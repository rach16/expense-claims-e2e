import type { Locator, Page } from '@playwright/test'

export class ClaimEditorPage {
  readonly total: Locator
  readonly errors: Locator
  readonly status: Locator
  readonly decisionReason: Locator
  readonly saveConfirmation: Locator

  constructor(private readonly page: Page) {
    this.total = page.getByTestId('total')
    this.errors = page.getByRole('alert')
    this.status = page.getByTestId('claim-status')
    this.decisionReason = page.getByTestId('decision-reason')
    this.saveConfirmation = page.getByTestId('save-confirmation')
  }

  async setTitle(title: string): Promise<void> {
    await this.page.getByLabel('Title').fill(title)
  }

  itemRow(index: number): Locator {
    return this.page.locator('.item-row').nth(index)
  }

  async setItem(index: number, description: string, amount: string): Promise<void> {
    await this.itemRow(index).getByLabel('Description').fill(description)
    await this.itemRow(index).getByLabel('Amount ($)').fill(amount)
  }

  async addItem(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add item' }).click()
  }

  async removeItem(index: number): Promise<void> {
    await this.itemRow(index).getByRole('button', { name: 'Remove' }).click()
  }

  async saveDraft(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save draft' }).click()
  }

  async submitForApproval(): Promise<void> {
    await this.page.getByRole('button', { name: 'Submit for approval' }).click()
  }
}
