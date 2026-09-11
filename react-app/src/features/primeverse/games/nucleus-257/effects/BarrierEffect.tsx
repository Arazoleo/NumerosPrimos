import {
  useEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'

import { resolveNucleusVfxPhase } from '../nucleusVfxLanguage'
import {
  TAU,
  clamp01,
  disposeRecord,
  easeOutCubic,
  useEffectTimeline,
  type EffectVisualProps,
} from './effectCore'

export function BarrierEffect({
  effect,
  frame,
  color,
  highlight,
  tuning,
  reducedMotion,
  onComplete,
}: EffectVisualProps): JSX.Element {
  const rootRef = useRef<THREE.Group>(null)
  const shellRef = useRef<THREE.Group>(null)
  const orbitRef = useRef<THREE.Group>(null)
  const plateRefs = useRef<Array<THREE.Group | null>>([])
  const lightRef = useRef<THREE.PointLight>(null)
  const radius = 1.85
  const plateCount = tuning.segments <= 12 ? 6 : tuning.segments <= 24 ? 8 : 12

  const geometries = useMemo(() => ({
    shell: new THREE.SphereGeometry(1, tuning.segments, Math.max(6, tuning.segments / 2), 0, TAU, 0, Math.PI / 2),
    floor: new THREE.RingGeometry(0.84, 1, tuning.segments),
    hex: new THREE.CircleGeometry(0.48, 6),
    hexRim: new THREE.RingGeometry(0.4, 0.5, 6),
    orbit: new THREE.TorusGeometry(1, 0.018, 4, tuning.segments),
    core: new THREE.DodecahedronGeometry(0.22, 0),
  }), [tuning.segments])

  const materials = useMemo(() => ({
    shell: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: 0.16,
      side: THREE.DoubleSide,
      transparent: true,
      wireframe: true,
    }),
    glow: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: 0.82,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    core: new THREE.MeshBasicMaterial({ color: highlight, toneMapped: false }),
    plate: new THREE.MeshStandardMaterial({
      color: '#2b2418',
      emissive: color,
      emissiveIntensity: 0.72,
      metalness: 0.88,
      opacity: 0.88,
      roughness: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  }), [color, highlight])

  useEffect(() => () => {
    disposeRecord(geometries)
    disposeRecord(materials)
  }, [geometries, materials])

  useEffectTimeline(effect.id, 1.05, reducedMotion, onComplete, (progress, _elapsed, delta, sceneTime) => {
    const phase = resolveNucleusVfxPhase(effect.mechanic, progress)
    const open = easeOutCubic(phase.action)
    const fade = phase.opacity
    if (rootRef.current) rootRef.current.scale.setScalar(0.68 + open * 0.32 + phase.impact * 0.08)
    if (shellRef.current) {
      shellRef.current.rotation.y += reducedMotion ? 0 : delta * 0.18
      shellRef.current.scale.set(1, 0.86 + Math.sin(sceneTime * 6) * (reducedMotion ? 0 : 0.025), 1)
    }
    plateRefs.current.forEach((plate, index) => {
      if (!plate) return
      const stagger = clamp01((phase.action * 1.3 - index / Math.max(1, plateCount) * 0.3))
      const lock = easeOutCubic(stagger)
      plate.visible = phase.charge > 0.02 || phase.action > 0
      plate.scale.setScalar(0.08 + lock * 0.92)
      plate.position.y = 0.52 + (index % 2) * 0.72
        + (reducedMotion ? 0 : Math.sin(sceneTime * 3.4 + index) * 0.012)
    })
    if (orbitRef.current) {
      orbitRef.current.rotation.y += reducedMotion ? 0 : delta * 1.8
      orbitRef.current.rotation.z -= reducedMotion ? 0 : delta * 0.9
    }
    materials.shell.opacity = 0.16 * fade
    materials.glow.opacity = 0.82 * fade
    materials.plate.opacity = 0.88 * fade
    materials.plate.emissiveIntensity = 0.72 + phase.impact * 1.8
    if (lightRef.current) lightRef.current.intensity = fade * (2.2 + phase.impact * 4.8)
  })

  return (
    <group
      ref={rootRef}
      name={`power-barrier-${effect.id}`}
      position={[frame.origin.x, frame.origin.y + 0.04, frame.origin.z]}
    >
      <group ref={shellRef}>
        <mesh geometry={geometries.shell} material={materials.shell} scale={radius} renderOrder={34} />
        {Array.from({ length: plateCount }, (_, index) => {
          const angle = index / plateCount * TAU
          const tier = index % 2
          return (
            <group
              key={index}
              ref={(node) => { plateRefs.current[index] = node }}
              position={[Math.cos(angle) * radius * (tier ? 0.72 : 0.91), 0.52 + tier * 0.72, Math.sin(angle) * radius * (tier ? 0.72 : 0.91)]}
              rotation={[0, Math.PI / 2 - angle, tier ? Math.PI / 6 : 0]}
              visible={false}
            >
              <mesh geometry={geometries.hex} material={materials.plate} renderOrder={36} />
              <mesh geometry={geometries.hexRim} material={materials.glow} position={[0, 0, 0.012]} renderOrder={37} />
              <mesh geometry={geometries.core} material={materials.core} position={[0, 0, 0.025]} scale={0.22} renderOrder={38} />
            </group>
          )
        })}
      </group>
      <mesh
        geometry={geometries.floor}
        material={materials.glow}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={radius}
        renderOrder={36}
      />
      <group ref={orbitRef} position={[0, 0.82, 0]}>
        <mesh geometry={geometries.orbit} material={materials.glow} scale={0.72} rotation={[Math.PI / 2, 0, 0]} renderOrder={36} />
        <mesh geometry={geometries.orbit} material={materials.glow} scale={0.48} rotation={[0, Math.PI / 2, 0]} renderOrder={36} />
        <mesh geometry={geometries.core} material={materials.core} renderOrder={37} />
      </group>
      {tuning.lights ? (
        <pointLight ref={lightRef} position={[0, 1, 0]} color={color} intensity={0} distance={7} decay={2} />
      ) : null}
    </group>
  )
}
