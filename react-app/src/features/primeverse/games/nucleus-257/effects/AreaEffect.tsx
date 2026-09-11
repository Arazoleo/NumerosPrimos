import { Sparkles } from '@react-three/drei'
import {
  useEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'

import { resolveNucleusVfxPhase } from '../nucleusVfxLanguage'
import {
  TAU,
  abilityRadius,
  disposeRecord,
  easeOutCubic,
  pulseEnvelope,
  useEffectTimeline,
  type EffectVisualProps,
} from './effectCore'

export function AreaEffect({
  effect,
  frame,
  ability,
  color,
  highlight,
  quality,
  tuning,
  reducedMotion,
  onComplete,
}: EffectVisualProps): JSX.Element {
  const rootRef = useRef<THREE.Group>(null)
  const outerRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Group>(null)
  const scanRef = useRef<THREE.Group>(null)
  const glitchRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const radius = abilityRadius(ability, effect.mechanic === 'sieve-field' ? 5.75 : 4.25)
  const sieve = effect.mechanic === 'sieve-field'

  const grid = useMemo(() => {
    const divisions = quality === 'low' ? 3 : quality === 'medium' ? 5 : 7
    const positions = new Float32Array(divisions * 2 * 6)
    for (let index = 0; index < divisions; index += 1) {
      const offset = (index / (divisions - 1) - 0.5) * radius * 1.6
      const base = index * 12
      positions.set([-radius * 0.8, 0.02, offset, radius * 0.8, 0.02, offset], base)
      positions.set([offset, 0.02, -radius * 0.8, offset, 0.02, radius * 0.8], base + 6)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: sieve ? 0.3 : 0.18,
      transparent: true,
    })
    const object = new THREE.LineSegments(geometry, material)
    object.frustumCulled = false
    object.renderOrder = 31
    return object
  }, [color, quality, radius, sieve])

  const geometries = useMemo(() => ({
    ring: new THREE.RingGeometry(0.88, 1, tuning.segments),
    thinRing: new THREE.RingGeometry(0.97, 1, tuning.segments),
    core: sieve
      ? new THREE.IcosahedronGeometry(0.32, quality === 'high' ? 1 : 0)
      : new THREE.OctahedronGeometry(0.48, 0),
    satellite: new THREE.OctahedronGeometry(0.13, 0),
    disc: new THREE.CircleGeometry(1, tuning.segments),
    scan: new THREE.BoxGeometry(1, 0.018, 0.065),
    glitch: new THREE.BoxGeometry(0.48, 0.035, 0.14),
    arc: new THREE.RingGeometry(0.78, 1, Math.max(6, Math.round(tuning.segments / 3)), 1, 0, Math.PI * 0.72),
  }), [quality, sieve, tuning.segments])

  const materials = useMemo(() => ({
    field: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: sieve ? 0.11 : 0.08,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    ring: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: 0.76,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    core: new THREE.MeshBasicMaterial({
      color: effect.hit ? highlight : color,
      opacity: 0.92,
      transparent: true,
      toneMapped: false,
      wireframe: !sieve,
    }),
    secondary: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: highlight,
      depthWrite: false,
      opacity: 0.7,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
  }), [color, effect.hit, highlight, sieve])

  useEffect(() => () => {
    grid.geometry.dispose()
    grid.material.dispose()
    disposeRecord(geometries)
    disposeRecord(materials)
  }, [geometries, grid, materials])

  useEffectTimeline(effect.id, sieve ? 1.05 : 0.92, reducedMotion, onComplete, (progress, _elapsed, delta, sceneTime) => {
    const phase = resolveNucleusVfxPhase(effect.mechanic, progress)
    const reveal = easeOutCubic(phase.action)
    const fade = phase.opacity
    if (rootRef.current) rootRef.current.scale.setScalar(Math.max(0.02, reveal, phase.charge * 0.35))
    if (outerRef.current) {
      outerRef.current.rotation.y += reducedMotion ? 0 : delta * (sieve ? 0.7 : -1.4)
      outerRef.current.scale.setScalar(0.92 + Math.sin(sceneTime * 8) * (reducedMotion ? 0 : 0.035))
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= reducedMotion ? 0 : delta * (sieve ? 1.1 : 2.2)
      innerRef.current.scale.setScalar(0.72 + reveal * 0.28)
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += reducedMotion ? 0 : delta * (sieve ? 2.2 : 4.5)
      coreRef.current.position.y = sieve ? 0.32 + Math.sin(sceneTime * 7) * (reducedMotion ? 0 : 0.08) : 0.72
      coreRef.current.scale.setScalar(0.72 + pulseEnvelope(progress, 0.25) * 0.75 + phase.impact * 0.28)
    }
    if (scanRef.current) {
      scanRef.current.visible = sieve && phase.action > 0 && phase.dissolve < 1
      scanRef.current.position.z = THREE.MathUtils.lerp(-radius * 0.82, radius * 0.82, phase.action)
      scanRef.current.scale.set(radius * 1.62, 1, 1 + phase.impact * 2.4)
    }
    if (glitchRef.current) {
      const stepped = Math.floor(phase.action * 9)
      glitchRef.current.position.x = reducedMotion ? 0 : Math.sin(stepped * 8.31 + effect.id) * 0.14
      glitchRef.current.position.z = reducedMotion ? 0 : Math.cos(stepped * 5.17 + effect.id) * 0.1
      glitchRef.current.rotation.y += reducedMotion ? 0 : delta * -1.7
    }
    grid.material.opacity = (sieve ? 0.34 : 0) * fade
    materials.field.opacity = (sieve ? 0.11 : 0.08) * fade
    materials.ring.opacity = 0.76 * fade
    materials.core.opacity = 0.92 * fade
    materials.secondary.opacity = (sieve ? 0.74 : 0.62) * fade
    if (lightRef.current) lightRef.current.intensity = fade * (effect.hit ? 4.8 : 2.2) * (0.35 + phase.action * 0.65)
  })

  return (
    <group
      ref={rootRef}
      name={`power-area-${effect.id}`}
      position={[frame.target.x, frame.target.y + 0.035, frame.target.z]}
    >
      <mesh
        geometry={geometries.disc}
        material={materials.field}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={radius}
        renderOrder={29}
      />
      {sieve ? <primitive object={grid} /> : null}
      {sieve ? (
        <group ref={scanRef} position={[0, 0.075, -radius * 0.82]}>
          <mesh geometry={geometries.scan} material={materials.secondary} renderOrder={35} />
          <mesh geometry={geometries.scan} material={materials.ring} position={[0, 0.08, 0]} scale={[1, 4, 0.3]} renderOrder={34} />
        </group>
      ) : null}
      <group ref={outerRef}>
        <mesh
          geometry={geometries.ring}
          material={materials.ring}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={radius}
          renderOrder={33}
        />
        {sieve ? [2, 3, 5, 7].map((prime, index) => {
          const angle = index / 4 * TAU + Math.PI / 4
          return (
            <mesh
              key={prime}
              geometry={geometries.satellite}
              material={materials.ring}
              position={[Math.cos(angle) * radius * 0.84, 0.16, Math.sin(angle) * radius * 0.84]}
              scale={0.72 + prime * 0.035}
              renderOrder={34}
            />
          )
        }) : null}
      </group>
      <group ref={innerRef}>
        {(sieve ? [0.32, 0.56, 0.76] : [0.38, 0.68, 0.9]).map((scale, index) => (
          <mesh
            key={scale}
            geometry={sieve ? geometries.thinRing : geometries.arc}
            material={index % 2 === 0 ? materials.ring : materials.secondary}
            rotation={[-Math.PI / 2, 0, index * 0.17]}
            scale={radius * scale}
            renderOrder={32}
          />
        ))}
      </group>
      {!sieve ? (
        <group ref={glitchRef}>
          {Array.from({ length: quality === 'low' ? 6 : 10 }, (_, index) => {
            const angle = index / (quality === 'low' ? 6 : 10) * TAU + (index % 2) * 0.21
            const distance = radius * (0.34 + (index % 4) * 0.14)
            return (
              <group
                key={index}
                position={[Math.cos(angle) * distance, 0.12 + (index % 3) * 0.22, Math.sin(angle) * distance]}
                rotation={[index * 0.11, -angle, index * 0.37]}
              >
                <mesh geometry={geometries.glitch} material={index % 2 === 0 ? materials.ring : materials.secondary} scale={[0.55 + (index % 3) * 0.2, 1, 1]} renderOrder={35} />
                {index % 3 === 0 ? (
                  <mesh geometry={geometries.glitch} material={materials.core} position={[0.17, 0.09, 0]} scale={[0.28, 0.6, 0.7]} renderOrder={36} />
                ) : null}
              </group>
            )
          })}
        </group>
      ) : null}
      <group ref={coreRef} position={[0, sieve ? 0.32 : 0.72, 0]}>
        <mesh geometry={geometries.core} material={materials.core} renderOrder={35} />
        {!sieve ? (
          <mesh geometry={geometries.ring} material={materials.ring} rotation={[Math.PI / 2, 0, 0]} scale={0.72} renderOrder={35} />
        ) : null}
      </group>
      {tuning.sparkles > 0 ? (
        <Sparkles
          count={tuning.sparkles}
          color={color}
          opacity={sieve ? 0.64 : 0.42}
          scale={[radius * 1.55, 0.65, radius * 1.55]}
          size={sieve ? 2.2 : 3}
          speed={reducedMotion ? 0 : sieve ? 0.35 : 0.7}
        />
      ) : null}
      {tuning.lights ? (
        <pointLight ref={lightRef} position={[0, 0.6, 0]} color={color} intensity={0} distance={radius * 2.2} decay={2} />
      ) : null}
    </group>
  )
}
