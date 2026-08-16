import { describe, expect, it } from 'vitest'

describe('toolchain sanity', () => {
  it('runs a typed test', () => {
    const sum = (a: number, b: number): number => a + b
    expect(sum(2, 3)).toBe(5)
  })
})