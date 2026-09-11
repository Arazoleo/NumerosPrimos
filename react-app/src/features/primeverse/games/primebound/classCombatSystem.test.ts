import { describe, expect, it } from 'vitest'

import {
  ARCANE_GLYPH_PRIMES,
  CLASS_ACTION_DELIVERIES,
  CLASS_ACTION_DELIVERIES_BY_ID,
  EMPTY_ARCANE_GLYPHS,
  EMPTY_RANGER_FOCUS,
  EMPTY_RSA_MARKS,
  EMPTY_WARRIOR_COMBO,
  advanceRangerFocus,
  advanceWarriorCombo,
  addArcaneGlyph,
  applyRsaMark,
  consumeArcaneGlyphs,
  consumeRangerFocus,
  detonateRsaMarks,
  expireArcaneGlyphs,
  expireRangerFocus,
  expireRsaMarks,
  expireWarriorCombo,
  getClassActionDelivery,
  getNextArcaneGlyphPrime,
  getNextRsaMark,
  selectRangerChainTargets,
  selectTargetsInForwardCone,
} from './classCombatSystem'
import {
  HERO_ACTION_SLOTS,
  HERO_CLASS_IDS,
  HERO_SLOT_ACTION_IDS,
} from './heroClassSystem'

describe('class action delivery map', () => {
  it('maps every class slot and canonical action ID to the same frozen delivery', () => {
    for (const classId of HERO_CLASS_IDS) {
      const loadout = CLASS_ACTION_DELIVERIES[classId]
      expect(Object.isFrozen(loadout)).toBe(true)
      for (const slot of HERO_ACTION_SLOTS) {
        const delivery = loadout[slot]
        expect(delivery).toMatchObject({
          classId,
          slot,
          actionId: HERO_SLOT_ACTION_IDS[slot],
        })
        expect(Object.isFrozen(delivery)).toBe(true)
        expect(getClassActionDelivery(classId, slot)).toBe(delivery)
        expect(getClassActionDelivery(classId, delivery.actionId)).toBe(delivery)
        expect(CLASS_ACTION_DELIVERIES_BY_ID[classId][delivery.actionId]).toBe(
          delivery,
        )
      }
    }
  })

  it('gives all eight classes fundamentally different basic and secondary attacks', () => {
    const basicKinds = HERO_CLASS_IDS.map((classId) =>
      CLASS_ACTION_DELIVERIES[classId].J.kind,
    )
    const secondaryKinds = HERO_CLASS_IDS.map((classId) =>
      CLASS_ACTION_DELIVERIES[classId]['2'].kind,
    )
    expect(new Set(basicKinds)).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(secondaryKinds)).toHaveLength(HERO_CLASS_IDS.length)
    expect(CLASS_ACTION_DELIVERIES['modular-ranger'].R.pierces).toBe(true)
    expect(CLASS_ACTION_DELIVERIES['rsa-cryptographer'].J.projectileSpeedMultiplier)
      .toBeGreaterThan(0)
    expect(CLASS_ACTION_DELIVERIES['mersenne-arcanist'].J.persistsMs)
      .toBeGreaterThan(0)
    expect(CLASS_ACTION_DELIVERIES['mobius-assassin']).toMatchObject({
      J: { classMechanic: 'mobius-sign', kind: 'shadow-step-strike' },
      R: { kind: 'divisor-execution', targeting: 'all-enemies' },
    })
    expect(CLASS_ACTION_DELIVERIES['goldbach-berserker']).toMatchObject({
      J: { classMechanic: 'goldbach-rage', kind: 'rage-cleave' },
      R: { kind: 'goldbach-cataclysm' },
    })
    expect(CLASS_ACTION_DELIVERIES['sieve-engineer']).toMatchObject({
      J: { classMechanic: 'sieve-machines', kind: 'sieve-bolt' },
      R: { kind: 'sieve-overdrive-grid' },
    })
    expect(CLASS_ACTION_DELIVERIES['elliptic-oracle']).toMatchObject({
      J: { classMechanic: 'elliptic-points', kind: 'curve-orb' },
      R: { kind: 'curve-of-destiny' },
    })
  })

  it('keeps every keyboard slot mechanically unique across the eight classes', () => {
    for (const slot of HERO_ACTION_SLOTS) {
      const deliveryKinds = HERO_CLASS_IDS.map((classId) =>
        CLASS_ACTION_DELIVERIES[classId][slot].kind,
      )
      expect(new Set(deliveryKinds).size, `slot ${slot}: ${deliveryKinds.join(', ')}`)
        .toBe(HERO_CLASS_IDS.length)
    }
  })

  it('rejects unsupported runtime identifiers', () => {
    expect(() => getClassActionDelivery('fake' as 'prime-warrior', 'J')).toThrow(
      RangeError,
    )
    expect(() =>
      getClassActionDelivery('prime-warrior', 'fake' as 'basic-strike'),
    ).toThrow(RangeError)
  })
})

