import { describe, expect, it } from 'vitest'

import { HERO_CLASS_IDS } from './heroClassSystem'
import {
  HERO_VOICE_CUES,
  HERO_VOICE_LINES,
  heroVoiceAudioPath,
} from './heroVoiceLines'

describe('hero voice lines', () => {
  it('covers every hero and cue with distinct, speakable lines', () => {
    const all: string[] = []
    for (const heroClassId of HERO_CLASS_IDS) {
      for (const cue of HERO_VOICE_CUES) {
        const line = HERO_VOICE_LINES[heroClassId][cue]
        expect(line.length).toBeGreaterThan(5)
        all.push(line)
      }
    }
    expect(new Set(all).size).toBe(all.length)
  })

  it('maps audio paths under the public voices folder', () => {
    expect(heroVoiceAudioPath('prime-warrior', 'ultimate')).toBe(
      '/games/primebound/voices/prime-warrior-ultimate.mp3',
    )
  })
})
