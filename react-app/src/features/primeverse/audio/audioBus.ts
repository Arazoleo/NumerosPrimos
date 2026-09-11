export type AudioCue = 'laser' | 'impact' | 'correct' | 'error' | 'combo' | 'portal' | 'complete'

export interface AudioAdapter {
  play(cue: AudioCue): void
  setEnabled(enabled: boolean): void
}

class SilentAudioAdapter implements AudioAdapter {
  play(_cue: AudioCue) {}
  setEnabled(_enabled: boolean) {}
}

let adapter: AudioAdapter = new SilentAudioAdapter()

export const audioBus: AudioAdapter = {
  play: (cue) => adapter.play(cue),
  setEnabled: (enabled) => adapter.setEnabled(enabled),
}

export function registerAudioAdapter(nextAdapter: AudioAdapter) {
  adapter = nextAdapter
}
