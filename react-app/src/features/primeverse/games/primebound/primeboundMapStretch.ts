/**
 * Online map enlargement.
 *
 * Hand-made tileMaps cannot be redrawn, but they can be *stretched*: every column
 * and row is duplicated on a fixed cadence, so walls thicken, rooms widen and
 * corridors lengthen while the topology stays identical — whatever was reachable
 * still is, gates keep their edges, and nothing hand-placed breaks.
 *
 * Grid-anchored entities are remapped through `stretchedGridIndex`, which lands on
 * the centre duplicate of the original cell — provably inside the same tile block.
 */

export function stretchFactorForParty(partySize: number): number {
  if (!Number.isFinite(partySize) || partySize <= 1) return 1
  return Math.min(1.75, 1 + (Math.floor(partySize) - 1) * 0.3)
}

/**
 * Output index of a duplicate of source cell `index` under `factor`. The first
 * duplicate is `ceil(index * factor)`, which provably satisfies
 * `floor(j / factor) === index` for every factor ≥ 1 — the guarantee the
 * walkability of remapped entities rests on.
 */
export function stretchedGridIndex(index: number, factor: number): number {
  if (factor === 1) return index
  return Math.ceil(index * factor)
}

export function stretchTileMap(tileMap: readonly string[], factor: number): readonly string[] {
  if (factor === 1) return tileMap
  const sourceHeight = tileMap.length
  const height = Math.ceil(sourceHeight * factor)
  const rows: string[] = []
  for (let j = 0; j < height; j += 1) {
    // Rows may be ragged (a gate 'D' can sit past the first row's width), so each
    // stretched row is sized from its own source row.
    const sourceRow = tileMap[Math.min(sourceHeight - 1, Math.floor(j / factor))]
    const width = Math.ceil(sourceRow.length * factor)
    let row = ''
    for (let i = 0; i < width; i += 1) {
      row += sourceRow[Math.min(sourceRow.length - 1, Math.floor(i / factor))]
    }
    rows.push(row)
  }
  return rows
}
