import { describe, expect, it } from 'vitest'
import { sumCents } from './money.js'

describe('sumCents', () => {
  it('sums integer cents exactly', () => {
    expect(sumCents([1010, 2020, 3030])).toBe(6060)
  })

  it('returns 0 for an empty list', () => {
    expect(sumCents([])).toBe(0)
  })

  it('rejects non-integer amounts', () => {
    expect(() => sumCents([10.5])).toThrow()
  })
})
