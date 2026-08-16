import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify'

/**
 * FastifyInstance with the TypeBox type provider attached, so route modules
 * keep schema-derived typing for request.body/params/reply.
 */
export type AppInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>
