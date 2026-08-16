const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

export function formatCents(cents: number): string {
  const dollars = Math.trunc(cents / 100)
  const remainder = String(cents % 100).padStart(2, '0')
  return `$${dollars}.${remainder}`
}

/** mirrors the API's parseAmount: string-split, never float math */
export function parseDollarsToCents(input: string): number | null {
  if (!AMOUNT_PATTERN.test(input)) return null
  const [dollarPart, centPart] = input.split('.')
  const padded = (centPart ?? '0').padEnd(2, '0')
  return Number(dollarPart) * 100 + Number(padded)
}
