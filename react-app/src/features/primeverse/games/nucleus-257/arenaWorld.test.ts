import { describe, expect, it } from 'vitest'

import {
  ARENA_COVERS,
  ARENA_PYLONS,
  BOT_SPAWNS,
  PLAYER_SPAWNS,
  collidesWithCover,
  hasArenaLineOfSight,
  isInsideArena,
  resolveArenaAbilityMovement,
  resolveArenaMovement,
  spawnForIndex,
} from './arenaWorld'

describe('Núcleo 257 arena geometry', () => {
  it('keeps every player, bot and pylon spawn inside the playable ring', () => {
    for (const point of [...PLAYER_SPAWNS, ...BOT_SPAWNS, ...ARENA_PYLONS.map((pylon) => pylon.position)]) {
      expect(isInsideArena(point, 0)).toBe(true)
      expect(collidesWithCover(point, 0.45)).toBe(false)
    }
  })

  it('blocks the core and slides along cover instead of crossing it', () => {
    const core = ARENA_COVERS.find((cover) => cover.id === 'core')!
    expect(collidesWithCover(core.center)).toBe(true)
    const current = { x: -3.2, y: 0.05, z: 3.2 }
    const moved = resolveArenaMovement(current, { x: -1.9, y: 0.05, z: 2.1 })
    expect(collidesWithCover(moved)).toBe(false)
    expect(moved).not.toEqual({ x: -1.9, y: 0.05, z: 2.1 })
  })

  it('detects cover occlusion and wraps deterministic spawn indexes', () => {
    expect(hasArenaLineOfSight({ x: -5, y: 1, z: 0 }, { x: 5, y: 1, z: 0 })).toBe(false)
    expect(hasArenaLineOfSight({ x: -5, y: 5, z: 0 }, { x: 5, y: 5, z: 0 })).toBe(true)
    expect(hasArenaLineOfSight({ x: -20, y: 1, z: -15 }, { x: -12, y: 1, z: -15 })).toBe(true)
    expect(spawnForIndex(-1)).toEqual(PLAYER_SPAWNS[PLAYER_SPAWNS.length - 1])
    expect(spawnForIndex(BOT_SPAWNS.length, true)).toEqual(BOT_SPAWNS[0])
    expect(spawnForIndex(Number.NaN, true)).toEqual(BOT_SPAWNS[0])
  })

  it('sweeps physical dashes while allowing blinks through cover to a safe endpoint', () => {
    const from = { x: -5, y: 0.05, z: 0 }
    const destination = { x: 5, y: 0.05, z: 0 }
    const dash = resolveArenaAbilityMovement(from, destination)
    const blink = resolveArenaAbilityMovement(from, destination, 0.48, true)

    expect(dash.x).toBeLessThan(-2.7)
    expect(collidesWithCover(dash)).toBe(false)
    expect(blink).toEqual(destination)
  })
})
