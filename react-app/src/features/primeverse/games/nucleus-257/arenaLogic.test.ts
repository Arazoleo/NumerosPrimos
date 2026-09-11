import { describe, expect, it } from 'vitest'

import {
  ABILITY_SLOTS,
  HERO_IDS,
  HERO_KIT_LIST,
  HERO_KITS,
  getHeroKit,
} from './classKits'
import {
  BOT_DAMAGE_SCALE,
  DAMAGE_GUARD_DURATION_MS,
  DAMAGE_GUARD_REDUCTION,
  PYLON_CAPTURE_MS,
  PYLON_SEQUENCE,
  RESPAWN_DELAY_MS,
  SHIELD_RECHARGE_DELAY_MS,
  SHIELD_RECHARGE_PER_SECOND,
  SPAWN_PROTECTION_MS,
  activePylon,
  advanceObjective,
  applyDamage,
  canCast,
  castAbility,
  chooseBotDecision,
  clearExpiredStatuses,
  cooldownRemainingMs,
  createCombatant,
  createObjectiveState,
  gainUltimateCharge,
  hitShapeContainsPoint,
  normalizeDirection,
  resolveAbilityHits,
  respawnCombatant,
  selectAimTarget,
  tickCombatants,
  type AbilityCastResult,
  type CombatantState,
  type HeroId,
  type TeamId,
  type Vec3,
} from './arenaLogic'

const ORIGIN: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 })
const FORWARD: Vec3 = Object.freeze({ x: 0, y: 0, z: 1 })

function fighter(
  id: string,
  heroId: HeroId,
  team: TeamId,
  position: Vec3,
  bot = false,
): CombatantState {
  return createCombatant({ id, heroId, team, position, facing: FORWARD, bot })
}

function combatant(result: AbilityCastResult, id: string): CombatantState {
  const value = result.combatants.find((candidate) => candidate.id === id)
  if (!value) throw new Error(`Missing test combatant: ${id}`)
  return value
}

describe('Núcleo 257 hero kits', () => {
  it('defines five complete and mechanically distinct kits', () => {
    expect(HERO_IDS).toEqual([
      'luma-crivo',
      'raul-rsa',
      'teo-gemeos',
      'yara-diffie',
      'iris-mersenne',
    ])
    expect(new Set(HERO_IDS)).toHaveLength(5)

    const abilityIds = new Set<string>()
    const mechanics = new Set<string>()
    for (const id of HERO_IDS) {
      const kit = getHeroKit(id)
      expect(kit.id).toBe(id)
      expect(Object.keys(kit.abilities)).toEqual(ABILITY_SLOTS)
      expect(kit.stats.maxHealth).toBeGreaterThan(0)
      expect(kit.stats.maxShield).toBeGreaterThanOrEqual(0)
      expect(kit.stats.moveSpeed).toBeGreaterThan(0)
      expect(Object.isFrozen(kit)).toBe(true)
      expect(Object.isFrozen(kit.stats)).toBe(true)
      expect(Object.isFrozen(kit.abilities)).toBe(true)

      for (const slot of ABILITY_SLOTS) {
        const ability = kit.abilities[slot]
        expect(ability.slot).toBe(slot)
        expect(ability.cooldownMs).toBeGreaterThan(0)
        expect(abilityIds.has(ability.id)).toBe(false)
        expect(mechanics.has(ability.mechanic)).toBe(false)
        abilityIds.add(ability.id)
        mechanics.add(ability.mechanic)
      }
    }

    expect(abilityIds.size).toBe(HERO_IDS.length * ABILITY_SLOTS.length)
    expect(mechanics.size).toBe(HERO_IDS.length * ABILITY_SLOTS.length)
    expect(HERO_KITS['luma-crivo'].role).toBe('controller')
    expect(HERO_KITS['raul-rsa'].role).toBe('tank')
    expect(HERO_KITS['teo-gemeos'].role).toBe('assault')
    expect(HERO_KITS['yara-diffie'].role).toBe('infiltrator')
  })

  it('keeps discrete perfect-primary time-to-kill between twelve and nineteen seconds', () => {
    for (const attacker of Object.values(HERO_KITS)) {
      const primary = attacker.abilities.primary
      const damagePerCast = (primary.damage?.amount ?? 0) * (primary.damage?.instances ?? 1)

      for (const defender of Object.values(HERO_KITS)) {
        const effectiveVitality = defender.stats.maxHealth + defender.stats.maxShield
        const castsToEliminate = Math.ceil(effectiveVitality / damagePerCast)
        const perfectTtkSeconds = (castsToEliminate - 1) * primary.cooldownMs / 1_000
        expect(perfectTtkSeconds, `${attacker.codename} -> ${defender.codename}`).toBeGreaterThanOrEqual(12)
        expect(perfectTtkSeconds, `${attacker.codename} -> ${defender.codename}`).toBeLessThanOrEqual(19)
      }
    }
  })

  it('rejects unknown heroes instead of silently selecting a fallback', () => {
    expect(() => getHeroKit('not-a-hero')).toThrow(RangeError)
  })
})

