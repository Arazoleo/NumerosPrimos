import { describe, expect, it } from 'vitest'

import { HERO_CLASS_IDS } from './heroClassSystem'
import {
  ULTIMATE_QTE_DEFINITIONS,
  applyUltimateQteInput,
  getUltimateQteKeyboardInput,
  getUltimateQteSnapshot,
  resolveUltimateQte,
  startUltimateQte,
  type UltimateQteInput,
  type UltimateQteState,
} from './ultimateQteSystem'

function applySeries(
  initial: UltimateQteState,
  inputs: readonly { atMs: number; input: UltimateQteInput }[],
): UltimateQteState {
  return inputs.reduce(
    (state, { input, atMs }) => applyUltimateQteInput(state, input, atMs),
    initial,
  )
}

function press(code: string): UltimateQteInput {
  return { type: 'press', code }
}

describe('Primebound ultimate QTE definitions', () => {
  it('defines two easy modes, three-second windows, and immutable UI metadata', () => {
    const definitions = Object.values(ULTIMATE_QTE_DEFINITIONS)
    expect(definitions).toHaveLength(HERO_CLASS_IDS.length)
    expect(new Set(definitions.map(({ mode }) => mode))).toEqual(
      new Set(['space-mash', 'key-sequence']),
    )
    expect(new Set(definitions.map(({ perfectName }) => perfectName)))
      .toHaveLength(HERO_CLASS_IDS.length)
    for (const definition of definitions) {
      expect(definition.durationMs).toBe(3_000)
      expect(definition.instruction.length).toBeGreaterThan(24)
      expect(Object.isFrozen(definition)).toBe(true)
      expect(Object.isFrozen(definition.keySequence)).toBe(true)
      expect(Object.isFrozen(definition.keyLabels)).toBe(true)
      expect(Object.isFrozen(definition.stepLabels)).toBe(true)
      expect(definition.stepLabels).toHaveLength(definition.targetCount)
    }
  })

  it('exports the requested targets and visible prime/factor sequences', () => {
    expect(ULTIMATE_QTE_DEFINITIONS['prime-warrior']).toMatchObject({
      mode: 'space-mash', targetCount: 10, keySequence: ['Space'], keyLabels: ['ESPAÇO'],
    })
    expect(ULTIMATE_QTE_DEFINITIONS['mersenne-arcanist']).toMatchObject({
      mode: 'space-mash', targetCount: 8, keySequence: ['Space'], keyLabels: ['ESPAÇO'],
    })
    expect(ULTIMATE_QTE_DEFINITIONS['rsa-cryptographer']).toMatchObject({
      mode: 'key-sequence',
      keySequence: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit4', 'Digit5'],
      keyLabels: ['1', '2', '3', '4', '4', '5'],
      stepLabels: ['3', '5', '7', '11', '11', '13'],
    })
    expect(ULTIMATE_QTE_DEFINITIONS['modular-ranger']).toMatchObject({
      mode: 'key-sequence',
      keySequence: ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Space'],
      keyLabels: ['←', '↑', '→', '↓', 'ESPAÇO'],
      stepLabels: ['2', '3', '5', '7', '11'],
    })
    expect(ULTIMATE_QTE_DEFINITIONS['mobius-assassin']).toMatchObject({
      mode: 'key-sequence',
      keySequence: ['KeyA', 'KeyD', 'KeyA', 'KeyD', 'Space'],
      stepLabels: ['−1', '+1', '0', '−1', 'μ'],
    })
    expect(ULTIMATE_QTE_DEFINITIONS['goldbach-berserker']).toMatchObject({
      mode: 'space-mash', targetCount: 12, keySequence: ['Space'],
    })
    expect(ULTIMATE_QTE_DEFINITIONS['sieve-engineer']).toMatchObject({
      mode: 'key-sequence',
      keySequence: ['Digit2', 'Digit3', 'Digit5', 'Digit2', 'Digit3', 'Digit5'],
    })
    expect(ULTIMATE_QTE_DEFINITIONS['elliptic-oracle']).toMatchObject({
      mode: 'space-mash', targetCount: 9, keySequence: ['Space'],
    })
  })

  it('keeps the original ultimate at exactly 1x when the player gives no input', () => {
    for (const classId of Object.keys(ULTIMATE_QTE_DEFINITIONS) as Array<keyof typeof ULTIMATE_QTE_DEFINITIONS>) {
      const state = startUltimateQte(classId, 100)
      expect(resolveUltimateQte(state, 3_100)).toMatchObject({
        score: 0, grade: 'base', damageMultiplier: 1, perfect: false,
      })
    }
  })
})

