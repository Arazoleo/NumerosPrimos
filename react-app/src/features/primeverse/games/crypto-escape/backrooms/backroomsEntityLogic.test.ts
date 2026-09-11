import { describe, expect, it } from 'vitest'

import {
  createBackroomsEntityRuntime,
  DEFAULT_BACKROOMS_ENTITY_CONFIG,
  evaluateBackroomsPerception,
  getBackroomsEntityTelegraph,
  stepBackroomsEntity,
  type BackroomsEntityRuntime,
  type BackroomsEntityStimulus,
} from './backroomsEntityLogic'

const config = DEFAULT_BACKROOMS_ENTITY_CONFIG

function stimulus(overrides: Partial<BackroomsEntityStimulus> = {}): BackroomsEntityStimulus {
  return {
    active: true,
    playerPosition: { x: config.spawn.x + 20, z: config.spawn.z },
    hasLineOfSight: true,
    ambientLight: 0,
    flashlightOn: false,
    flashlightHitsEntity: false,
    ...overrides,
  }
}

function advance(
  runtime: BackroomsEntityRuntime,
  input: BackroomsEntityStimulus,
  milliseconds: number,
): BackroomsEntityRuntime {
  let current = runtime
  let remaining = milliseconds
  while (remaining > 0) {
    const delta = Math.min(100, remaining)
    current = stepBackroomsEntity(current, config, input, delta).runtime
    remaining -= delta
  }
  return current
}

function awakePatrol(): BackroomsEntityRuntime {
  return advance(createBackroomsEntityRuntime(config), stimulus(), 1_000)
}

describe('Backrooms entity perception', () => {
  it('makes direct flashlight exposure a meaningful detection tradeoff', () => {
    const runtime = createBackroomsEntityRuntime(config)
    const playerPosition = { x: config.spawn.x + 9, z: config.spawn.z }
    const dark = evaluateBackroomsPerception(runtime, config, stimulus({ playerPosition }))
    const flashlight = evaluateBackroomsPerception(runtime, config, stimulus({
      playerPosition,
      flashlightOn: true,
      flashlightHitsEntity: true,
    }))

    expect(dark.seesPlayer).toBe(false)
    expect(flashlight.seesPlayer).toBe(true)
    expect(flashlight.cause).toBe('flashlight')
    expect(flashlight.sightRadius).toBeGreaterThan(dark.sightRadius + 5)
  })

  it('hears recent positioned noise but ignores an expired sound', () => {
    const runtime = createBackroomsEntityRuntime(config)
    const noise = { level: 0.8, position: { x: config.spawn.x + 4, z: config.spawn.z }, ageMs: 100 }
    const heard = evaluateBackroomsPerception(runtime, config, stimulus({ hasLineOfSight: false, noise }))
    const expired = evaluateBackroomsPerception(runtime, config, stimulus({
      hasLineOfSight: false,
      noise: { ...noise, ageMs: config.noisePersistenceMs + 1 },
    }))

    expect(heard.hearsNoise).toBe(true)
    expect(heard.cause).toBe('noise')
    expect(heard.interestPosition).toEqual(noise.position)
    expect(expired.hearsNoise).toBe(false)
  })

  it('lets hiding defeat sight unless the player points the flashlight at the entity', () => {
    const runtime = createBackroomsEntityRuntime(config)
    const playerPosition = { x: config.spawn.x + 2, z: config.spawn.z }
    expect(evaluateBackroomsPerception(runtime, config, stimulus({ playerPosition, playerHidden: true })).seesPlayer).toBe(false)
    expect(evaluateBackroomsPerception(runtime, config, stimulus({
      playerPosition,
      playerHidden: true,
      flashlightOn: true,
      flashlightHitsEntity: true,
    })).seesPlayer).toBe(true)
  })
})

