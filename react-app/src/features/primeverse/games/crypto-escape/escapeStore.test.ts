import { describe, expect, it, vi } from 'vitest'

import { PRIME_BOX_TARGET } from './escapeLogic'
import { createEscapeStore, type EscapeStore } from './escapeStore'

function createTestStore(startTime = 1_000) {
  let clock = startTime
  const recordProgress = vi.fn(() => true)
  const store = createEscapeStore({
    now: () => clock,
    recordProgress,
  })

  return {
    store,
    recordProgress,
    advanceClock: (milliseconds: number) => {
      clock += milliseconds
    },
  }
}

function dismissDialogue(store: EscapeStore): void {
  let remainingLines = 10
  while (store.getState().activeDialogue && remainingLines > 0) {
    store.getState().advanceDialogue()
    remainingLines -= 1
  }
  expect(store.getState().activeDialogue).toBeNull()
}

function collectLens(store: EscapeStore): void {
  dismissDialogue(store)
  store.getState().setNearby('lens')
  expect(store.getState().interact()).toBe(true)
  store.getState().closeInspection()
}

function openPrimeBox(store: EscapeStore): void {
  store.getState().setNearby('prime-box')
  expect(store.getState().interact()).toBe(true)
}

function dialPrimeTarget(store: EscapeStore): void {
  PRIME_BOX_TARGET.forEach((target, index) => {
    for (let turn = 0; turn < target; turn += 1) {
      expect(store.getState().rotateRing(index)).toBe(true)
    }
  })
}

function solvePrimeBox(store: EscapeStore): void {
  openPrimeBox(store)
  dialPrimeTarget(store)
  expect(store.getState().submitPrimeBox()).toBe(true)
  expect(store.getState().releasePrimeLatch(0)).toBe(true)
  expect(store.getState().releasePrimeLatch(1)).toBe(true)
  expect(store.getState().openPrimeLid()).toBe(true)
  expect(store.getState().openPrimeDrawer()).toBe(true)
  expect(store.getState().collectCaesarRotor()).toBe(true)
}

function solveCaesarCipher(store: EscapeStore): void {
  dismissDialogue(store)
  store.getState().setNearby('caesar-console')
  expect(store.getState().interact()).toBe(true)
  for (let turn = 0; turn < 3; turn += 1) {
    expect(store.getState().rotateCaesarWheel()).toBe(true)
  }
  expect(store.getState().submitCaesar()).toBe(true)
}

function solveModularLock(store: EscapeStore): void {
  dismissDialogue(store)
  store.getState().setNearby('modular-console')
  expect(store.getState().interact()).toBe(true)
  store.getState().setModularGuess('4')
  expect(store.getState().submitModularGuess()).toBe(true)
}

function revealSpectralClue(store: EscapeStore): void {
  dismissDialogue(store)
  store.getState().setNearby('hidden-plaque')
  expect(store.getState().interact()).toBe(true)
  store.getState().closeInspection()
}

function solveRsaVault(store: EscapeStore): void {
  dismissDialogue(store)
  store.getState().setNearby('rsa-vault')
  expect(store.getState().interact()).toBe(true)
  store.getState().setRsaField('p', '11')
  store.getState().setRsaField('q', '17')
  store.getState().setRsaField('d', '23')
  expect(store.getState().submitRsa()).toBe(true)
}

function solveRoom(store: EscapeStore): void {
  collectLens(store)
  solvePrimeBox(store)
  solveCaesarCipher(store)
  solveModularLock(store)
  revealSpectralClue(store)
  solveRsaVault(store)
  dismissDialogue(store)
}

