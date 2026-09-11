import {
  useEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'

import { resolveNucleusVfxPhase } from '../nucleusVfxLanguage'
import {
  abilityRange,
  disposeRecord,
  easeOutCubic,
  useEffectTimeline,
  type EffectVisualProps,
} from './effectCore'

export function ConeEffect({
  effect,
  frame,
  ability,
  color,
  highlight,
  tuning,
  reducedMotion,
  onComplete,
}: EffectVisualProps): JSX.Element {
  const rootRef = useRef<THREE.Group>(null)
  const chargeRef = useRef<THREE.Group>(null)
  const impactRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const range = abilityRange(ability, frame.distance)
  const halfAngle = ability.hitShape.kind === 'cone'
    ? THREE.MathUtils.degToRad(ability.hitShape.halfAngleDegrees)
    : THREE.MathUtils.degToRad(12)
  const radius = Math.max(0.35, Math.tan(halfAngle) * range)
  const twin = effect.mechanic === 'twin-detonation'

  const rays = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const laneCount = twin ? Math.max(4, tuning.coneRays - 1) : tuning.coneRays
    const positions = new Float32Array(laneCount * 6)
    for (let index = 0; index < laneCount; index += 1) {
      const ratio = laneCount === 1 ? 0.5 : index / (laneCount - 1)
      const spread = (ratio - 0.5) * 2
      const laneOffset = twin ? (index % 2 === 0 ? -0.26 : 0.26) : 0
      positions[index * 6] = laneOffset
      positions[index * 6 + 1] = 0.08
      positions[index * 6 + 2] = 0
      positions[index * 6 + 3] = spread * radius + laneOffset
      positions[index * 6 + 4] = Math.sin(index * 2.41) * radius * 0.24
      positions[index * 6 + 5] = range
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: twin ? 0.82 : 0.72,
      transparent: true,
    })
    const object = new THREE.LineSegments(geometry, material)
    object.frustumCulled = false
    object.renderOrder = 38
    return object
  }, [color, radius, range, tuning.coneRays, twin])

  const geometries = useMemo(() => ({
    cone: new THREE.ConeGeometry(1, 1, tuning.segments, 1, true),
    impact: new THREE.RingGeometry(0.58, 0.72, tuning.segments),
    aperture: new THREE.RingGeometry(0.24, 0.32, twin ? 12 : 6),
    pellet: twin
      ? new THREE.SphereGeometry(0.075, 6, 4)
      : new THREE.CylinderGeometry(0.09, 0.09, 0.16, 6),
  }), [tuning.segments, twin])

  const materials = useMemo(() => ({
    cone: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: twin ? 0.1 : 0.075,
      side: THREE.DoubleSide,
      transparent: true,
      wireframe: true,
    }),
    impact: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: effect.hit ? highlight : '#7a8290',
      depthWrite: false,
      opacity: effect.hit ? 0.76 : 0.25,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    pellet: new THREE.MeshBasicMaterial({ color: highlight, toneMapped: false }),
    secondary: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: highlight,
      depthWrite: false,
      opacity: 0.72,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
  }), [color, effect.hit, highlight, twin])

  useEffect(() => () => {
    rays.geometry.dispose()
    rays.material.dispose()
    disposeRecord(geometries)
    disposeRecord(materials)
  }, [geometries, materials, rays])

  useEffectTimeline(effect.id, twin ? 0.68 : 0.56, reducedMotion, onComplete, (progress, _elapsed, delta) => {
    const phase = resolveNucleusVfxPhase(effect.mechanic, progress)
    const reveal = easeOutCubic(phase.action)
    const fade = phase.opacity
    if (rootRef.current) {
      rootRef.current.scale.set(0.72 + reveal * 0.28, 0.72 + reveal * 0.28, Math.max(0.01, reveal))
    }
    if (chargeRef.current) {
      chargeRef.current.visible = phase.charge > 0.01
      chargeRef.current.scale.setScalar(0.42 + phase.charge * (twin ? 1.2 : 1.65))
      chargeRef.current.rotation.z += reducedMotion ? 0 : delta * (twin ? -4.5 : 2.4)
    }
    rays.material.opacity = (twin ? 0.82 : 0.72) * fade
    materials.cone.opacity = (twin ? 0.1 : 0.075) * fade
    materials.secondary.opacity = (twin ? 0.72 : 0.58) * fade
    materials.impact.opacity = (effect.hit ? 0.76 : 0.25) * phase.impact * fade
    if (impactRef.current) {
      impactRef.current.rotation.z += reducedMotion ? 0 : delta * (twin ? 5 : 2.5)
      impactRef.current.visible = phase.impact > 0
      impactRef.current.scale.setScalar(0.55 + easeOutCubic(phase.impact) * (effect.hit ? 1.6 : 0.8))
    }
    if (lightRef.current) lightRef.current.intensity = phase.impact * (effect.hit ? fade * 4.2 : fade * 1.1)
  })

  return (
    <group
      ref={rootRef}
      name={`power-cone-${effect.id}`}
      position={frame.origin}
      quaternion={frame.orientation}
    >
      <primitive object={rays} />
      <group ref={chargeRef} position={[0, 0, 0.08]} visible={false}>
        <mesh geometry={geometries.aperture} material={materials.secondary} renderOrder={40} />
        {twin ? (
          <>
            <mesh geometry={geometries.aperture} material={materials.cone} position={[-0.18, 0, 0.01]} scale={0.62} renderOrder={41} />
            <mesh geometry={geometries.aperture} material={materials.secondary} position={[0.18, 0, 0.01]} scale={0.62} renderOrder={41} />
          </>
        ) : (
          <mesh geometry={geometries.aperture} material={materials.impact} rotation={[0, 0, Math.PI / 6]} scale={0.68} renderOrder={41} />
        )}
      </group>
      {twin ? (
        [-1, 1].map((side) => (
          <mesh
            key={side}
            geometry={geometries.cone}
            material={side === 1 ? materials.secondary : materials.cone}
            position={[side * radius * 0.12, 0, range * 0.5]}
            rotation={[Math.PI / 2, 0, side * 0.025]}
            scale={[radius * 0.57, range, radius * 0.68]}
            renderOrder={37}
          />
        ))
      ) : (
        <mesh
          geometry={geometries.cone}
          material={materials.cone}
          position={[0, 0, range * 0.5]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[radius, range, radius]}
          renderOrder={37}
        />
      )}
      {Array.from({ length: twin ? 2 : Math.min(5, tuning.coneRays) }, (_, index) => {
        const count = twin ? 2 : Math.min(5, tuning.coneRays)
        const x = count === 1 ? 0 : (index / (count - 1) - 0.5) * radius * 1.2
        return (
          <mesh
            key={index}
            geometry={geometries.pellet}
            material={twin && index % 2 === 1 ? materials.secondary : materials.pellet}
            position={[x, Math.sin(index * 2.1) * radius * 0.12, range * 0.92]}
            rotation={twin ? undefined : [Math.PI / 2, 0, index * 0.18]}
            renderOrder={39}
          />
        )
      })}
      <group ref={impactRef} position={[0, 0, range]} visible={false}>
        <mesh geometry={geometries.impact} material={materials.impact} renderOrder={40} />
        {twin ? [-1, 1].map((side) => (
          <mesh
            key={side}
            geometry={geometries.impact}
            material={side === 1 ? materials.secondary : materials.impact}
            position={[side * radius * 0.28, 0, 0]}
            scale={0.72}
            renderOrder={41}
          />
        )) : [-1, 0, 1].map((plate) => (
          <mesh
            key={plate}
            geometry={geometries.aperture}
            material={plate === 0 ? materials.impact : materials.secondary}
            position={[plate * 0.55, Math.abs(plate) * -0.12, 0]}
            rotation={[0, 0, plate * Math.PI / 6]}
            scale={1.1 - Math.abs(plate) * 0.16}
            renderOrder={41}
          />
        ))}
        {tuning.lights ? (
          <pointLight ref={lightRef} color={color} intensity={0} distance={7} decay={2} />
        ) : null}
      </group>
    </group>
  )
}
