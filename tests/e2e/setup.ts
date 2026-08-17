import { mkdir, writeFile } from 'node:fs/promises'
import { request, test as setup } from '@playwright/test'

const API = 'http://localhost:3000'
const WEB = 'http://localhost:5173'
const PASSWORD = 'correct-horse-battery-staple'
const AUTH_DIR = 'playwright/.auth'

type Role = 'submitter' | 'approver' | 'admin'

setup('mint tenant, users, and per-role storage states', async ({ browser }) => {
  const stamp = `e2e-${Date.now()}`
  const emails: Record<Role, string> = {
    admin: `admin-${stamp}@test.local`,
    submitter: `submitter-${stamp}@test.local`,
    approver: `approver-${stamp}@test.local`,
  }

  const api = await request.newContext({ baseURL: API })

  // tenant + admin in one call, then the other roles via the admin
  const registered = await api.post('/auth/register', {
    data: { tenantName: `tenant-${stamp}`, email: emails.admin, password: PASSWORD },
  })
  const { accessToken: adminToken } = (await registered.json()) as { accessToken: string }
  for (const role of ['submitter', 'approver'] as const) {
    await api.post('/users', {
      headers: { authorization: `Bearer ${adminToken}` },
      data: { email: emails[role], password: PASSWORD, role },
    })
  }

  await mkdir(AUTH_DIR, { recursive: true })

  // storage state per role. The login runs INSIDE the browser context, not via
  // a separate API context — otherwise the httpOnly refresh cookie is set on
  // the wrong client and the saved state can never survive token expiry.
  for (const role of ['submitter', 'approver', 'admin'] as const) {
    const context = await browser.newContext({ baseURL: WEB })
    const page = await context.newPage()
    await page.goto('/login')

    const accessToken = await page.evaluate(async (creds) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(creds),
      })
      const body = (await response.json()) as { accessToken: string }
      return body.accessToken
    }, { email: emails[role], password: PASSWORD })

    await page.evaluate(
      ([token, r, email]) => {
        localStorage.setItem('accessToken', token!)
        localStorage.setItem('role', r!)
        localStorage.setItem('email', email!)
      },
      [accessToken, role, emails[role]],
    )
    // includes both localStorage and the httpOnly refresh cookie
    await context.storageState({ path: `${AUTH_DIR}/${role}.json` })
    await context.close()
  }

  await writeFile(`${AUTH_DIR}/meta.json`, JSON.stringify({ emails, password: PASSWORD }, null, 2))
  await api.dispose()
})
