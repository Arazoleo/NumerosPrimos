import { describe, expect, it } from 'vitest'

import {
  ENEMY_PRIME_POWER_FAMILY_IDS,
  ENEMY_PRIME_POWERS,
  enemyPowerPhaseLabel,
  getEnemyBossPhase,
  isEnemyBossShowcaseCast,
  resolveEnemyPrimePower,
  resolveEnemyPrimePowerAnimePresentation,
} from './enemyPrimePowerSystem'

describe('enemy prime power families', () => {
  it('defines seven mechanically distinct and documented families', () => {
    expect(ENEMY_PRIME_POWER_FAMILY_IDS).toHaveLength(7)
    expect(new Set(ENEMY_PRIME_POWER_FAMILY_IDS.map((id) => ENEMY_PRIME_POWERS[id].pattern)).size).toBe(7)
    for (const id of ENEMY_PRIME_POWER_FAMILY_IDS) {
      expect(ENEMY_PRIME_POWERS[id].formula.length).toBeGreaterThan(1)
      expect(ENEMY_PRIME_POWERS[id].description.length).toBeGreaterThan(20)
    }
  })

  it('keeps minions in phase one and advances bosses by health thresholds', () => {
    expect(getEnemyBossPhase(1, 100, 'minion')).toBe(1)
    expect(getEnemyBossPhase(100, 100, 'area-boss')).toBe(1)
    expect(getEnemyBossPhase(66, 100, 'area-boss')).toBe(2)
    expect(getEnemyBossPhase(32, 100, 'area-boss')).toBe(3)
    expect(() => getEnemyBossPhase(101, 100, 'area-boss')).toThrow(RangeError)
  })

  it('uses prime-family projectile counts for escalating boss phases', () => {
    expect(resolveEnemyPrimePower('twin-primes', 'area-boss', 100, 100).projectileCount).toBe(2)
    expect(resolveEnemyPrimePower('twin-primes', 'area-boss', 50, 100).projectileCount).toBe(4)
    expect(resolveEnemyPrimePower('mersenne', 'area-boss', 20, 100).projectileCount).toBe(11)
    expect(resolveEnemyPrimePower('wilson', 'area-boss', 20, 100)).toMatchObject({
      projectileCount: 9,
      angularVelocity: 1.51,
      radial: true,
    })
  })

  it('makes Sophie projectiles home and sieve shots form wide lanes', () => {
    expect(resolveEnemyPrimePower('sophie-germain', 'area-boss', 20, 100).homingStrength).toBeGreaterThan(4)
    expect(resolveEnemyPrimePower('eratosthenes-sieve', 'area-boss', 20, 100)).toMatchObject({
      projectileCount: 7,
      spreadRadians: .28,
      radial: false,
    })
  })

  it('gives bosses a readable recovery and telegraph window while increasing damage', () => {
    for (const rank of ['area-boss', 'final-boss'] as const) {
      for (const health of [100, 50, 20]) {
        const power = resolveEnemyPrimePower('prime-powers', rank, health, 100)
        expect(power.cooldownMs).toBeGreaterThanOrEqual(2_200)
        expect(power.telegraphMs).toBeGreaterThanOrEqual(920)
        expect(power.cooldownMs + power.telegraphMs).toBeGreaterThanOrEqual(3_100)
      }
    }

    const finalPower = resolveEnemyPrimePower('prime-powers', 'final-boss', 20, 100)
    expect(finalPower.projectileDamage).toBe(2)
    expect(enemyPowerPhaseLabel(finalPower)).toContain('FASE 3')
  })

  it('reserves the full-screen showcase for every third cast of boss phase three', () => {
    expect(isEnemyBossShowcaseCast('area-boss', 3, 1)).toBe(false)
    expect(isEnemyBossShowcaseCast('area-boss', 3, 2)).toBe(false)
    expect(isEnemyBossShowcaseCast('area-boss', 3, 3)).toBe(true)
    expect(isEnemyBossShowcaseCast('final-boss', 3, 6)).toBe(true)
    expect(isEnemyBossShowcaseCast('area-boss', 2, 3)).toBe(false)
    expect(isEnemyBossShowcaseCast('minion', 3, 3)).toBe(false)
    expect(() => isEnemyBossShowcaseCast('area-boss', 3, -1)).toThrow(RangeError)
  })

  it('gives every family a distinct anime visual language', () => {
    const presentations = ENEMY_PRIME_POWER_FAMILY_IDS.map((familyId) =>
      resolveEnemyPrimePowerAnimePresentation(familyId, 3),
    )

    expect(new Set(presentations.map(({ cutInStyle }) => cutInStyle))).toHaveLength(7)
    expect(new Set(presentations.map(({ cameraMove }) => cameraMove))).toHaveLength(7)
    expect(new Set(presentations.map(({ impactShape }) => impactShape))).toHaveLength(7)
    expect(new Set(presentations.map(({ rayCount }) => rayCount))).toHaveLength(7)

    for (const presentation of presentations) {
      expect(presentation.techniqueName.length).toBeGreaterThan(8)
      expect(presentation.battleCry.length).toBeGreaterThan(12)
      expect(presentation.impactWord).toMatch(/!$/)
      expect(presentation.glyph.length).toBeGreaterThan(2)
      expect(presentation.flashColor).toMatch(/^#[\da-f]{6}$/i)
      expect(Object.isFrozen(presentation)).toBe(true)
    }
  })

  it('escalates anime direction from phase one to the phase-three climax', () => {
    for (const familyId of ENEMY_PRIME_POWER_FAMILY_IDS) {
      const phases = ([1, 2, 3] as const).map((phase) =>
        resolveEnemyPrimePowerAnimePresentation(familyId, phase),
      )

      expect(new Set(phases.map(({ techniqueName }) => techniqueName))).toHaveLength(3)
      expect(new Set(phases.map(({ battleCry }) => battleCry))).toHaveLength(3)
      expect(new Set(phases.map(({ impactWord }) => impactWord))).toHaveLength(3)
      expect(new Set(phases.map(({ glyph }) => glyph))).toHaveLength(3)
      expect(new Set(phases.map(({ flashColor }) => flashColor))).toHaveLength(3)

      expect(phases[1].hitStopMs).toBeGreaterThan(phases[0].hitStopMs)
      expect(phases[2].hitStopMs).toBeGreaterThan(phases[1].hitStopMs)
      expect(phases[1].shakePx).toBeGreaterThan(phases[0].shakePx)
      expect(phases[2].shakePx).toBeGreaterThan(phases[1].shakePx)
      expect(phases[1].afterimageCount).toBeGreaterThan(phases[0].afterimageCount)
      expect(phases[2].afterimageCount).toBeGreaterThan(phases[1].afterimageCount)
      expect(phases[1].rayCount).toBeGreaterThan(phases[0].rayCount)
      expect(phases[2].rayCount).toBeGreaterThan(phases[1].rayCount)
      expect(phases[1].screenFlashAlpha).toBeGreaterThan(phases[0].screenFlashAlpha)
      expect(phases[2].screenFlashAlpha).toBeGreaterThan(phases[1].screenFlashAlpha)
      expect(phases[1].zoomScale).toBeGreaterThan(phases[0].zoomScale)
      expect(phases[2].zoomScale).toBeGreaterThan(phases[1].zoomScale)
      expect(phases[1].slowMotionScale).toBeLessThan(phases[0].slowMotionScale)
      expect(phases[2].slowMotionScale).toBeLessThan(phases[1].slowMotionScale)
      expect(phases[2].hitStopMs).toBeLessThanOrEqual(110)
      expect(phases[2].shakePx).toBeLessThanOrEqual(8)
      expect(phases[2].afterimageCount).toBeLessThanOrEqual(5)
      expect(phases[2].screenFlashAlpha).toBeLessThanOrEqual(.36)
      expect(phases[2].zoomScale).toBeLessThanOrEqual(1.075)
      expect(phases[2].slowMotionScale).toBeGreaterThanOrEqual(.62)
    }
  })

  it('embeds resolved anime direction in every combat cast', () => {
    const cast = resolveEnemyPrimePower('mersenne', 'area-boss', 20, 100)

    expect(cast.anime).toMatchObject({
      familyId: 'mersenne',
      phase: 3,
      techniqueName: 'Cataclismo 31: Coroa Absoluta',
      impactWord: '31 — RUÍNA!',
      rayCount: 11,
      impactShape: 'fractured-crown',
    })
    expect(cast.anime.hitStopMs).toBeLessThanOrEqual(110)
  })

  it('reuses phase profiles so the canvas loop does not allocate every frame', () => {
    expect(
      resolveEnemyPrimePowerAnimePresentation('goldbach', 2),
    ).toBe(resolveEnemyPrimePowerAnimePresentation('goldbach', 2))
    expect(
      resolveEnemyPrimePower('wilson', 'area-boss', 55, 100),
    ).toBe(resolveEnemyPrimePower('wilson', 'area-boss', 40, 100))
  })

  it('rejects invalid anime family and phase inputs at runtime', () => {
    expect(() => resolveEnemyPrimePowerAnimePresentation('unknown' as never, 1)).toThrow(RangeError)
    expect(() => resolveEnemyPrimePowerAnimePresentation('wilson', 4 as never)).toThrow(RangeError)
  })
})
