import { test as base, expect } from '@playwright/test'

export const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(`pageerror: ${error.stack ?? error.message}`))
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
    })
    await use(errors)
    expect(errors, 'O navegador não deve registrar erros').toEqual([])
  }, { auto: true }],
})

export { expect }
