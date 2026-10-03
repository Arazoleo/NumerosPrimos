import { describe, expect, it } from 'vitest'
import { createUlamSpiral } from './ulamLogic'
import {
  DEFAULT_VIEWPORT,
  actionFromKey,
  changeZoom,
  moveCellSelection,
  moveViewport,
  selectCell,
} from './ulamInput'

describe('Ulam input contract', () => {
  const cells = createUlamSpiral(5)

  it('moves selection by coordinates and clamps at the grid edge', () => {
    const center = selectCell(cells, 1)
    expect(moveCellSelection(cells, center, 1, 0)).toMatchObject({ x: 1, y: 0, value: 2 })
    expect(moveCellSelection(cells, center, 0, 1)).toMatchObject({ x: 0, y: 1, value: 4 })

    const leftCell = moveCellSelection(cells, center, -1, 0)
    expect(leftCell).toMatchObject({ x: -1, y: 0, value: 6 })
    
    const edgeCell = moveCellSelection(cells, leftCell!, -1, 0)!
    expect(moveCellSelection(cells, edgeCell, -1, 0)).toEqual(edgeCell)
  })

  it('clamps zoom and pan without changing the initial viewport contract', () => {
    expect(changeZoom(DEFAULT_VIEWPORT, 99).zoom).toBe(1.85)
    expect(changeZoom(DEFAULT_VIEWPORT, -99).zoom).toBe(0.72)
    expect(moveViewport(DEFAULT_VIEWPORT, 99, -99)).toMatchObject({ panX: 1.65, panY: -1.65 })
  })

  it('maps keyboard commands without requiring a browser', () => {
    expect(actionFromKey('ArrowRight')).toEqual({ type: 'move-cell', dx: 1, dy: 0 })
    expect(actionFromKey('w')).toEqual({ type: 'move-cell', dx: 0, dy: 1 })
    expect(actionFromKey('+')).toMatchObject({ type: 'zoom' })
    expect(actionFromKey('Escape')).toEqual({ type: 'clear-cell' })
    expect(actionFromKey('Tab')).toBeNull()
  })

  it('keeps keyboard navigation independent from form fields', () => {
    expect(actionFromKey('ArrowUp')).toEqual({ type: 'move-cell', dx: 0, dy: 1 })
    expect(actionFromKey('Enter')).toEqual({ type: 'confirm' })
    expect(actionFromKey(' ')).toBeNull()
  })

  it('does not let zoom escape its supported range after repeated gestures', () => {
    let viewport = DEFAULT_VIEWPORT
    for (let index = 0; index < 50; index += 1) viewport = changeZoom(viewport, 0.12)
    expect(viewport.zoom).toBe(1.85)
    for (let index = 0; index < 100; index += 1) viewport = changeZoom(viewport, -0.12)
    expect(viewport.zoom).toBe(0.72)
  })
})