describe('Crypto Escape store', () => {
  it('starts a clean exploration run and tracks nearby objects', () => {
    const { store } = createTestStore()
    expect(store.getState().phase).toBe('intro')

    store.getState().start()
    expect(store.getState()).toMatchObject({
      phase: 'searching',
      runId: 1,
      nearby: null,
      mistakes: 0,
      startedAt: 1_000,
      flashlightOn: true,
      activeDialogue: { sceneId: 'arrival', lineIndex: 0 },
    })

    store.getState().setNearby('lens')
    expect(store.getState().nearby).toBeNull()
    expect(store.getState().interact('lens')).toBe(false)
    store.getState().skipDialogue()
    store.getState().setNearby('lens')
    expect(store.getState().nearby).toBe('lens')
  })

  it('toggles the flashlight and advances or skips character dialogue safely', () => {
    const { store } = createTestStore()
    store.getState().toggleFlashlight()
    expect(store.getState().flashlightOn).toBe(false)
    store.getState().start()

    store.getState().toggleFlashlight()
    expect(store.getState().flashlightOn).toBe(false)
    store.getState().toggleFlashlight()
    expect(store.getState().flashlightOn).toBe(true)

    store.getState().advanceDialogue()
    expect(store.getState().activeDialogue).toEqual({
      sceneId: 'arrival',
      lineIndex: 1,
    })
    store.getState().advanceDialogue()
    expect(store.getState().activeDialogue).toBeNull()
    store.getState().advanceDialogue()
    expect(store.getState().activeDialogue).toBeNull()

    collectLens(store)
    solvePrimeBox(store)
    expect(store.getState().activeDialogue?.sceneId).toBe('rotor-collected')
    store.getState().skipDialogue()
    expect(store.getState().activeDialogue).toBeNull()

    solveCaesarCipher(store)
    expect(store.getState().activeDialogue?.sceneId).toBe('caesar-solved')
    solveModularLock(store)
    expect(store.getState().activeDialogue?.sceneId).toBe('modular-solved')
    revealSpectralClue(store)
    solveRsaVault(store)
    expect(store.getState().activeDialogue?.sceneId).toBe('rsa-unlocked')
  })

  it('keeps locked objects inspectable without counting a puzzle mistake', () => {
    const { store } = createTestStore()
    store.getState().start()
    store.getState().skipDialogue()
    store.getState().setNearby('prime-box')

    expect(store.getState().interact()).toBe(false)
    expect(store.getState().inspection).toMatchObject({
      interactable: 'prime-box',
      status: 'locked',
    })
    expect(store.getState().mistakes).toBe(0)
    expect(store.getState().phase).toBe('searching')

    store.getState().closeInspection()
    expect(store.getState().inspection).toBeNull()
  })

  it('collects the lens once and opens the prime-box manipulation phase', () => {
    const { store } = createTestStore()
    store.getState().start()
    collectLens(store)
    const discoveryScore = store.getState().score

    store.getState().setNearby('lens')
    expect(store.getState().interact()).toBe(true)
    expect(store.getState().score).toBe(discoveryScore)
    expect(store.getState().discoveredInteractables).toEqual(['lens'])
    store.getState().closeInspection()

    openPrimeBox(store)
    expect(store.getState()).toMatchObject({
      phase: 'prime-box',
      primeBoxRings: [0, 0, 0, 0],
      primeBoxStep: 'rings',
    })
    expect(store.getState().inspection?.status).toBe('puzzle')
  })

  it('opens every physical layer of the prime box before releasing the Caesar rotor', () => {
    const { store } = createTestStore()
    store.getState().start()
    collectLens(store)
    openPrimeBox(store)

    expect(store.getState().rotateRing(-1)).toBe(false)
    expect(store.getState().submitPrimeBox()).toBe(false)
    expect(store.getState().mistakes).toBe(1)

    dialPrimeTarget(store)
    expect(store.getState().primeBoxRings).toEqual(PRIME_BOX_TARGET)
    expect(store.getState().submitPrimeBox()).toBe(true)
    expect(store.getState()).toMatchObject({
      phase: 'prime-box',
      primeBoxStep: 'latches',
      primeBoxSolved: false,
    })

    expect(store.getState().openPrimeLid()).toBe(false)
    expect(store.getState().releasePrimeLatch(1)).toBe(true)
    expect(store.getState().primeBoxStep).toBe('latches')
    expect(store.getState().releasePrimeLatch(1)).toBe(false)
    expect(store.getState().releasePrimeLatch(0)).toBe(true)
    expect(store.getState().primeBoxStep).toBe('lid')
    expect(store.getState().openPrimeDrawer()).toBe(false)
    expect(store.getState().openPrimeLid()).toBe(true)
    expect(store.getState().primeBoxStep).toBe('drawer')
    expect(store.getState().openPrimeDrawer()).toBe(true)
    expect(store.getState().primeBoxStep).toBe('rotor')
    expect(store.getState().collectCaesarRotor()).toBe(true)
    expect(store.getState()).toMatchObject({
      phase: 'caesar-lock',
      primeBoxStep: 'complete',
      primeBoxSolved: true,
      caesarRotorCollected: true,
      inspection: null,
    })
    expect(store.getState().mistakes).toBe(1)
  })

  it('decodes the Caesar transmission with an interactive alphabet rotor', () => {
    const { store } = createTestStore()
    store.getState().start()
    collectLens(store)
    solvePrimeBox(store)
    dismissDialogue(store)
    store.getState().setNearby('caesar-console')
    expect(store.getState().interact()).toBe(true)

    store.getState().rotateCaesarWheel(-1)
    expect(store.getState().caesarShift).toBe(25)
    expect(store.getState().submitCaesar()).toBe(false)
    expect(store.getState().feedback?.detail).toContain('TVMQS')

    for (let turn = 0; turn < 4; turn += 1) store.getState().rotateCaesarWheel()
    expect(store.getState().caesarShift).toBe(3)
    expect(store.getState().submitCaesar()).toBe(true)
    expect(store.getState()).toMatchObject({
      phase: 'modular-lock',
      caesarSolved: true,
      inspection: null,
      mistakes: 1,
      score: 2_770,
    })
  })

  it('rejects extra modular laps and advances to the spectral clue', () => {
    const { store } = createTestStore()
    store.getState().start()
    collectLens(store)
    solvePrimeBox(store)
    solveCaesarCipher(store)
    dismissDialogue(store)
    store.getState().setNearby('modular-console')
    store.getState().interact()

    store.getState().setModularGuess('16')
    expect(store.getState().submitModularGuess()).toBe(false)
    expect(store.getState().feedback?.title).toBe('Rota longa demais')

    store.getState().setModularGuess('4')
    expect(store.getState().submitModularGuess()).toBe(true)
    expect(store.getState()).toMatchObject({
      phase: 'spectral-clue',
      modularSolved: true,
      mistakes: 1,
    })
  })

  it('requires the hidden plaque before the RSA vault becomes available', () => {
    const { store } = createTestStore()
    store.getState().start()
    collectLens(store)
    solvePrimeBox(store)
    solveCaesarCipher(store)
    solveModularLock(store)
    dismissDialogue(store)

    store.getState().setNearby('rsa-vault')
    expect(store.getState().interact()).toBe(false)
    expect(store.getState().inspection?.status).toBe('locked')
    store.getState().closeInspection()

    revealSpectralClue(store)
    expect(store.getState()).toMatchObject({
      phase: 'rsa-vault',
      clueRevealed: true,
    })
    expect(store.getState().discoveredInteractables).toContain('hidden-plaque')
  })

  it('checks both RSA factors before accepting the private exponent', () => {
    const { store } = createTestStore()
    store.getState().start()
    collectLens(store)
    solvePrimeBox(store)
    solveCaesarCipher(store)
    solveModularLock(store)
    revealSpectralClue(store)
    store.getState().setNearby('rsa-vault')
    store.getState().interact()

    store.getState().setRsaField('p', '11')
    store.getState().setRsaField('q', '17')
    store.getState().setRsaField('d', '7')
    expect(store.getState().submitRsa()).toBe(false)
    expect(store.getState().feedback?.detail).toContain('7d')

    store.getState().setRsaField('d', '23')
    expect(store.getState().submitRsa()).toBe(true)
    expect(store.getState()).toMatchObject({
      phase: 'rsa-vault',
      rsaSolved: true,
      inspection: null,
    })
  })

  it('escapes once, records time, score, XP and the generic best record', () => {
    const { store, recordProgress, advanceClock } = createTestStore()
    store.getState().start()
    advanceClock(30_000)
    solveRoom(store)
    advanceClock(90_000)

    store.getState().setNearby('exit-door')
    expect(store.getState().interact()).toBe(true)

    const state = store.getState()
    expect(state.phase).toBe('escaped')
    expect(state.result).toMatchObject({
      score: 9_450,
      xp: 428,
      elapsedMs: 90_000,
      mistakes: 0,
      solvedPuzzles: ['prime-box', 'caesar-cipher', 'modular-lock', 'rsa-vault'],
      isNewBest: true,
    })
    expect(state.score).toBe(9_450)
    expect(state.dialoguePausedMs).toBe(30_000)
    expect(state.result?.xp).toBeGreaterThan(0)
    expect(recordProgress).toHaveBeenCalledOnce()
    expect(recordProgress).toHaveBeenCalledWith({
      score: state.result?.score,
      xp: state.result?.xp,
    })

    expect(store.getState().interact('exit-door')).toBe(false)
    expect(recordProgress).toHaveBeenCalledOnce()
  })

  it('still opens the exit if progression persistence fails', () => {
    const store = createEscapeStore({
      now: () => 5_000,
      recordProgress: () => {
        throw new Error('storage unavailable')
      },
    })
    store.getState().start()
    solveRoom(store)
    store.getState().setNearby('exit-door')

    expect(store.getState().interact()).toBe(true)
    expect(store.getState()).toMatchObject({
      phase: 'escaped',
      result: { isNewBest: false },
    })
  })

  it('restarts the room or returns safely to the intro', () => {
    const { store, advanceClock } = createTestStore()
    store.getState().start()
    solveRoom(store)
    advanceClock(500)
    store.getState().setNearby('exit-door')
    expect(store.getState().interact()).toBe(true)
    store.getState().restart()

    expect(store.getState()).toMatchObject({
      phase: 'searching',
      runId: 2,
      nearby: null,
      inspection: null,
      discoveredInteractables: [],
      lensCollected: false,
      primeBoxRings: [0, 0, 0, 0],
      primeBoxStep: 'rings',
      primeBoxLatches: [false, false],
      primeBoxSolved: false,
      caesarRotorCollected: false,
      caesarShift: 0,
      caesarSolved: false,
      modularGuess: '',
      modularSolved: false,
      clueRevealed: false,
      rsaFields: { p: '', q: '', d: '' },
      rsaSolved: false,
      score: 0,
      mistakes: 0,
      startedAt: 1_500,
      completedAt: null,
      lastSound: null,
      result: null,
      flashlightOn: true,
      activeDialogue: { sceneId: 'arrival', lineIndex: 0 },
    })

    store.getState().returnToIntro()
    expect(store.getState()).toMatchObject({
      phase: 'intro',
      runId: 2,
      startedAt: null,
      result: null,
      flashlightOn: false,
      activeDialogue: null,
    })
    expect(store.getState().interact('lens')).toBe(false)
  })
})
