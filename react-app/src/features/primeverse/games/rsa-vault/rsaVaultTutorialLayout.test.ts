import { describe, expect, it } from 'vitest'

import { getRsaTutorialPanelLayout, type RsaTutorialPanelLayout } from './rsaVaultTutorialLayout'

const PANEL = { width: 470, height: 360 }

function expectInsideViewport(layout: RsaTutorialPanelLayout, viewport: { width: number; height: number }): void {
  expect(layout.left).toBeGreaterThanOrEqual(0)
  expect(layout.top).toBeGreaterThanOrEqual(0)
  expect(layout.width).toBeGreaterThanOrEqual(0)
  expect(layout.maxHeight).toBeGreaterThanOrEqual(0)
  expect(layout.left + layout.width).toBeLessThanOrEqual(viewport.width)
  expect(layout.top + layout.maxHeight).toBeLessThanOrEqual(viewport.height)
}

function expectSeparated(
  layout: RsaTutorialPanelLayout,
  target: { left: number; top: number; right: number; bottom: number },
): void {
  const hasGap = layout.left + layout.width + 16 <= target.left
    || layout.left >= target.right + 16
    || layout.top + layout.maxHeight + 16 <= target.top
    || layout.top >= target.bottom + 16
  expect(hasGap).toBe(true)
}

describe('RSA Vault tutorial panel placement', () => {
  it.each([
    ['desktop console', { width: 1440, height: 900 }, { left: 38, top: 98, right: 443, bottom: 788 }],
    ['desktop telemetry', { width: 1440, height: 900 }, { left: 1160, top: 200, right: 1406, bottom: 400 }],
    ['tablet q field', { width: 800, height: 800 }, { left: 227, top: 500, right: 401, bottom: 580 }],
    ['phone fields near bottom', { width: 390, height: 844 }, { left: 22, top: 650, right: 368, bottom: 720 }],
    ['phone progress rail near top', { width: 390, height: 844 }, { left: 22, top: 120, right: 368, bottom: 170 }],
    ['landscape field', { width: 844, height: 390 }, { left: 40, top: 180, right: 390, bottom: 235 }],
  ] as const)('keeps the panel inside the viewport and away from the %s', (_name, viewport, target) => {
    const layout = getRsaTutorialPanelLayout(viewport, target, PANEL)
    expectInsideViewport(layout, viewport)
    expectSeparated(layout, target)
  })

  it('reduces the panel width to the useful space beside a tablet target', () => {
    const layout = getRsaTutorialPanelLayout(
      { width: 800, height: 800 },
      { left: 227, top: 500, right: 401, bottom: 580 },
      PANEL,
    )
    expect(layout).toEqual({ left: 417, top: 16, width: 367, maxHeight: 768 })
  })

  it('uses the larger free vertical band when neither side can fit a readable panel', () => {
    const layout = getRsaTutorialPanelLayout(
      { width: 390, height: 844 },
      { left: 22, top: 650, right: 368, bottom: 720 },
      PANEL,
    )
    expect(layout).toEqual({ left: 16, top: 16, width: 358, maxHeight: 618 })
  })

  it('does not expand a panel beyond its preferred width in a wide side band', () => {
    const layout = getRsaTutorialPanelLayout(
      { width: 1440, height: 900 },
      { left: 38, top: 98, right: 443, bottom: 788 },
      { width: 320, height: 900 },
    )
    expect(layout.width).toBe(320)
    expectInsideViewport(layout, { width: 1440, height: 900 })
  })

  it.each([{ width: 390, height: 844 }, { width: 20, height: 20 }])(
    'fits inside $width × $height even when the target fills the viewport',
    (viewport) => {
      const layout = getRsaTutorialPanelLayout(
        viewport,
        { left: 0, top: 0, right: viewport.width, bottom: viewport.height },
        PANEL,
      )
      expectInsideViewport(layout, viewport)
    },
  )
})
