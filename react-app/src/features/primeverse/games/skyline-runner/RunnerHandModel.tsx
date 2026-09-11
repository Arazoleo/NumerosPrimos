import type { ThreeElements } from '@react-three/fiber'
import {
  forwardRef,
  useEffect,
  useMemo,
  type Ref,
} from 'react'
import * as THREE from 'three'

import type { SkylinePrimeCoreValue } from './missionData'

export type RunnerHandSide = 'left' | 'right'
export type RunnerHandDetail = 'low' | 'high'
export type RunnerFingerCurl = number | readonly [number, number, number, number]

export interface RunnerHandModelProps extends Omit<ThreeElements['group'], 'children' | 'ref'> {
  /** Mirrors the anatomy. In first person, both thumbs point toward the centre. */
  readonly side: RunnerHandSide
  readonly skinColor?: THREE.ColorRepresentation
  readonly gloveColor?: THREE.ColorRepresentation
  readonly sleeveColor?: THREE.ColorRepresentation
  readonly nailColor?: THREE.ColorRepresentation
  /** Prime displayed by the procedural palm sigil. */
  readonly runePrime?: SkylinePrimeCoreValue
  readonly runeColor?: THREE.ColorRepresentation
  readonly runeUnlocked?: boolean
  readonly showRune?: boolean
  /** Curl for all four fingers, or index/middle/ring/little values. Values are clamped to 0–1. */
  readonly fingerCurl?: RunnerFingerCurl
  /** Independent thumb curl, clamped to 0–1. */
  readonly thumbCurl?: number
  /** Natural finger fan from closed (0) to fully spread (1). */
  readonly spread?: number
  /** Opens the fingers and enlarges the sigil during a cast, clamped to 0–1. */
  readonly castStrength?: number
  /** Controlled sigil rotation in radians. For frame animation, prefer `sigilRef`. */
  readonly runeRotation?: number
  /** Two phalanges in low detail, three in high detail. */
  readonly detail?: RunnerHandDetail
  /** Base render order for the viewmodel. */
  readonly renderOrder?: number
  /** Optional imperative access to the sigil without re-rendering the hand. */
  readonly sigilRef?: Ref<THREE.Group>
}

interface HandGeometries {
  readonly capsule: THREE.CapsuleGeometry
  readonly nail: THREE.SphereGeometry
  readonly sleeve: THREE.CylinderGeometry
  readonly cuff: THREE.CylinderGeometry
}

interface HandMaterials {
  readonly skin: THREE.MeshStandardMaterial
  readonly glove: THREE.MeshStandardMaterial
  readonly sleeve: THREE.MeshStandardMaterial
  readonly nail: THREE.MeshStandardMaterial
}

interface FingerDefinition {
  readonly x: number
  readonly lengthScale: number
  readonly radiusScale: number
}

const FINGER_DEFINITIONS: readonly FingerDefinition[] = [
  { x: -0.083, lengthScale: 0.96, radiusScale: 0.95 },
  { x: -0.029, lengthScale: 1.08, radiusScale: 1 },
  { x: 0.03, lengthScale: 1.02, radiusScale: 0.97 },
  { x: 0.084, lengthScale: 0.82, radiusScale: 0.82 },
] as const

const DEFAULT_RUNE_COLORS: Readonly<Record<SkylinePrimeCoreValue, THREE.ColorRepresentation>> = {
  2: '#56f5ff',
  3: '#b78cff',
  5: '#ffc85a',
}

function normalizedPose(value: number, fallback = 0): number {
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : fallback, 0, 1)
}

function fingerCurlAt(curl: RunnerFingerCurl, index: number): number {
  return normalizedPose(typeof curl === 'number' ? curl : curl[index] ?? 0)
}

function emissiveShade(color: THREE.ColorRepresentation, intensity: number): THREE.Color {
  return new THREE.Color(color).multiplyScalar(intensity)
}

function useHandGeometries(): HandGeometries {
  const geometries = useMemo<HandGeometries>(() => ({
    capsule: new THREE.CapsuleGeometry(0.5, 1, 5, 9),
    nail: new THREE.SphereGeometry(0.5, 8, 5),
    sleeve: new THREE.CylinderGeometry(0.46, 0.58, 1, 10, 1, false),
    cuff: new THREE.CylinderGeometry(0.53, 0.53, 1, 10, 1, false),
  }), [])

  useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry.dispose())
  }, [geometries])

  return geometries
}

