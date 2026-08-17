import { isBugEnabled } from '../bugs.js'

export function sumCents(amounts: number[]): number {
    for (const amount of amounts) {
    if(!Number.isInteger(amount)) {
        throw new TypeError(`Amount ${amount} is not an integer`)
    }
}
if (isBugEnabled('MONEY_ROUNDING')) {
    // BUG MONEY_ROUNDING: sums via floating-point dollars — IEEE-754 noise
    return amounts.reduce((total, amount) => total + amount / 100, 0) * 100
}
return amounts.reduce((total, amount) => total + amount, 0)
  }

export function formatCents(cents: number): string {
    if(!Number.isInteger(cents)) {
        throw new TypeError(`Amount ${cents} is not an integer`)
    }
    const dollars = Math.floor(cents / 100)
    const remainder = cents % 100
    const paddedCents = String(remainder).padStart(2, '0')
    return `${dollars}.${paddedCents}`
}

export function parseAmount(amount: string): number {
    const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

  if (!AMOUNT_PATTERN.test(amount)) {
    throw new TypeError(`invalid amount: "${amount}"`)
  }
  const [dollarPart, centPart] = amount.split('.')
  const paddedCents = (centPart ?? '0').padEnd(2, '0')
  return Number(dollarPart) * 100 + Number(paddedCents)
}
