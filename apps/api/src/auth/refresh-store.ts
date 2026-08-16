import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client.js'
import { refreshTokens } from '../db/schema.js'

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export interface IssuedRefreshToken {
  token: string
  familyId: string
  expiresAt: Date
}

export async function issueRefreshToken(
  db: Db,
  userId: string,
  familyId: string = randomUUID(),
): Promise<IssuedRefreshToken> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
  await db.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: sha256(token),
    expiresAt,
  })
  return { token, familyId, expiresAt }
}

export type RotationResult =
  | { ok: true; userId: string; next: IssuedRefreshToken }
  | { ok: false; reason: 'unknown' | 'expired' | 'reused' }

/**
 * Rotate a refresh token: the presented token is consumed and a new one from
 * the same family is issued. Presenting an already-consumed token is treated
 * as theft and revokes the entire family (reuse detection).
 */
export async function rotateRefreshToken(db: Db, presented: string): Promise<RotationResult> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, sha256(presented)))

  if (!row) return { ok: false, reason: 'unknown' }

  if (row.revokedAt) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)))
    return { ok: false, reason: 'reused' }
  }

  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' }

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, row.id))

  const next = await issueRefreshToken(db, row.userId, row.familyId)
  return { ok: true, userId: row.userId, next }
}

export async function revokeFamilyByToken(db: Db, presented: string): Promise<void> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, sha256(presented)))
  if (!row) return
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)))
}
