import { describe, expect, it } from 'vitest'

import { remainingGameTime } from './types'
import {
  FACTOR_DURATION_MS,
  FACTOR_ERROR_PENALTY_MS,
  createFactorReactorState,
  factorReactorReducer,
  findFactorNodeAtPosition,
  getFactorNode,
  type FactorReactorState,
  type FactorValue,
} from './factorReactor'

function beginReactor(bestTimeMs: number | null = null): FactorReactorState {
  let state = createFactorReactorState(bestTimeMs)
  state = factorReactorReducer(state, { type: 'start', nowMs: 500 })
  return factorReactorReducer(state, { type: 'tick', nowMs: 3_500 })
}

function choose(state: FactorReactorState, factors: readonly FactorValue[], startAt: number): FactorReactorState {
  return factors.reduce((current, factor, index) => factorReactorReducer(current, {
    type: 'select-factor',
    factor,
    nowMs: startAt + index * 250,
  }), state)
}

describe('Factor Reactor', () => {
  it('starts with a countdown and three fixed reactor rounds', () => {
    let state = createFactorReactorState()
    expect(state.remainingTarget).toBe(30)
    state = factorReactorReducer(state, { type: 'start', nowMs: 500 })
    expect(state.phase).toBe('countdown')
    expect(state.countdownEndsAtMs).toBe(3_500)
    state = factorReactorReducer(state, { type: 'tick', nowMs: 3_500 })
    expect(state.phase).toBe('running')
    expect(remainingGameTime(state)).toBe(FACTOR_DURATION_MS)
  })

  it('accepts correct factors in any order and carries all three rounds', () => {
    let state = beginReactor(20_000)
    state = choose(state, [5, 2, 3], 4_000)
    expect(state.roundIndex).toBe(1)
    expect(state.remainingTarget).toBe(42)
    expect(state.solvedRounds[0]).toEqual({ target: 30, factors: [5, 2, 3] })

    state = choose(state, [7, 3, 2], 5_000)
    expect(state.roundIndex).toBe(2)
    expect(state.remainingTarget).toBe(66)

    state = choose(state, [11, 2, 3], 6_000)
    expect(state.phase).toBe('won')
    expect(state.solvedRounds).toHaveLength(3)
    expect(state.finishedTimeMs).toBe(3_000)
    expect(state.bestTimeMs).toBe(3_000)
    expect(state.isNewRecord).toBe(true)
  })

  it('penalizes a node that is not a factor of the remaining value', () => {
    let state = beginReactor()
    state = factorReactorReducer(state, { type: 'select-factor', factor: 7, nowMs: 4_000 })
    expect(state.remainingTarget).toBe(30)
    expect(state.penaltyMs).toBe(FACTOR_ERROR_PENALTY_MS)
    expect(state.errors).toBe(1)
    expect(state.feedback?.kind).toBe('error')

    state = factorReactorReducer(state, { type: 'select-factor', factor: 2, nowMs: 4_200 })
    expect(state.remainingTarget).toBe(15)
    state = factorReactorReducer(state, { type: 'select-factor', factor: 2, nowMs: 4_400 })
    expect(state.remainingTarget).toBe(15)
    expect(state.errors).toBe(2)
  })

  it('ignores values outside the five physical prime nodes', () => {
    let state = beginReactor()
    state = factorReactorReducer(state, { type: 'select-factor', factor: 13, nowMs: 4_000 })
    expect(state.remainingTarget).toBe(30)
    expect(state.errors).toBe(0)
  })

  it('maps world interactions to prime nodes and lets the console restart', () => {
    let state = beginReactor()
    state = factorReactorReducer(state, { type: 'interact', targetId: 'factor-node-2', nowMs: 4_000 })
    expect(state.remainingTarget).toBe(15)
    state = factorReactorReducer(state, { type: 'reset' })
    state = factorReactorReducer(state, { type: 'interact', targetId: 'factor-reactor-console', nowMs: 8_000 })
    expect(state.phase).toBe('countdown')
    expect(state.countdownEndsAtMs).toBe(11_000)
  })

  it('fails immediately if an error consumes the remaining time', () => {
    let state = beginReactor()
    state = factorReactorReducer(state, { type: 'tick', nowMs: 45_600 })
    expect(state.phase).toBe('running')
    state = factorReactorReducer(state, { type: 'select-factor', factor: 7, nowMs: 45_600 })
    expect(state.phase).toBe('lost')
  })

  it('times out normally and preserves a prior best on reset', () => {
    let state = beginReactor(1_900)
    state = factorReactorReducer(state, { type: 'tick', nowMs: 3_500 + FACTOR_DURATION_MS })
    expect(state.phase).toBe('lost')
    state = factorReactorReducer(state, { type: 'reset' })
    expect(state.phase).toBe('idle')
    expect(state.bestTimeMs).toBe(1_900)
  })

  it('exposes the physical node layout and proximity lookup', () => {
    expect(getFactorNode('factor-node-11')?.factor).toBe(11)
    expect(getFactorNode('unknown')).toBeNull()
    expect(findFactorNodeAtPosition([-78, 20, -1.5])?.factor).toBe(2)
    expect(findFactorNodeAtPosition([-72, 0, 5])).toBeNull()
  })
})

