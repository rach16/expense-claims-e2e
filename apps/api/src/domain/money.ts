export function sumCents(amounts: number[]): number {
    for (const amount of amounts) {
    if(!Number.isInteger(amount)) {
        throw new TypeError(`Amount ${amount} is not an integer`)
    }
}
return amounts.reduce((total, amount) => total + amount, 0)
  }