describe('Núcleo 257 combatants and aim geometry', () => {
  it('creates an independent combatant snapshot from its kit', () => {
    const source = { x: 2, y: 1, z: -4 }
    const luma = createCombatant({
      id: 'player',
      heroId: 'luma-crivo',
      team: 'cipher',
      position: source,
      facing: { x: 0, y: 0, z: 8 },
    })

    expect(luma.position).toEqual(source)
    expect(luma.position).not.toBe(source)
    expect(luma.facing).toEqual(FORWARD)
    expect(luma.health).toBe(getHeroKit('luma-crivo').stats.maxHealth)
    expect(luma.cooldownReadyAtMs).toEqual({
      primary: 0,
      signature: 0,
      mobility: 0,
      ultimate: 0,
    })
    source.x = 99
    expect(luma.position.x).toBe(2)
  })

  it('rejects malformed positions and zero facing vectors', () => {
    expect(() => createCombatant({
      id: 'bad',
      heroId: 'luma-crivo',
      team: 'cipher',
      position: { x: Number.NaN, y: 0, z: 0 },
    })).toThrow(RangeError)
    expect(() => normalizeDirection(ORIGIN)).toThrow(RangeError)
  })

  it('uses target radius and inclusive boundaries for ray hits', () => {
    const ray = { kind: 'ray', range: 10, radius: 0.1 } as const
    expect(hitShapeContainsPoint(ray, ORIGIN, { direction: FORWARD }, { x: 0.55, y: 0, z: 10 }, 0.45)).toBe(true)
    expect(hitShapeContainsPoint(ray, ORIGIN, { direction: FORWARD }, { x: 0.56, y: 0, z: 10 }, 0.45)).toBe(false)
    expect(hitShapeContainsPoint(ray, ORIGIN, { direction: FORWARD }, { x: 0, y: 0, z: -1 }, 0)).toBe(false)
  })

  it('accepts a cone edge but rejects points behind the caster', () => {
    const cone = { kind: 'cone', range: 10, halfAngleDegrees: 30 } as const
    const radians = Math.PI / 6
    const edge = { x: Math.sin(radians) * 10, y: 0, z: Math.cos(radians) * 10 }
    expect(hitShapeContainsPoint(cone, ORIGIN, { direction: FORWARD }, edge)).toBe(true)
    expect(hitShapeContainsPoint(cone, ORIGIN, { direction: FORWARD }, { x: 0, y: 0, z: -3 })).toBe(false)
  })

  it('counts a target capsule that overlaps a cone edge', () => {
    const cone = { kind: 'cone', range: 10, halfAngleDegrees: 30 } as const
    const nearAngle = 32 * Math.PI / 180
    const farAngle = 34 * Math.PI / 180
    expect(hitShapeContainsPoint(
      cone,
      ORIGIN,
      { direction: FORWARD },
      { x: Math.sin(nearAngle) * 10, y: 0, z: Math.cos(nearAngle) * 10 },
      0.5,
    )).toBe(true)
    expect(hitShapeContainsPoint(
      cone,
      ORIGIN,
      { direction: FORWARD },
      { x: Math.sin(farAngle) * 10, y: 0, z: Math.cos(farAngle) * 10 },
      0.5,
    )).toBe(false)
  })

  it('clamps aim-centered radius attacks to their maximum placement range', () => {
    const radius = { kind: 'radius', center: 'aim', radius: 2, maxRange: 10 } as const
    const aim = { direction: FORWARD, point: { x: 0, y: 0, z: 100 } }
    expect(hitShapeContainsPoint(radius, ORIGIN, aim, { x: 0, y: 0, z: 12 })).toBe(true)
    expect(hitShapeContainsPoint(radius, ORIGIN, aim, { x: 0, y: 0, z: 12.01 })).toBe(false)
  })

  it('selects deterministically while excluding allies, dead targets, and blocked sight', () => {
    const shooter = fighter('shooter', 'luma-crivo', 'cipher', ORIGIN)
    const ally = fighter('ally', 'raul-rsa', 'cipher', { x: 0, y: 0, z: 2 })
    const beta = fighter('beta', 'teo-gemeos', 'fracture', { x: 0, y: 0, z: 6 })
    const alpha = fighter('alpha', 'yara-diffie', 'fracture', { x: 0, y: 0, z: 6 })
    const dead = applyDamage(
      fighter('dead', 'luma-crivo', 'fracture', { x: 0, y: 0, z: 1 }),
      1_000,
      0,
    ).target
    const shape = { kind: 'ray', range: 20, radius: 0.2 } as const

    expect(selectAimTarget(shooter, [beta, ally, dead, alpha], shape, { direction: FORWARD })?.id).toBe('alpha')
    expect(selectAimTarget(
      shooter,
      [alpha],
      shape,
      { direction: FORWARD },
      { hasLineOfSight: () => false },
    )).toBeNull()
  })

  it('supports an eye origin and body point for first-person 3D aiming', () => {
    const shooter = fighter('shooter', 'luma-crivo', 'cipher', ORIGIN)
    const target = fighter('target', 'teo-gemeos', 'fracture', { x: 0, y: 0, z: 8 })
    const hitOrigin = { x: 0, y: 1.72, z: 0 }
    const targetBody = { x: 0, y: 1.18, z: 8 }
    const aligned = normalizeDirection({
      x: targetBody.x - hitOrigin.x,
      y: targetBody.y - hitOrigin.y,
      z: targetBody.z - hitOrigin.z,
    })
    const lookingAbove = normalizeDirection({ x: 0, y: 1, z: 8 })
    const options = { hitOrigin, hitPoint: () => targetBody }

    expect(selectAimTarget(
      shooter,
      [shooter, target],
      getHeroKit(shooter.heroId).abilities.primary.hitShape,
      { direction: aligned },
      options,
    )?.id).toBe(target.id)
    expect(selectAimTarget(
      shooter,
      [shooter, target],
      getHeroKit(shooter.heroId).abilities.primary.hitShape,
      { direction: lookingAbove },
      options,
    )).toBeNull()
  })
})

