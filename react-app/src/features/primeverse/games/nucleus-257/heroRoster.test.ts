import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import { HERO_KIT_LIST, getHeroKit, isHeroId } from './classKits'
import { HeroArchitecture, MODEL_STYLE } from './Nucleus257CombatantAvatar'
import { heroVfxLanguage } from './nucleusVfxLanguage'
import { ABILITY_SLOTS, HERO_IDS, type HeroId } from './types'

interface Tally {
  meshes: number
  names: string[]
}

/**
 * The architecture components are pure (no hooks), so calling them as functions
 * and walking the returned element tree needs no renderer or DOM.
 */
function tally(node: ReactNode, acc: Tally = { meshes: 0, names: [] }): Tally {
  if (Array.isArray(node)) {
    for (const child of node) tally(child, acc)
    return acc
  }
  if (!isValidElement(node)) return acc
  const { type, props } = node as { type: unknown; props: { name?: string; children?: ReactNode } }
  if (typeof type === 'function') return tally((type as (p: unknown) => ReactNode)(props), acc)
  if (type === 'mesh') acc.meshes += 1
  if (props.name) acc.names.push(props.name)
  return tally(props.children, acc)
}

function architecture(heroId: HeroId, quality: QualityLevel): Tally {
  const ref = { current: null }
  return tally(HeroArchitecture({
    heroId,
    accent: '#ffffff',
    secondary: '#ffffff',
    quality,
    identityRef: ref,
    echoARef: ref,
    echoBRef: ref,
    glitchRef: ref,
    rifleRef: ref,
  }))
}

function architectureName(heroId: HeroId): string | undefined {
  return architecture(heroId, 'high').names.find((name) => name.endsWith('-architecture'))
}

describe('Núcleo 257 roster', () => {
  it('selects every operator in the same order as the hero ids', () => {
    expect(HERO_KIT_LIST.map((kit) => kit.id)).toEqual([...HERO_IDS])
    for (const id of HERO_IDS) expect(isHeroId(id)).toBe(true)
    expect(isHeroId('desconhecido')).toBe(false)
  })

  it('gives every operator a complete kit', () => {
    for (const id of HERO_IDS) {
      const kit = getHeroKit(id)
      expect(kit.accent).toMatch(/^#[0-9a-f]{6}$/i)
      for (const slot of ABILITY_SLOTS) {
        expect(kit.abilities[slot].name.trim()).not.toBe('')
        expect(kit.abilities[slot].spokenName.trim()).not.toBe('')
      }
    }
  })

  it('gives every operator its own body, architecture and VFX language', () => {
    const architectures = HERO_IDS.map(architectureName)
    expect(architectures.every(Boolean)).toBe(true)
    expect(new Set(architectures)).toHaveLength(HERO_IDS.length)
    expect(new Set(HERO_IDS.map(heroVfxLanguage))).toHaveLength(HERO_IDS.length)
    for (const id of HERO_IDS) expect(MODEL_STYLE[id]).toBeDefined()
  })

  it('keeps Íris the leanest silhouette on the arena', () => {
    const others = HERO_IDS.filter((id) => id !== 'iris-mersenne').map((id) => MODEL_STYLE[id])
    const iris = MODEL_STYLE['iris-mersenne']
    expect(iris.torsoRadius).toBeLessThan(Math.min(...others.map((style) => style.torsoRadius)))
    expect(iris.shoulder).toBeLessThan(Math.min(...others.map((style) => style.shoulder)))
  })

  it('does not raise render cost on low quality', () => {
    for (const id of HERO_IDS) {
      expect(architecture(id, 'low').meshes).toBeLessThanOrEqual(architecture(id, 'high').meshes)
    }
    const others = HERO_IDS.filter((id) => id !== 'iris-mersenne')
    const heaviestLow = Math.max(...others.map((id) => architecture(id, 'low').meshes))
    expect(architecture('iris-mersenne', 'low').meshes).toBeLessThanOrEqual(heaviestLow)
  })
})
