import { expect, test } from '@playwright/test'

test('browser launches and renders HTML', async ({ page }) => {
  await page.setContent('<h1>hello</h1>')
  await expect(page.locator('h1')).toHaveText('hello')
})