describe('Núcleo 257 damage, shields, and respawn', () => {
  it('uses a readable five-second respawn and two-second safe re-entry', () => {
    expect(RESPAWN_DELAY_MS).toBe(5_000)
    expect(SPAWN_PROTECTION_MS).toBe(2_000)
  })

  it('drains shield before health and clamps overkill', () => {
    const raul = fighter('raul', 'raul-rsa', 'fracture', ORIGIN)
    const firstDamage = raul.maxShield + 10
    const first = applyDamage(raul, firstDamage, 1_000)
    expect(first).toMatchObject({
      requestedDamage: firstDamage,
      appliedDamage: firstDamage,
      absorbedByShield: raul.maxShield,
      healthDamage: 10,
      eliminated: false,
    })
    expect(first.target).toMatchObject({ shield: 0, health: raul.maxHealth - 10, alive: true })

    const lethal = applyDamage(first.target, 1_000, 1_500)
    expect(lethal.appliedDamage).toBe(raul.maxHealth - 10)
    expect(lethal.target).toMatchObject({
      shield: 0,
      health: 0,
      alive: false,
      deaths: 1,
      respawnAtMs: 1_500 + RESPAWN_DELAY_MS,
    })

    const repeated = applyDamage(lethal.target, 50, 1_600)
    expect(repeated.target).toBe(lethal.target)
    expect(repeated.eliminated).toBe(false)
  })

  it('supports shield bypass and rejects invalid damage values', () => {
    const target = fighter('target', 'luma-crivo', 'fracture', ORIGIN)
    const result = applyDamage(target, 20, 0, { bypassShield: true })
    expect(result.target.shield).toBe(target.shield)
    expect(result.target.health).toBe(target.health - 20)
    expect(() => applyDamage(target, -1, 0)).toThrow(RangeError)
    expect(() => applyDamage(target, Number.NaN, 0)).toThrow(RangeError)
  })

  it('softens stacked impacts for half a second without changing duel cadence', () => {
    const target = fighter('target', 'luma-crivo', 'fracture', ORIGIN)
    const first = applyDamage(target, 40, 1_000)
    const focused = applyDamage(first.target, 40, 1_000 + DAMAGE_GUARD_DURATION_MS - 1)
    const afterWindow = applyDamage(first.target, 40, 1_000 + DAMAGE_GUARD_DURATION_MS)

    expect(first.appliedDamage).toBe(40)
    expect(focused.appliedDamage).toBe(40 * (1 - DAMAGE_GUARD_REDUCTION))
    expect(afterWindow.appliedDamage).toBe(40)
    expect(first.target.statuses['damage-guard']).toMatchObject({
      expiresAtMs: 1_000 + DAMAGE_GUARD_DURATION_MS,
      magnitude: DAMAGE_GUARD_REDUCTION,
    })
  })

  it('recharges shields on the shared deterministic clock after a damage-free delay', () => {
    const target = fighter('target', 'luma-crivo', 'fracture', ORIGIN)
    const damaged = applyDamage(target, 40, 1_000).target
    const rechargeStartsAt = 1_000 + SHIELD_RECHARGE_DELAY_MS

    expect(tickCombatants([damaged], rechargeStartsAt - 1)[0].shield).toBe(60)
    expect(tickCombatants([damaged], rechargeStartsAt + 500)[0].shield)
      .toBe(60 + SHIELD_RECHARGE_PER_SECOND / 2)
    const full = tickCombatants([damaged], 20_000)[0]
    expect(full.shield).toBe(full.maxShield)
    expect(full.statuses['shield-recharging']).toBeUndefined()
  })

  it('respawns exactly on its deadline with protection and preserved cooldowns', () => {
    const base = fighter('target', 'yara-diffie', 'fracture', { x: 3, y: 0, z: -2 })
    const prepared: CombatantState = {
      ...base,
      position: { x: 20, y: 4, z: 20 },
      ultimateCharge: 63,
      cooldownReadyAtMs: { ...base.cooldownReadyAtMs, signature: 9_000 },
    }
    const dead = applyDamage(prepared, 10_000, 2_000).target
    expect(respawnCombatant(dead, dead.respawnAtMs! - 1)).toBe(dead)

    const respawned = respawnCombatant(dead, dead.respawnAtMs!)
    expect(respawned).toMatchObject({
      alive: true,
      position: base.spawnPosition,
      health: base.maxHealth,
      shield: base.maxShield,
      ultimateCharge: 63,
      respawnAtMs: null,
    })
    expect(respawned.cooldownReadyAtMs.signature).toBe(9_000)
    expect(applyDamage(respawned, 50, dead.respawnAtMs!).appliedDamage).toBe(0)

    const protectionEndsAt = dead.respawnAtMs! + SPAWN_PROTECTION_MS
    expect(clearExpiredStatuses(respawned, protectionEndsAt).statuses).toEqual({})
    expect(applyDamage(respawned, 50, protectionEndsAt).appliedDamage).toBe(50)
    expect(tickCombatants([dead], dead.respawnAtMs!)[0].alive).toBe(true)
  })

  it('ends spawn protection on an offensive cast but preserves it for an escape', () => {
    const base = fighter('teo', 'teo-gemeos', 'cipher', ORIGIN)
    const dead = applyDamage(base, 10_000, 0).target
    const respawned = respawnCombatant(dead, RESPAWN_DELAY_MS)
    const escaped = castAbility(
      [respawned],
      respawned.id,
      'mobility',
      { direction: FORWARD },
      RESPAWN_DELAY_MS,
    )
    expect(combatant(escaped, respawned.id).statuses['spawn-protected']).toBeDefined()

    const chargingBase = fighter('raul', 'raul-rsa', 'cipher', ORIGIN)
    const charging = respawnCombatant(applyDamage(chargingBase, 10_000, 0).target, RESPAWN_DELAY_MS)
    const chargeTarget = fighter('charge-target', 'luma-crivo', 'fracture', { x: 0, y: 0, z: 5 })
    const charged = castAbility(
      [charging, chargeTarget],
      charging.id,
      'mobility',
      { direction: FORWARD },
      RESPAWN_DELAY_MS,
    )
    expect(combatant(charged, charging.id).statuses['spawn-protected']).toBeUndefined()

    const attacker = respawnCombatant(dead, RESPAWN_DELAY_MS)
    const enemy = fighter('enemy', 'luma-crivo', 'fracture', { x: 0, y: 0, z: 6 })
    const fired = castAbility(
      [attacker, enemy],
      attacker.id,
      'primary',
      { direction: FORWARD },
      RESPAWN_DELAY_MS,
    )
    expect(combatant(fired, attacker.id).statuses['spawn-protected']).toBeUndefined()
  })

  it('reduces sentinel damage without changing player-versus-player damage', () => {
    const human = fighter('human', 'luma-crivo', 'cipher', ORIGIN)
    const bot = fighter('bot', 'luma-crivo', 'cipher', ORIGIN, true)
    const humanTarget = fighter('human-target', 'teo-gemeos', 'fracture', { x: 0, y: 0, z: 6 })
    const botTarget = fighter('bot-target', 'teo-gemeos', 'fracture', { x: 0, y: 0, z: 6 })
    const humanCast = castAbility([human, humanTarget], human.id, 'primary', { direction: FORWARD }, 0)
    const botCast = castAbility([bot, botTarget], bot.id, 'primary', { direction: FORWARD }, 0)

    expect(botCast.damageDealt).toBeCloseTo(humanCast.damageDealt * BOT_DAMAGE_SCALE)
  })

  it('caps ultimate charge at one hundred', () => {
    const luma = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    expect(gainUltimateCharge(luma, 35).ultimateCharge).toBe(35)
    expect(gainUltimateCharge(luma, 350).ultimateCharge).toBe(100)
  })
})

