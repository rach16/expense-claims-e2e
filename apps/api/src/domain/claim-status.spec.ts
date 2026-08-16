import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition, type ClaimStatus } from './claim-status.js'

const VALID: [ClaimStatus, ClaimStatus][] = [
  ['draft', 'submitted'],
  ['submitted', 'approved'],
  ['submitted', 'rejected'],
]

// every other cell of the 4×4 matrix — exhaustive by construction
const ALL: ClaimStatus[] = ['draft', 'submitted', 'approved', 'rejected']
const INVALID: [ClaimStatus, ClaimStatus][] = ALL.flatMap((from) =>
  ALL.map((to): [ClaimStatus, ClaimStatus] => [from, to]),
).filter(([from, to]) => !VALID.some(([f, t]) => f === from && t === to))

describe('canTransition', () => {
  it.each(VALID)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it.each(INVALID)('forbids %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
  })

  it('covers the complete transition matrix', () => {
    expect(VALID.length + INVALID.length).toBe(ALL.length * ALL.length)
  })
})

describe('assertTransition', () => {
  it('does not throw for a valid transition', () => {
    assertTransition('draft', 'submitted')
  })

  it.each(INVALID)('throws for %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(/cannot transition/)
  })
})
