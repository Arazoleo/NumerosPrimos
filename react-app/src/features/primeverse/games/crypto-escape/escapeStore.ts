import { create, type StoreApi, type UseBoundStore } from 'zustand'

import { evaluateCaesarShift, normalizeCaesarShift } from './caesarLogic'
import {
  advanceDialogue as advanceDialogueCursor,
  type DialogueSceneId,
} from './dialogue'
import {
  calculateEscapeScore,
  calculateEscapeXp,
  calculateExplorationScore,
  createInspection,
  evaluateModularLock,
  getInteractableAvailability,
  parseIntegerInput,
  rotatePrimeRing,
  validatePrimeBox,
  validateRsaVault,
} from './escapeLogic'
import { recordEscapeProgress } from './progressionAdapter'
import type {
  EscapeFeedback,
  EscapeInteractableId,
  EscapeInspection,
  EscapePhase,
  EscapeProgress,
  EscapeProgressInput,
  EscapeResult,
  EscapeSoundCue,
  EscapeSoundEvent,
  PrimeBoxStep,
  RingDirection,
  RsaField,
  RsaFields,
} from './types'

export interface EscapeState extends EscapeProgress {
  phase: EscapePhase
  runId: number
  nearby: EscapeInteractableId | null
  inspection: EscapeInspection | null
  discoveredInteractables: readonly EscapeInteractableId[]
  primeBoxRings: readonly number[]
  primeBoxStep: PrimeBoxStep
  primeBoxLatches: readonly [boolean, boolean]
  modularGuess: string
  caesarShift: number
  rsaFields: RsaFields
  score: number
  mistakes: number
  startedAt: number | null
  completedAt: number | null
  feedback: EscapeFeedback | null
  lastSound: EscapeSoundCue | null
  result: EscapeResult | null
  flashlightOn: boolean
  activeDialogue: EscapeDialogueState | null
  dialogueStartedAt: number | null
  dialoguePausedMs: number
  start: () => void
  setNearby: (interactable: EscapeInteractableId | null) => void
  interact: (interactable?: EscapeInteractableId) => boolean
  closeInspection: () => void
  rotateRing: (index: number, direction?: RingDirection) => boolean
  submitPrimeBox: () => boolean
  releasePrimeLatch: (index: 0 | 1) => boolean
  openPrimeLid: () => boolean
  openPrimeDrawer: () => boolean
  collectCaesarRotor: () => boolean
  rotateCaesarWheel: (direction?: RingDirection) => boolean
  submitCaesar: () => boolean
  setModularGuess: (guess: string) => void
  submitModularGuess: () => boolean
  setRsaField: (field: RsaField, value: string) => void
  submitRsa: () => boolean
  toggleFlashlight: () => void
  advanceDialogue: () => void
  skipDialogue: () => void
  restart: () => void
  returnToIntro: () => void
  clearFeedback: (feedbackId: number) => void
}

export interface EscapeDialogueState {
  readonly sceneId: DialogueSceneId
  readonly lineIndex: number
}

export type EscapeStore = UseBoundStore<StoreApi<EscapeState>>

export interface EscapeStoreOptions {
  readonly now?: () => number
  readonly recordProgress?: (input: EscapeProgressInput) => boolean
}

const INITIAL_RINGS: readonly number[] = [0, 0, 0, 0]
const INITIAL_RSA_FIELDS: RsaFields = { p: '', q: '', d: '' }

function progressFromState(state: EscapeProgress): EscapeProgress {
  return {
    lensCollected: state.lensCollected,
    primeBoxSolved: state.primeBoxSolved,
    caesarRotorCollected: state.caesarRotorCollected,
    caesarSolved: state.caesarSolved,
    modularSolved: state.modularSolved,
    clueRevealed: state.clueRevealed,
    rsaSolved: state.rsaSolved,
  }
}

function nextFeedback(
  previous: EscapeFeedback | null,
  kind: EscapeFeedback['kind'],
  title: string,
  detail: string,
): EscapeFeedback {
  return {
    id: (previous?.id ?? 0) + 1,
    kind,
    title,
    detail,
  }
}

function withDiscovered(
  discovered: readonly EscapeInteractableId[],
  interactable: EscapeInteractableId,
): readonly EscapeInteractableId[] {
  return discovered.includes(interactable)
    ? discovered
    : [...discovered, interactable]
}