describe('Núcleo 257 ability resolution', () => {
  it('consumes a valid primary even on a miss and unlocks at the exact deadline', () => {
    const luma = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    const miss = castAbility([luma], luma.id, 'primary', { direction: FORWARD }, 1_000)
    expect(miss).toMatchObject({ ok: true, damageDealt: 0, hitIds: [] })
    const afterShot = combatant(miss, luma.id)
    const readyAt = 1_000 + getHeroKit('luma-crivo').abilities.primary.cooldownMs
    expect(cooldownRemainingMs(afterShot, 'primary', readyAt - 1)).toBe(1)
    expect(canCast(afterShot, 'primary', readyAt - 1)).toBe(false)
    expect(canCast(afterShot, 'primary', readyAt)).toBe(true)

    const repeated = castAbility(miss.combatants, luma.id, 'primary', { direction: FORWARD }, 1_000)
    expect(repeated.ok).toBe(false)
    expect(repeated.reason).toBe('cooldown')
    expect(repeated.combatants).toBe(miss.combatants)
  })

  it('applies effective damage, status, kill credit, and non-overkill ultimate charge', () => {
    const luma = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    const fragileBase = fighter('fragile', 'yara-diffie', 'fracture', { x: 0, y: 0, z: 6 })
    const fragile: CombatantState = { ...fragileBase, health: 5, shield: 0 }
    const result = castAbility([luma, fragile], luma.id, 'primary', { direction: FORWARD }, 0)
    const attacker = combatant(result, luma.id)

    expect(result.hitIds).toEqual(['fragile'])
    expect(result.damageDealt).toBe(5)
    expect(result.eliminatedIds).toEqual(['fragile'])
    expect(attacker.eliminations).toBe(1)
    expect(attacker.ultimateCharge).toBeCloseTo(5 * 0.72 + 12)
  })

  it('gives Luma an aimed control field with radius hits and debuffs', () => {
    const luma = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    const near = fighter('near', 'teo-gemeos', 'fracture', { x: 1, y: 0, z: 12 })
    const far = fighter('far', 'teo-gemeos', 'fracture', { x: 8, y: 0, z: 12 })
    const result = castAbility(
      [luma, near, far],
      luma.id,
      'signature',
      { direction: FORWARD, point: { x: 0, y: 0, z: 12 } },
      100,
    )

    expect(result.hitIds).toEqual(['near'])
    expect(combatant(result, 'near').statuses.slowed?.magnitude).toBe(0.24)
    expect(combatant(result, 'near').statuses.revealed).toBeDefined()
  })

  it('gives Raul shielding/reflection, Teo a dash, and Yara a blink/cloak', () => {
    const raulBase = fighter('raul', 'raul-rsa', 'cipher', ORIGIN)
    const raul: CombatantState = { ...raulBase, shield: 0 }
    const raulCast = castAbility([raul], raul.id, 'signature', { direction: FORWARD }, 0)
    expect(combatant(raulCast, raul.id).shield).toBe(120)
    expect(combatant(raulCast, raul.id).statuses.reflecting?.magnitude).toBe(0.22)

    const teo = fighter('teo', 'teo-gemeos', 'cipher', ORIGIN)
    const teoCast = castAbility([teo], teo.id, 'mobility', { direction: FORWARD }, 0)
    expect(combatant(teoCast, teo.id).position.z).toBe(10.5)

    const yara = fighter('yara', 'yara-diffie', 'cipher', ORIGIN)
    const yaraCast = castAbility(
      [yara],
      yara.id,
      'mobility',
      { direction: FORWARD, point: { x: 3, y: 0, z: 4 } },
      0,
    )
    expect(combatant(yaraCast, yara.id).position).toEqual({ x: 3, y: 0, z: 4 })
    expect(combatant(yaraCast, yara.id).statuses.cloaked).toBeDefined()
  })

  it('makes each offensive kit mechanic change combat instead of only changing visuals', () => {
    const revealedBase = fighter('revealed', 'teo-gemeos', 'fracture', { x: 0, y: 0, z: 8 })
    const revealed: CombatantState = {
      ...revealedBase,
      statuses: { revealed: { id: 'revealed', expiresAtMs: 5_000, magnitude: 1 } },
    }
    const luma = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    const precision = castAbility([luma, revealed], luma.id, 'primary', { direction: FORWARD }, 1_000)
    expect(precision.damageDealt).toBeCloseTo(17 * 1.25)

    const markedBase = fighter('marked', 'luma-crivo', 'fracture', { x: 0, y: 0, z: 8 })
    const marked: CombatantState = {
      ...markedBase,
      statuses: { marked: { id: 'marked', expiresAtMs: 5_000, magnitude: 0.12 } },
    }
    const teo = fighter('teo', 'teo-gemeos', 'cipher', ORIGIN)
    const converged = castAbility([teo, marked], teo.id, 'primary', { direction: FORWARD }, 1_000)
    expect(converged.damageDealt).toBeCloseTo(18 * 1.12 * 1.22)
    expect(combatant(converged, marked.id).statuses.marked).toBeUndefined()

    const yaraBase = fighter('yara', 'yara-diffie', 'cipher', ORIGIN)
    const yara: CombatantState = {
      ...yaraBase,
      statuses: { cloaked: { id: 'cloaked', expiresAtMs: 5_000, magnitude: 1 } },
    }
    const victim = fighter('victim', 'luma-crivo', 'fracture', { x: 0, y: 0, z: 8 })
    const ambush = castAbility([yara, victim], yara.id, 'primary', { direction: FORWARD }, 1_000)
    expect(ambush.damageDealt).toBeCloseTo(17 * 1.35)
    expect(combatant(ambush, yara.id).statuses.cloaked).toBeUndefined()
  })

  it('disperses Raul scatter pellets toward the edge of its cone', () => {
    const nearRaul = fighter('near-raul', 'raul-rsa', 'cipher', ORIGIN)
    const near = fighter('near', 'luma-crivo', 'fracture', { x: 0, y: 0, z: 4 })
    const closeCast = castAbility([nearRaul, near], nearRaul.id, 'primary', { direction: FORWARD }, 0)

    const farRaul = fighter('far-raul', 'raul-rsa', 'cipher', ORIGIN)
    const far = fighter('far', 'luma-crivo', 'fracture', { x: 0, y: 0, z: 14 })
    const farCast = castAbility([farRaul, far], farRaul.id, 'primary', { direction: FORWARD }, 0)

    expect(closeCast.damageDealt).toBe(30)
    expect(farCast.damageDealt).toBe(12)
  })

  it('lets a zero-distance mobility input consume the cast without throwing', () => {
    const teo = fighter('teo', 'teo-gemeos', 'cipher', ORIGIN)
    const result = castAbility(
      [teo],
      teo.id,
      'mobility',
      { direction: FORWARD, point: ORIGIN },
      0,
    )
    expect(result.ok).toBe(true)
    expect(combatant(result, teo.id).position).toEqual(ORIGIN)
  })

  it('credits the reflector when reflected damage eliminates an attacker', () => {
    const attackerBase = fighter('attacker', 'luma-crivo', 'cipher', ORIGIN)
    const attacker: CombatantState = { ...attackerBase, health: 5, shield: 0 }
    const defenderBase = fighter('defender', 'raul-rsa', 'fracture', { x: 0, y: 0, z: 6 })
    const defender: CombatantState = {
      ...defenderBase,
      statuses: {
        reflecting: { id: 'reflecting', expiresAtMs: 5_000, magnitude: 1 },
      },
    }
    const result = castAbility([attacker, defender], attacker.id, 'primary', { direction: FORWARD }, 1_000)

    expect(combatant(result, attacker.id).alive).toBe(false)
    expect(combatant(result, defender.id).eliminations).toBe(1)
    expect(combatant(result, attacker.id).ultimateCharge).toBe(0)
  })

  it('requires full ultimate charge, consumes it atomically, and does not self-recharge', () => {
    const base = fighter('teo', 'teo-gemeos', 'cipher', ORIGIN)
    const enemy = fighter('enemy', 'raul-rsa', 'fracture', { x: 0, y: 0, z: 8 })
    expect(canCast(base, 'ultimate', 0)).toBe(false)
    expect(castAbility([base, enemy], base.id, 'ultimate', { direction: FORWARD }, 0).reason)
      .toBe('ultimate-not-ready')

    const charged: CombatantState = { ...base, ultimateCharge: 100 }
    const result = castAbility([charged, enemy], charged.id, 'ultimate', { direction: FORWARD }, 0)
    expect(result.ok).toBe(true)
    expect(result.damageDealt).toBeGreaterThan(0)
    expect(combatant(result, charged.id).ultimateCharge).toBe(0)
  })

  it('lets silence block powers but not a primary weapon', () => {
    const base = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    const silenced: CombatantState = {
      ...base,
      statuses: {
        silenced: { id: 'silenced', expiresAtMs: 2_000, magnitude: 1 },
      },
    }
    expect(canCast(silenced, 'signature', 1_999)).toBe(false)
    expect(canCast(silenced, 'primary', 1_999)).toBe(true)
    expect(canCast(silenced, 'signature', 2_000)).toBe(true)
  })

  it('keeps cloaked rivals hidden from aim assist without making them intangible', () => {
    const luma = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    const hiddenBase = fighter('hidden', 'yara-diffie', 'fracture', { x: 0, y: 0, z: 8 })
    const hidden: CombatantState = {
      ...hiddenBase,
      statuses: {
        cloaked: { id: 'cloaked', expiresAtMs: 4_000, magnitude: 1 },
      },
    }

    expect(selectAimTarget(
      luma,
      [luma, hidden],
      getHeroKit('luma-crivo').abilities.primary.hitShape,
      { direction: FORWARD },
      { nowMs: 1_000 },
    )).toBeNull()

    const directHit = castAbility([luma, hidden], luma.id, 'primary', { direction: FORWARD }, 1_000)
    expect(directHit.hitIds).toEqual(['hidden'])
    expect(combatant(directHit, hidden.id).shield).toBeLessThan(hidden.shield)
  })

  it('does not let weaker refreshes extend strong debuffs or affect spawn protection', () => {
    const raul = fighter('raul', 'raul-rsa', 'cipher', ORIGIN)
    const targetBase = fighter('target', 'teo-gemeos', 'fracture', { x: 0, y: 0, z: 4 })
    const slowed: CombatantState = {
      ...targetBase,
      statuses: {
        slowed: { id: 'slowed', expiresAtMs: 5_000, magnitude: 0.32 },
      },
    }
    const weakerRefresh = castAbility([raul, slowed], raul.id, 'mobility', { direction: FORWARD }, 1_000)
    expect(combatant(weakerRefresh, slowed.id).statuses.slowed).toEqual({
      id: 'slowed',
      expiresAtMs: 5_000,
      magnitude: 0.32,
    })

    const luma = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    const protectedTarget: CombatantState = {
      ...targetBase,
      statuses: {
        'spawn-protected': { id: 'spawn-protected', expiresAtMs: 2_000, magnitude: 1 },
      },
    }
    const protectedHit = castAbility(
      [luma, protectedTarget],
      luma.id,
      'signature',
      { direction: FORWARD, point: protectedTarget.position },
      1_000,
    )
    expect(combatant(protectedHit, protectedTarget.id).shield).toBe(protectedTarget.shield)
    expect(combatant(protectedHit, protectedTarget.id).statuses.slowed).toBeUndefined()
    expect(combatant(protectedHit, protectedTarget.id).statuses.revealed).toBeUndefined()
  })

  it('resolves multi-target shapes in stable distance/id order', () => {
    const luma = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    const a = fighter('a', 'raul-rsa', 'fracture', { x: 1, y: 0, z: 4 })
    const b = fighter('b', 'raul-rsa', 'fracture', { x: -1, y: 0, z: 4 })
    const hits = resolveAbilityHits(
      luma,
      getHeroKit('luma-crivo').abilities.ultimate,
      [b, luma, a],
      { direction: ORIGIN },
    )
    expect(hits.map((target) => target.id)).toEqual(['a', 'b'])
  })
})

