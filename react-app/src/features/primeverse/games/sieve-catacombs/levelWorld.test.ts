import { describe, expect, it } from 'vitest'

import { CATACOMBS_LEVELS } from './campaignLogic'
import {
  CATACOMBS_LEVEL_WORLDS,
  MAX_HUNT_MS,
  createLevelEnemies,
  getCatacombsLevelWorld,
  hasLevelLineOfSight,
  isLevelWalkable,
  resolveLevelMovement,
  resolveLevelMovementAroundEnemies,
  stepLevelEnemy,
  validateCatacombsLevelWorlds,
} from './levelWorld'

describe('Cripta do Crivo liminal worlds', () => {
  it('defines a valid and increasingly hostile world for each campaign level', () => {
    expect(CATACOMBS_LEVEL_WORLDS.map((world) => world.id)).toEqual(
      CATACOMBS_LEVELS.map((level) => level.id),
    )
    expect(CATACOMBS_LEVEL_WORLDS.map((world) => world.seal.prime)).toEqual([2, 3, 5, 7, 11, 13])
    expect(CATACOMBS_LEVEL_WORLDS.map((world) => world.theme)).toEqual(
      ['offices', 'pools', 'hotel', 'crypt', 'servers', 'cold'],
    )
    expect(CATACOMBS_LEVEL_WORLDS[0].enemies).toHaveLength(1)
    expect(CATACOMBS_LEVEL_WORLDS[3].enemies).toHaveLength(3)
    for (const world of CATACOMBS_LEVEL_WORLDS) {
      expect(world.cabinets.length).toBeGreaterThanOrEqual(2)
    }
    expect(validateCatacombsLevelWorlds()).toEqual([])

    for (const world of CATACOMBS_LEVEL_WORLDS) {
      expect(world.tiles.length).toBeGreaterThan(60)
      expect(world.walls.length).toBeGreaterThan(20)
      expect(createLevelEnemies(world)).toHaveLength(world.enemies.length)
      expect(world.scares[0].minLevelElapsedMs).toBeLessThanOrEqual(3_500)
      expect(world.scares.map((scare) => scare.minLevelElapsedMs)).toEqual(
        [...world.scares].map((scare) => scare.minLevelElapsedMs).sort((first, second) => first - second),
      )
      for (const tile of world.tiles) {
        expect(Math.abs(tile.x % 4)).toBe(2)
        expect(Math.abs(tile.z % 4)).toBe(2)
      }
    }
  })

  it('keeps collision and sight specific to the active level layout', () => {
    const hotel = getCatacombsLevelWorld('hotel-23')
    expect(isLevelWalkable(hotel, hotel.playerStart)).toBe(true)
    expect(resolveLevelMovement(hotel, { x: 3.4, z: 8 }, { x: 7, z: 7 }).x).toBe(3.4)
    expect(hasLevelLineOfSight(hotel, { x: 0, z: 8 }, { x: 0, z: -8 })).toBe(true)
    expect(hasLevelLineOfSight(hotel, { x: -24, z: 12 }, { x: 24, z: -2 })).toBe(false)
  })

  it('treats stalkers as solid bodies the player cannot walk through', () => {
    const hotel = getCatacombsLevelWorld('hotel-23')
    const stalker = { x: 0, z: 2 }
    const start = { x: 0, z: 4 }

    const blocked = resolveLevelMovementAroundEnemies(hotel, start, { x: 0, z: 2.6 }, [stalker])
    expect(Math.hypot(blocked.x - stalker.x, blocked.z - stalker.z)).toBeGreaterThanOrEqual(1.2)
    expect(blocked.z).toBe(start.z)

    const sideways = resolveLevelMovementAroundEnemies(hotel, start, { x: 1.4, z: 4 }, [stalker])
    expect(sideways.x).toBeCloseTo(1.4)

    // An overlap that already exists must never trap the player in place.
    const overlapped = { x: 0, z: 2.4 }
    const escaping = resolveLevelMovementAroundEnemies(hotel, overlapped, { x: 0, z: 3.2 }, [stalker])
    expect(escaping.z).toBeGreaterThan(overlapped.z)
  })

  it('stops a hunting stalker at contact distance instead of inside the player', () => {
    const crypt = getCatacombsLevelWorld('crypt-49')
    const blueprint = crypt.enemies[0]
    const player = { x: 20, z: -44 }
    const enemy = { ...createLevelEnemies(crypt)[0], x: 20, z: -46 }
    const stepped = stepLevelEnemy(enemy, blueprint, crypt, {
      player,
      flashlightOn: false,
      flashlightAimDot: 0,
      sprinting: false,
      nowMs: 10_000,
      deltaSeconds: 0.1,
      fear: 90,
      sealCollected: true,
    })
    expect(stepped.enemy.mode).toBe('chase')
    expect(Math.hypot(stepped.enemy.x - player.x, stepped.enemy.z - player.z)).toBeGreaterThanOrEqual(1.2)
  })

  it('freezes the Hotel 23 bellhop while watched and lets it advance unseen', () => {
    const hotel = getCatacombsLevelWorld('hotel-23')
    const blueprint = hotel.enemies[0]
    const enemy = { ...createLevelEnemies(hotel)[0], x: 0, z: -8 }
    const baseContext = {
      player: { x: 0, z: 0 },
      flashlightOn: true,
      sprinting: false,
      nowMs: 10_000,
      deltaSeconds: 0.1,
      fear: 40,
      sealCollected: false,
    }
    const watched = stepLevelEnemy(enemy, blueprint, hotel, { ...baseContext, flashlightAimDot: 1 })
    const unseen = stepLevelEnemy(enemy, blueprint, hotel, { ...baseContext, flashlightAimDot: -1 })
    const dark = stepLevelEnemy(enemy, blueprint, hotel, {
      ...baseContext,
      flashlightOn: false,
      flashlightAimDot: 1,
    })

    expect(watched.enemy.x).toBe(enemy.x)
    expect(watched.enemy.z).toBe(enemy.z)
    expect(unseen.enemy.z).toBeGreaterThan(enemy.z)
    expect(unseen.enemy.mode).toBe('chase')
    expect(dark.enemy.z).toBeGreaterThan(enemy.z)
  })

  it('makes a pool counter faster when the player switches the light off', () => {
    const pools = getCatacombsLevelWorld('modular-pools')
    const blueprint = pools.enemies[0]
    // The rebuilt floor is a maze: this pair sits in the eastern rim of Pool 03.
    const enemy = { ...createLevelEnemies(pools)[0], x: 6, z: -8 }
    const context = {
      player: { x: 6, z: 0 },
      flashlightAimDot: -1,
      sprinting: false,
      nowMs: 10_000,
      deltaSeconds: 0.1,
      fear: 30,
      sealCollected: false,
    }
    const lit = stepLevelEnemy(enemy, blueprint, pools, { ...context, flashlightOn: true })
    const dark = stepLevelEnemy(enemy, blueprint, pools, { ...context, flashlightOn: false })
    expect(dark.enemy.z).toBeGreaterThan(lit.enemy.z)
  })

  it('freezes the cold keeper under the flashlight and unleashes it in the dark', () => {
    const vault = getCatacombsLevelWorld('cold-vault-13')
    const blueprint = vault.enemies[1]
    const enemy = { ...createLevelEnemies(vault)[1], x: 20, z: -8 }
    const context = {
      player: { x: 20, z: 0 },
      flashlightAimDot: 0,
      sprinting: false,
      nowMs: 10_000,
      deltaSeconds: 0.1,
      fear: 50,
      sealCollected: false,
    }
    const lit = stepLevelEnemy(enemy, blueprint, vault, { ...context, flashlightOn: true })
    const dark = stepLevelEnemy(enemy, blueprint, vault, { ...context, flashlightOn: false })

    expect(lit.enemy.x).toBe(enemy.x)
    expect(lit.enemy.z).toBe(enemy.z)
    expect(dark.enemy.z).toBeGreaterThan(enemy.z)
    expect(dark.enemy.mode).toBe('chase')
  })

  it('ignores the flashlight for the brute forcer and sends it after loud drawers', () => {
    const farm = getCatacombsLevelWorld('server-farm-11')
    const blueprint = farm.enemies[0]
    const enemy = { ...createLevelEnemies(farm)[0], x: 28, z: 12 }
    const context = {
      player: { x: 26, z: 12 },
      flashlightOn: true,
      flashlightAimDot: 1,
      sprinting: false,
      nowMs: 10_000,
      deltaSeconds: 0.1,
      fear: 40,
      sealCollected: false,
    }
    // Aimed light stuns the other archetypes; this one just keeps coming.
    const lit = stepLevelEnemy(enemy, blueprint, farm, context)
    expect(lit.enemy.mode).not.toBe('stunned')

    const distracted = stepLevelEnemy(
      { ...enemy, x: 28, z: -20 },
      blueprint,
      farm,
      {
        ...context,
        player: { x: 0, z: 30 },
        noise: { position: { x: 28, z: -8 }, intensity: 1, atMs: 9_500 },
      },
    )
    expect(distracted.enemy.mode).toBe('search')
    expect(distracted.enemy.lastKnown).toEqual({ x: 28, z: -8 })
  })

  it('pays for the freeze with speed: unwatched stalkers outrun a walking player', () => {
    const walkSpeedPerStep = 3.35 * 0.1
    const hotel = getCatacombsLevelWorld('hotel-23')
    const mitm = hotel.enemies[0]
    const mitmEnemy = { ...createLevelEnemies(hotel)[0], x: 0, z: -8 }
    const unwatched = stepLevelEnemy(mitmEnemy, mitm, hotel, {
      player: { x: 0, z: 0 },
      flashlightOn: true,
      flashlightAimDot: -1,
      sprinting: false,
      nowMs: 10_000,
      deltaSeconds: 0.1,
      fear: 40,
      sealCollected: false,
    })
    expect(unwatched.enemy.mode).toBe('chase')
    expect(unwatched.enemy.z - mitmEnemy.z).toBeGreaterThan(walkSpeedPerStep)

    const vault = getCatacombsLevelWorld('cold-vault-13')
    const keeper = vault.enemies[1]
    const keeperEnemy = { ...createLevelEnemies(vault)[1], x: 20, z: -8 }
    const dark = stepLevelEnemy(keeperEnemy, keeper, vault, {
      player: { x: 20, z: 0 },
      flashlightOn: false,
      flashlightAimDot: 0,
      sprinting: false,
      nowMs: 10_000,
      deltaSeconds: 0.1,
      fear: 60,
      sealCollected: false,
    })
    // In the dark the keeper is the fastest thing on the campaign.
    expect(dark.enemy.z - keeperEnemy.z).toBeGreaterThan(unwatched.enemy.z - mitmEnemy.z)
  })

  it('lets the beam pin a stalker only for a few seconds before it adapts', () => {
    const offices = getCatacombsLevelWorld('yellow-offices')
    const blueprint = offices.enemies[0]
    const context = {
      player: { x: -28, z: 8 },
      flashlightOn: true,
      flashlightAimDot: 1,
      sprinting: false,
      nowMs: 10_000,
      deltaSeconds: 0.1,
      fear: 30,
      sealCollected: false,
    }
    let enemy = { ...createLevelEnemies(offices)[0], x: -28, z: 5 }

    // Held by the light at first...
    const first = stepLevelEnemy(enemy, blueprint, offices, context)
    expect(first.enemy.mode).toBe('stunned')
    enemy = first.enemy

    // ...but the budget runs out and the stare stops working.
    let adapted = false
    for (let step = 1; step <= 40 && !adapted; step += 1) {
      const result = stepLevelEnemy(enemy, blueprint, offices, {
        ...context,
        nowMs: 10_000 + step * 100,
      })
      enemy = result.enemy
      adapted = enemy.mode === 'chase'
    }
    expect(adapted).toBe(true)
    expect(enemy.lightImmuneUntil).toBeGreaterThan(10_000)

    // While immune, aiming the beam at it does nothing at all.
    const immune = stepLevelEnemy(enemy, blueprint, offices, { ...context, nowMs: enemy.lightImmuneUntil - 500 })
    expect(immune.enemy.mode).not.toBe('stunned')
  })

  it('breaks off a chase that drags on, then leaves the player a breather', () => {
    const offices = getCatacombsLevelWorld('yellow-offices')
    const blueprint = offices.enemies[0]
    const context = {
      player: { x: -28, z: 8 },
      flashlightOn: false,
      flashlightAimDot: 0,
      sprinting: false,
      nowMs: 10_000,
      deltaSeconds: 0.1,
      fear: 50,
      sealCollected: false,
    }
    let enemy = { ...createLevelEnemies(offices)[0], x: -28, z: 2 }

    const first = stepLevelEnemy(enemy, blueprint, offices, context)
    expect(first.enemy.mode).toBe('chase')
    expect(first.enemy.huntingSince).toBe(10_000)
    enemy = first.enemy

    // Still on your heels a moment later...
    const middle = stepLevelEnemy(enemy, blueprint, offices, { ...context, nowMs: 18_000 })
    expect(middle.enemy.mode).toBe('chase')

    // ...but the hunt has a ceiling.
    const winded = stepLevelEnemy(enemy, blueprint, offices, { ...context, nowMs: 10_000 + MAX_HUNT_MS + 200 })
    expect(winded.enemy.mode).toBe('patrol')
    expect(winded.enemy.huntCooldownUntil).toBeGreaterThan(10_000 + MAX_HUNT_MS)

    // During the cooldown it will not re-acquire, even standing in front of it.
    const ignored = stepLevelEnemy(winded.enemy, blueprint, offices, {
      ...context,
      nowMs: winded.enemy.huntCooldownUntil - 500,
    })
    expect(ignored.enemy.mode).not.toBe('chase')
  })

  it('keeps the pools floor large and genuinely maze-like', () => {
    const pools = getCatacombsLevelWorld('modular-pools')
    const offices = getCatacombsLevelWorld('yellow-offices')
    expect(pools.tiles.length).toBeGreaterThan(offices.tiles.length * 1.4)
    // Far more wall per walkable tile than a floor of open halls: that is the maze.
    const density = (world: typeof pools) => world.walls.length / world.tiles.length
    expect(density(pools)).toBeGreaterThan(density(offices) * 1.25)
    expect(pools.areas.length).toBeGreaterThanOrEqual(20)
  })

  it('accelerates the longer a chase lasts, but never past a fair ceiling', () => {
    const offices = getCatacombsLevelWorld('yellow-offices')
    const blueprint = offices.enemies[0]
    const context = {
      player: { x: 0, z: 8 },
      flashlightOn: false,
      flashlightAimDot: 0,
      sprinting: false,
      deltaSeconds: 0.1,
      fear: 40,
      sealCollected: false,
    }
    const base = { ...createLevelEnemies(offices)[0], x: 0, z: -2, mode: 'chase' as const }

    const fresh = stepLevelEnemy({ ...base, huntingSince: 10_000 }, blueprint, offices, {
      ...context,
      nowMs: 10_000,
    })
    const seasoned = stepLevelEnemy({ ...base, huntingSince: 10_000 }, blueprint, offices, {
      ...context,
      nowMs: 18_000,
    })
    const freshStep = fresh.enemy.z - base.z
    const seasonedStep = seasoned.enemy.z - base.z
    expect(seasonedStep).toBeGreaterThan(freshStep)

    // The ceiling holds: even a very long hunt stays under a sprint.
    const marathon = stepLevelEnemy({ ...base, huntingSince: 10_000 }, blueprint, offices, {
      ...context,
      nowMs: 10_000 + MAX_HUNT_MS - 100,
    })
    expect((marathon.enemy.z - base.z) / 0.1).toBeLessThan(5.45)
  })

  it('closes on a player who never crosses its patrol route', () => {
    const offices = getCatacombsLevelWorld('yellow-offices')
    const blueprint = offices.enemies[0]
    // A corner of the map the patrol loop never visits.
    const player = { x: 20, z: -28 }
    let enemy = { ...createLevelEnemies(offices)[0] }
    const startDistance = Math.hypot(enemy.x - player.x, enemy.z - player.z)
    expect(startDistance).toBeGreaterThan(40)

    let closest = startDistance
    for (let step = 0; step < 900; step += 1) {
      const result = stepLevelEnemy(enemy, blueprint, offices, {
        player,
        flashlightOn: false,
        flashlightAimDot: 0,
        sprinting: false,
        nowMs: 1_000 + step * 84,
        deltaSeconds: 1 / 12,
        fear: 30,
        sealCollected: false,
      })
      enemy = result.enemy
      closest = Math.min(closest, Math.hypot(enemy.x - player.x, enemy.z - player.z))
    }
    // It finds you eventually — that is the point of a hunter.
    expect(closest).toBeLessThan(2)
  })
})
