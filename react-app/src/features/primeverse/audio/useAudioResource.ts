import { useCallback, useEffect, useRef } from 'react'

export interface DisposableAudio {
  dispose(): Promise<void> | void
}

/**
 * Keeps an audio engine alive for the life of a mounted component.
 *
 * A plain `useRef(createEngine())` looks equivalent but is broken under
 * React.StrictMode: development mounts, unmounts and remounts, the unmount disposes
 * the engine, and the ref hands the same dead object back on the second mount — the
 * page then stays silent forever. Creating lazily through the returned getter and
 * clearing the ref on unmount makes the remount build a fresh engine.
 */
export function useAudioResource<T extends DisposableAudio>(factory: () => T): () => T {
  const instance = useRef<T | null>(null)
  const create = useRef(factory)
  create.current = factory

  useEffect(() => () => {
    const current = instance.current
    instance.current = null
    void current?.dispose()
  }, [])

  // Stable identity, so the getter can sit in dependency arrays without
  // re-running the effects that use it.
  return useCallback(() => {
    if (!instance.current) instance.current = create.current()
    return instance.current
  }, [])
}
