import { describe, expect, it } from 'vitest'

import { HERO_CLASS_IDS } from './heroClassSystem'
import {
  PERFECT_ULTIMATES,
  PERFECT_ULTIMATE_ORIGINS,
  PERFECT_ULTIMATE_STYLES,
  getPerfectUltimate,
} from './perfectUltimateSystem'

function totalDamage(classId: (typeof HERO_CLASS_IDS)[number]): number {
  return getPerfectUltimate(classId).waves.reduce(
    (total, wave) => total + wave.damage,
    0,
  )
}

describe('Primebound PERFECT ultimate area attacks', () => {
  it('defines one immutable and mechanically distinct attack for every hero class', () => {
    const definitions = HERO_CLASS_IDS.map(getPerfectUltimate)

    expect(Object.keys(PERFECT_ULTIMATES)).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ style }) => style))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ origin }) => origin))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ name }) => name))).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ formula }) => formula))).toHaveLength(HERO_CLASS_IDS.length)

    for (const [index, definition] of definitions.entries()) {
      expect(definition.classId).toBe(HERO_CLASS_IDS[index])
      expect(PERFECT_ULTIMATE_STYLES).toContain(definition.style)
      expect(PERFECT_ULTIMATE_ORIGINS).toContain(definition.origin)
      expect(Object.isFrozen(definition)).toBe(true)
      expect(Object.isFrozen(definition.waves)).toBe(true)
      expect(definition.waves.every(Object.isFrozen)).toBe(true)
    }
  })

  it('keeps every wave ordered, inside its lifetime and within the configured radius', () => {
    for (const definition of Object.values(PERFECT_ULTIMATES)) {
      expect(definition.waves.length).toBeGreaterThanOrEqual(3)
      let previousAtMs = -1
      for (const wave of definition.waves) {
        expect(wave.atMs).toBeGreaterThan(previousAtMs)
        expect(wave.atMs).toBeLessThan(definition.durationMs)
        expect(wave.damage).toBeGreaterThan(0)
        expect(wave.radiusMultiplier).toBeGreaterThan(0)
        expect(wave.radiusMultiplier).toBeLessThanOrEqual(1)
        expect(wave.glyph.length).toBeGreaterThan(0)
        previousAtMs = wave.atMs
      }
      expect(definition.waves[definition.waves.length - 1]?.radiusMultiplier).toBe(1)
    }
  })

  it('stays inside an epic but bounded bonus-damage and control budget', () => {
    for (const classId of HERO_CLASS_IDS) {
      const definition = getPerfectUltimate(classId)
      expect(definition.radius).toBeGreaterThanOrEqual(140)
      expect(definition.radius).toBeLessThanOrEqual(225)
      expect(definition.durationMs).toBeGreaterThanOrEqual(900)
      expect(definition.durationMs).toBeLessThanOrEqual(1_700)
      expect(definition.stunMs).toBeGreaterThanOrEqual(500)
      expect(definition.stunMs).toBeLessThanOrEqual(1_400)
      expect(totalDamage(classId)).toBeGreaterThanOrEqual(40)
      expect(totalDamage(classId)).toBeLessThanOrEqual(64)
    }
  })

  it('expresses a clear tradeoff for each class instead of cloning one explosion', () => {
    const warrior = getPerfectUltimate('prime-warrior')
    const cryptographer = getPerfectUltimate('rsa-cryptographer')
    const ranger = getPerfectUltimate('modular-ranger')
    const arcanist = getPerfectUltimate('mersenne-arcanist')

    expect(warrior.radius).toBeLessThan(cryptographer.radius)
    expect(cryptographer.stunMs).toBeGreaterThan(warrior.stunMs)
    expect(totalDamage('rsa-cryptographer')).toBeLessThan(totalDamage('prime-warrior'))
    expect(ranger.waves).toHaveLength(6)
    expect(ranger.stunMs).toBeLessThan(warrior.stunMs)
    expect(totalDamage('mersenne-arcanist')).toBeGreaterThan(totalDamage('prime-warrior'))
    expect(arcanist.durationMs).toBeGreaterThan(ranger.durationMs)

    expect(getPerfectUltimate('mobius-assassin')).toMatchObject({
      style: 'mobius-null-domain', origin: 'nearest-target', stunMs: 1_000,
    })
    expect(getPerfectUltimate('goldbach-berserker')).toMatchObject({
      style: 'goldbach-twin-impact', origin: 'forward-impact',
    })
    expect(totalDamage('goldbach-berserker')).toBe(64)
    expect(getPerfectUltimate('sieve-engineer')).toMatchObject({
      style: 'sieve-prime-grid', origin: 'battlefield-grid', radius: 225,
    })
    expect(getPerfectUltimate('elliptic-oracle')).toMatchObject({
      style: 'elliptic-infinity-curve', origin: 'predicted-cluster',
    })
  })

  it('returns canonical definitions and rejects unknown runtime class IDs', () => {
    for (const classId of HERO_CLASS_IDS) {
      expect(getPerfectUltimate(classId)).toBe(PERFECT_ULTIMATES[classId])
    }
    expect(() => getPerfectUltimate('unknown' as 'prime-warrior')).toThrow(
      RangeError,
    )
  })
})
