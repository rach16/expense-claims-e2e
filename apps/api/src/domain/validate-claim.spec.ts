import { describe, expect, it } from 'vitest'
import type { ClaimDraft, ClaimItem } from './claim.js'
import {
  MAX_CLAIM_TOTAL_CENTS,
  MAX_ITEMS_PER_CLAIM,
  MAX_TITLE_LENGTH,
  validateClaimDraft,
} from './validate-claim.js'

// tiny builder so each test states only what it cares about
function aDraft(overrides: Partial<ClaimDraft> = {}): ClaimDraft {
  return {
    title: 'Team lunch',
    items: [anItem()],
    ...overrides,
  }
}

function anItem(overrides: Partial<ClaimItem> = {}): ClaimItem {
  return { description: 'sandwiches', amountCents: 1250, ...overrides }
}

function fields(draft: ClaimDraft): string[] {
  return validateClaimDraft(draft).map((e) => e.field)
}

describe('validateClaimDraft', () => {
  it('accepts a well-formed draft', () => {
    expect(validateClaimDraft(aDraft())).toEqual([])
  })

  describe('title', () => {
    it('rejects an empty title', () => {
      expect(fields(aDraft({ title: '' }))).toContain('title')
    })

    it('rejects a whitespace-only title', () => {
      expect(fields(aDraft({ title: '   ' }))).toContain('title')
    })

    it('rejects a title over the length cap', () => {
      expect(fields(aDraft({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) }))).toContain('title')
    })

    it('accepts a title exactly at the length cap', () => {
      expect(fields(aDraft({ title: 'x'.repeat(MAX_TITLE_LENGTH) }))).toEqual([])
    })
  })

  describe('items', () => {
    it('rejects a claim with no items', () => {
      expect(fields(aDraft({ items: [] }))).toContain('items')
    })

    it('rejects a claim with too many items', () => {
      const items = Array.from({ length: MAX_ITEMS_PER_CLAIM + 1 }, () => anItem())
      expect(fields(aDraft({ items }))).toContain('items')
    })

    it('accepts exactly the maximum number of items', () => {
      const items = Array.from({ length: MAX_ITEMS_PER_CLAIM }, () => anItem({ amountCents: 100 }))
      expect(validateClaimDraft(aDraft({ items }))).toEqual([])
    })

    it('rejects an item with an empty description, naming the exact field', () => {
      const items = [anItem(), anItem({ description: ' ' })]
      expect(fields(aDraft({ items }))).toContain('items[1].description')
    })

    it('rejects a zero amount', () => {
      expect(fields(aDraft({ items: [anItem({ amountCents: 0 })] }))).toContain(
        'items[0].amountCents',
      )
    })

    it('rejects a negative amount', () => {
      expect(fields(aDraft({ items: [anItem({ amountCents: -500 })] }))).toContain(
        'items[0].amountCents',
      )
    })

    it('rejects a non-integer amount', () => {
      expect(fields(aDraft({ items: [anItem({ amountCents: 10.5 })] }))).toContain(
        'items[0].amountCents',
      )
    })
  })

  describe('policy cap', () => {
    it('rejects a total over the cap', () => {
      const items = [
        anItem({ amountCents: MAX_CLAIM_TOTAL_CENTS }),
        anItem({ amountCents: 1 }),
      ]
      expect(fields(aDraft({ items }))).toContain('items')
    })

    it('accepts a total exactly at the cap', () => {
      expect(
        validateClaimDraft(aDraft({ items: [anItem({ amountCents: MAX_CLAIM_TOTAL_CENTS })] })),
      ).toEqual([])
    })

    it('collects multiple errors in one pass instead of stopping at the first', () => {
      const draft = aDraft({ title: '', items: [anItem({ description: '', amountCents: -1 })] })
      const result = fields(draft)
      expect(result).toContain('title')
      expect(result).toContain('items[0].description')
      expect(result).toContain('items[0].amountCents')
    })
  })
})
