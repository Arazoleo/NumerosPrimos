import { describe, expect, it } from 'vitest'

import { createPrimeboundSfx, type PrimeboundSound } from './primeboundAudio'

const SOUNDS: readonly PrimeboundSound[] = [
  'swing', 'hit', 'hurt', 'dash', 'rune', 'portal', 'victory',
  'technique', 'guard', 'parry', 'ultimate',
  'cinematic-rise', 'cinematic-beat', 'cinematic-release',
]

describe('Primebound sound bank', () => {
  it('degrades to silence when Web Audio is unavailable', async () => {
    const sfx = createPrimeboundSfx()
    sfx.setEnabled(true)
    for (const sound of SOUNDS) expect(() => sfx.play(sound)).not.toThrow()
    await expect(sfx.unlock()).resolves.toBe(false)
    await expect(sfx.dispose()).resolves.toBeUndefined()
    expect(() => sfx.play('hit')).not.toThrow()
  })

  it('stays quiet while disabled', () => {
    const sfx = createPrimeboundSfx()
    sfx.setEnabled(false)
    expect(() => sfx.play('ultimate')).not.toThrow()
  })
})
