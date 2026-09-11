import { Sparkles } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import {
  useEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'

import { resolveNucleusVfxPhase } from '../nucleusVfxLanguage'
import {
  disposeRecord,
  easeOutCubic,
  useEffectTimeline,
  type EffectVisualProps,
} from './effectCore'

export function ProjectileEffect({
  effect,
  frame,
  color,
  highlight,
  quality,
  tuning,
  reducedMotion,
  onComplete,
}: EffectVisualProps): JSX.Element {
  const { camera } = useThree()
  const projectileRef = useRef<THREE.Group>(null)
  const chargeRef = useRef<THREE.Group>(null)
  const impactRef = useRef<THREE.Group>(null)
  const projectileLightRef = useRef<THREE.PointLight>(null)
  const impactLightRef = useRef<THREE.PointLight>(null)
  const current = useMemo(() => new THREE.Vector3(), [])
  const laneHead = useMemo(() => new THREE.Vector3(), [])
  const laneTail = useMemo(() => new THREE.Vector3(), [])
  const lanes = effect.mechanic === 'paired-burst' ? 2 : 1
  const quiet = effect.mechanic === 'suppressed-shot'
  const precision = effect.mechanic === 'precision-shot'
  const trailLength = quiet ? 1.1 : effect.mechanic === 'precision-shot' ? 3.4 : 2.3
  const trailSegmentsPerLane = quiet ? (quality === 'low' ? 4 : 7) : 1

  const trail = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(lanes * trailSegmentsPerLane * 6), 3),
    )
    const material = new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: quiet ? 0.5 : 0.92,
      transparent: true,
    })
    const object = new THREE.LineSegments(geometry, material)
    object.frustumCulled = false
    object.renderOrder = 42
    return object
  }, [color, lanes, quiet, trailSegmentsPerLane])

  const geometries = useMemo(() => ({
    core: quiet
      ? new THREE.SphereGeometry(0.1, tuning.segments, Math.max(6, tuning.segments / 2))
      : new THREE.OctahedronGeometry(effect.mechanic === 'paired-burst' ? 0.13 : 0.16, 0),
    halo: new THREE.TorusGeometry(0.2, 0.025, 5, tuning.segments),
    gate: new THREE.RingGeometry(0.13, 0.17, precision ? 4 : 6),
    glitch: new THREE.BoxGeometry(0.13, 0.025, 0.035),
    connector: new THREE.BoxGeometry(1, 1, 1),
    impact: new THREE.RingGeometry(0.2, 0.28, tuning.segments),
    impactOuter: new THREE.RingGeometry(0.38, 0.42, tuning.segments),
  }), [effect.mechanic, precision, quiet, tuning.segments])

  const materials = useMemo(() => ({
    core: new THREE.MeshBasicMaterial({ color: quiet ? color : highlight, toneMapped: false }),
    secondaryCore: new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    glow: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: quiet ? 0.46 : 0.86,
      transparent: true,
      toneMapped: false,
    }),
    impact: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: effect.hit ? color : '#9aa7b8',
      depthWrite: false,
      opacity: effect.hit ? 0.94 : 0.42,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    impactOuter: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: effect.hit ? highlight : '#657083',
      depthWrite: false,
      opacity: effect.hit ? 0.62 : 0.26,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    telegraph: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: precision ? highlight : color,
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
  }), [color, effect.hit, highlight, precision, quiet])

  useEffect(() => () => {
    trail.geometry.dispose()
    trail.material.dispose()
    disposeRecord(geometries)
    disposeRecord(materials)
  }, [geometries, materials, trail])

  const duration = THREE.MathUtils.clamp(0.3 + frame.distance / 105, 0.34, 0.72)
  useEffectTimeline(effect.id, duration, reducedMotion, onComplete, (progress, _elapsed, delta, sceneTime) => {
    const phase = resolveNucleusVfxPhase(effect.mechanic, progress)
    const travelProgress = phase.action
    const travel = easeOutCubic(phase.action)
    current.lerpVectors(frame.origin, frame.target, travel)

    if (chargeRef.current) {
      chargeRef.current.position.copy(frame.origin)
      chargeRef.current.quaternion.copy(frame.orientation)
      chargeRef.current.scale.setScalar(0.34 + phase.charge * (precision ? 1.35 : 0.92))
      chargeRef.current.visible = phase.charge > 0.01
      if (!reducedMotion) chargeRef.current.rotateZ(delta * (quiet ? -8 : 5))
    }

    const projectile = projectileRef.current
    if (projectile) {
      projectile.position.copy(current)
      projectile.quaternion.copy(frame.orientation)
      projectile.visible = travelProgress < 1
      if (!reducedMotion) projectile.rotateZ(delta * (quiet ? 4 : 11))
      const pulse = reducedMotion ? 1 : 1 + Math.sin(sceneTime * 38 + effect.id) * 0.1
      projectile.scale.setScalar(pulse)
    }

    const positions = trail.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let lane = 0; lane < lanes; lane += 1) {
      const offset = lanes === 1 ? 0 : (lane === 0 ? -0.12 : 0.12)
      for (let segment = 0; segment < trailSegmentsPerLane; segment += 1) {
        const availableTrail = Math.min(trailLength, frame.distance * travel)
        const segmentStart = quiet
          ? availableTrail * segment / trailSegmentsPerLane
          : 0
        const segmentLength = quiet
          ? Math.min(0.12, availableTrail / Math.max(1, trailSegmentsPerLane * 1.8))
          : availableTrail
        laneHead
          .copy(current)
          .addScaledVector(frame.side, offset)
          .addScaledVector(frame.direction, -segmentStart)
        laneTail.copy(laneHead).addScaledVector(frame.direction, -segmentLength)
        const vertex = (lane * trailSegmentsPerLane + segment) * 2
        positions.setXYZ(vertex, laneHead.x, laneHead.y, laneHead.z)
        positions.setXYZ(vertex + 1, laneTail.x, laneTail.y, laneTail.z)
      }
    }
    positions.needsUpdate = true
    trail.visible = phase.action > 0 && phase.dissolve < 1
    trail.material.opacity = (quiet ? 0.5 : 0.92) * phase.opacity

    const impactProgress = phase.impact
    const impact = impactRef.current
    if (impact) {
      impact.visible = phase.impact > 0
      impact.position.copy(frame.target)
      impact.quaternion.copy(camera.quaternion)
      impact.rotation.z += reducedMotion ? 0 : delta * (effect.hit ? 3.4 : 1.4)
      impact.scale.setScalar(0.25 + easeOutCubic(impactProgress) * (effect.hit ? 2.8 : 1.45))
    }
    const impactOpacity = (1 - phase.dissolve) * (1 - impactProgress * 0.7)
    materials.impact.opacity = (effect.hit ? 0.94 : 0.42) * impactOpacity
    materials.impactOuter.opacity = (effect.hit ? 0.62 : 0.26) * impactOpacity
    materials.glow.opacity = (quiet ? 0.46 : 0.86) * phase.opacity
    materials.telegraph.opacity = Math.max(phase.charge * 0.9, phase.impact * phase.opacity * 0.64)
    if (projectileLightRef.current) {
      projectileLightRef.current.intensity = travelProgress < 1 ? (quiet ? 1.2 : 4.4) : 0
    }
    if (impactLightRef.current) {
      impactLightRef.current.intensity = effect.hit ? (1 - impactProgress) * 6 : 0
    }
  })

  const sparkleCount = quality === 'high' && !quiet ? Math.max(4, tuning.sparkles / 2) : 0

  return (
    <group name={`power-projectile-${effect.id}`}>
      <primitive object={trail} />
      <group ref={chargeRef} position={frame.origin} quaternion={frame.orientation} visible={false} frustumCulled={false}>
        <mesh geometry={geometries.gate} material={materials.telegraph} renderOrder={45} />
        {precision ? (
          <mesh geometry={geometries.gate} material={materials.telegraph} rotation={[0, 0, Math.PI / 4]} scale={0.64} renderOrder={45} />
        ) : quiet ? (
          [-1, 1].map((side) => (
            <mesh key={side} geometry={geometries.glitch} material={materials.telegraph} position={[side * 0.19, 0, 0]} scale={[1, 1, 1 + side * 0.2]} renderOrder={45} />
          ))
        ) : null}
      </group>
      {precision ? (
        <group position={frame.origin} quaternion={frame.orientation}>
          {Array.from({ length: quality === 'low' ? 2 : 4 }, (_, index) => (
            <mesh
              key={index}
              geometry={geometries.gate}
              material={materials.telegraph}
              position={[0, 0, frame.distance * (0.2 + index * 0.18)]}
              rotation={[0, 0, Math.PI / 4]}
              scale={0.72 + index * 0.14}
              renderOrder={41}
            />
          ))}
        </group>
      ) : null}
      <group ref={projectileRef} position={frame.origin} frustumCulled={false}>
        {Array.from({ length: lanes }, (_, index) => (
          <group key={index} position={[lanes === 1 ? 0 : index === 0 ? -0.12 : 0.12, 0, 0]}>
            <mesh geometry={geometries.core} material={index === 1 ? materials.secondaryCore : materials.core} renderOrder={44} />
            {!quiet ? (
              <mesh
                geometry={geometries.halo}
                material={materials.glow}
                rotation={[Math.PI / 2, 0, 0]}
                scale={effect.mechanic === 'precision-shot' ? [0.8, 0.8, 1.35] : 0.72}
                renderOrder={43}
              />
            ) : null}
          </group>
        ))}
        {lanes === 2 ? (
          <mesh geometry={geometries.connector} material={materials.telegraph} scale={[0.24, 0.018, 0.018]} renderOrder={43} />
        ) : null}
        {quiet ? Array.from({ length: quality === 'low' ? 2 : 4 }, (_, index) => (
          <mesh
            key={index}
            geometry={geometries.glitch}
            material={materials.telegraph}
            position={[(index % 2 === 0 ? -1 : 1) * (0.12 + index * 0.025), (index - 1.5) * 0.045, -index * 0.08]}
            rotation={[0, 0, index * 0.7]}
            renderOrder={45}
          />
        )) : null}
        {sparkleCount > 0 ? (
          <Sparkles
            count={sparkleCount}
            color={color}
            opacity={0.72}
            scale={[0.45, 0.45, 1.2]}
            size={2.2}
            speed={reducedMotion ? 0 : 0.7}
          />
        ) : null}
        {tuning.lights ? (
          <pointLight ref={projectileLightRef} color={color} intensity={0} distance={quiet ? 2.5 : 5} decay={2} />
        ) : null}
      </group>
      <group ref={impactRef} visible={false} position={frame.target} frustumCulled={false}>
        <mesh geometry={geometries.impact} material={materials.impact} renderOrder={46} />
        <mesh geometry={geometries.impactOuter} material={materials.impactOuter} rotation={[0, 0, Math.PI / 4]} renderOrder={45} />
        {lanes === 2 ? [-1, 1].map((side) => (
          <mesh key={side} geometry={geometries.impact} material={side === 1 ? materials.telegraph : materials.impact} position={[side * 0.22, 0, 0]} scale={0.7} renderOrder={47} />
        )) : null}
        {quiet ? [-1, 0, 1].map((slice) => (
          <mesh key={slice} geometry={geometries.glitch} material={materials.telegraph} position={[slice * 0.22, slice * -0.07, 0]} scale={[1.5 - Math.abs(slice) * 0.2, 1, 1]} renderOrder={47} />
        )) : null}
        {tuning.lights ? (
          <pointLight ref={impactLightRef} color={color} intensity={0} distance={effect.hit ? 7 : 2} decay={2} />
        ) : null}
      </group>
    </group>
  )
}
