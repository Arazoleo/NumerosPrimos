import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

// Derive coverage from the router so a new route cannot silently escape the smoke suite.
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const routes = [...app.matchAll(/<Route path="([^"]+)" element=\{<([\w]+)\b/g)]
  .filter(([, path, component]) => component !== 'Navigate' && !path.includes('*'))
  .map(([, path]) => path)

async function expectLoaded(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0)
  if (path === '/') {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('navigation').first()).toBeVisible()
  } else {
    await expect(page.locator('main').first()).toBeVisible()
    await expect.poll(async () => (await page.locator('main').first().innerText()).trim().length).toBeGreaterThan(40)
  }
  // Observe effects and deferred browser errors after the lazy route has mounted.
  await page.waitForTimeout(500)
}

for (const path of routes) {
  test(`carrega ${path}`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(response?.ok()).toBe(true)
    await expectLoaded(page, path)
  })
}

const redirects = {
  '/jogos/ulam-rift': '/jogos/fenda-de-ulam',
  '/jogos/euclid-siege': '/jogos/cerco-de-euclides',
  '/jogos/sieve-catacombs': '/jogos/cripta-do-crivo',
  '/jogos/crypto-escape-room': '/jogos/crypto-escape',
}

for (const [source, destination] of Object.entries(redirects)) {
  test(`redireciona ${source} para ${destination}`, async ({ page }) => {
    await page.goto(source)
    await expectLoaded(page, destination)
  })
}

test('Núcleo 257 seleciona outro operador e entra na arena', async ({ page }) => {
  await page.goto('/jogos/nucleo-257')
  const operator = page.getByRole('option', { name: /Raul Sato/ })
  await operator.click()
  await expect(operator).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.n257-loadout__title')).toContainText('RSA')
  await page.getByRole('button', { name: 'ENTRAR NA CÂMARA 257' }).click()
  await expect(page.getByRole('region', { name: 'Estado do operador' })).toContainText('Raul Sato')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('listbox', { name: 'Escolha seu operador' })).toHaveCount(0)
})

test('Primeverse Online informa indisponibilidade e permite voltar', async ({ page }) => {
  // Close every attempted socket, including retries, without relying on a real backend.
  await page.routeWebSocket('**/api/primeverse', socket => socket.close({ code: 1013, reason: 'Backend indisponível no smoke test' }))
  await page.goto('/jogos/primeverse-online')
  await page.getByRole('textbox').fill('Explorador Smoke')
  await page.getByRole('button', { name: /^ENTRAR NO PRIMEVERSE/ }).click()
  await expect(page.getByText('Não foi possível entrar no Primeverse.', { exact: true })).toBeVisible({ timeout: 22_000 })
  await expect(page.getByRole('button', { name: 'TENTAR NOVAMENTE', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'VOLTAR', exact: true }).click()
  await expect(page.getByRole('textbox')).toBeVisible()
  await expect(page.getByRole('button', { name: /^ENTRAR NO PRIMEVERSE/ })).toBeEnabled()
})
