import { aClaimBody, expect, test } from './fixtures.js'

test.describe('claims — create and read', () => {
  test('creates a draft claim with a computed total', async ({ asSubmitter }) => {
    const response = await asSubmitter.post('/claims', {
      data: aClaimBody({
        items: [
          { description: 'sandwiches', amountCents: 1250 },
          { description: 'coffee', amountCents: 450 },
        ],
      }),
    })
    expect(response.status()).toBe(201)
    const claim = await response.json()
    expect(claim.status).toBe('draft')
    expect(claim.totalCents).toBe(1700)
    expect(claim.items).toHaveLength(2)
  })

  test('returns all validation errors in one 400', async ({ asSubmitter }) => {
    const response = await asSubmitter.post('/claims', {
      data: { title: '', items: [{ description: '', amountCents: -5 }] },
    })
    expect(response.status()).toBe(400)
    const { errors } = await response.json()
    const fields = errors.map((e: { field: string }) => e.field)
    expect(fields).toContain('title')
    expect(fields).toContain('items[0].description')
    expect(fields).toContain('items[0].amountCents')
  })

  test('owner can read their claim back', async ({ asSubmitter }) => {
    const created = await asSubmitter.post('/claims', { data: aClaimBody() })
    const { id } = await created.json()

    const read = await asSubmitter.get(`/claims/${id}`)
    expect(read.status()).toBe(200)
    expect((await read.json()).id).toBe(id)
  })

  test('approver can read a submitter claim in the same tenant', async ({
    asSubmitter,
    asApprover,
  }) => {
    const created = await asSubmitter.post('/claims', { data: aClaimBody() })
    const { id } = await created.json()

    const read = await asApprover.get(`/claims/${id}`)
    expect(read.status()).toBe(200)
  })

  test('IDOR: a user from another tenant gets 404, not 403', async ({
    asSubmitter,
    asOtherTenantUser,
  }) => {
    const created = await asSubmitter.post('/claims', { data: aClaimBody() })
    const { id } = await created.json()

    const read = await asOtherTenantUser.get(`/claims/${id}`)
    expect(read.status()).toBe(404) // existence must not leak across tenants
  })

  test('a submitter cannot read a colleague’s claim', async ({ asSubmitter, asSubmitter2 }) => {
    const created = await asSubmitter.post('/claims', { data: aClaimBody() })
    const { id } = await created.json()

    const read = await asSubmitter2.get(`/claims/${id}`)
    expect(read.status()).toBe(404)
  })

  test('rejects a malformed claim id at the schema layer', async ({ asSubmitter }) => {
    const response = await asSubmitter.get('/claims/not-a-uuid')
    expect(response.status()).toBe(400)
  })
})

test.describe('role matrix — user administration', () => {
  const attempt = (role: string) =>
    ({ email: `newuser-${role}-${Date.now()}@test.local`, password: 'a-long-enough-password', role: 'submitter' }) as const

  test('admin can create users', async ({ asAdmin }) => {
    const response = await asAdmin.post('/users', { data: attempt('via-admin') })
    expect(response.status()).toBe(201)
  })

  test('approver cannot create users', async ({ asApprover }) => {
    const response = await asApprover.post('/users', { data: attempt('via-approver') })
    expect(response.status()).toBe(403)
  })

  test('submitter cannot create users', async ({ asSubmitter }) => {
    const response = await asSubmitter.post('/users', { data: attempt('via-submitter') })
    expect(response.status()).toBe(403)
  })

  test('unauthenticated caller cannot create users', async ({ request }) => {
    const response = await request.post('/users', { data: attempt('via-anon') })
    expect(response.status()).toBe(401)
  })
})
