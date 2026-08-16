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

  // storage state per role: login via API (fast), plant the session the way
  // the app itself stores it, save the browser state for tests to reuse
  for (const role of ['submitter', 'approver', 'admin'] as const) {
    const login = await api.post('/auth/login', {
      data: { email: emails[role], password: PASSWORD },
    })
    const { accessToken } = (await login.json()) as { accessToken: string }

    const context = await browser.newContext({ baseURL: WEB })
    const page = await context.newPage()
    await page.goto('/login')
    await page.evaluate(
      ([token, r, email]) => {
        localStorage.setItem('accessToken', token!)
        localStorage.setItem('role', r!)
        localStorage.setItem('email', email!)
      },
      [accessToken, role, emails[role]],
    )
    await context.storageState({ path: `${AUTH_DIR}/${role}.json` })
    await context.close()
  }

  await writeFile(`${AUTH_DIR}/meta.json`, JSON.stringify({ emails, password: PASSWORD }, null, 2))
  await api.dispose()
})