interface RunReset {
  phase: 'searching'
  runId: number
  nearby: null
  inspection: null
  discoveredInteractables: readonly EscapeInteractableId[]
  lensCollected: false
  primeBoxRings: readonly number[]
  primeBoxStep: 'rings'
  primeBoxLatches: readonly [false, false]
  primeBoxSolved: false
  caesarRotorCollected: false
  caesarShift: number
  caesarSolved: false
  modularGuess: string
  modularSolved: false
  clueRevealed: false
  rsaFields: RsaFields
  rsaSolved: false
  score: number
  mistakes: number
  startedAt: number
  completedAt: null
  feedback: EscapeFeedback
  lastSound: null
  result: null
  flashlightOn: true
  activeDialogue: EscapeDialogueState
  dialogueStartedAt: number
  dialoguePausedMs: number
}

function resetRun(
  runId: number,
  startedAt: number,
  previousFeedback: EscapeFeedback | null,
): RunReset {
  return {
    phase: 'searching',
    runId,
    nearby: null,
    inspection: null,
    discoveredInteractables: [],
    lensCollected: false,
    primeBoxRings: [...INITIAL_RINGS],
    primeBoxStep: 'rings',
    primeBoxLatches: [false, false],
    primeBoxSolved: false,
    caesarRotorCollected: false,
    caesarShift: 0,
    caesarSolved: false,
    modularGuess: '',
    modularSolved: false,
    clueRevealed: false,
    rsaFields: { ...INITIAL_RSA_FIELDS },
    rsaSolved: false,
    score: 0,
    mistakes: 0,
    startedAt,
    completedAt: null,
    feedback: nextFeedback(
      previousFeedback,
      'info',
      'Você saiu do elevador',
      'O andar não aparece na planta. Siga o telefone e procure algo capaz de revelar marcas ocultas.',
    ),
    lastSound: null,
    result: null,
    flashlightOn: true,
    activeDialogue: { sceneId: 'arrival', lineIndex: 0 },
    dialogueStartedAt: startedAt,
    dialoguePausedMs: 0,
  }
}

function isActivePhase(phase: EscapePhase): boolean {
  return phase !== 'intro' && phase !== 'escaped'
}

function nextSound(
  previous: EscapeSoundCue | null,
  event: EscapeSoundEvent,
): EscapeSoundCue {
  return { id: (previous?.id ?? 0) + 1, event }
}

