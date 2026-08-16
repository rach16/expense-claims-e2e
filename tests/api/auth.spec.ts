import { request } from '@playwright/test'
import { expect, PASSWORD, test } from './fixtures.js'

test.describe('authentication', () => {
  test('rejects login with a wrong password', async ({ tenant }) => {
    const ctx = await request.newContext({ baseURL: 'http://localhost:3000' })
    const response = await ctx.post('/auth/login', {
      data: { email: tenant.adminEmail, password: 'definitely-not-the-password' },
    })
    expect(response.status()).toBe(401)
    await ctx.dispose()
  })

  test('rejects login for an unknown email', async ({ request }) => {
    const response = await request.post('/auth/login', {
      data: { email: 'ghost@test.local', password: PASSWORD },
    })
    expect(response.status()).toBe(401)
  })

  test('rejects duplicate registration with 409', async ({ tenant, request }) => {
    const response = await request.post('/auth/register', {
      data: { tenantName: 'imposter', email: tenant.adminEmail, password: PASSWORD },
    })
    expect(response.status()).toBe(409)
  })

  test('rejects /me without a token', async ({ request }) => {
    const response = await request.get('/me')
    expect(response.status()).toBe(401)
  })

  test('rejects a token with a forged signature', async ({ request }) => {
    const response = await request.get('/me', {
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged-signature' },
    })
    expect(response.status()).toBe(401)
  })

  test('returns the caller identity on /me', async ({ asApprover, tenant }) => {
    const response = await asApprover.get('/me')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.email).toBe(tenant.approverEmail)
    expect(body.role).toBe('approver')
  })
})

test.describe('refresh token rotation', () => {
  function refreshCookie(setCookieHeaders: string[]): string {
    const header = setCookieHeaders.find((h) => h.startsWith('refresh_token='))
    if (!header) throw new Error('no refresh_token cookie in response')
    return header.split(';')[0]!.split('=')[1]!
  }

  async function login(email: string) {
    const ctx = await request.newContext({ baseURL: 'http://localhost:3000' })
    const response = await ctx.post('/auth/login', { data: { email, password: PASSWORD } })
    const cookies = response
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
    await ctx.dispose()
    return refreshCookie(cookies)
  }

  async function refreshWith(token: string) {
    const ctx = await request.newContext({ baseURL: 'http://localhost:3000' })
    const response = await ctx.post('/auth/refresh', {
      headers: { cookie: `refresh_token=${token}` },
    })
    const status = response.status()
    const cookies = response
      .headersArray()
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value)
    await ctx.dispose()
    return { status, next: status === 200 ? refreshCookie(cookies) : null }
  }

  test('rotates: a refresh token works once and is replaced', async ({ tenant }) => {
    const first = await login(tenant.submitterEmail)
    const rotation = await refreshWith(first)
    expect(rotation.status).toBe(200)
    expect(rotation.next).not.toBe(first)
  })

  test('detects reuse: a consumed token revokes the whole family', async ({ tenant }) => {
    const first = await login(tenant.submitter2Email)
    const rotation = await refreshWith(first)
    expect(rotation.status).toBe(200)

    // replay the consumed token — theft signal
    const replay = await refreshWith(first)
    expect(replay.status).toBe(401)

    // the legitimately-issued successor must now be dead too
    const successor = await refreshWith(rotation.next!)
    expect(successor.status).toBe(401)
  })
})
