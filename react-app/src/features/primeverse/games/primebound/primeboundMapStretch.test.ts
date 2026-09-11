import { describe, expect, it } from 'vitest'

import { PRIMEBOUND_AREAS } from './world'
import { stretchFactorForParty, stretchTileMap, stretchedGridIndex } from './primeboundMapStretch'

describe('online map stretching', () => {
  it('grows with the party and never past the cap', () => {
    expect(stretchFactorForParty(1)).toBe(1)
    expect(stretchFactorForParty(2)).toBeCloseTo(1.3)
    expect(stretchFactorForParty(4)).toBeCloseTo(1.75)
    expect(stretchFactorForParty(10)).toBeCloseTo(1.75)
  })

  it('is the identity at factor one', () => {
    const map = PRIMEBOUND_AREAS['echo-woods'].tileMap
    expect(stretchTileMap(map, 1)).toBe(map)
    expect(stretchedGridIndex(7, 1)).toBe(7)
  })

  it('preserves every cell under the remapped grid index', () => {
    for (const factor of [1.3, 1.6, 1.75]) {
      for (const areaId of ['echo-woods', 'prime-sanctuary'] as const) {
        const source = PRIMEBOUND_AREAS[areaId].tileMap
        const stretched = stretchTileMap(source, factor)
        expect(stretched.length).toBe(Math.ceil(source.length * factor))
        // The centre duplicate of any original cell carries the same tile.
        for (let y = 0; y < source.length; y += 2) {
          for (let x = 0; x < source[0].length; x += 3) {
            const sy = stretchedGridIndex(y, factor)
            const sx = stretchedGridIndex(x, factor)
            expect(stretched[sy][sx]).toBe(source[y][x])
          }
        }
        // Eastern gates survive: a row ending in D still ends in D.
        const gateRow = source.findIndex((row) => row.endsWith('D'))
        if (gateRow >= 0) {
          expect(stretched[stretchedGridIndex(gateRow, factor)].endsWith('D')).toBe(true)
        }
      }
    }
  })
})