describe('Primebound simplified ultimate QTEs', () => {
  it.each([
    ['prime-warrior', 10],
    ['mersenne-arcanist', 8],
    ['goldbach-berserker', 12],
    ['elliptic-oracle', 9],
  ] as const)('rewards the %s space mash at its requested target', (classId, targetCount) => {
    let state = startUltimateQte(classId)
    for (let index = 0; index < targetCount; index += 1) {
      state = applyUltimateQteInput(state, press('Space'), 100 + index * 60)
    }
    expect(state.completedSteps).toBe(targetCount)
    expect(getUltimateQteSnapshot(state, 2_999).status).toBe('complete')
    expect(resolveUltimateQte(state, 3_200)).toMatchObject({
      score: 1_000, grade: 'perfect', damageMultiplier: 1.75, perfect: true,
    })
  })

  it('completes every sequence challenge only by following its visible keys', () => {
    for (const classId of [
      'rsa-cryptographer',
      'modular-ranger',
      'mobius-assassin',
      'sieve-engineer',
    ] as const) {
      const definition = ULTIMATE_QTE_DEFINITIONS[classId]
      const inputs = definition.keySequence.map((code, index) => ({
        atMs: 100 + index * 70,
        input: press(code),
      }))
      const state = applySeries(startUltimateQte(classId), inputs)
      expect(state.completedSteps).toBe(definition.targetCount)
      expect(resolveUltimateQte(state, 2_999)).toMatchObject({
        score: 1_000, damageMultiplier: 1.75, perfect: true,
      })
    }
  })

  it('ignores a wrong input without lowering score or consuming correct-input debounce', () => {
    const initial = startUltimateQte('rsa-cryptographer')
    const wrong = applyUltimateQteInput(initial, press('Digit5'), 100)
    const correctImmediatelyAfter = applyUltimateQteInput(wrong, press('Digit1'), 101)

    expect(wrong).toBe(initial)
    expect(correctImmediatelyAfter).toMatchObject({
      completedSteps: 1,
      lastCorrectInputAtMs: 101,
    })
    expect(resolveUltimateQte(correctImmediatelyAfter, 200).score).toBeGreaterThan(0)
  })

  it('debounces only repeated correct input', () => {
    const initial = startUltimateQte('prime-warrior')
    const first = applyUltimateQteInput(initial, press('Space'), 100)
    const repeated = applyUltimateQteInput(first, press('Space'), 120)
    const accepted = applyUltimateQteInput(repeated, press('Space'), 155)

    expect(repeated).toBe(first)
    expect(accepted.completedSteps).toBe(2)
  })

  it('grants partial amplification up to the 1.55 cap without perfect', () => {
    const state = applySeries(
      startUltimateQte('prime-warrior'),
      Array.from({ length: 9 }, (_, index) => ({
        atMs: 100 + index * 60,
        input: press('Space'),
      })),
    )
    const result = resolveUltimateQte(state, 3_000)
    expect(result.score).toBe(900)
    expect(result.damageMultiplier).toBeGreaterThan(1)
    expect(result.damageMultiplier).toBeLessThanOrEqual(1.55)
    expect(result.perfect).toBe(false)
  })

  it('expires at three seconds and cannot become perfect afterward', () => {
    const definition = ULTIMATE_QTE_DEFINITIONS['modular-ranger']
    const partial = applySeries(
      startUltimateQte('modular-ranger'),
      definition.keySequence.slice(0, -1).map((code, index) => ({
        atMs: 100 + index * 70,
        input: press(code),
      })),
    )
    const late = applyUltimateQteInput(partial, press('Space'), 3_000)
    expect(late).toBe(partial)
    expect(getUltimateQteSnapshot(late, 3_000).status).toBe('expired')
    expect(resolveUltimateQte(late, 3_000).perfect).toBe(false)
  })

  it('maps keydown controls by mode and ignores every key release', () => {
    const warrior = startUltimateQte('prime-warrior')
    expect(getUltimateQteKeyboardInput(warrior, 'Space', 'down')).toEqual(press('Space'))
    expect(getUltimateQteKeyboardInput(warrior, 'Enter', 'down')).toBeNull()
    expect(getUltimateQteKeyboardInput(warrior, 'Space', 'up')).toBeNull()

    const ada = startUltimateQte('rsa-cryptographer')
    expect(getUltimateQteKeyboardInput(ada, 'Digit4', 'down')).toEqual(press('Digit4'))
    expect(getUltimateQteKeyboardInput(ada, 'Numpad4', 'down')).toEqual(press('Digit4'))
    expect(getUltimateQteKeyboardInput(ada, 'ArrowLeft', 'down')).toBeNull()

    const nara = startUltimateQte('modular-ranger')
    expect(getUltimateQteKeyboardInput(nara, 'ArrowDown', 'down')).toEqual(press('ArrowDown'))
    expect(getUltimateQteKeyboardInput(nara, 'KeyS', 'down')).toEqual(press('ArrowDown'))
    expect(getUltimateQteKeyboardInput(nara, 'ArrowDown', 'up')).toBeNull()

    const mobius = startUltimateQte('mobius-assassin')
    expect(getUltimateQteKeyboardInput(mobius, 'KeyA', 'down')).toEqual(press('KeyA'))
    expect(getUltimateQteKeyboardInput(mobius, 'KeyW', 'down')).toBeNull()

    const sieve = startUltimateQte('sieve-engineer')
    expect(getUltimateQteKeyboardInput(sieve, 'Numpad5', 'down')).toEqual(press('Digit5'))

    const oracle = startUltimateQte('elliptic-oracle')
    expect(getUltimateQteKeyboardInput(oracle, 'Space', 'down')).toEqual(press('Space'))
  })

  it('is immutable, idempotent after completion, and validates clocks', () => {
    const definition = ULTIMATE_QTE_DEFINITIONS['modular-ranger']
    const initial = startUltimateQte('modular-ranger', 500)
    const complete = applySeries(initial, definition.keySequence.map((code, index) => ({
      atMs: 600 + index * 70,
      input: press(code),
    })))

    expect(applyUltimateQteInput(complete, press('Space'), 1_500)).toBe(complete)
    expect(Object.isFrozen(complete)).toBe(true)
    expect(() => getUltimateQteSnapshot(initial, 499)).toThrow(RangeError)
    expect(() => resolveUltimateQte(initial, Number.NaN)).toThrow(RangeError)
    expect(() => resolveUltimateQte(complete, 599)).toThrow(RangeError)
  })
})
