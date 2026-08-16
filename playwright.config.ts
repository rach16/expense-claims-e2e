import { defineConfig, devices } from '@playwright/test'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://claims:claims_local_dev@localhost:5432/claims'

export default defineConfig({
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api',
      testDir: 'tests/api',
    },
    {
      name: 'e2e-setup',
      testDir: 'tests/e2e',
      testMatch: /setup\.ts/,
    },
    {
      name: 'chromium',
      testDir: 'tests/e2e',
      testIgnore: /setup\.ts/,
      dependencies: ['e2e-setup'],
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173' },
    },
  ],
  webServer: [
    {
      command: 'npm run start --workspace @expense-claims/api',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET ?? 'local-test-secret',
        NODE_ENV: 'test',
      },
    },
    {
      command: 'npm run dev --workspace @expense-claims/web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
