import swagger from '@fastify/swagger'
import { type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import Fastify from 'fastify'

export interface AppOptions {
  databaseUrl?: string
}

export async function buildApp(_options: AppOptions = {}) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  }).withTypeProvider<TypeBoxTypeProvider>()

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

  return app
}
