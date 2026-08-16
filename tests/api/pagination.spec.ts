import { aClaimBody, expect, newIsolatedUser, test } from './fixtures.js'

test.describe('claims listing & pagination', () => {
  test('pages are exact, disjoint, and complete', async ({ asAdmin }) => {
    // a fresh submitter so this test owns every claim it can see
    const ctx = await newIsolatedUser(asAdmin, 'submitter')
    const created: string[] = []
    for (let i = 0; i < 25; i++) {
      const response = await ctx.post('/claims', {
        data: aClaimBody({ title: `claim ${i}` }),
      })
      created.push((await response.json()).id)
    }

    const page1 = await (await ctx.get('/claims?page=1&pageSize=20')).json()
    expect(page1.total).toBe(25)
    expect(page1.items).toHaveLength(20)

    const page2 = await (await ctx.get('/claims?page=2&pageSize=20')).json()
    expect(page2.items).toHaveLength(5) // the off-by-one trap: not 4, not 6

    const seen = new Set([...page1.items, ...page2.items].map((c: { id: string }) => c.id))
    expect(seen.size).toBe(25) // disjoint pages, nothing duplicated or dropped
    for (const id of created) expect(seen.has(id)).toBe(true)

    await ctx.dispose()
  })

  test('status filter returns only matching claims', async ({ asAdmin }) => {
    const ctx = await newIsolatedUser(asAdmin, 'submitter')
    const draft = await (await ctx.post('/claims', { data: aClaimBody() })).json()
    const toSubmit = await (await ctx.post('/claims', { data: aClaimBody() })).json()
    await ctx.post(`/claims/${toSubmit.id}/submit`)

    const drafts = await (await ctx.get('/claims?status=draft&page=1&pageSize=20')).json()
    expect(drafts.total).toBe(1)
    expect(drafts.items[0].id).toBe(draft.id)

    const submitted = await (await ctx.get('/claims?status=submitted&page=1&pageSize=20')).json()
    expect(submitted.total).toBe(1)
    expect(submitted.items[0].id).toBe(toSubmit.id)

    await ctx.dispose()
  })

  test('a submitter sees only their own claims in the list', async ({
    asSubmitter,
    asSubmitter2,
  }) => {
    const mine = await (await asSubmitter.post('/claims', { data: aClaimBody() })).json()
    await asSubmitter2.post('/claims', { data: aClaimBody() })

    const list = await (await asSubmitter.get('/claims?page=1&pageSize=100')).json()
    const ids = list.items.map((c: { id: string }) => c.id)
    expect(ids).toContain(mine.id)

    const list2 = await (await asSubmitter2.get('/claims?page=1&pageSize=100')).json()
    const ids2 = list2.items.map((c: { id: string }) => c.id)
    for (const id of ids2) expect(ids).not.toContain(id)
  })
})
