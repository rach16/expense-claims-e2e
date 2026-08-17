import { readFile } from 'node:fs/promises'
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
 */
const DEAD_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJnb25lIn0.not-a-valid-signature'

test.describe('session expiry', () => {
  test.use({ storageState: `${AUTH_DIR}/submitter.json` })

  test('recovers silently when the access token has expired', async ({ page }) => {
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
  })

  test('redirects to login, preserving the destination, when refresh also fails', async ({
    page,
    context,
  }) => {
    const list = new ClaimsListPage(page)
    await list.goto()
    await expect(list.heading).toBeVisible()

    // both credentials are gone: expired access token AND no refresh cookie
    await page.evaluate((dead) => localStorage.setItem('accessToken', dead), DEAD_TOKEN)
    await context.clearCookies()

    await page.reload()

    await expect(page).toHaveURL(/\/login\?next=%2Fclaims/)

    // signing in returns the user where they were headed
    const meta = JSON.parse(await readFile(`${AUTH_DIR}/meta.json`, 'utf8')) as {
      emails: { submitter: string }
      password: string
    }
    await page.getByLabel('Email').fill(meta.emails.submitter)
    await page.getByLabel('Password').fill(meta.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(list.heading).toBeVisible()
  })
})
