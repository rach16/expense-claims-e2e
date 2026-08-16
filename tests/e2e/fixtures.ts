import { test as base } from '@playwright/test'

/**
 * Console guard: any uncaught page error fails the test that caused it.
 * A journey that "passes" while the app throws in the background is a lie.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: Error[] = []
    page.on('pageerror', (error) => errors.push(error))
    await use(page)
    if (errors.length > 0) {
      throw new Error(`uncaught page error(s):\n${errors.map((e) => e.message).join('\n')}`)
    }
  },
})

export { expect } from '@playwright/test'

export const AUTH_DIR = 'playwright/.auth'