describe('Núcleo 257 pylon objective', () => {
  it('locks only the active prime at the inclusive five-second boundary', () => {
    const initial = createObjectiveState()
    expect(PYLON_SEQUENCE).toEqual([2, 3, 5, 7])
    expect(Object.isFrozen(PYLON_SEQUENCE)).toBe(true)
    expect(activePylon(initial)).toBe(2)

    const wrong = advanceObjective(initial, {
      pylon: 3,
      presentTeams: ['cipher'],
      deltaMs: PYLON_CAPTURE_MS,
    })
    expect(wrong).toBe(initial)

    const almost = advanceObjective(initial, {
      pylon: 2,
      presentTeams: ['cipher'],
      deltaMs: PYLON_CAPTURE_MS - 1,
    })
    expect(almost.progressMs).toBe(4_999)
    expect(almost.captures).toEqual([])

    const locked = advanceObjective(almost, {
      pylon: 2,
      presentTeams: ['cipher'],
      deltaMs: 1,
    })
    expect(locked.captures).toEqual([{ prime: 2, team: 'cipher' }])
    expect(locked.score.cipher).toBe(1)
    expect(activePylon(locked)).toBe(3)
  })

  it('freezes while contested, decays while empty, and neutralizes enemy progress', () => {
    const initial = advanceObjective(createObjectiveState(), {
      pylon: 2,
      presentTeams: ['cipher'],
      deltaMs: 2_000,
    })
    const contested = advanceObjective(initial, {
      pylon: 2,
      presentTeams: ['cipher', 'fracture'],
      deltaMs: 1_000,
    })
    expect(contested).toBe(initial)

    const decayed = advanceObjective(contested, {
      pylon: 2,
      presentTeams: [],
      deltaMs: 500,
    })
    expect(decayed.progressMs).toBe(1_500)

    const neutralized = advanceObjective(decayed, {
      pylon: 2,
      presentTeams: ['fracture'],
      deltaMs: 2_000,
    })
    expect(neutralized.capturingTeam).toBe('fracture')
    expect(neutralized.progressMs).toBe(500)
  })

  it('declares the team that captures the fourth ordered pylon and then becomes terminal', () => {
    let state = createObjectiveState()
    for (const pylon of PYLON_SEQUENCE) {
      state = advanceObjective(state, {
        pylon,
        presentTeams: ['cipher', 'cipher'],
        deltaMs: PYLON_CAPTURE_MS,
      })
    }
    expect(state.captures.map((capture) => capture.prime)).toEqual(PYLON_SEQUENCE)
    expect(state.score.cipher).toBe(4)
    expect(state.winner).toBe('cipher')
    expect(activePylon(state)).toBeNull()
    expect(advanceObjective(state, {
      pylon: 7,
      presentTeams: ['fracture'],
      deltaMs: 10_000,
    })).toBe(state)
    expect(() => advanceObjective(state, {
      pylon: 7,
      presentTeams: [],
      deltaMs: -1,
    })).toThrow(RangeError)
  })
})

