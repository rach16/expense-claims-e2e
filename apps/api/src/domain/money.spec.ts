import { describe, expect, it } from 'vitest'
import { parseAmount, sumCents, formatCents } from './money.js'

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

describe('formatCents', () => {
  it('formats integer cents as a string with two decimal places', () => {
    expect(formatCents(1234)).toBe('12.34')
  })
  
  it('zero-pads amounts less than 10 cents', () => {
    expect(formatCents(5)).toBe('0.05')
  })
  it('formats zero cents as "0.00"', () => {
    expect(formatCents(0)).toBe('0.00')
  })
  it('handles large amounts correctly', () => {
    expect(formatCents(123456789)).toBe('1234567.89')
  })
  it('rejects non-integer amounts', () => {
    expect(() => formatCents(10.5)).toThrow()
  })
})

describe('parseAmount', () => {
  it('parses dollars and cents', () => {
    expect(parseAmount('12.34')).toBe(1234)
  })

  it('parses whole dollars without a decimal point', () => {
    expect(parseAmount('12')).toBe(1200)
  })

  it('treats one decimal digit as tenths', () => {
    expect(parseAmount('12.3')).toBe(1230)
  })

  it('parses the float-trap amount exactly', () => {
    expect(parseAmount('0.29')).toBe(29)
  })

  it('rejects non-numeric input', () => {
    expect(() => parseAmount('abc')).toThrow()
  })

  it('rejects empty input', () => {
    expect(() => parseAmount('')).toThrow()
  })

  it('rejects more than two decimal places', () => {
    expect(() => parseAmount('12.345')).toThrow()
  })

  it('rejects negative amounts', () => {
    expect(() => parseAmount('-5.00')).toThrow()
  })
})