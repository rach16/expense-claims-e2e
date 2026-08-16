import { AUTH_DIR, expect, test } from './fixtures.js'
import { ClaimEditorPage } from './pages/claim-editor-page.js'
import { ClaimsListPage } from './pages/claims-list-page.js'

test.use({ storageState: `${AUTH_DIR}/submitter.json` })

function uniqueTitle(label: string): string {
  return `${label} ${Date.now()}-${Math.floor(Math.random() * 1e5)}`
}

test.describe('claim drafting', () => {
  test('creates a draft with a computed total', async ({ page }) => {
    const list = new ClaimsListPage(page)
    const editor = new ClaimEditorPage(page)
    const title = uniqueTitle('Lunch')

    await list.goto()
    await list.startNewClaim()
    await editor.setTitle(title)
    await editor.setItem(0, 'sandwiches', '12.34')
    await editor.addItem()
    await editor.setItem(1, 'coffee', '0.29')
    await expect(editor.total).toHaveText('Total: $12.63')
    await editor.saveDraft()

    await expect(page).toHaveURL(/\/claims\/[0-9a-f-]{36}$/)
    await expect(editor.status).toHaveText('draft')

    await list.goto()
    await expect(list.row(title)).toContainText('$12.63')
  })

  test('surfaces every validation error at once', async ({ page }) => {
    const list = new ClaimsListPage(page)
    const editor = new ClaimEditorPage(page)

    await list.goto()
    await list.startNewClaim()
    await editor.setItem(0, '', '5.00')
    await editor.saveDraft()

    await expect(editor.errors).toContainText('title')
    await expect(editor.errors).toContainText('description')
  })

  test('rejects malformed amounts before hitting the API', async ({ page }) => {
    const list = new ClaimsListPage(page)
    const editor = new ClaimEditorPage(page)

    await list.goto()
    await list.startNewClaim()
    await editor.setTitle(uniqueTitle('Bad amount'))
    await editor.setItem(0, 'mystery', 'abc')
    await editor.saveDraft()

    await expect(editor.errors).toContainText('Amounts must look like')
  })

  test('editing a draft recomputes the total after removing an item', async ({ page }) => {
    const list = new ClaimsListPage(page)
    const editor = new ClaimEditorPage(page)
    const title = uniqueTitle('Edit me')

    await list.goto()
    await list.startNewClaim()
    await editor.setTitle(title)
    await editor.setItem(0, 'hotel', '100.00')
    await editor.addItem()
    await editor.setItem(1, 'minibar', '25.00')
    await editor.saveDraft()
    await expect(editor.total).toHaveText('Total: $125.00')

    // the UI_STALE_TOTAL trap: total must track item removal
    await editor.removeItem(1)
    await expect(editor.total).toHaveText('Total: $100.00')
    await editor.saveDraft()
    // wait for the app's own signal — never navigate away from an in-flight save
    await expect(editor.saveConfirmation).toBeVisible()

    await list.goto()
    await expect(list.row(title)).toContainText('$100.00')
  })

  test('submits a draft for approval', async ({ page }) => {
    const list = new ClaimsListPage(page)
    const editor = new ClaimEditorPage(page)
    const title = uniqueTitle('Submit me')

    await list.goto()
    await list.startNewClaim()
    await editor.setTitle(title)
    await editor.setItem(0, 'train ticket', '42.00')
    await editor.saveDraft()
    await editor.submitForApproval()

    await expect(list.heading).toBeVisible()
    await expect(list.row(title)).toContainText('submitted')
  })
})
