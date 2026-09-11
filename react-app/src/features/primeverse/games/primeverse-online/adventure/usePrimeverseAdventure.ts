import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'

import {
  createPrimeverseAdventureState,
  primeverseAdventureReducer,
  selectAdventureObjective,
  type AdventureMinigameId,
  type AdventureObjective,
  type AdventureRealmId,
  type HorrorSealId,
  type PrimeverseAdventureAction,
  type PrimeverseAdventureState,
} from './adventureState'

const FEEDBACK_LIFETIME_MS = 3_200

function defaultClock(): number {
  if (typeof performance !== 'undefined') return performance.now()
  return Date.now()
}

function acceptsAdventureHotkeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true
  return !target.isContentEditable
    && target.tagName !== 'INPUT'
    && target.tagName !== 'TEXTAREA'
    && target.tagName !== 'SELECT'
}

export interface UsePrimeverseAdventureOptions {
  readonly initialRealm?: AdventureRealmId
  readonly clock?: () => number
  readonly enableKeyboard?: boolean
}

export interface PrimeverseAdventureController {
  readonly state: PrimeverseAdventureState
  readonly objective: AdventureObjective
  readonly setRealm: (realm: AdventureRealmId) => void
  readonly markMinigameWin: (game: AdventureMinigameId) => boolean
  readonly collectSeal: (sealId: HorrorSealId) => boolean
  readonly defeatMob: (mobId: string) => boolean
  readonly activateAltar: () => boolean
  readonly takeDamage: (mobId: string, amount: number, nowMs?: number) => number
  readonly toggleLantern: () => boolean
  readonly castPulse: (nowMs?: number) => boolean
  readonly recover: () => void
  readonly resetHorror: () => void
  readonly clearFeedback: () => void
}

export function usePrimeverseAdventure(
  options: UsePrimeverseAdventureOptions = {},
): PrimeverseAdventureController {
  const [state, dispatch] = useReducer(
    primeverseAdventureReducer,
    options.initialRealm ?? 'nexus',
    createPrimeverseAdventureState,
  )
  const stateRef = useRef(state)
  const clockRef = useRef(options.clock ?? defaultClock)
  stateRef.current = state
  clockRef.current = options.clock ?? defaultClock

  const commit = useCallback((action: PrimeverseAdventureAction): {
    readonly previous: PrimeverseAdventureState
    readonly next: PrimeverseAdventureState
  } => {
    const previous = stateRef.current
    const next = primeverseAdventureReducer(previous, action)
    stateRef.current = next
    dispatch(action)
    return { previous, next }
  }, [])

  const setRealm = useCallback((realm: AdventureRealmId) => {
    commit({ type: 'set-realm', realm })
  }, [commit])

  const markMinigameWin = useCallback((game: AdventureMinigameId): boolean => {
    const { previous, next } = commit({ type: 'mark-minigame-win', game })
    return next.completedMinigames.length > previous.completedMinigames.length
  }, [commit])

  const collectSeal = useCallback((sealId: HorrorSealId): boolean => {
    const { previous, next } = commit({ type: 'collect-seal', sealId })
    return next.sealsCollected.length > previous.sealsCollected.length
  }, [commit])

  const defeatMob = useCallback((mobId: string): boolean => {
    const { previous, next } = commit({ type: 'defeat-mob', mobId })
    return next.defeatedMobIds.length > previous.defeatedMobIds.length
  }, [commit])

  const activateAltar = useCallback((): boolean => {
    const { previous, next } = commit({ type: 'activate-altar' })
    return !previous.altarActivated && next.altarActivated
  }, [commit])

  const takeDamage = useCallback((mobId: string, amount: number, nowMs = clockRef.current()): number => {
    const { next } = commit({ type: 'take-damage', mobId, amount, nowMs })
    return next.integrity
  }, [commit])

  const toggleLantern = useCallback((): boolean => {
    const { next } = commit({ type: 'toggle-lantern' })
    return next.lanternOn
  }, [commit])

  const castPulse = useCallback((nowMs = clockRef.current()): boolean => {
    const { previous, next } = commit({ type: 'cast-pulse', nowMs })
    return next.pulseSerial > previous.pulseSerial
  }, [commit])

  const resetHorror = useCallback(() => {
    commit({ type: 'reset-horror' })
  }, [commit])

  const recover = useCallback(() => {
    commit({ type: 'recover' })
  }, [commit])

  const clearFeedback = useCallback(() => {
    commit({ type: 'clear-feedback' })
  }, [commit])

  useEffect(() => {
    if (!state.feedback) return undefined
    const timer = window.setTimeout(clearFeedback, FEEDBACK_LIFETIME_MS)
    return () => window.clearTimeout(timer)
  }, [clearFeedback, state.feedback])

  useEffect(() => {
    if (options.enableKeyboard === false) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !acceptsAdventureHotkeys(event.target)) return
      if (event.code === 'KeyF') toggleLantern()
      if (event.code === 'KeyR') castPulse()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [castPulse, options.enableKeyboard, toggleLantern])

  const objective = useMemo(() => selectAdventureObjective(state), [state])

  return {
    state,
    objective,
    setRealm,
    markMinigameWin,
    collectSeal,
    defeatMob,
    activateAltar,
    takeDamage,
    toggleLantern,
    castPulse,
    recover,
    resetHorror,
    clearFeedback,
  }
}
