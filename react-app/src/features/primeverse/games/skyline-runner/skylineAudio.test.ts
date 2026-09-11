import { describe, expect, it } from 'vitest'

import { createSkylineAudio } from './skylineAudio'

describe('skyline audio', () => {
  it('is safe when WebAudio is unavailable', async () => {
    const audio = createSkylineAudio({ volume: 0.4 })

    expect(audio.getState()).toMatchObject({
      available: false,
      disposed: false,
      enabled: true,
      unlocked: false,
      volume: 0.4,
    })

    audio.play('hook')
    audio.play('victory', 1.5)
    audio.startWind()

    expect(audio.getState().windRequested).toBe(true)
    expect(await audio.unlock()).toBe(false)

    audio.stopWind()
    await audio.dispose()
    await audio.dispose()

    expect(audio.getState()).toMatchObject({
      disposed: true,
      windPlaying: false,
      windRequested: false,
    })
  })

  it('clamps volume and honors explicit sound and motion preferences', async () => {
    const audio = createSkylineAudio({ enabled: false, reducedMotion: true, volume: 4 })

    expect(audio.getState()).toMatchObject({
      enabled: false,
      reducedMotion: true,
      volume: 1,
    })

    audio.startWind()
    expect(audio.getState().windPlaying).toBe(false)

    audio.setVolume(Number.NaN)
    audio.setEnabled(true)
    audio.setReducedMotion(false)

    expect(audio.getState()).toMatchObject({
      enabled: true,
      reducedMotion: false,
      volume: 0,
    })

    await audio.dispose()
  })
})