function useHandMaterials({
  skinColor,
  gloveColor,
  sleeveColor,
  nailColor,
}: {
  skinColor: THREE.ColorRepresentation
  gloveColor: THREE.ColorRepresentation
  sleeveColor: THREE.ColorRepresentation
  nailColor: THREE.ColorRepresentation
}): HandMaterials {
  const materials = useMemo<HandMaterials>(() => ({
    skin: new THREE.MeshStandardMaterial({
      color: skinColor,
      depthTest: true,
      depthWrite: true,
      emissive: emissiveShade(skinColor, 0.065),
      metalness: 0.02,
      roughness: 0.76,
      toneMapped: false,
    }),
    glove: new THREE.MeshStandardMaterial({
      color: gloveColor,
      depthTest: true,
      depthWrite: true,
      emissive: emissiveShade(gloveColor, 0.12),
      metalness: 0.2,
      roughness: 0.67,
      toneMapped: false,
    }),
    sleeve: new THREE.MeshStandardMaterial({
      color: sleeveColor,
      depthTest: true,
      depthWrite: true,
      emissive: emissiveShade(sleeveColor, 0.08),
      metalness: 0.12,
      roughness: 0.82,
      toneMapped: false,
    }),
    nail: new THREE.MeshStandardMaterial({
      color: nailColor,
      depthTest: true,
      depthWrite: true,
      emissive: emissiveShade(nailColor, 0.055),
      metalness: 0,
      roughness: 0.48,
      toneMapped: false,
    }),
  }), [gloveColor, nailColor, skinColor, sleeveColor])

  useEffect(() => () => {
    Object.values(materials).forEach((material) => material.dispose())
  }, [materials])

  return materials
}

function Phalanx({
  geometry,
  material,
  length,
  radius,
  depth,
  renderOrder,
}: {
  geometry: THREE.CapsuleGeometry
  material: THREE.Material
  length: number
  radius: number
  depth: number
  renderOrder: number
}): JSX.Element {
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, length / 2, 0]}
      scale={[radius * 2, length / 2, depth * 2]}
      renderOrder={renderOrder}
      frustumCulled={false}
    />
  )
}

function Nail({
  geometry,
  material,
  length,
  radius,
  renderOrder,
}: {
  geometry: THREE.SphereGeometry
  material: THREE.Material
  length: number
  radius: number
  renderOrder: number
}): JSX.Element {
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[0, length * 0.54, radius * 0.79]}
      scale={[radius * 1.08, length * 0.27, 0.008]}
      renderOrder={renderOrder}
      frustumCulled={false}
    />
  )
}

function Finger({
  definition,
  index,
  mirror,
  curl,
  spread,
  detail,
  geometries,
  materials,
  renderOrder,
}: {
  definition: FingerDefinition
  index: number
  mirror: number
  curl: number
  spread: number
  detail: RunnerHandDetail
  geometries: HandGeometries
  materials: HandMaterials
  renderOrder: number
}): JSX.Element {
  const radius = 0.025 * definition.radiusScale
  const depth = radius * 0.74
  const proximalLength = 0.112 * definition.lengthScale
  const middleLength = 0.084 * definition.lengthScale
  const distalLength = 0.061 * definition.lengthScale
  const mirroredX = definition.x * mirror
  const fan = -Math.sign(mirroredX) * Math.abs(definition.x / 0.084) * spread * 0.17
  const baseBend = -0.05 - curl * 0.58
  const middleBend = -curl * 0.86
  const distalBend = -curl * 0.72

  return (
    <group
      name={`finger-${index}`}
      position={[mirroredX, 0.125, -0.003]}
      rotation={[baseBend, 0, fan]}
    >
      <Phalanx
        geometry={geometries.capsule}
        material={materials.glove}
        length={proximalLength}
        radius={radius}
        depth={depth}
        renderOrder={renderOrder}
      />
      <group position={[0, proximalLength * 0.86, 0]} rotation={[middleBend, 0, 0]}>
        <Phalanx
          geometry={geometries.capsule}
          material={materials.skin}
          length={middleLength}
          radius={radius * 0.96}
          depth={depth * 0.96}
          renderOrder={renderOrder + 1}
        />
        {detail === 'high' ? (
          <group position={[0, middleLength * 0.85, 0]} rotation={[distalBend, 0, 0]}>
            <Phalanx
              geometry={geometries.capsule}
              material={materials.skin}
              length={distalLength}
              radius={radius * 0.88}
              depth={depth * 0.88}
              renderOrder={renderOrder + 1}
            />
            <Nail
              geometry={geometries.nail}
              material={materials.nail}
              length={distalLength}
              radius={radius * 0.88}
              renderOrder={renderOrder + 2}
            />
          </group>
        ) : null}
      </group>
    </group>
  )
}

