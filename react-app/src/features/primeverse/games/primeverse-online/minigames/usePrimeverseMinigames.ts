import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import {
  FACTOR_REACTOR_CONSOLE,
  factorReactorReducer,
  getFactorNode,
  type FactorReactorInteractableId,
  type FactorReactorState,
  type FactorValue,
  createFactorReactorState,
} from './factorReactor'
import {
  persistMinigameRecord,
  readMinigameRecords,
  type MinigameRecordStorage,
  type PrimeverseMinigameId,
} from './recordStorage'
import type { MinigameWorldPosition } from './types'
import {
  createUlamPrimeRunState,
  findUlamTargetAtPosition,
  ulamPrimeRunReducer,
  type UlamPrimeRunState,
  type UlamTargetId,
} from './ulamPrimeRun'

const HUD_TICK_INTERVAL_MS = 50

export type PrimeverseLocalMinigameId = PrimeverseMinigameId

export interface PrimeverseMinigameController {
  readonly activeGame: PrimeverseLocalMinigameId | null
  readonly ulam: UlamPrimeRunState
  readonly factorReactor: FactorReactorState
  readonly start: (game: PrimeverseLocalMinigameId, nowMs?: number) => void
  readonly observePrimeRunPosition: (
    position: MinigameWorldPosition,
    nowMs?: number,
  ) => UlamTargetId | null
  readonly selectFactor: (factor: FactorValue, nowMs?: number) => void
  readonly interactFactorTarget: (targetId: FactorReactorInteractableId, nowMs?: number) => boolean
  readonly tick: (nowMs?: number) => void
  readonly reset: (game?: PrimeverseLocalMinigameId) => void
  readonly leave: () => void
}

export interface UsePrimeverseMinigamesOptions {
  readonly clock?: () => number
  readonly storage?: MinigameRecordStorage | null
}

function defaultClock(): number {
  if (typeof performance !== 'undefined') return performance.now()
  return Date.now()
}

export function usePrimeverseMinigames(
  options: UsePrimeverseMinigamesOptions = {},
): PrimeverseMinigameController {
  const clock = options.clock ?? defaultClock
  const storage = options.storage
  const [initialRecords] = useState(() => readMinigameRecords(storage))
  const [activeGame, setActiveGame] = useState<PrimeverseLocalMinigameId | null>(null)
  const [ulam, dispatchUlam] = useReducer(
    ulamPrimeRunReducer,
    initialRecords.ulamPrimeRunBestMs,
    createUlamPrimeRunState,
  )
  const [factorReactor, dispatchFactor] = useReducer(
    factorReactorReducer,
    initialRecords.factorReactorBestMs,
    createFactorReactorState,
  )
  const activeGameRef = useRef(activeGame)
  const ulamPhaseRef = useRef(ulam.phase)
  const occupiedUlamTarget = useRef<UlamTargetId | null>(null)
  const lastTickAtMs = useRef(Number.NEGATIVE_INFINITY)
  activeGameRef.current = activeGame
  ulamPhaseRef.current = ulam.phase

  useEffect(() => {
    if (ulam.phase === 'won' && ulam.isNewRecord && ulam.finishedTimeMs !== null) {
      persistMinigameRecord('ulam-prime-run', ulam.finishedTimeMs, storage)
    }
  }, [storage, ulam.finishedTimeMs, ulam.isNewRecord, ulam.phase])

  useEffect(() => {
    if (factorReactor.phase === 'won'
      && factorReactor.isNewRecord
      && factorReactor.finishedTimeMs !== null) {
      persistMinigameRecord('factor-reactor', factorReactor.finishedTimeMs, storage)
    }
  }, [factorReactor.finishedTimeMs, factorReactor.isNewRecord, factorReactor.phase, storage])

  useEffect(() => {
    if (ulam.phase !== 'running') occupiedUlamTarget.current = null
  }, [ulam.phase])

  const start = useCallback((game: PrimeverseLocalMinigameId, nowMs = clock()) => {
    occupiedUlamTarget.current = null
    lastTickAtMs.current = Number.NEGATIVE_INFINITY
    activeGameRef.current = game
    if (game === 'ulam-prime-run') {
      dispatchFactor({ type: 'reset' })
      dispatchUlam({ type: 'start', nowMs })
    } else {
      dispatchUlam({ type: 'reset' })
      dispatchFactor({ type: 'start', nowMs })
    }
    setActiveGame(game)
  }, [clock])

  const observePrimeRunPosition = useCallback((
    position: MinigameWorldPosition,
    nowMs = clock(),
  ): UlamTargetId | null => {
    const target = findUlamTargetAtPosition(position)
    if (activeGameRef.current !== 'ulam-prime-run' || ulamPhaseRef.current !== 'running') {
      occupiedUlamTarget.current = null
      return target?.id ?? null
    }
    if (!target) {
      occupiedUlamTarget.current = null
      return null
    }
    if (occupiedUlamTarget.current === target.id) return target.id
    occupiedUlamTarget.current = target.id
    dispatchUlam({ type: 'hit', targetId: target.id, nowMs })
    return target.id
  }, [clock])

  const selectFactor = useCallback((factor: FactorValue, nowMs = clock()) => {
    if (activeGameRef.current !== 'factor-reactor') return
    dispatchFactor({ type: 'select-factor', factor, nowMs })
  }, [clock])

  const interactFactorTarget = useCallback((
    targetId: FactorReactorInteractableId,
    nowMs = clock(),
  ): boolean => {
    if (targetId === FACTOR_REACTOR_CONSOLE.id) {
      if (activeGameRef.current === 'factor-reactor') {
        dispatchFactor({ type: 'interact', targetId, nowMs })
      } else {
        start('factor-reactor', nowMs)
      }
      return true
    }
    const node = getFactorNode(targetId)
    if (!node || activeGameRef.current !== 'factor-reactor') return false
    dispatchFactor({ type: 'select-factor', factor: node.factor, nowMs })
    return true
  }, [clock, start])

  const tick = useCallback((nowMs = clock()) => {
    if (!Number.isFinite(nowMs)) return
    if (nowMs >= lastTickAtMs.current && nowMs - lastTickAtMs.current < HUD_TICK_INTERVAL_MS) return
    lastTickAtMs.current = nowMs
    if (activeGameRef.current === 'ulam-prime-run') {
      dispatchUlam({ type: 'tick', nowMs })
    } else if (activeGameRef.current === 'factor-reactor') {
      dispatchFactor({ type: 'tick', nowMs })
    }
  }, [clock])

  const reset = useCallback((game = activeGameRef.current ?? undefined) => {
    occupiedUlamTarget.current = null
    lastTickAtMs.current = Number.NEGATIVE_INFINITY
    if (game === 'ulam-prime-run') dispatchUlam({ type: 'reset' })
    if (game === 'factor-reactor') dispatchFactor({ type: 'reset' })
  }, [])

  const leave = useCallback(() => {
    occupiedUlamTarget.current = null
    lastTickAtMs.current = Number.NEGATIVE_INFINITY
    activeGameRef.current = null
    dispatchUlam({ type: 'reset' })
    dispatchFactor({ type: 'reset' })
    setActiveGame(null)
  }, [])

  return {
    activeGame,
    ulam,
    factorReactor,
    start,
    observePrimeRunPosition,
    selectFactor,
    interactFactorTarget,
    tick,
    reset,
    leave,
  }
}
