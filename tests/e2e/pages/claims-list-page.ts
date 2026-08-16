import type { Locator, Page } from '@playwright/test'

export class ClaimsListPage {
  readonly heading: Locator

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'My claims' })
  }

  async goto(): Promise<void> {
    await this.page.goto('/claims')
  }

  async startNewClaim(): Promise<void> {
    await this.page.getByRole('button', { name: 'New claim' }).click()
  }

  row(title: string): Locator {
    return this.page.getByRole('row').filter({ hasText: title })
  }

  async open(title: string): Promise<void> {
    await this.row(title).click()
  }
}
