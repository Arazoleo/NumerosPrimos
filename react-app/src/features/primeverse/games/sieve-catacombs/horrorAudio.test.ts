import { describe, expect, it } from 'vitest'

import { createHorrorAudio } from './horrorAudio'

describe('Cripta do Crivo procedural audio', () => {
  it('degrades safely when Web Audio is unavailable', async () => {
    const audio = createHorrorAudio()

    audio.setEnabled(true)
    audio.setActive(true)
    audio.update({
      fear: 87,
      flashlightOn: false,
      levelIndex: 3,
      nowMs: 4_900,
      threatDistance: 2.4,
    })
    audio.play('scare')

    await expect(audio.unlock()).resolves.toBe(false)
    await expect(audio.dispose()).resolves.toBeUndefined()
    await expect(audio.unlock()).resolves.toBe(false)
    await expect(audio.dispose()).resolves.toBeUndefined()
  })
})
