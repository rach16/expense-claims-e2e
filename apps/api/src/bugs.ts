/**
 * Seeded-bug registry. Each flag switches ONE deliberate defect on, so the
 * detection matrix can prove the test suite catches it. Enabled via env:
 *   BUGS=STATE_SKIP,IDOR_CLAIM_READ
 * Flags are read at call time; NODE_ENV gating is intentionally absent so the
 * matrix can exercise the real server exactly as deployed.
 */
export const BUG_FLAGS = [
  'MONEY_ROUNDING',
  'STATE_SKIP',
  'IDOR_CLAIM_READ',
  'PAGINATION_OFF_BY_ONE',
  'RACE_DOUBLE_APPROVE',
] as const

export type BugFlag = (typeof BUG_FLAGS)[number]

export function isBugEnabled(flag: BugFlag): boolean {
  const raw = process.env.BUGS ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .includes(flag)
}
