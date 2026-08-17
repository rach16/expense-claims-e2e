import { isBugEnabled } from '../bugs.js'

export type ClaimStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

const ALLOWED: Record<ClaimStatus, readonly ClaimStatus[]> = {
  // BUG STATE_SKIP: lets a draft be approved without ever being submitted
  draft: isBugEnabled('STATE_SKIP') ? ['submitted', 'approved'] : ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

export const CLAIM_STATUSES = Object.keys(ALLOWED) as ClaimStatus[]

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return ALLOWED[from].includes(to)
}

export function assertTransition(from: ClaimStatus, to: ClaimStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`cannot transition claim from ${from} to ${to}`)
  }
}