function Thumb({
  side,
  curl,
  detail,
  geometries,
  materials,
  renderOrder,
}: {
  side: RunnerHandSide
  curl: number
  detail: RunnerHandDetail
  geometries: HandGeometries
  materials: HandMaterials
  renderOrder: number
}): JSX.Element {
  const thumbSide = side === 'left' ? 1 : -1
  const proximalLength = 0.105
  const distalLength = 0.076
  const radius = 0.034

  return (
    <group
      name="thumb"
      position={[thumbSide * 0.132, -0.025, 0.002]}
      rotation={[-0.12 - curl * 0.32, 0, -thumbSide * (0.94 - curl * 0.12)]}
    >
      <Phalanx
        geometry={geometries.capsule}
        material={materials.glove}
        length={proximalLength}
        radius={radius}
        depth={radius * 0.72}
        renderOrder={renderOrder}
      />
      <group position={[0, proximalLength * 0.82, 0]} rotation={[-curl * 0.74, 0, thumbSide * 0.08]}>
        <Phalanx
          geometry={geometries.capsule}
          material={materials.skin}
          length={distalLength}
          radius={radius * 0.86}
          depth={radius * 0.64}
          renderOrder={renderOrder + 1}
        />
        {detail === 'high' ? (
          <Nail
            geometry={geometries.nail}
            material={materials.nail}
            length={distalLength}
            radius={radius * 0.86}
            renderOrder={renderOrder + 2}
          />
        ) : null}
      </group>
    </group>
  )
}

function PrimeHandSigil({
  prime,
  color,
  unlocked,
  detail,
  rotation,
  castStrength,
  renderOrder,
  sigilRef,
}: {
  prime: SkylinePrimeCoreValue
  color: THREE.ColorRepresentation
  unlocked: boolean
  detail: RunnerHandDetail
  rotation: number
  castStrength: number
  renderOrder: number
  sigilRef?: Ref<THREE.Group>
}): JSX.Element {
  const polygonSides = prime === 2 ? 4 : prime
  const geometries = useMemo(() => ({
    outerRing: new THREE.RingGeometry(0.1, 0.112, 32),
    primeRing: new THREE.RingGeometry(0.047, 0.059, polygonSides),
    mote: new THREE.CircleGeometry(0.012, 8),
  }), [polygonSides])
  const materials = useMemo(() => ({
    color: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: unlocked ? color : '#53656a',
      depthTest: false,
      depthWrite: false,
      opacity: unlocked ? 0.9 : 0.2,
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true,
    }),
    core: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: unlocked ? '#efffff' : '#53656a',
      depthTest: false,
      depthWrite: false,
      opacity: unlocked ? 0.96 : 0.18,
      side: THREE.DoubleSide,
      toneMapped: false,
      transparent: true,
    }),
  }), [color, unlocked])

  useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry.dispose())
  }, [geometries])

  useEffect(() => () => {
    Object.values(materials).forEach((material) => material.dispose())
  }, [materials])

  return (
    <group
      ref={sigilRef}
      name={`prime-${prime}-sigil`}
      position={[0, 0.015, 0.071]}
      rotation={[0, 0, rotation]}
      scale={0.82 + castStrength * 0.58}
      frustumCulled={false}
      userData={{ kind: 'prime-hand-sigil', prime, unlocked }}
    >
      <mesh geometry={geometries.outerRing} material={materials.color} renderOrder={renderOrder} frustumCulled={false} />
      <mesh
        geometry={geometries.primeRing}
        material={materials.core}
        rotation={[0, 0, prime === 2 ? Math.PI / 4 : -Math.PI / 2]}
        renderOrder={renderOrder + 1}
        frustumCulled={false}
      />
      {detail === 'high' && Array.from({ length: prime }, (_, index) => {
        const angle = index / prime * Math.PI * 2 - Math.PI / 2
        return (
          <mesh
            key={index}
            geometry={geometries.mote}
            material={materials.color}
            position={[Math.cos(angle) * 0.139, Math.sin(angle) * 0.139, 0.004]}
            scale={prime === 5 ? 0.78 : 1}
            renderOrder={renderOrder + 2}
            frustumCulled={false}
          />
        )
      })}
    </group>
  )
}

