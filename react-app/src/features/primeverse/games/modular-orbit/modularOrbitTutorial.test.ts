import { afterEach, describe, expect, it, vi } from 'vitest'

import { evaluateOrbitGuess, isValidOrbitChallenge } from './modularOrbitLogic'
import {
  getTutorialTrace,
  hasSeenModularOrbitTutorial,
  markModularOrbitTutorialSeen,
  MODULAR_ORBIT_TUTORIAL_STEPS,
  MODULAR_ORBIT_TUTORIAL_STORAGE_KEY,
  TUTORIAL_EXTRA_LAP_PULSES,
  TUTORIAL_ORBIT,
} from './modularOrbitTutorial'

describe('Tutorial da Órbita Modular — copy', () => {
  it('tem no máximo cinco passos', () => {
    expect(MODULAR_ORBIT_TUTORIAL_STEPS.length).toBeGreaterThan(0)
    expect(MODULAR_ORBIT_TUTORIAL_STEPS.length).toBeLessThanOrEqual(5)
  })

  // Percorre TODOS os passos: título e texto curtos, sem lixo de template.
  it.each(MODULAR_ORBIT_TUTORIAL_STEPS.map((step, index) => [index + 1, step] as const))(
    'passo %i tem título e texto legíveis',
    (_, step) => {
      const texts = [
        step.title,
        step.body,
        step.hint ?? '',
        ...(step.math ?? []),
        ...(step.traces?.map((trace) => trace.label) ?? []),
        step.quiz?.question ?? '',
        step.quiz?.success ?? '',
        step.quiz?.retry ?? '',
      ]

      expect(step.title.length).toBeGreaterThanOrEqual(5)
      expect(step.title.length).toBeLessThanOrEqual(40)
      expect(step.body.length).toBeLessThanOrEqual(280)
      for (const text of texts) {
        expect(text).not.toMatch(/undefined|null|NaN|\$\{/)
      }
    },
  )

  it('usa uma órbita de exemplo válida e com módulo pequeno', () => {
    expect(isValidOrbitChallenge(TUTORIAL_ORBIT)).toBe(true)
    expect(TUTORIAL_ORBIT.modulus).toBeLessThanOrEqual(7)
  })

  it('tem um passo que mostra o rastro pulso a pulso', () => {
    const traceStep = MODULAR_ORBIT_TUTORIAL_STEPS.find(
      (step) => step.traces?.length === 1 && /pulso a pulso/i.test(step.title),
    )
    expect(traceStep).toBeDefined()
    // 1 → 3 → 0 em mod 5: o mesmo rastro que o jogo calcula.
    expect(getTutorialTrace(TUTORIAL_ORBIT.solution)).toEqual([1, 3, 0])
  })

  it('tem um passo da menor solução: duas respostas chegam ao alvo, só uma vale', () => {
    const ruleStep = MODULAR_ORBIT_TUTORIAL_STEPS.find((step) => step.quiz)
    expect(ruleStep?.title).toMatch(/menor/i)

    const accepted = ruleStep?.traces?.filter((trace) => trace.accepted) ?? []
    const rejected = ruleStep?.traces?.filter((trace) => trace.accepted === false) ?? []
    expect(accepted).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    // As duas respostas realmente chegam ao alvo no jogo...
    const right = evaluateOrbitGuess(TUTORIAL_ORBIT, accepted[0].pulses)
    const extraLap = evaluateOrbitGuess(TUTORIAL_ORBIT, rejected[0].pulses)
    expect(right.reachesTarget).toBe(true)
    expect(extraLap.reachesTarget).toBe(true)
    // ...mas só a menor é aceita.
    expect(right.isCorrect).toBe(true)
    expect(extraLap.isCorrect).toBe(false)
    expect(rejected[0].pulses).toBe(TUTORIAL_EXTRA_LAP_PULSES)

    // A prática pede exatamente essa escolha.
    expect(ruleStep?.quiz?.correct).toBe(TUTORIAL_ORBIT.solution)
    expect(ruleStep?.quiz?.options).toContain(TUTORIAL_EXTRA_LAP_PULSES)
    expect(ruleStep?.body).toMatch(/volta/i)
  })
})

describe('Tutorial da Órbita Modular — persistência', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubStorage(): Map<string, string> {
    const data = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value) },
      },
    })
    return data
  }

  it('lembra que o tutorial foi visto ou pulado', () => {
    const data = stubStorage()
    expect(hasSeenModularOrbitTutorial()).toBe(false)

    markModularOrbitTutorialSeen()

    expect(data.get(MODULAR_ORBIT_TUTORIAL_STORAGE_KEY)).toBe('1')
    expect(hasSeenModularOrbitTutorial()).toBe(true)
  })

  it('não quebra quando o armazenamento está bloqueado', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage { throw new Error('bloqueado') },
    })

    expect(hasSeenModularOrbitTutorial()).toBe(false)
    expect(() => markModularOrbitTutorialSeen()).not.toThrow()
  })
})
