import { Type } from '@sinclair/typebox'
import { eq } from 'drizzle-orm'
import type { AppInstance } from '../types.js'
import { requireAuth } from '../auth/guard.js'
import { hashPassword, verifyPassword } from '../auth/passwords.js'
import { issueRefreshToken, revokeFamilyByToken, rotateRefreshToken } from '../auth/refresh-store.js'
import type { Role } from '../auth/tokens.js'
import { signAccessToken } from '../auth/tokens.js'
import { tenants, users } from '../db/schema.js'

const REFRESH_COOKIE = 'refresh_token'

const TokenResponse = Type.Object({
  accessToken: Type.String(),
})

const Credentials = Type.Object({
  email: Type.String({ format: 'email', maxLength: 254 }),
  password: Type.String({ minLength: 12, maxLength: 128 }),
})

export function authRoutes(app: AppInstance): void {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    // path '/' rather than '/auth': the browser reaches this API under a
    // proxy prefix (/api/auth/refresh), which would never match Path=/auth.
    // Scope is still tight — httpOnly, SameSite=Strict, secure in production.
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  } as const

  app.post(
    '/auth/register',
    {
      schema: {
        description: 'Create a tenant and its admin user',
        body: Type.Intersect([Credentials, Type.Object({ tenantName: Type.String({ minLength: 1, maxLength: 120 }) })]),
        response: { 201: TokenResponse, 409: Type.Object({ error: Type.String() }) },
      },
    },
    async (request, reply) => {
      const { tenantName, email, password } = request.body
      const existing = await app.db.select().from(users).where(eq(users.email, email))
      if (existing.length > 0) {
        return reply.code(409).send({ error: 'email already registered' })
      }
      const [tenant] = await app.db.insert(tenants).values({ name: tenantName }).returning()
      const [user] = await app.db
        .insert(users)
        .values({
          tenantId: tenant!.id,
          email,
          passwordHash: await hashPassword(password),
          role: 'admin',
        })
        .returning()

      const accessToken = await signAccessToken(
        { sub: user!.id, tenantId: tenant!.id, role: 'admin' },
        app.jwtSecret,
      )
      const refresh = await issueRefreshToken(app.db, user!.id)
      return reply
        .code(201)
        .setCookie(REFRESH_COOKIE, refresh.token, { ...cookieOptions, expires: refresh.expiresAt })
        .send({ accessToken })
    },
  )

  app.post(
    '/auth/login',
    {
      schema: {
        body: Credentials,
        response: { 200: TokenResponse, 401: Type.Object({ error: Type.String() }) },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body
      const [user] = await app.db.select().from(users).where(eq(users.email, email))
      // verify against a dummy hash on unknown email to keep timing uniform
      const ok = user
        ? await verifyPassword(user.passwordHash, password)
        : ((await hashPassword(password)), false)
      if (!ok || !user) {
        return reply.code(401).send({ error: 'invalid credentials' })
      }
      const accessToken = await signAccessToken(
        { sub: user.id, tenantId: user.tenantId, role: user.role as Role },
        app.jwtSecret,
      )
      const refresh = await issueRefreshToken(app.db, user.id)
      return reply
        .setCookie(REFRESH_COOKIE, refresh.token, { ...cookieOptions, expires: refresh.expiresAt })
        .send({ accessToken })
    },
  )

  app.post(
    '/auth/refresh',
    {
      schema: {
        response: { 200: TokenResponse, 401: Type.Object({ error: Type.String() }) },
      },
    },
    async (request, reply) => {
      const presented = request.cookies[REFRESH_COOKIE]
      if (!presented) return reply.code(401).send({ error: 'missing refresh token' })

      const result = await rotateRefreshToken(app.db, presented)
      if (!result.ok) {
        reply.clearCookie(REFRESH_COOKIE, cookieOptions)
        return reply.code(401).send({ error: `refresh token ${result.reason}` })
      }
      const [user] = await app.db.select().from(users).where(eq(users.id, result.userId))
      if (!user) return reply.code(401).send({ error: 'user no longer exists' })

      const accessToken = await signAccessToken(
        { sub: user.id, tenantId: user.tenantId, role: user.role as Role },
        app.jwtSecret,
      )
      return reply
        .setCookie(REFRESH_COOKIE, result.next.token, {
          ...cookieOptions,
          expires: result.next.expiresAt,
        })
        .send({ accessToken })
    },
  )

  app.post(
    '/auth/logout',
    { schema: { response: { 204: Type.Null() } } },
    async (request, reply) => {
      const presented = request.cookies[REFRESH_COOKIE]
      if (presented) await revokeFamilyByToken(app.db, presented)
      return reply.clearCookie(REFRESH_COOKIE, cookieOptions).code(204).send(null)
    },
  )

  app.get(
    '/me',
    {
      preHandler: [requireAuth],
      schema: {
        response: {
          200: Type.Object({
            id: Type.String(),
            email: Type.String(),
            role: Type.String(),
            tenantId: Type.String(),
          }),
          401: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const [user] = await app.db.select().from(users).where(eq(users.id, request.user.sub))
      if (!user) return reply.code(401).send({ error: 'user no longer exists' })
      return { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }
    },
  )
}