/**
 * Procedural first-person hand for Skyline Runner.
 *
 * Attach the forwarded ref to the camera viewmodel rig and mutate that group from
 * `useFrame` for recoil/sway. Continuous finger poses can be driven declaratively
 * with `fingerCurl`, `thumbCurl`, `spread` and `castStrength`; `sigilRef` exists for
 * inexpensive per-frame rune rotation. The parent viewmodel clears world depth once
 * before drawing both hands, while these meshes keep depth enabled for correct
 * finger-to-palm occlusion. Geometry and materials are shared by all phalanges
 * inside one hand and explicitly disposed when the hand unmounts.
 */
export const RunnerHandModel = forwardRef<THREE.Group, RunnerHandModelProps>(function RunnerHandModel({
  side,
  skinColor = '#d9a17c',
  gloveColor = '#294b58',
  sleeveColor = '#18313c',
  nailColor = '#efc9ae',
  runePrime = 2,
  runeColor = DEFAULT_RUNE_COLORS[runePrime],
  runeUnlocked = false,
  showRune = true,
  fingerCurl = 0.16,
  thumbCurl = 0.12,
  spread = 0.32,
  castStrength = 0,
  runeRotation = 0,
  detail = 'high',
  renderOrder = 1000,
  sigilRef,
  ...groupProps
}, ref): JSX.Element {
  const geometries = useHandGeometries()
  const materials = useHandMaterials({ skinColor, gloveColor, sleeveColor, nailColor })
  const mirror = side === 'left' ? -1 : 1
  const resolvedCast = normalizedPose(castStrength)
  const resolvedSpread = normalizedPose(spread)
  const resolvedThumbCurl = normalizedPose(thumbCurl) * (1 - resolvedCast * 0.72)

  return (
    <group
      {...groupProps}
      ref={ref}
      name={groupProps.name ?? `runner-${side}-hand`}
      dispose={null}
      frustumCulled={false}
      userData={{ kind: 'runner-hand', side, ...groupProps.userData }}
    >
      <mesh
        name="sleeve"
        geometry={geometries.sleeve}
        material={materials.sleeve}
        position={[0, -0.285, -0.012]}
        scale={[0.24, 0.25, 0.2]}
        renderOrder={renderOrder}
        frustumCulled={false}
      />
      <mesh
        name="cuff"
        geometry={geometries.cuff}
        material={materials.glove}
        position={[0, -0.151, -0.004]}
        scale={[0.235, 0.055, 0.18]}
        renderOrder={renderOrder + 1}
        frustumCulled={false}
      />
      <mesh
        name="wrist"
        geometry={geometries.capsule}
        material={materials.skin}
        position={[0, -0.12, 0]}
        scale={[0.15, 0.08, 0.105]}
        renderOrder={renderOrder + 1}
        frustumCulled={false}
      />
      <mesh
        name="palm"
        geometry={geometries.capsule}
        material={materials.skin}
        scale={[0.25, 0.14, 0.12]}
        renderOrder={renderOrder + 2}
        frustumCulled={false}
      />
      <mesh
        name="glove-plate"
        geometry={geometries.capsule}
        material={materials.glove}
        position={[0, -0.037, 0.061]}
        scale={[0.218, 0.084, 0.025]}
        renderOrder={renderOrder + 3}
        frustumCulled={false}
      />

      {FINGER_DEFINITIONS.map((definition, index) => {
        const relaxedCurl = fingerCurlAt(fingerCurl, index)
        const curl = relaxedCurl * (1 - resolvedCast * 0.9)
        return (
          <Finger
            key={index}
            definition={definition}
            index={index}
            mirror={mirror}
            curl={curl}
            spread={resolvedSpread + resolvedCast * (1 - resolvedSpread) * 0.65}
            detail={detail}
            geometries={geometries}
            materials={materials}
            renderOrder={renderOrder + 4}
          />
        )
      })}

      <Thumb
        side={side}
        curl={resolvedThumbCurl}
        detail={detail}
        geometries={geometries}
        materials={materials}
        renderOrder={renderOrder + 4}
      />

      {showRune ? (
        <PrimeHandSigil
          prime={runePrime}
          color={runeColor}
          unlocked={runeUnlocked}
          detail={detail}
          rotation={runeRotation * mirror}
          castStrength={resolvedCast}
          renderOrder={renderOrder + 10}
          sigilRef={sigilRef}
        />
      ) : null}
    </group>
  )
})

RunnerHandModel.displayName = 'RunnerHandModel'

export default RunnerHandModel
