import { describe, expect, it } from 'vitest'

import type { AbilityMechanic, HeroId } from './types'
import {
  heroVfxLanguage,
  nucleusVfxProfile,
  resolveNucleusVfxPhase,
} from './nucleusVfxLanguage'

const HEROES: readonly HeroId[] = [
  'luma-crivo',
  'raul-rsa',
  'teo-gemeos',
  'yara-diffie',
]

const MECHANICS: readonly AbilityMechanic[] = [
  'precision-shot',
  'sieve-field',
  'residue-dash',
  'sieve-domain',
  'scatter-shot',
  'rsa-barrier',
  'modular-charge',
  'rsa-bastion',
  'paired-burst',
  'twin-detonation',
  'echo-step',
  'twin-conjecture',
  'suppressed-shot',
  'public-key-decoy',
  'key-exchange',
  'shared-secret',
]

describe('Núcleo 257 visual language', () => {
  it('gives each hero one exclusive visual grammar', () => {
    expect(new Set(HEROES.map(heroVfxLanguage))).toEqual(
      new Set(['sieve', 'rsa', 'twins', 'diffie']),
    )
  })

  it('keeps anticipation, impact and dissolve ordered for every mechanic', () => {
    for (const mechanic of MECHANICS) {
      const profile = nucleusVfxProfile(mechanic)
      expect(profile.anticipationEnd).toBeGreaterThan(0)
      expect(profile.impactStart).toBeGreaterThan(profile.anticipationEnd)
      expect(profile.dissolveStart).toBeGreaterThan(profile.impactStart)
      expect(profile.dissolveStart).toBeLessThan(1)
    }
  })

  it('clamps malformed progress and fully clears at the end', () => {
    expect(resolveNucleusVfxPhase('key-exchange', Number.NaN).progress).toBe(0)
    expect(resolveNucleusVfxPhase('key-exchange', -4).progress).toBe(0)
    expect(resolveNucleusVfxPhase('key-exchange', 9)).toMatchObject({
      progress: 1,
      dissolve: 1,
      opacity: 0,
    })
  })
})
