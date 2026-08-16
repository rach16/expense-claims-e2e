export interface ClaimItem {
  description: string
  amountCents: number
}

export interface ClaimDraft {
  title: string
  items: ClaimItem[]
}
