import { test as base, request, type APIRequestContext } from '@playwright/test'

export interface TenantHandle {
  name: string
  adminEmail: string
  submitterEmail: string
  submitter2Email: string
  approverEmail: string
  password: string
}

interface ApiWorkerFixtures {
  tenant: TenantHandle
  otherTenant: TenantHandle
  asAdmin: APIRequestContext
  asSubmitter: APIRequestContext
  asSubmitter2: APIRequestContext
  asApprover: APIRequestContext
  asOtherTenantUser: APIRequestContext
}

export const PASSWORD = 'correct-horse-battery-staple'
const BASE_URL = 'http://localhost:3000'

async function registerTenant(name: string, adminEmail: string): Promise<string> {
  const ctx = await request.newContext({ baseURL: BASE_URL })
  const response = await ctx.post('/auth/register', {
    data: { tenantName: name, email: adminEmail, password: PASSWORD },
  })
  if (response.status() !== 201) {
    throw new Error(`tenant registration failed: ${response.status()} ${await response.text()}`)
  }
  const { accessToken } = (await response.json()) as { accessToken: string }
  await ctx.dispose()
  return accessToken
}

async function createUser(
  adminToken: string,
  email: string,
  role: 'submitter' | 'approver' | 'admin',
): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL })
  const response = await ctx.post('/users', {
    headers: { authorization: `Bearer ${adminToken}` },
    data: { email, password: PASSWORD, role },
  })
  if (response.status() !== 201) {
    throw new Error(`user creation failed: ${response.status()} ${await response.text()}`)
  }
  await ctx.dispose()
}

export async function loginContext(email: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE_URL })
  const response = await ctx.post('/auth/login', { data: { email, password: PASSWORD } })
  if (response.status() !== 200) {
    throw new Error(`login failed for ${email}: ${response.status()}`)
  }
  const { accessToken } = (await response.json()) as { accessToken: string }
  await ctx.dispose()
  return request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { authorization: `Bearer ${accessToken}` },
  })
}

/**
 * Worker-scoped isolation: each Playwright worker gets its own tenant (plus a
 * second tenant for cross-tenant tests). Tests inside a worker share the
 * tenant but create their own claims — a test asserts only on data it created.
 */
export const test = base.extend<Record<never, never>, ApiWorkerFixtures>({
  tenant: [
    async ({}, use, workerInfo) => {
      const stamp = `w${workerInfo.workerIndex}-${Date.now()}`
      const tenant: TenantHandle = {
        name: `tenant-${stamp}`,
        adminEmail: `admin-${stamp}@test.local`,
        submitterEmail: `submitter-${stamp}@test.local`,
        submitter2Email: `submitter2-${stamp}@test.local`,
        approverEmail: `approver-${stamp}@test.local`,
        password: PASSWORD,
      }
      const adminToken = await registerTenant(tenant.name, tenant.adminEmail)
      await createUser(adminToken, tenant.submitterEmail, 'submitter')
      await createUser(adminToken, tenant.submitter2Email, 'submitter')
      await createUser(adminToken, tenant.approverEmail, 'approver')
      await use(tenant)
    },
    { scope: 'worker' },
  ],

  otherTenant: [
    async ({}, use, workerInfo) => {
      const stamp = `w${workerInfo.workerIndex}-other-${Date.now()}`
      const tenant: TenantHandle = {
        name: `tenant-${stamp}`,
        adminEmail: `admin-${stamp}@test.local`,
        submitterEmail: `submitter-${stamp}@test.local`,
        submitter2Email: `unused-${stamp}@test.local`,
        approverEmail: `unused2-${stamp}@test.local`,
        password: PASSWORD,
      }
      const adminToken = await registerTenant(tenant.name, tenant.adminEmail)
      await createUser(adminToken, tenant.submitterEmail, 'submitter')
      await use(tenant)
    },
    { scope: 'worker' },
  ],

  asAdmin: [
    async ({ tenant }, use) => {
      const ctx = await loginContext(tenant.adminEmail)
      await use(ctx)
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],

  asSubmitter: [
    async ({ tenant }, use) => {
      const ctx = await loginContext(tenant.submitterEmail)
      await use(ctx)
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],

  asSubmitter2: [
    async ({ tenant }, use) => {
      const ctx = await loginContext(tenant.submitter2Email)
      await use(ctx)
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],

  asApprover: [
    async ({ tenant }, use) => {
      const ctx = await loginContext(tenant.approverEmail)
      await use(ctx)
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],

  asOtherTenantUser: [
    async ({ otherTenant }, use) => {
      const ctx = await loginContext(otherTenant.submitterEmail)
      await use(ctx)
      await ctx.dispose()
    },
    { scope: 'worker' },
  ],
})

export { expect } from '@playwright/test'

/**
 * Create a brand-new user in the admin's tenant and return an authenticated
 * context for them — for tests that must own ALL data they can see (e.g.
 * pagination counts).
 */
export async function newIsolatedUser(
  asAdmin: APIRequestContext,
  role: 'submitter' | 'approver',
): Promise<APIRequestContext> {
  const email = `isolated-${role}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`
  const created = await asAdmin.post('/users', {
    data: { email, password: PASSWORD, role },
  })
  if (created.status() !== 201) {
    throw new Error(`isolated user creation failed: ${created.status()}`)
  }
  return loginContext(email)
}

/** claim builder for API tests — same vocabulary as the unit-test builders */
export function aClaimBody(overrides: Partial<{ title: string; items: unknown[] }> = {}) {
  return {
    title: 'Team lunch',
    items: [{ description: 'sandwiches', amountCents: 1250 }],
    ...overrides,
  }
}
