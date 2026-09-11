import { afterEach, describe, expect, it } from 'vitest'

import {
  addEscapeLookDelta,
  consumeEscapeLookDelta,
  isEscapeMovePressed,
  resetEscapeInput,
  setEscapeMove,
} from './explorationInput'

afterEach(resetEscapeInput)

describe('escape exploration input', () => {
  it('tracks movement commands without React state updates', () => {
    setEscapeMove('forward', true)
    setEscapeMove('sprint', true)
    expect(isEscapeMovePressed('forward')).toBe(true)
    expect(isEscapeMovePressed('sprint')).toBe(true)
    setEscapeMove('forward', false)
    resetEscapeInput()
    expect(isEscapeMovePressed('forward')).toBe(false)
    expect(isEscapeMovePressed('sprint')).toBe(false)
  })

  it('accumulates and consumes pointer look deltas', () => {
    addEscapeLookDelta(4, -2)
    addEscapeLookDelta(3, 1)
    expect(consumeEscapeLookDelta()).toEqual({ x: 7, y: -1 })
    expect(consumeEscapeLookDelta()).toEqual({ x: 0, y: 0 })
  })

  it('ignores non-finite pointer data', () => {
    addEscapeLookDelta(Number.NaN, 2)
    expect(consumeEscapeLookDelta()).toEqual({ x: 0, y: 0 })
  })
})
