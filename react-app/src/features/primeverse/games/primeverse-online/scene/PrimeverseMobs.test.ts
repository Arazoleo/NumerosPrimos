import { describe, expect, it } from 'vitest'

import {
  createPrimeverseMobRuntime,
  isMobInsidePrimePulse,
  mobDetectionRadius,
  PRIMEVERSE_MOBS,
  PRIMEVERSE_MOBS_BY_REALM,
  stepPrimeverseMob,
} from './PrimeverseMobs'

function mob(id: string) {
  const definition = PRIMEVERSE_MOBS.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Fixture ${id} not found`)
  return definition
}

describe('Primeverse mob roster', () => {
  it('keeps distinct canonical encounters in all adventure realms', () => {
    expect(PRIMEVERSE_MOBS_BY_REALM['ulam-run']).toHaveLength(3)
    expect(PRIMEVERSE_MOBS_BY_REALM['factor-forge']).toHaveLength(3)
    expect(PRIMEVERSE_MOBS_BY_REALM['sieve-catacombs']).toHaveLength(4)
    expect(new Set(PRIMEVERSE_MOBS.map((entry) => entry.id)).size).toBe(10)
    expect(new Set(PRIMEVERSE_MOBS.map((entry) => entry.home.join(','))).size).toBe(10)
  })

  it('makes the horror lantern useful but dangerous', () => {
    const stalker = mob('catacomb-null-alpha')
    const drone = mob('ulam-composite-4')

    expect(mobDetectionRadius(stalker, true)).toBeGreaterThan(mobDetectionRadius(stalker, false) + 7)
    expect(mobDetectionRadius(drone, true)).toBe(mobDetectionRadius(drone, false))

    const runtime = createPrimeverseMobRuntime(stalker)
    const player = [stalker.home[0] + 10, stalker.home[1], stalker.home[2]] as const
    expect(stepPrimeverseMob(runtime, stalker, player, 100, 0.016, false).runtime.mode).toBe('patrol')
    expect(stepPrimeverseMob(runtime, stalker, player, 100, 0.016, true).runtime.mode).toBe('alert')
  })
})

describe('Primeverse mob finite-state machine', () => {
  it('is deterministic and advances patrol, alert and chase predictably', () => {
    const definition = mob('ulam-composite-6')
    const initial = createPrimeverseMobRuntime(definition)
    const farPlayer = [definition.home[0] + 20, definition.home[1], definition.home[2]] as const

    const patrolA = stepPrimeverseMob(initial, definition, farPlayer, 1_000, 0.05, false)
    const patrolB = stepPrimeverseMob(initial, definition, farPlayer, 1_000, 0.05, false)
    expect(patrolA).toEqual(patrolB)
    expect(patrolA.runtime.mode).toBe('patrol')

    const closePlayer = [initial.position[0] + 2, initial.position[1], initial.position[2]] as const
    const alerted = stepPrimeverseMob(initial, definition, closePlayer, 100, 0.016, false)
    expect(alerted.runtime.mode).toBe('alert')
    expect(alerted.attacked).toBe(false)

    const chasing = stepPrimeverseMob(
      alerted.runtime,
      definition,
      closePlayer,
      100 + definition.alertDurationMs,
      0.016,
      false,
    )
    expect(chasing.runtime.mode).toBe('chase')
  })

  it('damages only on a readable contact attack and respects cooldown', () => {
    const definition = mob('forge-warden-3')
    const player = [definition.home[0] + 0.4, definition.home[1], definition.home[2]] as const
    const alerted = stepPrimeverseMob(createPrimeverseMobRuntime(definition), definition, player, 10, 0.016, false)
    const chasing = stepPrimeverseMob(alerted.runtime, definition, player, 10 + definition.alertDurationMs, 0.016, false)
    const firstAttack = stepPrimeverseMob(chasing.runtime, definition, player, 700, 0.016, false)

    expect(firstAttack.runtime.mode).toBe('attack')
    expect(firstAttack.attacked).toBe(true)

    const animationEnds = stepPrimeverseMob(firstAttack.runtime, definition, player, 950, 0.016, false)
    expect(animationEnds.runtime.mode).toBe('cooldown')
    expect(animationEnds.attacked).toBe(false)

    const stillCooling = stepPrimeverseMob(animationEnds.runtime, definition, player, 1_400, 0.016, false)
    expect(stillCooling.runtime.mode).toBe('cooldown')
    expect(stillCooling.attacked).toBe(false)

    const secondAttack = stepPrimeverseMob(
      stillCooling.runtime,
      definition,
      player,
      firstAttack.runtime.nextAttackAtMs,
      0.016,
      false,
    )
    expect(secondAttack.runtime.mode).toBe('attack')
    expect(secondAttack.attacked).toBe(true)
  })

  it('uses a tight prime pulse radius and freezes defeated runtimes', () => {
    expect(isMobInsidePrimePulse([6.2, 0, 0], [0, 0, 0])).toBe(true)
    expect(isMobInsidePrimePulse([6.21, 0, 0], [0, 0, 0])).toBe(false)

    const definition = mob('catacomb-null-omega')
    const defeated = { ...createPrimeverseMobRuntime(definition), defeated: true }
    const result = stepPrimeverseMob(defeated, definition, definition.home, 5_000, 0.1, true)
    expect(result.runtime).toBe(defeated)
    expect(result.attacked).toBe(false)
  })
})
