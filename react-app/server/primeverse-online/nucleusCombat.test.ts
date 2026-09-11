import { describe, expect, it } from 'vitest'

import {
  SHIELD_RECHARGE_DELAY_MS,
  SHIELD_RECHARGE_PER_SECOND,
  SPAWN_PROTECTION_MS,
} from '../../src/features/primeverse/games/nucleus-257/arenaLogic.js'
import { getHeroKit } from '../../src/features/primeverse/games/nucleus-257/classKits.js'
import {
  ACTIVITY_SPAWNS,
  createActivityRunId,
  createAvatarAppearance,
} from '../../src/features/primeverse/games/primeverse-online/shared/index.js'
import {
  createInitialNucleusCombat,
  isNucleusCombatRecord,
  type StoredPlayer,
} from './model.js'
import {
  NUCLEUS_MAX_COMBATANTS,
  castNucleusAbility,
  joinNucleusCombat,
  leaveNucleusCombat,
  tickNucleusCombat,
  toNucleusCombatState,
} from './nucleusCombat.js'

const RUN_ID = createActivityRunId('primeverse-001', 'nucleus-257')
if (!RUN_ID) throw new Error('Expected Nucleus run id.')

function player(id: string, index: number): StoredPlayer {
  return {
    id,
    nickname: `Player ${index}`,
    activityId: 'nucleus-257',
    runId: RUN_ID,
    position: { ...ACTIVITY_SPAWNS['nucleus-257'] },
    yaw: 0,
    animation: 'idle',
    appearance: createAvatarAppearance(index),
    emote: null,
    sequence: 1,
    updatedAt: 1_000,
    joinedAt: 0,
    resumeToken: `resume_token_${String(index).padStart(16, '0')}`,
  }
}

