import { Type } from '@sinclair/typebox'
import { eq } from 'drizzle-orm'
import type { AppInstance } from '../types.js'
import { requireAuth, requireRole } from '../auth/guard.js'
import { hashPassword } from '../auth/passwords.js'
import { users } from '../db/schema.js'

export function userRoutes(app: AppInstance): void {
  app.post(
    '/users',
    {
      preHandler: [requireAuth, requireRole('admin')],
      schema: {
        description: 'Admin creates a user inside their own tenant',
        body: Type.Object({
          email: Type.String({ format: 'email', maxLength: 254 }),
          password: Type.String({ minLength: 12, maxLength: 128 }),
          role: Type.Union([
            Type.Literal('submitter'),
            Type.Literal('approver'),
            Type.Literal('admin'),
          ]),
        }),
        response: {
          201: Type.Object({ id: Type.String(), email: Type.String(), role: Type.String() }),
          409: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const { email, password, role } = request.body
      const existing = await app.db.select().from(users).where(eq(users.email, email))
      if (existing.length > 0) return reply.code(409).send({ error: 'email already registered' })

      const [user] = await app.db
        .insert(users)
        .values({
          tenantId: request.user.tenantId,
          email,
          passwordHash: await hashPassword(password),
          role,
        })
        .returning()
      return reply.code(201).send({ id: user!.id, email: user!.email, role: user!.role })
    },
  )
}
