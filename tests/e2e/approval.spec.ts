import type { Browser, Page } from '@playwright/test'
import { AUTH_DIR, expect, test } from './fixtures.js'
import { ApproverQueuePage } from './pages/approver-queue-page.js'
import { ClaimEditorPage } from './pages/claim-editor-page.js'
import { ClaimsListPage } from './pages/claims-list-page.js'

function uniqueTitle(label: string): string {
  return `${label} ${Date.now()}-${Math.floor(Math.random() * 1e5)}`
}

async function asRole(browser: Browser, role: 'submitter' | 'approver'): Promise<Page> {
  const context = await browser.newContext({ storageState: `${AUTH_DIR}/${role}.json` })
  return context.newPage()
}

async function submitClaim(page: Page, title: string): Promise<void> {
  const list = new ClaimsListPage(page)
  const editor = new ClaimEditorPage(page)
  await list.goto()
  await list.startNewClaim()
  await editor.setTitle(title)
  await editor.setItem(0, 'expenses', '50.00')
  await editor.saveDraft()
  await editor.submitForApproval()
  await expect(list.row(title)).toContainText('submitted')
}

test.describe('approval workflow — two roles, two contexts', () => {
  test('approver approves a submitted claim', async ({ browser }) => {
    const submitterPage = await asRole(browser, 'submitter')
    const approverPage = await asRole(browser, 'approver')
    const title = uniqueTitle('Approve me')

    await submitClaim(submitterPage, title)

    const queue = new ApproverQueuePage(approverPage)
    await queue.goto()
    await queue.approve(title)
    await expect(queue.row(title)).toHaveCount(0) // gone from the queue

    const list = new ClaimsListPage(submitterPage)
    await list.goto()
    await expect(list.row(title)).toContainText('approved')
  })

  test('rejection reason round-trips to the submitter', async ({ browser }) => {
    const submitterPage = await asRole(browser, 'submitter')
    const approverPage = await asRole(browser, 'approver')
    const title = uniqueTitle('Reject me')

    await submitClaim(submitterPage, title)

    const queue = new ApproverQueuePage(approverPage)
    await queue.goto()
    await queue.reject(title, 'missing receipts')
    await expect(queue.row(title)).toHaveCount(0)

    const list = new ClaimsListPage(submitterPage)
    const editor = new ClaimEditorPage(submitterPage)
    await list.goto()
    await list.open(title)
    await expect(editor.status).toHaveText('rejected')
    await expect(editor.decisionReason).toHaveText('missing receipts')
  })
})
