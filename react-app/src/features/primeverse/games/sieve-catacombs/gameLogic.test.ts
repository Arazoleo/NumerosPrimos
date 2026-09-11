import { describe, expect, it } from 'vitest'

import {
  EXIT_POSITION,
  HIT_DAMAGE,
  HIT_INVULNERABILITY_MS,
  MAX_PLAYER_HITS,
  SEALS,
  advanceGameState,
  applyDamage,
  hitsRemaining,
  createInitialEnemies,
  createInitialGameState,
  detectionRange,
  expectedSealPrime,
  interactWithWorld,
  isPointWalkable,
  isPrime,
  isWalkable,
  resolveMovement,
  sieveSurvivors,
  stepEnemy,
  toggleFlashlight,
} from './gameLogic'

describe('Cripta do Crivo map and arithmetic', () => {
  it('keeps every objective and both ends of the expedition walkable', () => {
    expect(isWalkable({ x: 0, z: 20 })).toBe(true)
    expect(isWalkable(EXIT_POSITION)).toBe(true)
    for (const seal of SEALS) expect(isWalkable(seal.position)).toBe(true)
    expect(isPointWalkable({ x: 35, z: 27 })).toBe(false)
  })

  it('slides along walls without allowing the player through them', () => {
    const current = { x: 3.4, z: 10 }
    const resolved = resolveMovement(current, { x: 4.8, z: 9 })
    expect(resolved.x).toBe(current.x)
    expect(resolved.z).toBe(9)
  })

  it('models the sieve instead of using a hard-coded prime list', () => {
    expect(sieveSurvivors(20, [2, 3])).toEqual([2, 3, 5, 7, 11, 13, 17, 19])
    expect([2, 3, 5, 7, 11, 49, 1].map(isPrime)).toEqual([true, true, true, true, true, false, false])
  })
})

describe('Cripta do Crivo progression', () => {
  it('requires seals 2, 3, 5 and 7 in sieve order', () => {
    let state = createInitialGameState()
    state = interactWithWorld(state, SEALS[1].position, 1_000)
    expect(state.collectedPrimes).toEqual([])
    expect(state.message).toContain('Encontre 2 primeiro')

    for (const [index, seal] of SEALS.entries()) {
      expect(expectedSealPrime(state.collectedPrimes)).toBe(seal.prime)
      state = interactWithWorld(state, seal.position, 2_000 + index)
    }
    expect(state.collectedPrimes).toEqual([2, 3, 5, 7])
    expect(expectedSealPrime(state.collectedPrimes)).toBeNull()
  })

  it('keeps the exit locked until all seals are recovered', () => {
    const locked = interactWithWorld(createInitialGameState(), EXIT_POSITION, 1_000)
    expect(locked.phase).toBe('playing')
    expect(locked.message).toContain('Faltam 4')

    let ready = createInitialGameState()
    for (const [index, seal] of SEALS.entries()) ready = interactWithWorld(ready, seal.position, 2_000 + index)
    const escaped = interactWithWorld(ready, EXIT_POSITION, 9_000)
    expect(escaped.phase).toBe('won')
    expect(escaped.flashlightOn).toBe(false)
  })

  it('drains the active flashlight, recharges it slowly and supports defeat', () => {
    const initial = createInitialGameState()
    const drained = advanceGameState(initial, 0.1, 100)
    expect(drained.battery).toBeLessThan(initial.battery)
    const recovering = advanceGameState({ ...drained, flashlightOn: false }, 0.1, 200)
    expect(recovering.battery).toBeGreaterThan(drained.battery)

    const hit = applyDamage(initial, 99, 1_000, 'A Sombra')
    expect(hit.health).toBe(1)
    // Mercy window: a second blow inside it is ignored.
    expect(applyDamage(hit, 99, 1_100, 'A Sombra').health).toBe(1)
    expect(applyDamage(hit, 99, 1_000 + HIT_INVULNERABILITY_MS, 'A Sombra').phase).toBe('lost')
  })

  it('ends the run after exactly three connected blows', () => {
    let state = createInitialGameState(0)
    expect(hitsRemaining(state.health)).toBe(MAX_PLAYER_HITS)

    state = applyDamage(state, HIT_DAMAGE, 1_000, 'Φ(49) · O Fatorador')
    expect(hitsRemaining(state.health)).toBe(2)
    expect(state.phase).toBe('playing')

    state = applyDamage(state, HIT_DAMAGE, 3_000, 'Φ(49) · O Fatorador')
    expect(hitsRemaining(state.health)).toBe(1)
    expect(state.phase).toBe('playing')
    expect(state.message).toContain('MAIS UM GOLPE')

    state = applyDamage(state, HIT_DAMAGE, 5_000, 'Φ(49) · O Fatorador')
    expect(state.phase).toBe('lost')
    expect(hitsRemaining(state.health)).toBe(0)
  })

  it('does not reactivate a completely depleted flashlight', () => {
    const depleted = { ...createInitialGameState(), flashlightOn: false, battery: 0 }
    expect(toggleFlashlight(depleted, 1_000).flashlightOn).toBe(false)
    expect(toggleFlashlight({ ...depleted, battery: 7.9 }, 1_000).flashlightOn).toBe(false)
    expect(toggleFlashlight({ ...depleted, battery: 8 }, 1_000).flashlightOn).toBe(true)
    expect(toggleFlashlight({ ...depleted, battery: 10 }, 1_000).flashlightOn).toBe(true)
  })
})

describe('Cripta do Crivo stalkers', () => {
  it('uses light and footsteps as distinct detection signals', () => {
    expect(detectionRange(true, false)).toBeGreaterThan(detectionRange(false, false))
    expect(detectionRange(false, true)).toBeGreaterThan(detectionRange(false, false))
  })

  it('chases, attacks on a cooldown and can be repelled by aimed light', () => {
    const enemy = { ...createInitialEnemies()[0], x: -20, z: 4 }
    const chase = stepEnemy(enemy, {
      player: { x: -22, z: 4 }, flashlightOn: false, flashlightAimDot: 0,
      sprinting: false, nowMs: 1_000, deltaSeconds: 0.1,
    })
    expect(chase.enemy.mode).toBe('chase')

    const attack = stepEnemy({ ...chase.enemy, x: -21.2, z: 4 }, {
      player: { x: -22, z: 4 }, flashlightOn: false, flashlightAimDot: 0,
      sprinting: false, nowMs: 2_000, deltaSeconds: 0.1,
    })
    expect(attack.enemy.mode).toBe('attack')
    expect(attack.damage).toBe(22)

    const repelled = stepEnemy({ ...attack.enemy, x: -20.5, z: 4 }, {
      player: { x: -22, z: 4 }, flashlightOn: true, flashlightAimDot: 0.95,
      sprinting: false, nowMs: 2_100, deltaSeconds: 0.1,
    })
    expect(repelled.enemy.mode).toBe('stunned')
    expect(repelled.damage).toBe(0)
  })
})
