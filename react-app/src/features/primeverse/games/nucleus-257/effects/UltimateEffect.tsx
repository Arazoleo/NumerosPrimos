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
  abilityRange,
  clamp01,
  disposeRecord,
  easeOutCubic,
  pulseEnvelope,
  useEffectTimeline,
  type EffectVisualProps,
} from './effectCore'

export function UltimateEffect({
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
  const waveARef = useRef<THREE.Group>(null)
  const waveBRef = useRef<THREE.Group>(null)
  const volumeRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Group>(null)
  const beamRef = useRef<THREE.Group>(null)
  const languageRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const bastion = effect.mechanic === 'rsa-bastion'
  const twin = effect.mechanic === 'twin-conjecture'
  const secret = effect.mechanic === 'shared-secret'
  const radius = abilityRadius(ability, secret ? 17 : bastion ? 20 : 18)
  const range = abilityRange(ability, 48)
  const halfAngle = ability.hitShape.kind === 'cone'
    ? THREE.MathUtils.degToRad(ability.hitShape.halfAngleDegrees)
    : THREE.MathUtils.degToRad(32)
  const coneRadius = Math.tan(halfAngle) * range

  const geometries = useMemo(() => ({
    ring: new THREE.RingGeometry(0.93, 1, tuning.segments),
    thinRing: new THREE.RingGeometry(0.98, 1, tuning.segments),
    dome: new THREE.SphereGeometry(1, tuning.segments, Math.max(8, tuning.segments / 2), 0, TAU, 0, Math.PI / 2),
    sphere: new THREE.SphereGeometry(1, tuning.segments, Math.max(8, tuning.segments / 2)),
    cone: new THREE.ConeGeometry(1, 1, tuning.segments, 1, true),
    marker: secret ? new THREE.OctahedronGeometry(0.34, 0) : new THREE.IcosahedronGeometry(0.28, 0),
    pillar: new THREE.BoxGeometry(0.1, 1, 0.1),
    hex: new THREE.RingGeometry(0.38, 0.5, 6),
    scan: new THREE.RingGeometry(0.94, 1, tuning.segments),
    glitch: new THREE.BoxGeometry(0.72, 0.055, 0.18),
    core: bastion ? new THREE.DodecahedronGeometry(0.72, 0) : new THREE.IcosahedronGeometry(0.58, 1),
  }), [bastion, secret, tuning.segments])

  const materials = useMemo(() => ({
    wave: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: 0.78,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    bright: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: highlight,
      depthWrite: false,
      opacity: 0.88,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    volume: new THREE.MeshBasicMaterial({
      blending: secret ? THREE.NormalBlending : THREE.AdditiveBlending,
      color: secret ? '#130d2d' : color,
      depthWrite: false,
      opacity: secret ? 0.11 : bastion ? 0.09 : 0.07,
      side: THREE.DoubleSide,
      transparent: true,
      wireframe: true,
    }),
    core: new THREE.MeshBasicMaterial({
      color: highlight,
      toneMapped: false,
      wireframe: secret,
    }),
  }), [bastion, color, highlight, secret])

  useEffect(() => () => {
    disposeRecord(geometries)
    disposeRecord(materials)
  }, [geometries, materials])

  useEffectTimeline(effect.id, twin ? 1.15 : 1.35, reducedMotion, onComplete, (progress, _elapsed, delta, sceneTime) => {
    const phase = resolveNucleusVfxPhase(effect.mechanic, progress)
    const expansion = easeOutCubic(phase.action)
    const delayedExpansion = easeOutCubic(clamp01((phase.action - 0.18) / 0.82))
    const fade = phase.opacity
    if (rootRef.current) rootRef.current.visible = progress < 1
    if (waveARef.current) {
      waveARef.current.scale.setScalar(Math.max(0.01, radius * (0.04 + expansion * 0.96)))
      waveARef.current.rotation.y += reducedMotion ? 0 : delta * 0.48
    }
    if (waveBRef.current) {
      waveBRef.current.scale.setScalar(Math.max(0.01, radius * (0.03 + delayedExpansion * 0.97)))
      waveBRef.current.rotation.y -= reducedMotion ? 0 : delta * 0.68
    }
    if (volumeRef.current) {
      const resolvedRadius = Math.max(0.02, radius * expansion)
      volumeRef.current.scale.set(resolvedRadius, resolvedRadius * (bastion ? 0.5 : secret ? 0.7 : 0.34), resolvedRadius)
      volumeRef.current.rotation.y += reducedMotion ? 0 : delta * (secret ? -0.42 : 0.24)
    }
    if (beamRef.current) {
      beamRef.current.scale.set(0.7 + expansion * 0.3, 0.7 + expansion * 0.3, Math.max(0.01, expansion))
    }
    if (languageRef.current) {
      if (secret) {
        const stepped = Math.floor(phase.action * 12)
        languageRef.current.position.x = reducedMotion ? 0 : Math.sin(stepped * 7.13 + effect.id) * 0.18
        languageRef.current.position.z = reducedMotion ? 0 : Math.cos(stepped * 4.71 + effect.id) * 0.14
        languageRef.current.rotation.y += reducedMotion ? 0 : delta * -0.62
      } else {
        languageRef.current.position.y = 0.08 + expansion * (bastion ? 2.4 : 3.8)
        languageRef.current.rotation.y += reducedMotion ? 0 : delta * (bastion ? 0.24 : 0.72)
        languageRef.current.scale.setScalar(Math.max(0.08, radius * (0.08 + expansion * 0.92)))
      }
    }
    if (coreRef.current) {
      coreRef.current.rotation.y += reducedMotion ? 0 : delta * (twin ? 4 : 1.8)
      coreRef.current.rotation.z -= reducedMotion ? 0 : delta * 0.7
      coreRef.current.scale.setScalar(0.55 + pulseEnvelope(progress, 0.24) * (twin ? 1.6 : 1.1) + phase.impact * 0.32)
      coreRef.current.position.y = 0.9 + Math.sin(sceneTime * 5) * (reducedMotion ? 0 : 0.12)
    }
    materials.wave.opacity = 0.78 * fade
    materials.bright.opacity = 0.88 * fade
    materials.volume.opacity = (secret ? 0.11 : bastion ? 0.09 : 0.07) * fade
    if (lightRef.current) lightRef.current.intensity = fade * (bastion ? 9 : 7) * (0.35 + expansion * 0.65)
  })

  const markerCount = tuning.ultimateMarks

  return (
    <group
      ref={rootRef}
      name={`power-ultimate-${effect.id}`}
      position={[frame.origin.x, frame.origin.y + 0.04, frame.origin.z]}
    >
      {twin ? (
        <group ref={beamRef} quaternion={frame.orientation}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              geometry={geometries.cone}
              material={materials.volume}
              position={[side * coneRadius * 0.16, 0, range * 0.5]}
              rotation={[Math.PI / 2, 0, side * 0.035]}
              scale={[coneRadius * 0.58, range, coneRadius * 0.72]}
              renderOrder={52}
            />
          ))}
          {[-1, 1].map((side) => (
            <mesh
              key={`rail-${side}`}
              geometry={geometries.pillar}
              material={materials.bright}
              position={[side * 0.46, 0, range * 0.5]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[1, range, 1]}
              renderOrder={54}
            />
          ))}
          {[-1, 1].map((side) => (
            <group key={`echo-rail-${side}`} position={[side * 0.82, 0, range * 0.42]}>
              {[0, 1, 2].map((echoIndex) => (
                <mesh
                  key={echoIndex}
                  geometry={geometries.pillar}
                  material={echoIndex % 2 === 0 ? materials.wave : materials.bright}
                  position={[side * echoIndex * 0.16, 0, -echoIndex * 1.2]}
                  rotation={[Math.PI / 2, 0, 0]}
                  scale={[0.72, range * (0.34 - echoIndex * 0.055), 0.72]}
                  renderOrder={53 - echoIndex}
                />
              ))}
            </group>
          ))}
          <group ref={coreRef} position={[0, 0, 1.1]}>
            <mesh geometry={geometries.core} material={materials.core} renderOrder={55} />
          </group>
        </group>
      ) : (
        <>
          <group ref={waveARef}>
            <mesh geometry={geometries.ring} material={materials.wave} rotation={[-Math.PI / 2, 0, 0]} renderOrder={54} />
          </group>
          <group ref={waveBRef}>
            <mesh geometry={geometries.thinRing} material={materials.bright} rotation={[-Math.PI / 2, 0, Math.PI / 7]} renderOrder={55} />
          </group>
          <group ref={volumeRef}>
            <mesh
              geometry={bastion ? geometries.dome : geometries.sphere}
              material={materials.volume}
              position={[0, bastion ? 0 : 0.18, 0]}
              renderOrder={50}
            />
          </group>
          {secret ? (
            <group ref={languageRef}>
              {Array.from({ length: Math.max(6, Math.round(markerCount * 0.7)) }, (_, index) => {
                const angle = index / Math.max(6, Math.round(markerCount * 0.7)) * TAU
                const distance = radius * (0.28 + (index % 3) * 0.13)
                return (
                  <mesh
                    key={index}
                    geometry={geometries.glitch}
                    material={index % 2 === 0 ? materials.wave : materials.bright}
                    position={[Math.cos(angle) * distance, 0.35 + (index % 4) * 0.38, Math.sin(angle) * distance]}
                    rotation={[index * 0.13, -angle, index * 0.58]}
                    scale={[0.45 + (index % 3) * 0.22, 1, 1]}
                    renderOrder={53}
                  />
                )
              })}
              <mesh geometry={geometries.scan} material={materials.bright} position={[0, 1.1, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={radius * 0.26} renderOrder={54} />
              <mesh geometry={geometries.scan} material={materials.wave} position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, Math.PI / 4]} scale={radius * 0.18} renderOrder={54} />
            </group>
          ) : bastion ? (
            <group ref={languageRef}>
              {Array.from({ length: 8 }, (_, index) => {
                const angle = index / 8 * TAU
                return (
                  <mesh
                    key={index}
                    geometry={geometries.hex}
                    material={index % 2 === 0 ? materials.bright : materials.wave}
                    position={[Math.cos(angle) * 0.72, (index % 2) * 0.045, Math.sin(angle) * 0.72]}
                    rotation={[0, Math.PI / 2 - angle, index % 2 ? Math.PI / 6 : 0]}
                    scale={0.065}
                    renderOrder={56}
                  />
                )
              })}
            </group>
          ) : (
            <group ref={languageRef}>
              <mesh geometry={geometries.scan} material={materials.bright} rotation={[-Math.PI / 2, 0, 0]} renderOrder={57} />
              <mesh geometry={geometries.hex} material={materials.wave} rotation={[-Math.PI / 2, 0, Math.PI / 4]} scale={0.62} renderOrder={56} />
            </group>
          )}
          <group ref={coreRef} position={[0, 0.9, 0]}>
            <mesh geometry={geometries.core} material={materials.core} renderOrder={56} />
            <mesh geometry={geometries.thinRing} material={materials.bright} scale={0.92} renderOrder={55} />
          </group>
          {Array.from({ length: markerCount }, (_, index) => {
            const angle = index / markerCount * TAU
            const markerRadius = radius * (0.56 + (index % 3) * 0.13)
            return (
              <group
                key={index}
                position={[Math.cos(angle) * markerRadius, 0, Math.sin(angle) * markerRadius]}
                rotation={[0, -angle, 0]}
              >
                {secret ? (
                  <mesh geometry={geometries.marker} material={materials.wave} position={[0, 0.42 + (index % 2) * 0.35, 0]} renderOrder={53} />
                ) : bastion ? (
                  <>
                    <mesh geometry={geometries.hex} material={index % 2 === 0 ? materials.bright : materials.wave} position={[0, 0.74 + (index % 3) * 0.24, 0]} scale={1.25 + (index % 2) * 0.3} renderOrder={54} />
                    <mesh geometry={geometries.pillar} material={materials.wave} position={[0, 0.42, 0]} scale={[1.2, 0.82, 1.2]} renderOrder={53} />
                  </>
                ) : (
                  <mesh
                    geometry={geometries.pillar}
                    material={index % 2 === 0 ? materials.bright : materials.wave}
                    position={[0, 0.72 + (index % 3) * 0.22, 0]}
                    scale={[1, 1.15 + (index % 3) * 0.35, 1]}
                    renderOrder={53}
                  />
                )}
              </group>
            )
          })}
          {tuning.sparkles > 0 ? (
            <Sparkles
              count={tuning.sparkles * 2}
              color={color}
              opacity={secret ? 0.36 : 0.62}
              scale={[radius * 1.45, 2.4, radius * 1.45]}
              size={secret ? 3.2 : 2.4}
              speed={reducedMotion ? 0 : secret ? 0.24 : 0.48}
            />
          ) : null}
        </>
      )}
      {tuning.lights ? (
        <pointLight ref={lightRef} position={[0, 1.1, 0]} color={color} intensity={0} distance={Math.min(radius * 1.4, 24)} decay={2} />
      ) : null}
    </group>
  )
}
