import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import Fastify from 'fastify'
import { createDb, type Db } from './db/client.js'
import { authRoutes } from './routes/auth.js'
import { claimRoutes } from './routes/claims.js'
import { userRoutes } from './routes/users.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

export interface AppOptions {
  databaseUrl?: string
  jwtSecret?: string
}

export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  }).withTypeProvider<TypeBoxTypeProvider>()

  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required (set env var or pass jwtSecret option)')
  }
  app.decorate('jwtSecret', jwtSecret)

  if (options.databaseUrl) {
    const { db, sql } = createDb(options.databaseUrl)
    app.decorate('db', db)
    app.addHook('onClose', async () => {
      await sql.end()
    })
  }

  await app.register(cookie)
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'expense-claims API',
        version: '0.1.0',
      },
    },
  })

  app.get(
    '/health',
    {
      schema: {
        description: 'Liveness probe',
        response: {
          200: Type.Object({
            status: Type.Literal('ok'),
            uptimeSeconds: Type.Number(),
          }),
        },
      },
    },
    async () => ({ status: 'ok' as const, uptimeSeconds: process.uptime() }),
  )

  authRoutes(app)
  userRoutes(app)
  claimRoutes(app)

  return app
}
