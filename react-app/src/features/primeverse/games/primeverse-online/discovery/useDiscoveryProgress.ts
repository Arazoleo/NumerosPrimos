import { useCallback, useRef, useState } from 'react'

import {
  DISCOVERY_STORAGE_KEY,
  recordDiscovery,
  restoreDiscoveryProgress,
  serializeDiscoveryProgress,
  type DiscoveryProgress,
  type DiscoveryResult,
} from './discoveryProgress'

function loadSessionProgress(): DiscoveryProgress {
  if (typeof window === 'undefined') return restoreDiscoveryProgress(null)
  try {
    return restoreDiscoveryProgress(window.sessionStorage.getItem(DISCOVERY_STORAGE_KEY))
  } catch {
    return restoreDiscoveryProgress(null)
  }
}

function saveSessionProgress(progress: DiscoveryProgress): void {
  try {
    window.sessionStorage.setItem(DISCOVERY_STORAGE_KEY, serializeDiscoveryProgress(progress))
  } catch {
    // Exploration remains available even when storage is blocked by the browser.
  }
}

export function useDiscoveryProgress(): {
  readonly progress: DiscoveryProgress
  readonly discover: (id: string) => DiscoveryResult
} {
  const [progress, setProgress] = useState(loadSessionProgress)
  const progressRef = useRef(progress)

  const discover = useCallback((id: string): DiscoveryResult => {
    const result = recordDiscovery(progressRef.current, id)
    if (result.state !== progressRef.current) {
      progressRef.current = result.state
      setProgress(result.state)
      saveSessionProgress(result.state)
    }
    return result
  }, [])

  return { progress, discover }
}