export function createEscapeStore(
  options: EscapeStoreOptions = {},
): EscapeStore {
  const now = options.now ?? Date.now
  const recordProgress = options.recordProgress ?? recordEscapeProgress

  return create<EscapeState>((set, get) => ({
    phase: 'intro',
    runId: 0,
    nearby: null,
    inspection: null,
    discoveredInteractables: [],
    lensCollected: false,
    primeBoxRings: [...INITIAL_RINGS],
    primeBoxStep: 'rings',
    primeBoxLatches: [false, false],
    primeBoxSolved: false,
    caesarRotorCollected: false,
    caesarShift: 0,
    caesarSolved: false,
    modularGuess: '',
    modularSolved: false,
    clueRevealed: false,
    rsaFields: { ...INITIAL_RSA_FIELDS },
    rsaSolved: false,
    score: 0,
    mistakes: 0,
    startedAt: null,
    completedAt: null,
    feedback: null,
    lastSound: null,
    result: null,
    flashlightOn: false,
    activeDialogue: null,
    dialogueStartedAt: null,
    dialoguePausedMs: 0,

    start: () => {
      const state = get()
      set(resetRun(state.runId + 1, now(), state.feedback))
    },

    setNearby: (interactable) => {
      const state = get()
      if (!isActivePhase(state.phase)) return
      if (state.activeDialogue && interactable !== null) return
      set({ nearby: interactable })
    },

    interact: (requestedInteractable) => {
      const state = get()
      if (!isActivePhase(state.phase) || state.inspection || state.activeDialogue) return false

      const interactable = requestedInteractable ?? state.nearby
      if (!interactable) {
        set({
          feedback: nextFeedback(
            state.feedback,
            'info',
            'Nada ao alcance',
            'Aproxime-se de um mecanismo ou objeto para inspecioná-lo.',
          ),
        })
        return false
      }

      const progress = progressFromState(state)
      const availability = getInteractableAvailability(interactable, progress)
      const discoveredInteractables = withDiscovered(
        state.discoveredInteractables,
        interactable,
      )

      if (availability === 'locked') {
        const inspection = createInspection(interactable, 'locked')
        set({
          inspection,
          discoveredInteractables,
          feedback: nextFeedback(
            state.feedback,
            'info',
            'Mecanismo bloqueado',
            inspection.description,
          ),
          lastSound: nextSound(state.lastSound, 'error'),
        })
        return false
      }

      if (availability === 'solved') {
        set({
          inspection: createInspection(interactable, 'solved'),
          discoveredInteractables,
          feedback: nextFeedback(
            state.feedback,
            'info',
            'Mecanismo já resolvido',
            'Não há mais nada a ajustar aqui.',
          ),
          lastSound: nextSound(state.lastSound, 'inspect'),
        })
        return true
      }

      switch (interactable) {
        case 'lens': {
          const nextProgress: EscapeProgress = {
            ...progress,
            lensCollected: true,
          }
          set({
            lensCollected: true,
            inspection: createInspection('lens', 'clue'),
            discoveredInteractables,
            score: calculateExplorationScore(nextProgress, state.mistakes),
            feedback: nextFeedback(
              state.feedback,
              'success',
              'Lente espectral encontrada',
              'Inscrições antes invisíveis agora podem ser examinadas.',
            ),
            lastSound: nextSound(state.lastSound, 'discover'),
          })
          return true
        }

        case 'prime-box':
          set({
            phase: 'prime-box',
            inspection: createInspection('prime-box', 'puzzle'),
            discoveredInteractables,
            feedback: nextFeedback(
              state.feedback,
              'info',
              'Mecanismo em camadas',
              'Alinhe os anéis, libere as duas travas e procure o compartimento oculto.',
            ),
            lastSound: nextSound(state.lastSound, 'inspect'),
          })
          return true

        case 'caesar-console':
          set({
            phase: 'caesar-lock',
            inspection: createInspection('caesar-console', 'puzzle'),
            discoveredInteractables,
            feedback: nextFeedback(
              state.feedback,
              'info',
              'Transmissão SULPR',
              'Gire os alfabetos e encontre uma palavra válida para liberar o sinal.',
            ),
            lastSound: nextSound(state.lastSound, 'inspect'),
          })
          return true

        case 'modular-console':
          set({
            inspection: createInspection('modular-console', 'puzzle'),
            discoveredInteractables,
            feedback: nextFeedback(
              state.feedback,
              'info',
              'Console orbital',
              'Resolva 7 + 5k ≡ 3 (mod 12) usando o menor k possível.',
            ),
            lastSound: nextSound(state.lastSound, 'inspect'),
          })
          return true

        case 'hidden-plaque': {
          const nextProgress: EscapeProgress = {
            ...progress,
            clueRevealed: true,
          }
          set({
            phase: 'rsa-vault',
            clueRevealed: true,
            inspection: createInspection('hidden-plaque', 'clue'),
            discoveredInteractables,
            score: calculateExplorationScore(nextProgress, state.mistakes),
            feedback: nextFeedback(
              state.feedback,
              'success',
              'Mensagem espectral revelada',
              'A parede informa N = 187 e φ(N) = 160.',
            ),
            lastSound: nextSound(state.lastSound, 'discover'),
          })
          return true
        }

        case 'rsa-vault':
          set({
            inspection: createInspection('rsa-vault', 'puzzle'),
            discoveredInteractables,
            feedback: nextFeedback(
              state.feedback,
              'info',
              'Cofre assimétrico',
              'Fatore N = 187 e encontre d, o inverso de 7 módulo 160.',
            ),
            lastSound: nextSound(state.lastSound, 'inspect'),
          })
          return true

        case 'exit-door': {
          const completedAt = now()
          const elapsedMs = Math.max(
            0,
            completedAt - (state.startedAt ?? completedAt) - state.dialoguePausedMs,
          )
          const score = calculateEscapeScore({
            mistakes: state.mistakes,
            elapsedMs,
          })
          const xp = calculateEscapeXp(score, state.mistakes)
          let isNewBest = false

          try {
            isNewBest = recordProgress({ score, xp })
          } catch {
            // Local or remote persistence must never keep the player trapped.
          }

          const result: EscapeResult = {
            score,
            xp,
            elapsedMs,
            mistakes: state.mistakes,
            solvedPuzzles: ['prime-box', 'caesar-cipher', 'modular-lock', 'rsa-vault'],
            isNewBest,
          }

          set({
            phase: 'escaped',
            nearby: null,
            inspection: null,
            activeDialogue: null,
            dialogueStartedAt: null,
            discoveredInteractables,
            score,
            completedAt,
            result,
            feedback: nextFeedback(
              state.feedback,
              'success',
              'Protocolo quebrado',
              `A porta abriu. Missão concluída com +${xp} XP.`,
            ),
            lastSound: nextSound(state.lastSound, 'escape'),
          })
          return true
        }
      }
    },

    closeInspection: () => {
      if (!get().inspection) return
      set({ inspection: null })
    },

    rotateRing: (index, direction = 1) => {
      const state = get()
      if (
        state.phase !== 'prime-box' ||
        state.inspection?.interactable !== 'prime-box' ||
        state.primeBoxStep !== 'rings' ||
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= state.primeBoxRings.length ||
        (direction !== 1 && direction !== -1)
      ) {
        return false
      }

      const primeBoxRings = [...state.primeBoxRings]
      primeBoxRings[index] = rotatePrimeRing(primeBoxRings[index], direction)
      set({
        primeBoxRings,
        lastSound: nextSound(state.lastSound, 'rotate'),
      })
      return true
    },

    submitPrimeBox: () => {
      const state = get()
      if (
        state.phase !== 'prime-box' ||
        state.inspection?.interactable !== 'prime-box' ||
        state.primeBoxSolved ||
        state.primeBoxStep !== 'rings'
      ) {
        return false
      }

      if (!validatePrimeBox(state.primeBoxRings)) {
        const mistakes = state.mistakes + 1
        set({
          mistakes,
          score: calculateExplorationScore(progressFromState(state), mistakes),
          feedback: nextFeedback(
            state.feedback,
            'error',
            'Os pinos não cederam',
            'Os quatro valores devem ser primos, distintos e estar em ordem crescente.',
          ),
          lastSound: nextSound(state.lastSound, 'error'),
        })
        return false
      }

      set({
        primeBoxStep: 'latches',
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Pinos liberados',
          'Os números estão alinhados. Duas travas mecânicas apareceram nas laterais.',
        ),
        lastSound: nextSound(state.lastSound, 'unlock'),
      })
      return true
    },

    releasePrimeLatch: (index) => {
      const state = get()
      if (
        state.phase !== 'prime-box' ||
        state.inspection?.interactable !== 'prime-box' ||
        state.primeBoxStep !== 'latches' ||
        (index !== 0 && index !== 1) ||
        state.primeBoxLatches[index]
      ) {
        return false
      }

      const primeBoxLatches: [boolean, boolean] = [...state.primeBoxLatches]
      primeBoxLatches[index] = true
      const bothReleased = primeBoxLatches.every(Boolean)
      set({
        primeBoxLatches,
        primeBoxStep: bothReleased ? 'lid' : 'latches',
        feedback: nextFeedback(
          state.feedback,
          bothReleased ? 'success' : 'info',
          bothReleased ? 'Duas travas liberadas' : `Trava ${index === 0 ? 'esquerda' : 'direita'} liberada`,
          bothReleased
            ? 'A tampa cedeu. Levante-a para acessar o núcleo interno.'
            : 'A caixa continua presa pelo mecanismo do lado oposto.',
        ),
        lastSound: nextSound(state.lastSound, bothReleased ? 'unlock' : 'rotate'),
      })
      return true
    },

    openPrimeLid: () => {
      const state = get()
      if (
        state.phase !== 'prime-box' ||
        state.inspection?.interactable !== 'prime-box' ||
        state.primeBoxStep !== 'lid'
      ) {
        return false
      }

      set({
        primeBoxStep: 'drawer',
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Tampa aberta',
          'O núcleo subiu. Uma placa frontal agora pode ser puxada.',
        ),
        lastSound: nextSound(state.lastSound, 'unlock'),
      })
      return true
    },

    openPrimeDrawer: () => {
      const state = get()
      if (
        state.phase !== 'prime-box' ||
        state.inspection?.interactable !== 'prime-box' ||
        state.primeBoxStep !== 'drawer'
      ) {
        return false
      }

      set({
        primeBoxStep: 'rotor',
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Compartimento revelado',
          'Um rotor de alfabeto estava escondido dentro da caixa.',
        ),
        lastSound: nextSound(state.lastSound, 'unlock'),
      })
      return true
    },

    collectCaesarRotor: () => {
      const state = get()
      if (
        state.phase !== 'prime-box' ||
        state.inspection?.interactable !== 'prime-box' ||
        state.primeBoxStep !== 'rotor' ||
        state.caesarRotorCollected
      ) {
        return false
      }

      const nextProgress: EscapeProgress = {
        ...progressFromState(state),
        primeBoxSolved: true,
        caesarRotorCollected: true,
      }
      set({
        phase: 'caesar-lock',
        nearby: null,
        inspection: null,
        primeBoxSolved: true,
        primeBoxStep: 'complete',
        caesarRotorCollected: true,
        score: calculateExplorationScore(nextProgress, state.mistakes),
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Rotor de César coletado',
          'As paredes mudaram. Encontre a janela impossível e a máquina de dois alfabetos.',
        ),
        lastSound: nextSound(state.lastSound, 'discover'),
        activeDialogue: { sceneId: 'rotor-collected', lineIndex: 0 },
        dialogueStartedAt: now(),
      })
      return true
    },

    rotateCaesarWheel: (direction = 1) => {
      const state = get()
      if (
        state.phase !== 'caesar-lock' ||
        state.inspection?.interactable !== 'caesar-console' ||
        state.caesarSolved ||
        (direction !== 1 && direction !== -1)
      ) {
        return false
      }

      set({
        caesarShift: normalizeCaesarShift(state.caesarShift + direction),
        lastSound: nextSound(state.lastSound, 'rotate'),
      })
      return true
    },

    submitCaesar: () => {
      const state = get()
      if (
        state.phase !== 'caesar-lock' ||
        state.inspection?.interactable !== 'caesar-console' ||
        state.caesarSolved
      ) {
        return false
      }

      const evaluation = evaluateCaesarShift(state.caesarShift)
      if (!evaluation?.isCorrect) {
        const mistakes = state.mistakes + 1
        set({
          mistakes,
          score: calculateExplorationScore(progressFromState(state), mistakes),
          feedback: nextFeedback(
            state.feedback,
            'error',
            'Mensagem sem sentido',
            `O alinhamento atual produz “${evaluation?.decodedText ?? '—'}”. Continue girando o rotor.`,
          ),
          lastSound: nextSound(state.lastSound, 'error'),
        })
        return false
      }

      const nextProgress: EscapeProgress = {
        ...progressFromState(state),
        caesarSolved: true,
      }
      set({
        phase: 'modular-lock',
        nearby: null,
        inspection: null,
        caesarSolved: true,
        score: calculateExplorationScore(nextProgress, state.mistakes),
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Transmissão decifrada',
          'SULPR significa PRIMO. O corredor agora leva à junção úmida.',
        ),
        lastSound: nextSound(state.lastSound, 'unlock'),
        activeDialogue: { sceneId: 'caesar-solved', lineIndex: 0 },
        dialogueStartedAt: now(),
      })
      return true
    },

    setModularGuess: (guess) => {
      const state = get()
      if (
        state.phase !== 'modular-lock' ||
        state.inspection?.interactable !== 'modular-console'
      ) {
        return
      }
      set({ modularGuess: guess })
    },

    submitModularGuess: () => {
      const state = get()
      if (
        state.phase !== 'modular-lock' ||
        state.inspection?.interactable !== 'modular-console' ||
        state.modularSolved
      ) {
        return false
      }

      const guess = parseIntegerInput(state.modularGuess)
      const evaluation = guess === null ? null : evaluateModularLock(guess)

      if (!evaluation?.isCorrect) {
        const mistakes = state.mistakes + 1
        const detail = evaluation?.reachesTarget
          ? 'Esse valor alcança o resíduo 3, mas completa voltas extras. Encontre o menor k.'
          : evaluation
            ? `O console parou no resíduo ${evaluation.residue}, não no resíduo 3.`
            : 'Digite um número inteiro não negativo para k.'
        set({
          mistakes,
          score: calculateExplorationScore(progressFromState(state), mistakes),
          feedback: nextFeedback(
            state.feedback,
            'error',
            evaluation?.reachesTarget ? 'Rota longa demais' : 'Pulso rejeitado',
            detail,
          ),
          lastSound: nextSound(state.lastSound, 'error'),
        })
        return false
      }

      const nextProgress: EscapeProgress = {
        ...progressFromState(state),
        modularSolved: true,
      }
      set({
        phase: 'spectral-clue',
        nearby: null,
        inspection: null,
        modularSolved: true,
        score: calculateExplorationScore(nextProgress, state.mistakes),
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Órbita sincronizada',
          'O projetor violeta iluminou uma parede aparentemente vazia.',
        ),
        lastSound: nextSound(state.lastSound, 'unlock'),
        activeDialogue: { sceneId: 'modular-solved', lineIndex: 0 },
        dialogueStartedAt: now(),
      })
      return true
    },

    setRsaField: (field, value) => {
      const state = get()
      if (
        state.phase !== 'rsa-vault' ||
        state.inspection?.interactable !== 'rsa-vault'
      ) {
        return
      }
      set({ rsaFields: { ...state.rsaFields, [field]: value } })
    },

    submitRsa: () => {
      const state = get()
      if (
        state.phase !== 'rsa-vault' ||
        state.inspection?.interactable !== 'rsa-vault' ||
        state.rsaSolved
      ) {
        return false
      }

      const p = parseIntegerInput(state.rsaFields.p)
      const q = parseIntegerInput(state.rsaFields.q)
      const d = parseIntegerInput(state.rsaFields.d)
      const evaluation =
        p === null || q === null || d === null
          ? null
          : validateRsaVault({ p, q, d })

      if (!evaluation?.isCorrect) {
        const mistakes = state.mistakes + 1
        const detail = !evaluation
          ? 'Preencha p, q e d apenas com números inteiros.'
          : !evaluation.factorsCorrect
            ? 'p e q devem ser primos distintos cujo produto seja 187.'
            : 'Os fatores estão corretos, mas 7d ainda não deixa resto 1 módulo 160.'
        set({
          mistakes,
          score: calculateExplorationScore(progressFromState(state), mistakes),
          feedback: nextFeedback(
            state.feedback,
            'error',
            'Chave recusada',
            detail,
          ),
          lastSound: nextSound(state.lastSound, 'error'),
        })
        return false
      }

      const nextProgress: EscapeProgress = {
        ...progressFromState(state),
        rsaSolved: true,
      }
      set({
        nearby: null,
        inspection: null,
        rsaSolved: true,
        score: calculateExplorationScore(nextProgress, state.mistakes),
        feedback: nextFeedback(
          state.feedback,
          'success',
          'Chave privada aceita',
          'O cofre liberou o último circuito. A porta vermelha está aberta.',
        ),
        lastSound: nextSound(state.lastSound, 'unlock'),
        activeDialogue: { sceneId: 'rsa-unlocked', lineIndex: 0 },
        dialogueStartedAt: now(),
      })
      return true
    },

    toggleFlashlight: () => {
      const state = get()
      if (!isActivePhase(state.phase)) return
      set({ flashlightOn: !state.flashlightOn })
    },

    advanceDialogue: () => {
      const state = get()
      if (!state.activeDialogue) return
      const nextLineIndex = advanceDialogueCursor(
        state.activeDialogue.sceneId,
        state.activeDialogue.lineIndex,
      )
      set({
        activeDialogue: nextLineIndex === null
          ? null
          : { ...state.activeDialogue, lineIndex: nextLineIndex },
        dialogueStartedAt: nextLineIndex === null ? null : state.dialogueStartedAt,
        dialoguePausedMs: nextLineIndex === null && state.dialogueStartedAt !== null
          ? state.dialoguePausedMs + Math.max(0, now() - state.dialogueStartedAt)
          : state.dialoguePausedMs,
      })
    },

    skipDialogue: () => {
      const state = get()
      if (!state.activeDialogue) return
      set({
        activeDialogue: null,
        dialogueStartedAt: null,
        dialoguePausedMs: state.dialogueStartedAt === null
          ? state.dialoguePausedMs
          : state.dialoguePausedMs + Math.max(0, now() - state.dialogueStartedAt),
      })
    },

    restart: () => {
      const state = get()
      set(resetRun(state.runId + 1, now(), state.feedback))
    },

    returnToIntro: () => {
      const state = get()
      set({
        phase: 'intro',
        nearby: null,
        inspection: null,
        discoveredInteractables: [],
        lensCollected: false,
        primeBoxRings: [...INITIAL_RINGS],
        primeBoxStep: 'rings',
        primeBoxLatches: [false, false],
        primeBoxSolved: false,
        caesarRotorCollected: false,
        caesarShift: 0,
        caesarSolved: false,
        modularGuess: '',
        modularSolved: false,
        clueRevealed: false,
        rsaFields: { ...INITIAL_RSA_FIELDS },
        rsaSolved: false,
        score: 0,
        mistakes: 0,
        startedAt: null,
        completedAt: null,
        feedback: null,
        lastSound: null,
        result: null,
        flashlightOn: false,
        activeDialogue: null,
        dialogueStartedAt: null,
        dialoguePausedMs: 0,
        runId: state.runId,
      })
    },

    clearFeedback: (feedbackId) => {
      if (get().feedback?.id === feedbackId) set({ feedback: null })
    },
  }))
}

export const useEscapeStore = createEscapeStore()
