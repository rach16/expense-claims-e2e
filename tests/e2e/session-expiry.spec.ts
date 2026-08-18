import { readFile } from 'node:fs/promises'
import type { Browser, Page } from '@playwright/test'
import { request } from '@playwright/test'
import { AUTH_DIR, expect, test } from './fixtures.js'
import { ClaimEditorPage } from './pages/claim-editor-page.js'
import { ClaimsListPage } from './pages/claims-list-page.js'

/**
 * Access tokens expire after 5 minutes. These tests pin that moment instead of
 * waiting for it: plant a dead access token, act, and assert the app recovers
 * by spending the refresh cookie it already holds.
 *
 * Found by exploratory testing, not by the suite — every other E2E test runs
 * seconds after minting a token, so none of them could ever observe expiry.
 *
 * IMPORTANT: these tests do NOT reuse the shared per-role storageState. A
 * refresh token is a one-time credential — rotation plus reuse detection means
 * the first consumer rotates it and every later consumer looks like a thief.
 * Sharing it across browser projects made this suite fail in nightly while
 * passing on Chromium alone. Each test mints its own user and its own session.
 */
const DEAD_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJnb25lIn0.not-a-valid-signature'
const PASSWORD = 'correct-horse-battery-staple'

async function ownSession(browser: Browser): Promise<Page> {
  const meta = JSON.parse(await readFile(`${AUTH_DIR}/meta.json`, 'utf8')) as {
    emails: { admin: string }
    password: string
  }

  // a dedicated submitter, so this test owns its refresh-token family outright
  const api = await request.newContext({ baseURL: 'http://localhost:3000' })
  const login = await api.post('/auth/login', {
    data: { email: meta.emails.admin, password: meta.password },
  })
  const { accessToken } = (await login.json()) as { accessToken: string }
  const email = `expiry-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`
  await api.post('/users', {
    headers: { authorization: `Bearer ${accessToken}` },
    data: { email, password: PASSWORD, role: 'submitter' },
  })
  await api.dispose()

  // log in through the browser so the httpOnly refresh cookie lands here
  const context = await browser.newContext({ baseURL: 'http://localhost:5173' })
  const page = await context.newPage()
  await page.goto('/login')
  const token = await page.evaluate(async (creds) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(creds),
    })
    return ((await response.json()) as { accessToken: string }).accessToken
  }, { email, password: PASSWORD })
  await page.evaluate(
    ([t, e]) => {
      localStorage.setItem('accessToken', t!)
      localStorage.setItem('role', 'submitter')
      localStorage.setItem('email', e!)
    },
    [token, email],
  )
  return page
}

test.describe('session expiry', () => {
  test('recovers silently when the access token has expired', async ({ browser }) => {
    const page = await ownSession(browser)
    const list = new ClaimsListPage(page)
    const editor = new ClaimEditorPage(page)

    await list.goto()
    await expect(list.heading).toBeVisible()

    // the access token dies mid-session; the refresh cookie is still valid
    await page.evaluate((dead) => localStorage.setItem('accessToken', dead), DEAD_TOKEN)

    const title = `Expiry ${Date.now()}`
    await list.startNewClaim()
    await editor.setTitle(title)
    await editor.setItem(0, 'taxi', '18.00')
    await editor.saveDraft()

    // no error, no bounce to login: the client refreshed and replayed the save
    await expect(editor.errors).toHaveCount(0)
    await expect(page).toHaveURL(/\/claims\/[0-9a-f-]{36}$/)

    await list.goto()
    await expect(list.row(title)).toContainText('$18.00')

    // and the stored token was actually replaced
    const token = await page.evaluate(() => localStorage.getItem('accessToken'))
    expect(token).not.toBe(DEAD_TOKEN)

    await page.context().close()
  })

  test('redirects to login, preserving the destination, when refresh also fails', async ({
    browser,
  }) => {
    const page = await ownSession(browser)
    const list = new ClaimsListPage(page)
    await list.goto()
    await expect(list.heading).toBeVisible()

    // both credentials are gone: expired access token AND no refresh cookie
    await page.evaluate((dead) => localStorage.setItem('accessToken', dead), DEAD_TOKEN)
    await page.context().clearCookies()

    await page.reload()
    await expect(page).toHaveURL(/\/login\?next=%2Fclaims/)

    await page.context().close()
  })
})
