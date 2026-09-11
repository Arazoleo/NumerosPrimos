import { useState } from 'react'

export type QualityLevel = 'low' | 'medium' | 'high'

export interface QualityProfile {
  dpr: [number, number]
  antialias: boolean
  stars: number
  particles: number
  floatingNumbers: number
  asteroidSlots: number
  shadows: boolean
}

const STORAGE_KEY = 'primeverse:quality'

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: { dpr: [0.75, 1], antialias: false, stars: 650, particles: 18, floatingNumbers: 7, asteroidSlots: 6, shadows: false },
  medium: { dpr: [1, 1.5], antialias: true, stars: 1150, particles: 34, floatingNumbers: 11, asteroidSlots: 8, shadows: false },
  high: { dpr: [1, 2], antialias: true, stars: 1850, particles: 54, floatingNumbers: 15, asteroidSlots: 10, shadows: true },
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

function detectQuality(): QualityLevel {
  if (typeof window === 'undefined') return 'medium'

  let saved: string | null = null
  try {
    saved = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Privacy modes can disable storage; automatic detection remains available.
  }
  if (saved === 'low' || saved === 'medium' || saved === 'high') return saved

  const nav = window.navigator as NavigatorWithMemory
  const compactScreen = window.matchMedia('(max-width: 760px)').matches
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const limitedCpu = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4
  const limitedMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4

  if (reducedMotion || (compactScreen && (limitedCpu || limitedMemory))) return 'low'
  if (compactScreen || coarsePointer || limitedCpu || limitedMemory) return 'medium'
  return 'high'
}

export function useQualitySettings() {
  const [quality, setQualityState] = useState<QualityLevel>(detectQuality)

  const setQuality = (next: QualityLevel) => {
    setQualityState(next)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // The in-memory preference still works when storage is unavailable.
      }
    }
  }

  return { quality, setQuality, profile: QUALITY_PROFILES[quality] }
}
