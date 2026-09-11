import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  BACKROOMS_CEILING_Y,
  BACKROOMS_LIGHTS,
  BACKROOMS_SECTORS,
  DEFAULT_BACKROOMS_ORIGIN,
  type BackroomsLightDefinition,
  type BackroomsOrigin,
} from './backroomsLayout'
import { useBackroomsRuntime } from './backroomsRuntime'

export type BackroomsQuality = 'low' | 'medium' | 'high'

export interface BackroomsLightingProps {
  readonly origin?: BackroomsOrigin
  readonly quality?: BackroomsQuality
  readonly reducedMotion?: boolean
}

/**
 * Three.js renders forward: every live light is evaluated by every lit material in
 * the scene, so nineteen ceiling lamps cost nineteen times the fragment work — even
 * the ones two rooms away and out of sight. Only the nearest few stay real; the rest
 * keep their emissive panel, which is free.
 */
const REAL_LIGHT_BUDGET: Readonly<Record<BackroomsQuality, number>> = {
  low: 2,
  medium: 4,
  high: 6,
}

/** Lamps further than this never light the player, whatever the budget. */
const LIGHT_RANGE = 17

function fixturePulse(light: BackroomsLightDefinition, elapsed: number, reducedMotion: boolean): number {
  if (reducedMotion || !light.broken) return 1
  const primary = Math.sin(elapsed * 8.7 + light.phase)
  const interference = Math.sin(elapsed * 23.1 + light.phase * 2.3)
  if (primary + interference > 1.25) return 0.06
  if (primary < -0.91 && interference > 0.25) return 0.38
  return 0.88 + Math.sin(elapsed * 2.2 + light.phase) * 0.08
}

interface FixtureHandles {
  readonly material: THREE.MeshStandardMaterial | null
  readonly light: THREE.PointLight | null
}

function FluorescentFixture({
  light,
  register,
}: {
  readonly light: BackroomsLightDefinition
  readonly register: (id: string, handles: FixtureHandles) => void
}): JSX.Element {
  const color = BACKROOMS_SECTORS[light.sectorId].lightColor
  const material = useRef<THREE.MeshStandardMaterial | null>(null)
  const point = useRef<THREE.PointLight | null>(null)

  return (
    <group position={[light.x, BACKROOMS_CEILING_Y - 0.13, light.z]}>
      <mesh>
        <boxGeometry args={[2.45, 0.09, 0.48]} />
        <meshStandardMaterial
          ref={(instance) => {
            material.current = instance
            register(light.id, { material: instance, light: point.current })
          }}
          color="#f0e8b1"
          emissive={color}
          emissiveIntensity={2.4}
          roughness={0.42}
        />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[2.72, 0.06, 0.72]} />
        <meshStandardMaterial color="#7d754d" metalness={0.2} roughness={0.67} />
      </mesh>
      <mesh position={[0, -0.07, 0]}>
        <planeGeometry args={[2.27, 0.31]} />
        <meshBasicMaterial color={color} transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <pointLight
        ref={(instance) => {
          point.current = instance
          register(light.id, { material: material.current, light: instance })
        }}
        color={color}
        intensity={0}
        distance={10.5}
        decay={2}
        visible={false}
      />
    </group>
  )
}

/**
 * Asset-free fluorescent fixtures. One frame loop drives every lamp and re-picks the
 * handful of real lights around the player, instead of one loop and one live light
 * per fixture.
 */
export function BackroomsLighting({
  origin = DEFAULT_BACKROOMS_ORIGIN,
  quality = 'medium',
  reducedMotion = false,
}: BackroomsLightingProps): JSX.Element {
  const handles = useRef(new Map<string, FixtureHandles>())
  const activeIds = useRef<readonly string[]>([])
  const nextSortAtMs = useRef(0)
  const register = useMemo(
    () => (id: string, entry: FixtureHandles) => {
      handles.current.set(id, entry)
    },
    [],
  )

  useFrame(({ clock }) => {
    const nowMs = performance.now()
    // Re-picking the nearest lamps four times a second is imperceptible and keeps
    // the sort off the hot path.
    if (nowMs >= nextSortAtMs.current) {
      nextSortAtMs.current = nowMs + 260
      const player = useBackroomsRuntime.getState().player
      const budget = REAL_LIGHT_BUDGET[quality]
      const ranked = BACKROOMS_LIGHTS
        .map((light) => ({
          id: light.id,
          distance: Math.hypot(light.x + origin[0] - player.x, light.z + origin[2] - player.z),
        }))
        .filter((entry) => entry.distance <= LIGHT_RANGE)
        .sort((first, second) => first.distance - second.distance)
        .slice(0, budget)
      const nextIds = ranked.map((entry) => entry.id)
      if (nextIds.join('|') !== activeIds.current.join('|')) {
        for (const id of activeIds.current) {
          if (nextIds.includes(id)) continue
          const handle = handles.current.get(id)
          if (handle?.light) handle.light.visible = false
        }
        for (const id of nextIds) {
          const handle = handles.current.get(id)
          if (handle?.light) handle.light.visible = true
        }
        activeIds.current = nextIds
      }
    }

    const elapsed = clock.elapsedTime
    for (const light of BACKROOMS_LIGHTS) {
      const handle = handles.current.get(light.id)
      if (!handle) continue
      const pulse = fixturePulse(light, elapsed, reducedMotion)
      if (handle.material) handle.material.emissiveIntensity = 2.4 * pulse
      if (handle.light?.visible) handle.light.intensity = 4.6 * pulse
    }
  })

  return (
    <group position={origin as [number, number, number]}>
      {BACKROOMS_LIGHTS.map((light) => (
        <FluorescentFixture key={light.id} light={light} register={register} />
      ))}
    </group>
  )
}

export default BackroomsLighting
