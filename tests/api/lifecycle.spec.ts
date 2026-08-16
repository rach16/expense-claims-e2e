import type { APIRequestContext } from '@playwright/test'
import { aClaimBody, expect, test } from './fixtures.js'

async function createDraft(ctx: APIRequestContext): Promise<string> {
  const response = await ctx.post('/claims', { data: aClaimBody() })
  expect(response.status()).toBe(201)
  return (await response.json()).id
}

async function createSubmitted(ctx: APIRequestContext): Promise<string> {
  const id = await createDraft(ctx)
  const submitted = await ctx.post(`/claims/${id}/submit`)
  expect(submitted.status()).toBe(200)
  return id
}

test.describe('claim lifecycle', () => {
  test('submit moves a draft to submitted', async ({ asSubmitter }) => {
    const id = await createDraft(asSubmitter)
    const response = await asSubmitter.post(`/claims/${id}/submit`)
    expect(response.status()).toBe(200)
    expect((await response.json()).status).toBe('submitted')
  })

  test('a submitted claim can no longer be edited', async ({ asSubmitter }) => {
    const id = await createSubmitted(asSubmitter)
    const response = await asSubmitter.patch(`/claims/${id}`, { data: aClaimBody() })
    expect(response.status()).toBe(409)
  })

  test('a draft can be edited and the total recomputes', async ({ asSubmitter }) => {
    const id = await createDraft(asSubmitter)
    const response = await asSubmitter.patch(`/claims/${id}`, {
      data: aClaimBody({ items: [{ description: 'taxi', amountCents: 3300 }] }),
    })
    expect(response.status()).toBe(200)
    expect((await response.json()).totalCents).toBe(3300)
  })

  test('submitting twice conflicts', async ({ asSubmitter }) => {
    const id = await createSubmitted(asSubmitter)
    const again = await asSubmitter.post(`/claims/${id}/submit`)
    expect(again.status()).toBe(409)
  })

  test('approver approves a submitted claim', async ({ asSubmitter, asApprover }) => {
    const id = await createSubmitted(asSubmitter)
    const response = await asApprover.post(`/claims/${id}/decision`, {
      data: { decision: 'approved' },
    })
    expect(response.status()).toBe(200)
    expect((await response.json()).status).toBe('approved')
  })

  test('rejection records the reason', async ({ asSubmitter, asApprover }) => {
    const id = await createSubmitted(asSubmitter)
    const response = await asApprover.post(`/claims/${id}/decision`, {
      data: { decision: 'rejected', reason: 'missing receipts' },
    })
    expect(response.status()).toBe(200)
    const claim = await response.json()
    expect(claim.status).toBe('rejected')
    expect(claim.decisionReason).toBe('missing receipts')
  })

  test('a decision on a draft conflicts (STATE_SKIP trap)', async ({
    asSubmitter,
    asApprover,
  }) => {
    const id = await createDraft(asSubmitter)
    const response = await asApprover.post(`/claims/${id}/decision`, {
      data: { decision: 'approved' },
    })
    expect(response.status()).toBe(409)
  })

  test('a decided claim cannot be decided again', async ({ asSubmitter, asApprover }) => {
    const id = await createSubmitted(asSubmitter)
    const first = await asApprover.post(`/claims/${id}/decision`, {
      data: { decision: 'approved' },
    })
    expect(first.status()).toBe(200)
    const second = await asApprover.post(`/claims/${id}/decision`, {
      data: { decision: 'rejected' },
    })
    expect(second.status()).toBe(409)
  })

  test('a submitter cannot decide claims', async ({ asSubmitter }) => {
    const id = await createSubmitted(asSubmitter)
    const response = await asSubmitter.post(`/claims/${id}/decision`, {
      data: { decision: 'approved' },
    })
    expect(response.status()).toBe(403)
  })

  test('concurrent decisions: exactly one wins (RACE_DOUBLE_APPROVE trap)', async ({
    asSubmitter,
    asApprover,
    asAdmin,
  }) => {
    const id = await createSubmitted(asSubmitter)
    const [a, b] = await Promise.all([
      asApprover.post(`/claims/${id}/decision`, { data: { decision: 'approved' } }),
      asAdmin.post(`/claims/${id}/decision`, { data: { decision: 'rejected' } }),
    ])
    const statuses = [a.status(), b.status()].sort()
    expect(statuses).toEqual([200, 409])
  })
})