describe('Backrooms entity deterministic state machine', () => {
  it('stays dormant while disabled and provides a wake warning before patrol', () => {
    const dormant = advance(createBackroomsEntityRuntime(config), stimulus({ active: false }), 5_000)
    expect(dormant.state).toBe('dormant')
    expect(dormant.awakenStartedAtMs).toBeNull()

    const warning = stepBackroomsEntity(dormant, config, stimulus(), 100)
    expect(warning.runtime.state).toBe('dormant')
    expect(warning.events.map((event) => event.kind)).toContain('wake-warning')
    expect(getBackroomsEntityTelegraph(warning.runtime, config).kind).toBe('waking')

    const patrol = advance(warning.runtime, stimulus(), 900)
    expect(patrol.state).toBe('patrol')
  })

  it('investigates noise without unfairly jumping straight to pursuit', () => {
    const patrol = awakePatrol()
    const soundPosition = { x: patrol.position.x + 3, z: patrol.position.z }
    const noticed = stepBackroomsEntity(patrol, config, stimulus({
      hasLineOfSight: false,
      noise: { level: 1, position: soundPosition },
    }), 16)

    expect(noticed.runtime.state).toBe('investigate')
    expect(noticed.runtime.investigationTarget).toEqual(soundPosition)
    expect(noticed.attacked).toBe(false)
    expect(getBackroomsEntityTelegraph(noticed.runtime, config)).toMatchObject({
      kind: 'listening',
      attackLocked: true,
    })
  })

  it('requires the full investigation telegraph before beginning a chase', () => {
    const patrol = awakePatrol()
    const playerPosition = { x: patrol.position.x + 2, z: patrol.position.z }
    const visible = stimulus({ playerPosition, ambientLight: 1 })
    const noticed = stepBackroomsEntity(patrol, config, visible, 16).runtime
    const almostReady = advance(noticed, visible, config.investigateTelegraphMs - 100)

    expect(almostReady.state).toBe('investigate')
    expect(getBackroomsEntityTelegraph(almostReady, config).attackLocked).toBe(true)

    const chase = advance(almostReady, visible, 100)
    expect(chase.state).toBe('chase')
    expect(getBackroomsEntityTelegraph(chase, config).kind).toBe('pursuit')
    expect(getBackroomsEntityTelegraph(chase, config).attackLocked).toBe(true)
  })

  it('forgets a lost player gradually and investigates the last known position', () => {
    const patrol = awakePatrol()
    const playerPosition = { x: patrol.position.x + 2, z: patrol.position.z }
    const visible = stimulus({ playerPosition, ambientLight: 1 })
    const noticed = stepBackroomsEntity(patrol, config, visible, 16).runtime
    const chasing = advance(noticed, visible, config.investigateTelegraphMs)
    expect(chasing.state).toBe('chase')

    const lost = advance(chasing, stimulus({ playerPosition, hasLineOfSight: false }), config.chaseMemoryMs + 100)
    expect(lost.state).toBe('investigate')
    expect(lost.investigationTarget).toEqual(playerPosition)
  })

  it('applies attack grace and cooldown even during continuous contact', () => {
    const patrol = awakePatrol()
    const playerPosition = { ...patrol.position }
    const visible = stimulus({ playerPosition, ambientLight: 1 })
    const noticed = stepBackroomsEntity(patrol, config, visible, 16).runtime
    let chasing = advance(noticed, visible, config.investigateTelegraphMs)
    expect(chasing.state).toBe('chase')

    const grace = stepBackroomsEntity(chasing, config, visible, 100)
    expect(grace.attacked).toBe(false)
    chasing = advance(grace.runtime, visible, config.chaseAttackGraceMs - 200)
    const firstAttack = stepBackroomsEntity(chasing, config, visible, 100)
    expect(firstAttack.attacked).toBe(true)
    expect(firstAttack.events.find((event) => event.kind === 'attack')?.damage).toBe(config.attackDamage)

    const cooldown = stepBackroomsEntity(firstAttack.runtime, config, visible, 100)
    expect(cooldown.attacked).toBe(false)
    const almostReady = advance(cooldown.runtime, visible, config.attackCooldownMs - 200)
    const secondAttack = stepBackroomsEntity(almostReady, config, visible, 100)
    expect(secondAttack.attacked).toBe(true)
  })

  it('can be stunned, remains harmless, then recovers into investigation', () => {
    const patrol = awakePatrol()
    const playerPosition = { x: patrol.position.x + 2, z: patrol.position.z }
    const visible = stimulus({ playerPosition, ambientLight: 1 })
    const noticed = stepBackroomsEntity(patrol, config, visible, 16).runtime
    const chasing = advance(noticed, visible, config.investigateTelegraphMs)
    const stunned = stepBackroomsEntity(chasing, config, stimulus({ ...visible, stunRequested: true }), 16)

    expect(stunned.runtime.state).toBe('stunned')
    expect(stunned.attacked).toBe(false)
    expect(getBackroomsEntityTelegraph(stunned.runtime, config).kind).toBe('recovery')

    const almostRecovered = advance(stunned.runtime, visible, config.stunDurationMs - 100)
    expect(almostRecovered.state).toBe('stunned')
    const recovered = advance(almostRecovered, visible, 100)
    expect(recovered.state).toBe('investigate')
  })

  it('is deterministic for identical runtime, stimulus and timestep', () => {
    const runtime = awakePatrol()
    const input = stimulus({
      hasLineOfSight: false,
      noise: { level: 0.7, position: { x: runtime.position.x + 2, z: runtime.position.z } },
    })
    expect(stepBackroomsEntity(runtime, config, input, 47)).toEqual(stepBackroomsEntity(runtime, config, input, 47))
  })
})
