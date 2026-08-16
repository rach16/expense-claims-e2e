import type { ClaimDraft } from './claim.js'
import { sumCents } from './money.js'

export const MAX_TITLE_LENGTH = 120
export const MAX_ITEMS_PER_CLAIM = 20
export const MAX_CLAIM_TOTAL_CENTS = 1_000_000 // $10,000 policy cap

export interface ValidationError {
  field: string
  message: string
}

export function validateClaimDraft(draft: ClaimDraft): ValidationError[] {
  const errors: ValidationError[] = []

  if (draft.title.trim() === '') {
    errors.push({ field: 'title', message: 'title is required' })
  } else if (draft.title.length > MAX_TITLE_LENGTH) {
    errors.push({ field: 'title', message: `title must be at most ${MAX_TITLE_LENGTH} characters` })
  }

  if (draft.items.length === 0) {
    errors.push({ field: 'items', message: 'a claim needs at least one item' })
  } else if (draft.items.length > MAX_ITEMS_PER_CLAIM) {
    errors.push({ field: 'items', message: `a claim can have at most ${MAX_ITEMS_PER_CLAIM} items` })
  }

  draft.items.forEach((item, index) => {
    if (item.description.trim() === '') {
      errors.push({ field: `items[${index}].description`, message: 'description is required' })
    }
    if (!Number.isInteger(item.amountCents)) {
      errors.push({ field: `items[${index}].amountCents`, message: 'amount must be integer cents' })
    } else if (item.amountCents <= 0) {
      errors.push({ field: `items[${index}].amountCents`, message: 'amount must be positive' })
    }
  })

  const allAmountsValid = draft.items.every(
    (item) => Number.isInteger(item.amountCents) && item.amountCents > 0,
  )
  if (allAmountsValid && draft.items.length > 0) {
    const total = sumCents(draft.items.map((item) => item.amountCents))
    if (total > MAX_CLAIM_TOTAL_CENTS) {
      errors.push({ field: 'items', message: 'claim total exceeds the $10,000 policy cap' })
    }
  }

  return errors
}
