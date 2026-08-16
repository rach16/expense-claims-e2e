import { readFile } from 'node:fs/promises'
import { AUTH_DIR, expect, test } from './fixtures.js'
import { LoginPage } from './pages/login-page.js'

// the ONE test that drives the real login form; every other test reuses
// storage state minted via the API
test.describe('login form', () => {
  test('rejects invalid credentials with a visible error', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signIn('ghost@test.local', 'definitely-wrong-pw')
    await expect(login.error).toContainText('Invalid email or password')
  })

  test('signs a submitter in and lands on their claims', async ({ page }) => {
    const meta = JSON.parse(await readFile(`${AUTH_DIR}/meta.json`, 'utf8')) as {
      emails: { submitter: string }
      password: string
    }
    const login = new LoginPage(page)
    await login.goto()
    await login.signIn(meta.emails.submitter, meta.password)
    await expect(page.getByRole('heading', { name: 'My claims' })).toBeVisible()
  })
})
