import { effectiveAudioVolume, subscribeAudioVolume } from './audioPreferences'

export type AudioCue = 'laser' | 'impact' | 'correct' | 'error' | 'combo' | 'portal' | 'complete'

export interface AudioAdapter {
  play(cue: AudioCue): void
  setEnabled(enabled: boolean): void
  setVolume?(volume: number): void
}

class SilentAudioAdapter implements AudioAdapter {
  play(_cue: AudioCue) {}
  setEnabled(_enabled: boolean) {}
}

let adapter: AudioAdapter = new SilentAudioAdapter()

export const audioBus: AudioAdapter = {
  play: (cue) => { if (effectiveAudioVolume() > 0) adapter.play(cue) },
  setEnabled: (enabled) => adapter.setEnabled(enabled),
}

export function registerAudioAdapter(nextAdapter: AudioAdapter) {
  adapter = nextAdapter
  adapter.setVolume?.(effectiveAudioVolume())
}

subscribeAudioVolume(volume => adapter.setVolume?.(volume))