describe('forward targeting helpers', () => {
  it('selects nearest targetable actors in a cone without mutating input order', () => {
    const targets = [
      { id: 'far', x: 9, y: 1 },
      { id: 'behind', x: -2, y: 0 },
      { id: 'disabled', x: 1, y: 0, targetable: false },
      { id: 'near', x: 3, y: -0.5 },
      { id: 'outside-angle', x: 3, y: 8 },
    ] as const

    const result = selectTargetsInForwardCone(
      { x: 0, y: 0 },
      0,
      targets,
      { range: 10, halfAngleRadians: Math.PI / 6, maxTargets: 2 },
    )

    expect(result.map(({ id }) => id)).toEqual(['near', 'far'])
    expect(targets.map(({ id }) => id)).toEqual([
      'far', 'behind', 'disabled', 'near', 'outside-angle',
    ])
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('handles angle wraparound and lets a target radius touch the range edge', () => {
    const result = selectTargetsInForwardCone(
      { x: 0, y: 0 },
      -Math.PI + 0.03,
      [
        { id: 'wrapped', x: -8, y: 0.1 },
        { id: 'radius-edge', x: -11, y: 0, radius: 1 },
      ],
      { range: 10, halfAngleRadians: 0.1 },
    )
    expect(result.map(({ id }) => id)).toEqual(['wrapped', 'radius-edge'])
  })

  it('chains greedily from one ranger target without revisiting IDs', () => {
    const primary = { id: 'a', x: 0, y: 0 }
    const candidates = [
      { id: 'a', x: 0, y: 0 },
      { id: 'c', x: 7, y: 0 },
      { id: 'b', x: 3, y: 0 },
      { id: 'd', x: 10, y: 0, targetable: false },
    ]
    const result = selectRangerChainTargets(primary, candidates, {
      jumpRange: 4.1,
      maxTargets: 4,
    })
    expect(result.map(({ id }) => id)).toEqual(['a', 'b', 'c'])
    expect(Object.isFrozen(result)).toBe(true)
  })
})

describe('warrior combo', () => {
  it('advances through three increasingly strong strikes and wraps after finisher', () => {
    const first = advanceWarriorCombo(EMPTY_WARRIOR_COMBO, 100)
    const second = advanceWarriorCombo(first.state, 300)
    const third = advanceWarriorCombo(second.state, 500)
    const wrapped = advanceWarriorCombo(third.state, 600)

    expect([first.step, second.step, third.step, wrapped.step]).toEqual([1, 2, 3, 1])
    expect(first.damageMultiplier).toBeLessThan(second.damageMultiplier)
    expect(second.damageMultiplier).toBeLessThan(third.damageMultiplier)
    expect(third).toMatchObject({ isFinisher: true, reachMultiplier: 1.24 })
    expect(wrapped.isFinisher).toBe(false)
    expect(Object.isFrozen(third.state)).toBe(true)
  })

  it('expires at the combo boundary and restarts on the first strike', () => {
    const first = advanceWarriorCombo(EMPTY_WARRIOR_COMBO, 100, 500)
    expect(expireWarriorCombo(first.state, 599)).toBe(first.state)
    expect(expireWarriorCombo(first.state, 600)).toBe(EMPTY_WARRIOR_COMBO)
    expect(advanceWarriorCombo(first.state, 600, 500).step).toBe(1)
  })
})

describe('RSA p/q marks', () => {
  it('alternates marks, refreshes them and detonates only a complete key pair', () => {
    expect(getNextRsaMark(EMPTY_RSA_MARKS, 0)).toBe('p')
    const p = applyRsaMark(EMPTY_RSA_MARKS, 'p', 100)
    expect(p).toMatchObject({
      activeMarks: ['p'],
      readyToDetonate: false,
    })
    expect(getNextRsaMark(p.state, 200)).toBe('q')
    const q = applyRsaMark(p.state, 'q', 200)
    expect(q.activeMarks).toEqual(['p', 'q'])
    expect(q.readyToDetonate).toBe(true)

    const detonation = detonateRsaMarks(q.state, 201)
    expect(detonation).toMatchObject({
      state: EMPTY_RSA_MARKS,
      detonated: true,
      consumedMarks: ['p', 'q'],
      damageMultiplier: 2.35,
      blastRadius: 72,
    })
    expect(Object.isFrozen(detonation)).toBe(true)
  })

  it('does not detonate an incomplete or expired key pair', () => {
    const p = applyRsaMark(EMPTY_RSA_MARKS, 'p', 100, 500)
    expect(detonateRsaMarks(p.state, 200).detonated).toBe(false)
    expect(expireRsaMarks(p.state, 600)).toBe(EMPTY_RSA_MARKS)
    expect(detonateRsaMarks(p.state, 600)).toMatchObject({
      detonated: false,
      damageMultiplier: 1,
      blastRadius: 0,
    })
  })
})

describe('ranger focus', () => {
  it('stacks precision on one target and resets when changing target', () => {
    const first = advanceRangerFocus(EMPTY_RANGER_FOCUS, 'sentinel', 0)
    const second = advanceRangerFocus(first.state, 'sentinel', 100)
    const third = advanceRangerFocus(second.state, 'sentinel', 200)
    const switched = advanceRangerFocus(third.state, 'warden', 300)

    expect(first.state.stacks).toBe(1)
    expect(second).toMatchObject({ damageMultiplier: 1.2, chainJumps: 1 })
    expect(third).toMatchObject({
      damageMultiplier: 1.4,
      chainJumps: 2,
      reachedMaximum: true,
    })
    expect(switched.state).toMatchObject({ targetId: 'warden', stacks: 1 })
  })

  it('expires and can be consumed into an immutable combat bonus', () => {
    const focus = advanceRangerFocus(EMPTY_RANGER_FOCUS, 'sentinel', 50, 500)
    expect(expireRangerFocus(focus.state, 549)).toBe(focus.state)
    expect(expireRangerFocus(focus.state, 550)).toBe(EMPTY_RANGER_FOCUS)

    const consumed = consumeRangerFocus(focus.state, 100)
    expect(consumed).toMatchObject({
      state: EMPTY_RANGER_FOCUS,
      damageMultiplier: 1,
      chainJumps: 0,
    })
    expect(Object.isFrozen(consumed)).toBe(true)
  })
})

describe('arcanist glyph zones', () => {
  it('cycles through 3, 7 and 31 while adding immutable glyphs', () => {
    let state = EMPTY_ARCANE_GLYPHS
    for (const [index, prime] of ARCANE_GLYPH_PRIMES.entries()) {
      expect(getNextArcaneGlyphPrime(state, index)).toBe(prime)
      state = addArcaneGlyph(
        state,
        { id: `glyph-${prime}`, prime, x: index * 10, y: 0 },
        index,
      ).state
    }
    expect(state.map(({ prime }) => prime)).toEqual([3, 7, 31])
    expect(Object.isFrozen(state)).toBe(true)
    expect(state.every(Object.isFrozen)).toBe(true)
  })

  it('evicts the oldest glyph at capacity and purges expired glyphs', () => {
    const one = addArcaneGlyph(
      EMPTY_ARCANE_GLYPHS,
      { id: 'one', prime: 3, x: 0, y: 0 },
      0,
      500,
      2,
    )
    const two = addArcaneGlyph(
      one.state,
      { id: 'two', prime: 7, x: 1, y: 0 },
      10,
      800,
      2,
    )
    const three = addArcaneGlyph(
      two.state,
      { id: 'three', prime: 31, x: 2, y: 0 },
      20,
      900,
      2,
    )
    expect(three.evicted?.id).toBe('one')
    expect(three.state.map(({ id }) => id)).toEqual(['two', 'three'])
    expect(expireArcaneGlyphs(three.state, 811).map(({ id }) => id)).toEqual([
      'three',
    ])
  })

  it('consumes nearby glyphs and rewards a complete Mersenne set', () => {
    let state = EMPTY_ARCANE_GLYPHS
    state = addArcaneGlyph(state, { id: '3', prime: 3, x: 0, y: 0 }, 0).state
    state = addArcaneGlyph(state, { id: '7', prime: 7, x: 2, y: 0 }, 1).state
    state = addArcaneGlyph(state, { id: '31', prime: 31, x: 4, y: 0 }, 2).state

    const partial = consumeArcaneGlyphs(state, 10, {
      center: { x: 0, y: 0 },
      radius: 2.1,
    })
    expect(partial.consumed.map(({ prime }) => prime)).toEqual([3, 7])
    expect(partial.state.map(({ prime }) => prime)).toEqual([31])
    expect(partial).toMatchObject({
      primeSum: 10,
      completedMersenneSet: false,
      damageMultiplier: 1.6,
    })

    const complete = consumeArcaneGlyphs(state, 10)
    expect(complete).toMatchObject({
      state: EMPTY_ARCANE_GLYPHS,
      primeSum: 41,
      completedMersenneSet: true,
      damageMultiplier: 2.8,
    })
    expect(Object.isFrozen(complete.consumed)).toBe(true)
  })
})
