import { useEffect, useState } from 'react'

import type { ForgeQuality } from './types'

const QUALITY_STORAGE_KEY = 'primeverse:quality'

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

function detectQuality(): ForgeQuality {
  if (typeof window === 'undefined') return 'medium'

  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(QUALITY_STORAGE_KEY)
  } catch {
    // Continue with capability detection when storage is unavailable.
  }
  if (stored === 'low' || stored === 'medium' || stored === 'high') return stored

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const memory = (window.navigator as NavigatorWithMemory).deviceMemory
  const narrow = window.innerWidth < 760

  if (reducedMotion || narrow || (memory !== undefined && memory <= 4)) return 'low'
  if (window.devicePixelRatio > 1.75 || (memory !== undefined && memory <= 8)) return 'medium'
  return 'high'
}

export function saveForgeQuality(quality: ForgeQuality): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(QUALITY_STORAGE_KEY, quality)
  } catch {
    // Private browsing or storage policies must not block the experience.
  }
}

export function useForgeQuality(): ForgeQuality {
  const [quality, setQuality] = useState<ForgeQuality>(detectQuality)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const refresh = () => setQuality(detectQuality())

    media.addEventListener('change', refresh)
    window.addEventListener('resize', refresh)
    return () => {
      media.removeEventListener('change', refresh)
      window.removeEventListener('resize', refresh)
    }
  }, [])

  return quality
}

export const QUALITY_SETTINGS: Record<
  ForgeQuality,
  {
    dpr: readonly [number, number]
    stars: number
    particles: number
    shadows: boolean
  }
> = {
  low: { dpr: [0.75, 1], stars: 450, particles: 8, shadows: false },
  medium: { dpr: [1, 1.5], stars: 850, particles: 14, shadows: true },
  high: { dpr: [1, 2], stars: 1_350, particles: 24, shadows: true },
}
