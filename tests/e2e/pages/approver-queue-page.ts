import type { Locator, Page } from '@playwright/test'

export class ApproverQueuePage {
  readonly heading: Locator

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Approval queue' })
  }

  async goto(): Promise<void> {
    await this.page.goto('/queue')
  }

  row(title: string): Locator {
    return this.page.getByRole('row').filter({ hasText: title })
  }

  async approve(title: string): Promise<void> {
    await this.row(title).getByRole('button', { name: 'Approve' }).click()
  }

  async reject(title: string, reason: string): Promise<void> {
    await this.row(title).getByRole('button', { name: 'Reject' }).click()
    await this.row(title).getByLabel('Reason').fill(reason)
    await this.row(title).getByRole('button', { name: 'Confirm rejection' }).click()
  }
}
