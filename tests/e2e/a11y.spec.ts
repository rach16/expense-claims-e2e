import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { AUTH_DIR, expect, test } from './fixtures.js'

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.description}`)
}

test.describe('accessibility — zero serious/critical violations', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login')
    expect(await seriousViolations(page)).toEqual([])
  })

  test.describe('authenticated pages', () => {
    test.use({ storageState: `${AUTH_DIR}/submitter.json` })

    test('claims list', async ({ page }) => {
      await page.goto('/claims')
      await expect(page.getByRole('heading', { name: 'My claims' })).toBeVisible()
      expect(await seriousViolations(page)).toEqual([])
    })

    test('claim editor', async ({ page }) => {
      await page.goto('/claims/new')
      await expect(page.getByRole('heading', { name: 'New claim' })).toBeVisible()
      expect(await seriousViolations(page)).toEqual([])
    })
  })

  test.describe('approver pages', () => {
    test.use({ storageState: `${AUTH_DIR}/approver.json` })

    test('approval queue', async ({ page }) => {
      await page.goto('/queue')
      await expect(page.getByRole('heading', { name: 'Approval queue' })).toBeVisible()
      expect(await seriousViolations(page)).toEqual([])
    })
  })
})