describe('Núcleo 257 deterministic bot decisions', () => {
  it('prioritizes a charged ultimate against the nearest visible enemy', () => {
    const botBase = fighter('bot', 'teo-gemeos', 'fracture', ORIGIN, true)
    const bot: CombatantState = { ...botBase, ultimateCharge: 100 }
    const far = fighter('far', 'luma-crivo', 'cipher', { x: 0, y: 0, z: 12 })
    const near = fighter('near', 'luma-crivo', 'cipher', { x: 0, y: 0, z: 6 })
    expect(chooseBotDecision([far, bot, near], bot.id, 0, null)).toMatchObject({
      kind: 'cast',
      slot: 'ultimate',
      targetId: 'near',
    })
  })

  it('moves toward the objective without a target and waits while dead', () => {
    const bot = fighter('bot', 'raul-rsa', 'fracture', ORIGIN, true)
    const objective = { x: 4, y: 0, z: -8 }
    expect(chooseBotDecision([bot], bot.id, 0, objective)).toEqual({
      kind: 'move',
      destination: objective,
    })
    const dead = applyDamage(bot, 10_000, 0).target
    expect(chooseBotDecision([dead], dead.id, 0, objective)).toEqual({
      kind: 'wait',
      reason: 'dead',
    })
  })

  it('lets an injured RSA bot reinforce itself before resuming fire', () => {
    const base = fighter('bot', 'raul-rsa', 'fracture', ORIGIN, true)
    const bot: CombatantState = { ...base, shield: 20 }
    const enemy = fighter('enemy', 'luma-crivo', 'cipher', { x: 0, y: 0, z: 7 })

    expect(chooseBotDecision([bot, enemy], bot.id, 0, null)).toMatchObject({
      kind: 'cast',
      slot: 'signature',
      targetId: bot.id,
    })
  })

  it('does not spend a cast on a target hidden behind cover', () => {
    const bot = fighter('bot', 'teo-gemeos', 'fracture', ORIGIN, true)
    const enemy = fighter('enemy', 'luma-crivo', 'cipher', { x: 0, y: 0, z: 7 })

    expect(chooseBotDecision(
      [bot, enemy],
      bot.id,
      0,
      null,
      { hasLineOfSight: () => false },
    )).toEqual({ kind: 'wait', reason: 'no-target' })
  })

  it('aims bot projectiles from eye height toward the target body', () => {
    const base = fighter('bot', 'luma-crivo', 'fracture', ORIGIN, true)
    const bot: CombatantState = {
      ...base,
      cooldownReadyAtMs: { ...base.cooldownReadyAtMs, signature: 9_000 },
    }
    const enemy = fighter('enemy', 'teo-gemeos', 'cipher', { x: 0, y: 0, z: 8 })
    const hitOrigin = { x: 0, y: 1.72, z: 0 }
    const hitPoint = () => ({ x: 0, y: 1.18, z: 8 })

    const decision = chooseBotDecision(
      [bot, enemy],
      bot.id,
      1_000,
      null,
      { hasLineOfSight: () => true, hitOrigin, hitPoint },
    )

    expect(decision).toMatchObject({ kind: 'cast', slot: 'primary', targetId: enemy.id })
    if (decision.kind === 'cast') {
      expect(decision.aim.direction.y).toBeLessThan(0)
      expect(decision.aim.point).toEqual(enemy.position)
    }
  })

  it('turns a mark into a combo: bonus damage, a consumed mark and a refund', () => {
    const luma = fighter('luma', 'luma-crivo', 'cipher', ORIGIN)
    const plain = fighter('plain', 'raul-rsa', 'fracture', { x: 0, y: 0, z: -6 })
    const marked = Object.freeze({
      ...plain,
      statuses: Object.freeze({
        marked: Object.freeze({ id: 'marked' as const, expiresAtMs: 9_000, magnitude: 0.2 }),
      }),
    })

    const aim = { origin: ORIGIN, direction: { x: 0, y: 0, z: -1 } }
    const clean = castAbility([luma, plain], luma.id, 'primary', aim, 1_000)
    const combo = castAbility([luma, marked], luma.id, 'primary', aim, 1_000)

    // The needle detonates: mark magnitude (20%) plus its detonation bonus (30%).
    expect(combo.damageDealt).toBeGreaterThan(clean.damageDealt)
    expect(combo.detonatedIds).toEqual([marked.id])
    expect(clean.detonatedIds).toEqual([])
    expect(combatant(combo, marked.id).statuses.marked).toBeUndefined()
    expect(combo.damageByTarget[marked.id]).toBeCloseTo(combo.damageDealt)

    // Detonating pays the caster back in ultimate charge.
    const comboCaster = combatant(combo, luma.id)
    const cleanCaster = combatant(clean, luma.id)
    expect(comboCaster.ultimateCharge).toBeGreaterThan(cleanCaster.ultimateCharge)
  })

  it('refunds cooldown to the charger that detonates, and only to it', () => {
    const raul = fighter('raul', 'raul-rsa', 'fracture', ORIGIN)
    const target = fighter('target', 'teo-gemeos', 'cipher', { x: 0, y: 0, z: -4 })
    const marked = Object.freeze({
      ...target,
      statuses: Object.freeze({
        marked: Object.freeze({ id: 'marked' as const, expiresAtMs: 9_000, magnitude: 0.1 }),
      }),
    })
    const aim = { origin: ORIGIN, direction: { x: 0, y: 0, z: -1 } }

    const plain = castAbility([raul, target], raul.id, 'mobility', aim, 1_000)
    const detonated = castAbility([raul, marked], raul.id, 'mobility', aim, 1_000)

    expect(detonated.detonatedIds).toEqual([marked.id])
    expect(combatant(detonated, raul.id).cooldownReadyAtMs.mobility)
      .toBeLessThan(combatant(plain, raul.id).cooldownReadyAtMs.mobility)
  })

  it('gives every hero both a way to mark and a way to detonate', () => {
    for (const kit of HERO_KIT_LIST) {
      const abilities = Object.values(kit.abilities)
      const marks = abilities.some((ability) => (
        ability.statuses?.some((status) => status.id === 'marked')
      ))
      const detonates = abilities.some((ability) => ability.detonates !== undefined)
      expect(marks, `${kit.id} precisa marcar`).toBe(true)
      expect(detonates, `${kit.id} precisa detonar`).toBe(true)
    }
  })
})
