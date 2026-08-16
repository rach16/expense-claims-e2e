import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AccessTokenClaims, Role } from './tokens.js'
import { verifyAccessToken } from './tokens.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: AccessTokenClaims
  }
  interface FastifyInstance {
    jwtSecret: string
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'missing bearer token' })
  }
  try {
    request.user = await verifyAccessToken(header.slice(7), request.server.jwtSecret)
  } catch {
    return reply.code(401).send({ error: 'invalid or expired token' })
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'insufficient role' })
    }
  }
}
