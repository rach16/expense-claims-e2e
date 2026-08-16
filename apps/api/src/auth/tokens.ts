import { jwtVerify, SignJWT } from 'jose'

export type Role = 'submitter' | 'approver' | 'admin'

export interface AccessTokenClaims {
  sub: string // user id
  tenantId: string
  role: Role
}

const ACCESS_TOKEN_TTL = '5m'

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(claims: AccessTokenClaims, secret: string): Promise<string> {
  return new SignJWT({ tenantId: claims.tenantId, role: claims.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(key(secret))
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'] })
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.tenantId !== 'string' ||
    typeof payload.role !== 'string'
  ) {
    throw new Error('malformed access token payload')
  }
  return { sub: payload.sub, tenantId: payload.tenantId, role: payload.role as Role }
}
