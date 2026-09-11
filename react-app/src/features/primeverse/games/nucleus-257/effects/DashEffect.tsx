import { Sparkles } from '@react-three/drei'
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
  pulseEnvelope,
  useEffectTimeline,
  type EffectVisualProps,
} from './effectCore'

export function DashEffect({
  effect,
  frame,
  color,
  highlight,
  quality,
  tuning,
  reducedMotion,
  onComplete,
}: EffectVisualProps): JSX.Element {
  const headRef = useRef<THREE.Group>(null)
  const originRef = useRef<THREE.Group>(null)
  const targetRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const current = useMemo(() => new THREE.Vector3(), [])
  const echo = effect.mechanic === 'echo-step'
  const blink = effect.mechanic === 'key-exchange'
  const charge = effect.mechanic === 'modular-charge'
  const trailCount = charge ? 3 : echo || blink ? 2 : 1

  const trail = useMemo(() => {
    const samples = quality === 'low' ? 5 : quality === 'medium' ? 8 : 12
    const dashedSamples = blink ? samples : 1
    const positions = new Float32Array(trailCount * dashedSamples * 6)
    let cursor = 0
    for (let lane = 0; lane < trailCount; lane += 1) {
      const laneOffset = trailCount === 1 ? 0 : (lane / (trailCount - 1) - 0.5) * (charge ? 1.4 : 0.52)
      for (let sample = 0; sample < dashedSamples; sample += 1) {
        const startT = blink ? sample / samples : 0
        const endT = blink ? Math.min(1, startT + 0.045) : 1
        const start = frame.origin.clone().lerp(frame.target, startT).addScaledVector(frame.side, laneOffset)
        const end = frame.origin.clone().lerp(frame.target, endT).addScaledVector(frame.side, laneOffset)
        positions.set([start.x, start.y + 0.2, start.z, end.x, end.y + 0.2, end.z], cursor)
        cursor += 6
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: blink ? 0.7 : charge ? 0.9 : 0.76,
      transparent: true,
    })
    const object = new THREE.LineSegments(geometry, material)
    object.frustumCulled = false
    object.renderOrder = 36
    return object
  }, [blink, charge, color, frame, quality, trailCount])

  const geometries = useMemo(() => ({
    head: charge
      ? new THREE.BoxGeometry(1.35, 0.9, 0.42)
      : blink
        ? new THREE.OctahedronGeometry(0.42, 0)
        : new THREE.IcosahedronGeometry(0.3, 0),
    ring: new THREE.RingGeometry(0.46, 0.58, tuning.segments),
    echo: new THREE.BoxGeometry(0.42, 0.7, 0.08),
    primeGate: new THREE.RingGeometry(0.32, 0.4, 4),
    hex: new THREE.CircleGeometry(0.48, 6),
    afterimage: new THREE.CapsuleGeometry(0.18, 0.48, 3, 6),
    glitch: new THREE.BoxGeometry(0.44, 0.035, 0.12),
  }), [blink, charge, tuning.segments])

  const materials = useMemo(() => ({
    head: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: charge ? 0.45 : 0.82,
      transparent: true,
      toneMapped: false,
      wireframe: charge,
    }),
    ring: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: highlight,
      depthWrite: false,
      opacity: 0.72,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    secondary: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: 0.52,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
      wireframe: echo,
    }),
  }), [charge, color, echo, highlight])

  useEffect(() => () => {
    trail.geometry.dispose()
    trail.material.dispose()
    disposeRecord(geometries)
    disposeRecord(materials)
  }, [geometries, materials, trail])

  useEffectTimeline(effect.id, blink ? 0.48 : charge ? 0.7 : 0.58, reducedMotion, onComplete, (progress, _elapsed, delta) => {
    const phase = resolveNucleusVfxPhase(effect.mechanic, progress)
    const travel = blink
      ? phase.action < 0.48 ? 0 : 1
      : easeOutCubic(phase.action)
    const fade = phase.opacity
    current.lerpVectors(frame.origin, frame.target, travel)
    if (headRef.current) {
      headRef.current.position.copy(current)
      headRef.current.quaternion.copy(frame.orientation)
      headRef.current.visible = blink
        ? phase.charge > 0.02 || phase.action > 0.54
        : phase.action < 1 || phase.impact < 0.4
      if (!reducedMotion) headRef.current.rotateZ(delta * (echo ? 8 : 3))
      headRef.current.scale.setScalar(0.72 + pulseEnvelope(progress, 0.2) * 0.65)
    }
    if (originRef.current) {
      originRef.current.rotation.y += reducedMotion ? 0 : delta * 2.4
      originRef.current.scale.setScalar(0.45 + phase.charge * 1.15 + phase.action * 0.35)
    }
    if (targetRef.current) {
      targetRef.current.rotation.y -= reducedMotion ? 0 : delta * 3.2
      targetRef.current.scale.setScalar(0.25 + easeOutCubic(Math.max(phase.charge * 0.42, phase.impact)) * (blink ? 2.2 : 1.35))
    }
    trail.material.opacity = (blink ? 0.7 : charge ? 0.9 : 0.76) * fade * (0.18 + phase.action * 0.82)
    materials.head.opacity = (charge ? 0.45 : 0.82) * fade
    materials.ring.opacity = 0.72 * fade
    materials.secondary.opacity = (echo ? 0.42 : 0.52) * fade
    if (lightRef.current) lightRef.current.intensity = fade * (charge ? 5.5 : 3.2) * (0.3 + phase.action * 0.7)
  })

  return (
    <group name={`power-dash-${effect.id}`}>
      <primitive object={trail} />
      {effect.mechanic === 'residue-dash' ? (
        <group position={frame.origin} quaternion={frame.orientation}>
          {[2, 3, 5, 7].map((prime, index) => (
            <mesh
              key={prime}
              geometry={geometries.primeGate}
              material={index % 2 === 0 ? materials.ring : materials.secondary}
              position={[0, 0.12, frame.distance * (0.18 + index * 0.2)]}
              rotation={[0, 0, Math.PI / 4 + index * 0.12]}
              scale={0.72 + prime * 0.025}
              renderOrder={37}
            />
          ))}
        </group>
      ) : charge ? (
        Array.from({ length: quality === 'low' ? 3 : 5 }, (_, index) => {
          const point = frame.origin.clone().lerp(frame.target, (index + 1) / (quality === 'low' ? 4 : 6))
          return (
            <mesh
              key={index}
              geometry={geometries.hex}
              material={index % 2 === 0 ? materials.secondary : materials.ring}
              position={[point.x, point.y + 0.055, point.z]}
              rotation={[-Math.PI / 2, 0, index * 0.24]}
              scale={0.72 + index * 0.08}
              renderOrder={35}
            />
          )
        })
      ) : echo ? (
        Array.from({ length: quality === 'low' ? 2 : 4 }, (_, index) => {
          const point = frame.origin.clone().lerp(frame.target, (index + 1) / (quality === 'low' ? 3 : 5))
          return (
            <group key={index} position={[point.x, point.y + 0.47, point.z]} quaternion={frame.orientation}>
              <mesh geometry={geometries.afterimage} material={index % 2 === 0 ? materials.secondary : materials.ring} scale={[1, 1, 0.24]} renderOrder={36} />
              <mesh geometry={geometries.afterimage} material={index % 2 === 0 ? materials.ring : materials.secondary} position={[index % 2 === 0 ? -0.24 : 0.24, 0, -0.08]} scale={[0.72, 0.86, 0.18]} renderOrder={35} />
            </group>
          )
        })
      ) : (
        Array.from({ length: quality === 'low' ? 4 : 7 }, (_, index) => {
          const point = frame.origin.clone().lerp(frame.target, (index + 0.5) / (quality === 'low' ? 4 : 7))
          return (
            <mesh
              key={index}
              geometry={geometries.glitch}
              material={index % 2 === 0 ? materials.ring : materials.secondary}
              position={[point.x + Math.sin(index * 4.1) * 0.3, point.y + 0.12 + (index % 3) * 0.13, point.z]}
              rotation={[0, -Math.atan2(frame.direction.x, frame.direction.z), index * 0.73]}
              scale={[0.55 + (index % 3) * 0.22, 1, 1]}
              renderOrder={37}
            />
          )
        })
      )}
      <group ref={headRef} position={frame.origin} frustumCulled={false}>
        <mesh geometry={geometries.head} material={materials.head} renderOrder={38} />
        {echo ? (
          [-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={geometries.echo}
              material={materials.ring}
              position={[side * 0.38, 0, 0.18]}
              renderOrder={37}
            />
          ))
        ) : null}
        {tuning.sparkles > 0 && !charge ? (
          <Sparkles
            count={Math.max(3, tuning.sparkles / 2)}
            color={color}
            opacity={0.62}
            scale={0.8}
            size={2.4}
            speed={reducedMotion ? 0 : 0.65}
          />
        ) : null}
        {tuning.lights ? <pointLight ref={lightRef} color={color} intensity={0} distance={6} decay={2} /> : null}
      </group>
      <group ref={originRef} position={[frame.origin.x, frame.origin.y + 0.05, frame.origin.z]}>
        <mesh geometry={geometries.ring} material={materials.ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={37} />
      </group>
      <group ref={targetRef} position={[frame.target.x, frame.target.y + 0.05, frame.target.z]}>
        <mesh geometry={geometries.ring} material={materials.ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={37} />
        {blink ? (
          <mesh geometry={geometries.ring} material={materials.ring} rotation={[0, 0, 0]} scale={0.72} renderOrder={37} />
        ) : null}
      </group>
    </group>
  )
}
