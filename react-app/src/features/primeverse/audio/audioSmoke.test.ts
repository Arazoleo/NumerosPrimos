import { describe, expect, it, vi } from 'vitest'

/** Minimal Web Audio stand-in: records what the code under test actually schedules. */
function installAudioMock() {
  const started: Array<{ type: string; when: number }> = []
  const gains: number[] = []

  class FakeParam {
    value = 0
    setValueAtTime(value: number) { this.value = value; return this }
    exponentialRampToValueAtTime(value: number) { gains.push(value); this.value = value; return this }
    setTargetAtTime(value: number) { this.value = value; return this }
    cancelScheduledValues() { return this }
    linearRampToValueAtTime(value: number) { this.value = value; return this }
  }
  class FakeNode {
    connect(next: unknown) { return next as FakeNode }
    disconnect() {}
    addEventListener() {}
    removeEventListener() {}
  }
  class FakeOscillator extends FakeNode {
    type = 'sine'
    frequency = new FakeParam()
    detune = new FakeParam()
    start(when: number) { started.push({ type: 'osc:' + this.type, when }) }
    stop() {}
  }
  class FakeBufferSource extends FakeNode {
    buffer: unknown = null
    start(when: number) { started.push({ type: 'noise', when }) }
    stop() {}
  }
  class FakeGain extends FakeNode { gain = new FakeParam() }
  class FakeFilter extends FakeNode {
    type = 'lowpass'
    frequency = new FakeParam()
    Q = new FakeParam()
  }
  class FakeCompressor extends FakeNode {
    threshold = new FakeParam(); knee = new FakeParam(); ratio = new FakeParam()
    attack = new FakeParam(); release = new FakeParam()
  }
  class FakeContext {
    state: 'suspended' | 'running' | 'closed' = 'suspended'
    currentTime = 0
    sampleRate = 48_000
    destination = new FakeNode()
    createOscillator() { return new FakeOscillator() }
    createGain() { return new FakeGain() }
    createBiquadFilter() { return new FakeFilter() }
    createDynamicsCompressor() { return new FakeCompressor() }
    createBufferSource() { return new FakeBufferSource() }
    createBuffer(_c: number, length: number) {
      const data = new Float32Array(length)
      return { getChannelData: () => data }
    }
    async resume() { this.state = 'running' }
    async close() { this.state = 'closed' }
  }

  ;(globalThis as Record<string, unknown>).window = globalThis
  ;(globalThis as Record<string, unknown>).AudioContext = FakeContext
  return { started, gains }
}

describe('audio actually schedules sound', () => {
  it('plays a Primebound cue through Web Audio', async () => {
    const spy = installAudioMock()
    const { createPrimeboundSfx } = await import('../games/primebound/primeboundAudio')
    const sfx = createPrimeboundSfx()
    await sfx.unlock()
    sfx.play('hit')
    expect(spy.started.length).toBeGreaterThan(0)
  })

  it('schedules soundtrack notes once started', async () => {
    const spy = installAudioMock()
    const { createMusicDirector } = await import('./proceduralMusic')
    const { PRIMEBOUND_TRACK } = await import('./tracks')
    const director = createMusicDirector(PRIMEBOUND_TRACK)
    const ok = await director.start()
    expect(ok).toBe(true)
    await vi.waitFor(() => expect(spy.started.length).toBeGreaterThan(0), { timeout: 900 })
    await director.dispose()
  })

  it('survives the StrictMode mount-unmount-mount cycle', async () => {
    const spy = installAudioMock()
    const { createPrimeboundSfx } = await import('../games/primebound/primeboundAudio')

    // First mount: created, then torn down by StrictMode's double-invoke.
    const first = createPrimeboundSfx()
    await first.unlock()
    await first.dispose()
    first.play('hit')
    const afterDispose = spy.started.length

    // Second mount must build a fresh engine — this is what `useAudioResource`
    // guarantees, and what a plain useRef(create()) got wrong.
    const second = createPrimeboundSfx()
    await second.unlock()
    second.play('hit')
    expect(spy.started.length).toBeGreaterThan(afterDispose)
  })
})
