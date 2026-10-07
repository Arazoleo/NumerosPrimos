import type { UlamCell } from './types'

export interface UlamViewport {
  readonly panX: number
  readonly panY: number
  readonly zoom: number
}

export interface UlamCellSelection {
  readonly value: number
  readonly x: number
  readonly y: number
  readonly prime: boolean
}

export const ULAM_ZOOM = {
  min: 0.72,
  max: 1.85,
  step: 0.12,
} as const

export const DEFAULT_VIEWPORT: UlamViewport = {
  panX: 0,
  panY: 0,
  zoom: 1,
}

export function clampZoom(value: number): number {
  return Math.min(ULAM_ZOOM.max, Math.max(ULAM_ZOOM.min, value))
}

export function changeZoom(viewport: UlamViewport, delta: number): UlamViewport {
  return { ...viewport, zoom: clampZoom(viewport.zoom + delta) }
}

export function resetViewport(): UlamViewport {
  return DEFAULT_VIEWPORT
}

export function clampPan(value: number, limit = 1.65): number {
  return Math.min(limit, Math.max(-limit, value))
}

export function moveViewport(
  viewport: UlamViewport,
  dx: number,
  dy: number,
): UlamViewport {
  return {
    ...viewport,
    panX: clampPan(viewport.panX + dx),
    panY: clampPan(viewport.panY + dy),
  }
}

export function selectCell(cells: readonly UlamCell[], value: number): UlamCellSelection | null {
  const cell = cells.find((candidate) => candidate.value === value)
  return cell ? { value: cell.value, x: cell.x, y: cell.y, prime: cell.prime } : null
}

export function moveCellSelection(
  cells: readonly UlamCell[],
  current: UlamCellSelection | null,
  dx: -1 | 0 | 1,
  dy: -1 | 0 | 1,
): UlamCellSelection | null {
  if (cells.length === 0) return null
  const origin = current ?? cells[0]
  const next = cells.find((cell) => cell.x === origin.x + dx && cell.y === origin.y + dy)
  return selectCell(cells, next?.value ?? origin.value)
}

export type UlamInputAction =
  | { readonly type: 'move-cell'; readonly dx: -1 | 0 | 1; readonly dy: -1 | 0 | 1 }
  | { readonly type: 'zoom'; readonly delta: number }
  | { readonly type: 'reset-viewport' }
  | { readonly type: 'clear-cell' }
  | { readonly type: 'confirm' }

export function actionFromKey(key: string): UlamInputAction | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W': return { type: 'move-cell', dx: 0, dy: 1 }
    case 'ArrowDown':
    case 's':
    case 'S': return { type: 'move-cell', dx: 0, dy: -1 }
    case 'ArrowLeft':
    case 'a':
    case 'A': return { type: 'move-cell', dx: -1, dy: 0 }
    case 'ArrowRight':
    case 'd':
    case 'D': return { type: 'move-cell', dx: 1, dy: 0 }
    case '+':
    case '=': return { type: 'zoom', delta: ULAM_ZOOM.step }
    case '-':
    case '_': return { type: 'zoom', delta: -ULAM_ZOOM.step }
    case '0': return { type: 'reset-viewport' }
    case 'Escape': return { type: 'clear-cell' }
    case 'Enter': return { type: 'confirm' }
    default: return null
  }
}