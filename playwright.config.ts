import { defineConfig, devices } from '@playwright/test'

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://claims:claims_local_dev@localhost:5432/claims'

const WEB_URL = 'http://localhost:5173'

/** nightly adds Firefox/WebKit/mobile; PRs stay on Chromium for speed */
const browserProjects = process.env.ALL_BROWSERS
  ? [
      { name: 'chromium', device: devices['Desktop Chrome'] },
      { name: 'firefox', device: devices['Desktop Firefox'] },
      { name: 'webkit', device: devices['Desktop Safari'] },
      { name: 'mobile-chrome', device: devices['Pixel 7'] },
    ]
  : [{ name: 'chromium', device: devices['Desktop Chrome'] }]

export default defineConfig({
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // fail fast on a broken PR, but never mask a systemic failure as one flake
  maxFailures: process.env.CI ? 10 : 0,
  forbidOnly: !!process.env.CI,
  // blob on CI so shards can be merged into one report; readable output locally
  reporter: process.env.CI
    ? [['blob'], ['github'], ['list']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
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
    ...browserProjects.map(({ name, device }) => ({
      name,
      testDir: 'tests/e2e',
      testIgnore: /setup\.ts/,
      dependencies: ['e2e-setup'],
      use: { ...device, baseURL: WEB_URL },
    })),
  ],
  webServer: [
    {
      command: 'npm run start --workspace @expense-claims/api',
      url: 'http://localhost:3000/health',
      // the detection matrix must never reuse a server booted without its flags
      reuseExistingServer: !process.env.CI && !process.env.DETECTION_MATRIX,
      env: {
        DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET ?? 'local-test-secret',
        NODE_ENV: 'test',
        BUGS: process.env.BUGS ?? '',
      },
    },
    {
      command: 'npm run dev --workspace @expense-claims/web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI && !process.env.DETECTION_MATRIX,
      env: {
        VITE_BUGS: process.env.VITE_BUGS ?? '',
      },
    },
  ],
})
