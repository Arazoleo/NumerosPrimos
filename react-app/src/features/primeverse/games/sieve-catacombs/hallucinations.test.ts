import { describe, expect, it } from 'vitest'

import { CATACOMBS_LEVELS } from './campaignLogic'
import {
  CATACOMBS_HALLUCINATIONS,
  HALLUCINATION_SAFE_DISTANCE,
  hallucinationFrame,
  isHallucinationTriggered,
  selectHallucination,
  type HallucinationContext,
} from './hallucinations'

const quiet: HallucinationContext = {
  levelId: 'yellow-offices',
  levelElapsedMs: 40_000,
  player: { x: 0, z: 0 },
  fear: 20,
  sealJustTaken: false,
  seenIds: [],
  nearestEnemyDistance: 40,
}

describe('Cripta do Crivo hallucinations', () => {
  it('gives every floor at least two visions built from its own mathematics', () => {
    for (const level of CATACOMBS_LEVELS) {
      const visions = CATACOMBS_HALLUCINATIONS.filter((vision) => vision.levelId === level.id)
      expect(visions.length, `${level.id} precisa de visões`).toBeGreaterThanOrEqual(2)
      for (const vision of visions) {
        expect(vision.lines.length).toBeGreaterThan(0)
        expect(vision.durationMs).toBeGreaterThan(vision.lines[vision.lines.length - 1].atMs)
        expect(vision.severity).toBeGreaterThan(0)
        expect(vision.severity).toBeLessThanOrEqual(1)
      }
    }
    expect(new Set(CATACOMBS_HALLUCINATIONS.map((vision) => vision.id)).size)
      .toBe(CATACOMBS_HALLUCINATIONS.length)
  })

  it('never fires with a creature on top of the player', () => {
    expect(selectHallucination(quiet)).not.toBeNull()
    expect(selectHallucination({ ...quiet, nearestEnemyDistance: HALLUCINATION_SAFE_DISTANCE - 1 }))
      .toBeNull()
  })

  it('plays each vision once and only on its own floor', () => {
    const first = selectHallucination(quiet)
    expect(first?.levelId).toBe('yellow-offices')

    const afterSeeing = selectHallucination({ ...quiet, seenIds: [first!.id] })
    expect(afterSeeing?.id).not.toBe(first?.id)

    const elsewhere = selectHallucination({ ...quiet, levelId: 'cold-vault-13', levelElapsedMs: 19_000 })
    expect(elsewhere?.levelId).toBe('cold-vault-13')
  })

  it('honours each kind of trigger', () => {
    const timed = CATACOMBS_HALLUCINATIONS.find((vision) => vision.trigger.kind === 'elapsed')!
    expect(isHallucinationTriggered(timed, { ...quiet, levelElapsedMs: 1_000 })).toBe(false)
    expect(isHallucinationTriggered(timed, { ...quiet, levelElapsedMs: 90_000 })).toBe(true)

    const onSeal = CATACOMBS_HALLUCINATIONS.find((vision) => vision.trigger.kind === 'seal')!
    expect(isHallucinationTriggered(onSeal, quiet)).toBe(false)
    expect(isHallucinationTriggered(onSeal, { ...quiet, sealJustTaken: true })).toBe(true)

    const onFear = CATACOMBS_HALLUCINATIONS.find((vision) => vision.trigger.kind === 'fear')!
    expect(isHallucinationTriggered(onFear, { ...quiet, levelId: onFear.levelId, fear: 10 })).toBe(false)
    expect(isHallucinationTriggered(onFear, { ...quiet, levelId: onFear.levelId, fear: 99 })).toBe(true)
  })

  it('walks the lines in order and fades in and out', () => {
    const vision = CATACOMBS_HALLUCINATIONS[0]
    expect(hallucinationFrame(vision, 0).line?.text).toBe(vision.lines[0].text)
    expect(hallucinationFrame(vision, vision.lines[1].atMs + 10).line?.text).toBe(vision.lines[1].text)

    expect(hallucinationFrame(vision, 0).envelope).toBeLessThan(0.2)
    expect(hallucinationFrame(vision, vision.durationMs / 2).envelope).toBe(1)
    expect(hallucinationFrame(vision, vision.durationMs).envelope).toBe(0)
    expect(hallucinationFrame(vision, vision.durationMs).finished).toBe(true)
    expect(hallucinationFrame(vision, Number.NaN).progress).toBe(0)
  })
})