describe('Nucleus authoritative combat model', () => {
  it('balances teams, caps active participants and exposes only connected players', () => {
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    for (let index = 0; index < NUCLEUS_MAX_COMBATANTS; index += 1) {
      const joined = joinNucleusCombat(
        record,
        player(`player-${index}`, index),
        index % 2 === 0 ? 'luma-crivo' : 'raul-rsa',
        1_000 + index,
      )
      expect(joined.rejection).toBeNull()
      record = joined.record
    }
    expect(record.players.filter(({ team }) => team === 'cipher')).toHaveLength(6)
    expect(record.players.filter(({ team }) => team === 'fracture')).toHaveLength(6)

    const overflow = joinNucleusCombat(record, player('overflow', 99), 'teo-gemeos', 2_000)
    expect(overflow.rejection).toBe('arena-full')
    const left = leaveNucleusCombat(record, 'player-0', 'selection', 2_100)
    const state = toNucleusCombatState(left.record, 2_100)
    expect(state.players).toHaveLength(11)
    expect(state.players.some(({ id }) => id === 'player-0')).toBe(false)
    expect(joinNucleusCombat(left.record, player('overflow', 99), 'teo-gemeos', 2_200).rejection)
      .toBeNull()
  })

  it('rebalances inactive operators when they rejoin instead of preserving a stacked team', () => {
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    const players = Array.from({ length: NUCLEUS_MAX_COMBATANTS }, (_, index) => (
      player(`stack-${index}`, index)
    ))
    for (const [index, current] of players.entries()) {
      record = joinNucleusCombat(record, current, 'luma-crivo', 1_000 + index * 2).record
      record = leaveNucleusCombat(record, current.id, 'selection', 1_001 + index * 2).record
    }
    expect(new Set(record.players.map(({ team }) => team))).toEqual(new Set(['cipher']))

    for (const [index, current] of players.entries()) {
      record = joinNucleusCombat(record, current, 'luma-crivo', 7_000 + index).record
    }
    const cipher = record.players.filter((candidate) => candidate.connected && candidate.team === 'cipher')
    const fracture = record.players.filter((candidate) => candidate.connected && candidate.team === 'fracture')
    expect(Math.abs(cipher.length - fracture.length)).toBeLessThanOrEqual(1)
    expect(toNucleusCombatState(record, 7_100).phase).toBe('active')
  })

  it('penalizes every leave/join toggle in a 1v1 and returns at the team spawn', () => {
    const ada = player('ada', 1)
    const gauss = player('gauss', 2)
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    record = joinNucleusCombat(record, ada, 'luma-crivo', 1_000).record
    record = joinNucleusCombat(record, gauss, 'raul-rsa', 1_001).record
    expect(toNucleusCombatState(record, 1_050).phase).toBe('active')
    record = {
      ...record,
      players: record.players.map((combatant) => combatant.id === ada.id
        ? { ...combatant, health: 1, shield: 0 }
        : combatant),
    }

    const left = leaveNucleusCombat(record, ada.id, 'selection', 1_100)
    expect(toNucleusCombatState(left.record, 1_100).phase).toBe('waiting')
    expect(left.record.players.find(({ id }) => id === ada.id)).toMatchObject({
      connected: false,
      health: 0,
      shield: 0,
      alive: false,
      deaths: 1,
      respawnAt: 6_100,
    })
    const spammed = joinNucleusCombat(left.record, ada, 'luma-crivo', 1_101)
    expect(spammed.rejection).toBe('rejoin-locked')
    expect(spammed.record).toEqual(left.record)
    expect(castNucleusAbility(left.record, [ada, gauss], gauss.id, {
      type: 'nucleus_cast', runId: RUN_ID, castId: 'phase:dodge', slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: 1 } }, clientTime: 1_102,
    }, 1_102).rejection).toBe('waiting-for-opponent')

    const returned = joinNucleusCombat(left.record, ada, 'luma-crivo', 6_100)
    expect(returned.rejection).toBeNull()
    expect(returned.record.players.find(({ id }) => id === ada.id)).toMatchObject({
      position: left.record.players.find(({ id }) => id === ada.id)?.spawnPosition,
      rejoinLockedUntil: 0,
      alive: false,
    })
    expect(toNucleusCombatState(returned.record, 6_100).phase).toBe('active')
    const respawned = tickNucleusCombat(returned.record, 6_100)
    expect(respawned.record.players.find(({ id }) => id === ada.id)).toMatchObject({
      alive: true,
      health: getHeroKit('luma-crivo').stats.maxHealth,
      shield: getHeroKit('luma-crivo').stats.maxShield,
    })

    const dropped = leaveNucleusCombat(respawned.record, ada.id, 'disconnect', 6_200)
    expect(joinNucleusCombat(dropped.record, ada, 'luma-crivo', 6_201).rejection)
      .toBe('rejoin-locked')
    const reconnected = joinNucleusCombat(dropped.record, ada, 'luma-crivo', 11_200)
    expect(reconnected.rejection).toBeNull()
    expect(reconnected.record.players.find(({ id }) => id === ada.id)?.position)
      .toEqual(dropped.record.players.find(({ id }) => id === ada.id)?.spawnPosition)
  })

  it('derives hits from persisted poses and enforces cooldown plus idempotency', () => {
    const ada = player('ada', 1)
    const gauss = player('gauss', 2)
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    record = joinNucleusCombat(record, ada, 'luma-crivo', 1_000).record
    record = joinNucleusCombat(record, gauss, 'raul-rsa', 1_001).record
    const [adaCombat, gaussCombat] = record.players
    const authoritativePlayers = [
      { ...ada, position: { ...adaCombat.position } },
      { ...gauss, position: { ...gaussCombat.position } },
    ]

    const cast = castNucleusAbility(record, authoritativePlayers, ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'cast:one',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: 3_100,
    }, 3_100)
    expect(cast.rejection).toBeNull()
    expect(cast.event).toMatchObject({
      kind: 'cast',
      casterId: ada.id,
      hitIds: [gauss.id],
    })
    if (cast.event?.kind !== 'cast') throw new Error('Expected cast event.')
    expect(cast.event.damages[0]?.amount).toBe(getHeroKit('luma-crivo').abilities.primary.damage?.amount)
    expect(cast.event.damages[0]?.sourceId).toBe(ada.id)

    const duplicate = castNucleusAbility(cast.record, authoritativePlayers, ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'cast:one',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: 3_101,
    }, 3_101)
    expect(duplicate.rejection).toBe('duplicate-cast')

    const cooldown = castNucleusAbility(cast.record, authoritativePlayers, ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'cast:two',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: 3_102,
    }, 3_102)
    expect(cooldown.rejection).toBe('cooldown')
  })

  it('persists and resolves shield recharge on the authoritative server clock', () => {
    const ada = player('ada', 1)
    const gauss = player('gauss', 2)
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    record = joinNucleusCombat(record, ada, 'luma-crivo', 1_000).record
    record = joinNucleusCombat(record, gauss, 'raul-rsa', 1_001).record
    const [adaCombat, gaussCombat] = record.players
    const authoritativePlayers = [
      { ...ada, position: { ...adaCombat.position } },
      { ...gauss, position: { ...gaussCombat.position } },
    ]
    const damaged = castNucleusAbility(record, authoritativePlayers, ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'recharge:one',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: 3_100,
    }, 3_100)
    expect(damaged.rejection).toBeNull()
    expect(isNucleusCombatRecord(damaged.record)).toBe(true)
    const afterDamage = damaged.record.players.find(({ id }) => id === gauss.id)
    expect(afterDamage?.shield).toBe(gaussCombat.maxShield - 17)
    expect(afterDamage?.statuses).toContainEqual(expect.objectContaining({ id: 'shield-recharging' }))

    const castDuringRecharge = castNucleusAbility(damaged.record, authoritativePlayers, ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'recharge:two',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: 3_100 + SHIELD_RECHARGE_DELAY_MS + 500,
    }, 3_100 + SHIELD_RECHARGE_DELAY_MS + 500)
    expect(castDuringRecharge.record.players.find(({ id }) => id === gauss.id)?.shield)
      .toBe(gaussCombat.maxShield - 17 + SHIELD_RECHARGE_PER_SECOND / 2 - 17)

    const beforeDelay = tickNucleusCombat(damaged.record, 3_100 + SHIELD_RECHARGE_DELAY_MS - 1)
    expect(beforeDelay.record.players.find(({ id }) => id === gauss.id)?.shield)
      .toBe(gaussCombat.maxShield - 17)
    const recovering = tickNucleusCombat(
      beforeDelay.record,
      3_100 + SHIELD_RECHARGE_DELAY_MS + 500,
    )
    expect(recovering.record.players.find(({ id }) => id === gauss.id)?.shield)
      .toBe(gaussCombat.maxShield - 17 + SHIELD_RECHARGE_PER_SECOND / 2)
  })

  it('migrates legacy same-hero vitals and hit radius while preserving their ratios', () => {
    const ada = player('ada', 1)
    let record = joinNucleusCombat(
      createInitialNucleusCombat(RUN_ID, 1_000),
      ada,
      'luma-crivo',
      1_000,
    ).record
    record = {
      ...record,
      players: [{
        ...record.players[0],
        health: 125,
        maxHealth: 250,
        shield: 40,
        maxShield: 80,
        hitRadius: 0.46,
      }],
    }
    const left = leaveNucleusCombat(record, ada.id, 'selection', 2_000)
    const rejoined = joinNucleusCombat(left.record, ada, 'luma-crivo', 7_000)
    const migrated = rejoined.record.players[0]
    const kit = getHeroKit('luma-crivo')

    expect(migrated).toMatchObject({
      heroId: 'luma-crivo',
      maxHealth: kit.stats.maxHealth,
      health: kit.stats.maxHealth / 2,
      maxShield: kit.stats.maxShield,
      shield: kit.stats.maxShield / 2,
      hitRadius: kit.stats.hitRadius,
    })
    expect(isNucleusCombatRecord(rejoined.record)).toBe(true)
  })

  it('protects a fresh spawn until it attacks or the protection expires', () => {
    const ada = player('ada', 1)
    const gauss = player('gauss', 2)
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    record = joinNucleusCombat(record, ada, 'luma-crivo', 1_000).record
    record = joinNucleusCombat(record, gauss, 'raul-rsa', 1_001).record
    record = {
      ...record,
      players: record.players.map((combatant) => ({
        ...combatant,
        position: combatant.id === ada.id
          ? { x: 5, y: 0.05, z: 10 }
          : { x: 5, y: 0.05, z: 5 },
      })),
    }
    const authoritativePlayers = record.players.map((combatant, index) => ({
      ...(index === 0 ? ada : gauss),
      position: { ...combatant.position },
    }))
    const targetBefore = record.players.find(({ id }) => id === gauss.id)
    const cast = castNucleusAbility(record, authoritativePlayers, ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'protected:spawn',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: 1_100,
    }, 1_100)
    expect(cast.event).toMatchObject({ kind: 'cast', hitIds: [gauss.id], damages: [] })
    const casterAfter = cast.record.players.find(({ id }) => id === ada.id)
    const targetAfter = cast.record.players.find(({ id }) => id === gauss.id)
    expect(casterAfter?.statuses.some(({ id }) => id === 'spawn-protected')).toBe(false)
    expect(targetAfter).toMatchObject({ health: targetBefore?.health, shield: targetBefore?.shield })
    expect(targetAfter?.statuses).toEqual([expect.objectContaining({ id: 'spawn-protected' })])
  })

  it('uses one direction for a damaging movement cast even when aim.point disagrees', () => {
    const ada = player('ada', 1)
    const gauss = player('gauss', 2)
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    record = joinNucleusCombat(record, ada, 'raul-rsa', 1_000).record
    record = joinNucleusCombat(record, gauss, 'luma-crivo', 1_001).record
    record = {
      ...record,
      players: record.players.map((combatant) => ({
        ...combatant,
        position: combatant.id === ada.id
          ? { x: 5, y: 0.05, z: 15 }
          : { x: 5, y: 0.05, z: 10 },
      })),
    }
    const authoritativePlayers = record.players.map((combatant, index) => ({
      ...(index === 0 ? ada : gauss),
      position: { ...combatant.position },
    }))
    const cast = castNucleusAbility(record, authoritativePlayers, ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'coherent:dash',
      slot: 'mobility',
      aim: {
        direction: { x: 0, y: 0, z: -1 },
        point: { x: 5, y: 0.05, z: 23 },
      },
      clientTime: 4_000,
    }, 4_000)
    if (cast.event?.kind !== 'cast') throw new Error('Expected movement cast event.')
    expect(cast.event.hitIds).toEqual([gauss.id])
    expect(cast.event.damages).toEqual([expect.objectContaining({
      sourceId: ada.id,
      targetId: gauss.id,
      amount: 22,
    })])
    expect('point' in cast.event).toBe(false)
    expect(cast.event.destination?.z).toBeLessThan(15)
  })

  it('attributes reflected damage to the reflector without a fake self-elimination', () => {
    const ada = player('ada', 1)
    const gauss = player('gauss', 2)
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    record = joinNucleusCombat(record, ada, 'luma-crivo', 1_000).record
    record = joinNucleusCombat(record, gauss, 'raul-rsa', 1_001).record
    record = {
      ...record,
      players: record.players.map((combatant) => {
        if (combatant.id === ada.id) return { ...combatant, health: 5, shield: 0 }
        if (combatant.id === gauss.id) {
          return {
            ...combatant,
            statuses: [{ id: 'reflecting' as const, expiresAt: 5_000, magnitude: 1 }],
          }
        }
        return combatant
      }),
    }
    const authoritativePlayers = record.players.map((combatant, index) => ({
      ...(index === 0 ? ada : gauss),
      position: { ...combatant.position },
    }))
    const cast = castNucleusAbility(record, authoritativePlayers, ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'reflected:cast',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: 1_100,
    }, 1_100)
    if (cast.event?.kind !== 'cast') throw new Error('Expected reflected cast event.')
    expect(cast.event.damages.find(({ targetId }) => targetId === ada.id)).toMatchObject({
      sourceId: gauss.id,
      targetId: ada.id,
      eliminated: true,
    })
    expect(cast.event.eliminatedIds).not.toContain(ada.id)
    expect(cast.record.players.find(({ id }) => id === gauss.id)?.eliminations).toBe(1)
  })

  it('waits for an opponent on the other team before accepting combat casts', () => {
    const ada = player('ada', 1)
    const record = joinNucleusCombat(
      createInitialNucleusCombat(RUN_ID, 1_000),
      ada,
      'luma-crivo',
      1_000,
    ).record
    expect(toNucleusCombatState(record, 1_100).phase).toBe('waiting')
    expect(castNucleusAbility(record, [ada], ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'waiting:cast',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: 1_100,
    }, 1_100).rejection).toBe('waiting-for-opponent')
  })

  it('preserves vitality ratios but clears cross-kit advantages when switching hero', () => {
    const ada = player('ada', 1)
    let record = joinNucleusCombat(
      createInitialNucleusCombat(RUN_ID, 1_000),
      ada,
      'luma-crivo',
      1_000,
    ).record
    const original = record.players[0]
    record = {
      ...record,
      players: [{
        ...original,
        health: original.maxHealth / 2,
        shield: original.maxShield / 4,
        cooldownReadyAt: { ...original.cooldownReadyAt, signature: 9_000 },
        ultimateCharge: 90,
        statuses: [{ id: 'reflecting' as const, expiresAt: 20_000, magnitude: 0.5 }],
      }],
    }
    record = leaveNucleusCombat(record, ada.id, 'selection', 2_000).record
    expect(record.players[0].statuses).toEqual([])
    expect(joinNucleusCombat(record, ada, 'raul-rsa', 6_999).rejection).toBe('rejoin-locked')
    const switched = joinNucleusCombat(record, ada, 'raul-rsa', 7_000)
    expect(switched.rejection).toBeNull()
    const combatant = switched.record.players[0]
    const rsa = getHeroKit('raul-rsa')
    expect(combatant.heroId).toBe('raul-rsa')
    expect(combatant.health).toBeCloseTo(rsa.stats.maxHealth / 2)
    expect(combatant.shield).toBeCloseTo(rsa.stats.maxShield / 4)
    expect(combatant.statuses).toEqual([expect.objectContaining({
      id: 'spawn-protected', expiresAt: 7_000 + SPAWN_PROTECTION_MS,
    })])
    expect(combatant.ultimateCharge).toBe(0)
    expect(combatant.cooldownReadyAt.signature)
      .toBe(7_000 + rsa.abilities.signature.cooldownMs)
  })

  it('respawns server-side with full pools and temporary protection', () => {
    const ada = player('ada', 1)
    let record = joinNucleusCombat(
      createInitialNucleusCombat(RUN_ID, 1_000),
      ada,
      'yara-diffie',
      1_000,
    ).record
    const current = record.players[0]
    record = {
      ...record,
      players: [{ ...current, health: 0, shield: 0, alive: false, respawnAt: 6_000 }],
    }
    expect(tickNucleusCombat(record, 5_999).events).toHaveLength(0)
    const ticked = tickNucleusCombat(record, 6_000)
    expect(ticked.events).toEqual([{
      kind: 'respawned', playerId: ada.id, position: current.spawnPosition,
    }])
    const respawned = ticked.record.players[0]
    expect(respawned).toMatchObject({
      alive: true,
      health: respawned.maxHealth,
      shield: respawned.maxShield,
      respawnAt: null,
    })
    expect(respawned.statuses).toEqual([expect.objectContaining({
      id: 'spawn-protected', expiresAt: 6_000 + SPAWN_PROTECTION_MS,
    })])
  })

  it('never silently respawns during cast or reconnect mutations', () => {
    const ada = player('ada', 1)
    const gauss = player('gauss', 2)
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    record = joinNucleusCombat(record, ada, 'luma-crivo', 1_000).record
    record = joinNucleusCombat(record, gauss, 'raul-rsa', 1_001).record
    record = {
      ...record,
      players: record.players.map((combatant) => combatant.id === ada.id
        ? { ...combatant, health: 0, shield: 0, alive: false, respawnAt: 2_000 }
        : combatant),
    }
    const authoritativePlayers = record.players.map((combatant, index) => ({
      ...(index === 0 ? ada : gauss),
      position: { ...combatant.position },
    }))

    const expiredCast = castNucleusAbility(record, authoritativePlayers, ada.id, {
      type: 'nucleus_cast',
      runId: RUN_ID,
      castId: 'after:deadline',
      slot: 'primary',
      aim: { direction: { x: 0, y: 0, z: -1 } },
      clientTime: 2_001,
    }, 2_001)
    expect(expiredCast.rejection).toBe('dead')
    expect(expiredCast.record.players.find(({ id }) => id === ada.id)?.alive).toBe(false)

    record = leaveNucleusCombat(expiredCast.record, ada.id, 'disconnect', 2_002).record
    expect(joinNucleusCombat(record, ada, 'luma-crivo', 2_003).rejection).toBe('rejoin-locked')
    const rejoined = joinNucleusCombat(record, ada, 'luma-crivo', 7_002)
    expect(rejoined.record.players.find(({ id }) => id === ada.id)).toMatchObject({
      connected: true,
      alive: false,
      respawnAt: 2_000,
    })

    const ticked = tickNucleusCombat(rejoined.record, 7_002)
    expect(ticked.events).toEqual([expect.objectContaining({
      kind: 'respawned', playerId: ada.id,
    })])
    expect(ticked.record.players.find(({ id }) => id === ada.id)?.alive).toBe(true)
  })

  it('bounds retained reconnect records under heavy join/leave churn', () => {
    let record = createInitialNucleusCombat(RUN_ID, 1_000)
    for (let index = 0; index < 80; index += 1) {
      const current = player(`churn-${index}`, index)
      record = joinNucleusCombat(record, current, 'teo-gemeos', 1_000 + index * 2).record
      record = leaveNucleusCombat(record, current.id, 'disconnect', 1_001 + index * 2).record
    }
    expect(record.players.length).toBeLessThanOrEqual(64)
    expect(record.players.some(({ id }) => id === 'churn-79')).toBe(true)
    expect(record.players.some(({ id }) => id === 'churn-0')).toBe(false)
    expect(isNucleusCombatRecord(record)).toBe(true)
  })
})
