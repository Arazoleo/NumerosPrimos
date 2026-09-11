import { useFrame, useThree } from '@react-three/fiber'
import {
  useEffect,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'

import { getHeroKit } from '../classKits'
import type { AbilitySlot, HeroId } from '../types'
interface HeroViewmodelStyle {
  readonly armor: string
  readonly armorDark: string
  readonly skin: string
  readonly secondary: string
  readonly bulk: number
  readonly tempo: number
}

import {
  CIPHER_TEAM_COLOR,
  TAU,
  assertNever,
  clamp01,
  disposeRecord,
  finite,
  powerEffectPalette,
  pulseEnvelope,
  type FirstPersonHandsProps,
} from './effectCore'

const HERO_VIEWMODEL_STYLE: Readonly<Record<HeroId, HeroViewmodelStyle>> = {
  'luma-crivo': { armor: '#173f3e', armorDark: '#0a2024', skin: '#a96f58', secondary: '#fff18d', bulk: 0.92, tempo: 1 },
  'raul-rsa': { armor: '#403b35', armorDark: '#211d1b', skin: '#9c6249', secondary: '#66dfff', bulk: 1.16, tempo: 0.86 },
  'teo-gemeos': { armor: '#452044', armorDark: '#220f29', skin: '#bd8060', secondary: '#65eaff', bulk: 0.9, tempo: 1.18 },
  'yara-diffie': { armor: '#262042', armorDark: '#100e23', skin: '#68453d', secondary: '#ff5ebf', bulk: 0.86, tempo: 1.08 },
  'iris-mersenne': { armor: '#14372a', armorDark: '#081b16', skin: '#8a5a44', secondary: '#7dff8f', bulk: 0.88, tempo: 1.12 },
}

interface HandAssets {
  readonly geometries: {
    readonly capsule: THREE.CapsuleGeometry
    readonly forearm: THREE.CylinderGeometry
    readonly plate: THREE.BoxGeometry
    readonly ring: THREE.TorusGeometry
    readonly hex: THREE.CircleGeometry
    readonly shard: THREE.OctahedronGeometry
    readonly sphere: THREE.SphereGeometry
    readonly viewPlane: THREE.PlaneGeometry
  }
  readonly materials: {
    readonly armor: THREE.MeshStandardMaterial
    readonly armorDark: THREE.MeshStandardMaterial
    readonly skin: THREE.MeshStandardMaterial
    readonly accent: THREE.MeshStandardMaterial
    readonly glow: THREE.MeshBasicMaterial
    readonly secondary: THREE.MeshBasicMaterial
    readonly cast: THREE.MeshBasicMaterial
    readonly castSecondary: THREE.MeshBasicMaterial
    readonly viewMask: THREE.MeshBasicMaterial
  }
}

function useHandAssets(heroId: HeroId, accent: string): HandAssets {
  const style = HERO_VIEWMODEL_STYLE[heroId]
  const geometries = useMemo(() => ({
    capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 8),
    forearm: new THREE.CylinderGeometry(0.48, 0.62, 1, 10, 1, false),
    plate: new THREE.BoxGeometry(1, 1, 1),
    ring: new THREE.TorusGeometry(1, 0.09, 5, 24),
    hex: new THREE.CircleGeometry(1, 6),
    shard: new THREE.OctahedronGeometry(1, 0),
    sphere: new THREE.SphereGeometry(1, 10, 7),
    viewPlane: new THREE.PlaneGeometry(0.001, 0.001),
  }), [])

  const materials = useMemo(() => ({
    armor: new THREE.MeshStandardMaterial({
      color: style.armor,
      emissive: new THREE.Color(style.armor).multiplyScalar(0.18),
      emissiveIntensity: 1,
      metalness: 0.55,
      roughness: 0.36,
    }),
    armorDark: new THREE.MeshStandardMaterial({
      color: style.armorDark,
      emissive: new THREE.Color(style.armorDark).multiplyScalar(0.12),
      metalness: 0.68,
      roughness: 0.31,
    }),
    skin: new THREE.MeshStandardMaterial({
      color: style.skin,
      emissive: new THREE.Color(style.skin).multiplyScalar(0.035),
      metalness: 0.01,
      roughness: 0.73,
    }),
    accent: new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.25,
      metalness: 0.28,
      roughness: 0.24,
      toneMapped: false,
    }),
    glow: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: accent,
      depthWrite: false,
      opacity: 0.78,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    secondary: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: style.secondary,
      depthWrite: false,
      opacity: 0.82,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    cast: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: accent,
      depthTest: false,
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    castSecondary: new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: style.secondary,
      depthTest: false,
      depthWrite: false,
      opacity: 0,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    }),
    viewMask: new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthTest: false,
      depthWrite: false,
    }),
  }), [accent, style.armor, style.armorDark, style.secondary, style.skin])

  useEffect(() => () => {
    disposeRecord(geometries)
    disposeRecord(materials)
  }, [geometries, materials])

  return { geometries, materials }
}

function HeroGauntletMark({
  heroId,
  side,
  assets,
  renderOrder,
}: {
  readonly heroId: HeroId
  readonly side: -1 | 1
  readonly assets: HandAssets
  readonly renderOrder: number
}): JSX.Element {
  const { geometries, materials } = assets

  switch (heroId) {
    case 'luma-crivo':
      return (
        <group position={[0, -0.005, 0.102]}>
          <mesh geometry={geometries.ring} material={materials.glow} scale={0.075} renderOrder={renderOrder} />
          {[2, 3, 5, 7].map((prime, index) => {
            const angle = index / 4 * TAU + side * 0.25
            return (
              <mesh
                key={prime}
                geometry={geometries.sphere}
                material={materials.accent}
                position={[Math.cos(angle) * 0.085, Math.sin(angle) * 0.085, 0.007]}
                scale={0.012 + prime * 0.001}
                renderOrder={renderOrder + 1}
              />
            )
          })}
        </group>
      )
    case 'raul-rsa':
      return (
        <group position={[0, -0.015, 0.103]}>
          <mesh geometry={geometries.hex} material={materials.accent} scale={0.092} renderOrder={renderOrder} />
          <mesh geometry={geometries.ring} material={materials.glow} scale={0.057} rotation={[0, 0, side * Math.PI / 6]} renderOrder={renderOrder + 1} />
          <mesh geometry={geometries.plate} material={materials.armorDark} position={[-0.03, 0, 0.009]} scale={[0.012, 0.065, 0.01]} renderOrder={renderOrder + 2} />
          <mesh geometry={geometries.plate} material={materials.armorDark} position={[0.03, 0, 0.009]} scale={[0.012, 0.065, 0.01]} renderOrder={renderOrder + 2} />
        </group>
      )
    case 'teo-gemeos':
      return (
        <group position={[0, -0.005, 0.105]}>
          {[-1, 1].map((pairSide) => (
            <group key={pairSide} position={[pairSide * 0.052, 0, 0]}>
              <mesh geometry={geometries.ring} material={pairSide === side ? materials.secondary : materials.glow} scale={0.038} renderOrder={renderOrder} />
              <mesh geometry={geometries.sphere} material={pairSide === side ? materials.secondary : materials.accent} scale={0.021} renderOrder={renderOrder + 1} />
            </group>
          ))}
        </group>
      )
    case 'yara-diffie':
      return (
        <group position={[0, -0.002, 0.107]} rotation={[0, 0, side * 0.18]}>
          <mesh geometry={geometries.shard} material={materials.accent} scale={[0.034, 0.075, 0.012]} renderOrder={renderOrder} />
          <mesh geometry={geometries.ring} material={materials.glow} position={[0, -0.09, 0]} scale={[0.047, 0.047, 0.03]} renderOrder={renderOrder + 1} />
        </group>
      )
    case 'iris-mersenne':
      // Three stacked slivers: 2^p − 1 counted on the knuckles.
      return (
        <group position={[0, 0.004, 0.104]} rotation={[0, 0, side * -0.12]}>
          {[0, 1, 2].map((index) => (
            <mesh
              key={index}
              geometry={geometries.shard}
              material={index === 1 ? materials.glow : materials.accent}
              position={[side * (index - 1) * 0.026, 0, 0]}
              scale={[0.017, 0.058 - index * 0.008, 0.011]}
              renderOrder={renderOrder + index}
            />
          ))}
        </group>
      )
    default:
      return assertNever(heroId)
  }
}

function HeroArmArchitecture({
  heroId,
  side,
  assets,
  renderOrder,
}: {
  readonly heroId: HeroId
  readonly side: -1 | 1
  readonly assets: HandAssets
  readonly renderOrder: number
}): JSX.Element {
  const { geometries, materials } = assets

  switch (heroId) {
    case 'luma-crivo':
      return (
        <group>
          {[-1, 1].map((rail) => (
            <mesh
              key={rail}
              geometry={geometries.plate}
              material={rail === side ? materials.secondary : materials.glow}
              position={[rail * 0.085, -0.27, 0.095]}
              scale={[0.018, 0.29, 0.014]}
              renderOrder={renderOrder}
            />
          ))}
          {[0, 1, 2].map((index) => (
            <mesh
              key={index}
              geometry={geometries.ring}
              material={index === 1 ? materials.secondary : materials.glow}
              position={[0, -0.34 + index * 0.13, 0.108]}
              rotation={[0, 0, Math.PI / 4 + index * 0.13]}
              scale={0.055 - index * 0.006}
              renderOrder={renderOrder + 1}
            />
          ))}
        </group>
      )
    case 'raul-rsa':
      return (
        <group>
          {[-1, 0, 1].map((column) => (
            <group key={column} position={[column * 0.095, 0.015 - Math.abs(column) * 0.012, 0.112]}>
              <mesh geometry={geometries.hex} material={materials.accent} scale={[0.048, 0.058, 1]} renderOrder={renderOrder + 1} />
              <mesh geometry={geometries.hex} material={materials.armorDark} position={[0, 0, -0.006]} scale={[0.034, 0.042, 1]} renderOrder={renderOrder + 2} />
            </group>
          ))}
          {[-1, 1].map((plateSide) => (
            <mesh
              key={plateSide}
              geometry={geometries.plate}
              material={plateSide === side ? materials.secondary : materials.armor}
              position={[plateSide * 0.15, -0.25, 0.035]}
              rotation={[0, 0, plateSide * 0.16]}
              scale={[0.075, 0.24, 0.085]}
              renderOrder={renderOrder}
            />
          ))}
        </group>
      )
    case 'teo-gemeos':
      return (
        <group>
          {[-1, 1].map((pairSide) => (
            <group key={pairSide} position={[pairSide * 0.09, -0.24, 0.105]}>
              <mesh geometry={geometries.plate} material={pairSide === side ? materials.secondary : materials.glow} scale={[0.018, 0.29, 0.012]} renderOrder={renderOrder} />
              <mesh geometry={geometries.ring} material={pairSide === side ? materials.secondary : materials.glow} position={[0, 0.14, 0.006]} scale={0.045} renderOrder={renderOrder + 1} />
            </group>
          ))}
          <mesh geometry={geometries.plate} material={materials.armorDark} position={[0, -0.08, 0.095]} rotation={[0, 0, side * 0.08]} scale={[0.18, 0.025, 0.018]} renderOrder={renderOrder + 1} />
        </group>
      )
    case 'yara-diffie':
      return (
        <group>
          {[0, 1, 2, 3].map((index) => (
            <mesh
              key={index}
              geometry={geometries.shard}
              material={index % 2 === 0 ? materials.glow : materials.secondary}
              position={[(index % 2 === 0 ? -1 : 1) * (0.055 + index * 0.01), -0.35 + index * 0.105, 0.1 + (index % 2) * 0.012]}
              rotation={[0, 0, side * (0.35 + index * 0.22)]}
              scale={[0.027 + index * 0.004, 0.07, 0.012]}
              renderOrder={renderOrder + index}
            />
          ))}
          <mesh geometry={geometries.plate} material={materials.secondary} position={[side * 0.115, -0.2, 0.11]} scale={[0.055, 0.012, 0.012]} renderOrder={renderOrder + 4} />
        </group>
      )
    case 'iris-mersenne':
      // A long, spare rail down the forearm: a sniper's brace.
      return (
        <group>
          <mesh
            geometry={geometries.plate}
            material={materials.accent}
            position={[side * 0.052, -0.24, 0.108]}
            scale={[0.014, 0.34, 0.014]}
            renderOrder={renderOrder}
          />
          {[0, 1, 2].map((index) => (
            <mesh
              key={index}
              geometry={geometries.ring}
              material={index === 1 ? materials.glow : materials.secondary}
              position={[side * 0.052, -0.36 + index * 0.12, 0.108]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[0.03, 0.03, 0.028]}
              renderOrder={renderOrder + index + 1}
            />
          ))}
        </group>
      )
    default:
      return assertNever(heroId)
  }
}

function HeroArm({
  heroId,
  side,
  assets,
}: {
  readonly heroId: HeroId
  readonly side: 'left' | 'right'
  readonly assets: HandAssets
}): JSX.Element {
  const mirror: -1 | 1 = side === 'left' ? -1 : 1
  const style = HERO_VIEWMODEL_STYLE[heroId]
  const { geometries, materials } = assets
  const baseOrder = 1002
  const fingerXs = [-0.09, -0.03, 0.03, 0.09] as const

  return (
    <group name={`${heroId}-${side}-arm`} scale={[style.bulk, 1, style.bulk]} dispose={null} frustumCulled={false}>
      <mesh
        geometry={geometries.forearm}
        material={materials.armorDark}
        position={[0, -0.31, 0.015]}
        scale={[0.36, 0.36, 0.31]}
        renderOrder={baseOrder}
        frustumCulled={false}
      />
      <mesh
        geometry={geometries.forearm}
        material={materials.armor}
        position={[0, -0.165, 0.006]}
        scale={[0.32, 0.09, 0.28]}
        renderOrder={baseOrder + 1}
        frustumCulled={false}
      />
      <mesh
        geometry={geometries.capsule}
        material={materials.skin}
        position={[0, -0.095, 0]}
        scale={[0.145, 0.085, 0.105]}
        renderOrder={baseOrder + 1}
        frustumCulled={false}
      />
      <mesh
        geometry={geometries.capsule}
        material={materials.armor}
        position={[0, 0.01, 0]}
        scale={[0.25, 0.14, 0.115]}
        renderOrder={baseOrder + 2}
        frustumCulled={false}
      />
      <mesh
        geometry={geometries.plate}
        material={materials.armorDark}
        position={[0, -0.008, 0.082]}
        scale={[0.205, 0.118, 0.026]}
        rotation={[0, 0, mirror * 0.025]}
        renderOrder={baseOrder + 3}
        frustumCulled={false}
      />
      {fingerXs.map((x, index) => {
        const length = index === 0 || index === 3 ? 0.105 : 0.12
        const mirroredX = x * mirror
        return (
          <group
            key={index}
            position={[mirroredX, 0.115, -0.004]}
            rotation={[-0.16 - (index === 3 ? 0.09 : 0), 0, -Math.sign(mirroredX) * 0.035]}
          >
            <mesh
              geometry={geometries.capsule}
              material={materials.armor}
              position={[0, length * 0.48, 0]}
              scale={[0.043, length * 0.5, 0.034]}
              renderOrder={baseOrder + 4}
              frustumCulled={false}
            />
            <mesh
              geometry={geometries.capsule}
              material={materials.skin}
              position={[0, length * 1.18, -0.008]}
              rotation={[-0.2, 0, 0]}
              scale={[0.039, length * 0.36, 0.031]}
              renderOrder={baseOrder + 5}
              frustumCulled={false}
            />
          </group>
        )
      })}
      <group position={[mirror * 0.142, -0.005, 0]} rotation={[-0.2, 0, -mirror * 0.82]}>
        <mesh
          geometry={geometries.capsule}
          material={materials.skin}
          position={[0, 0.06, 0]}
          scale={[0.05, 0.065, 0.038]}
          renderOrder={baseOrder + 5}
          frustumCulled={false}
        />
      </group>
      <HeroGauntletMark heroId={heroId} side={mirror} assets={assets} renderOrder={baseOrder + 7} />
      <HeroArmArchitecture heroId={heroId} side={mirror} assets={assets} renderOrder={baseOrder + 8} />
    </group>
  )
}

function CastFocus({
  heroId,
  assets,
}: {
  readonly heroId: HeroId
  readonly assets: HandAssets
}): JSX.Element {
  const { geometries, materials } = assets

  return (
    <group dispose={null}>
      {heroId === 'teo-gemeos' ? (
        <>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.105, 0, 0]}>
              <mesh geometry={geometries.sphere} material={side === 1 ? materials.castSecondary : materials.cast} scale={0.055} renderOrder={1022} />
              <mesh geometry={geometries.ring} material={side === 1 ? materials.castSecondary : materials.cast} scale={0.078} renderOrder={1021} />
              <mesh geometry={geometries.ring} material={side === 1 ? materials.cast : materials.castSecondary} scale={0.11} rotation={[0, 0, side * 0.34]} renderOrder={1020} />
            </group>
          ))}
          <mesh geometry={geometries.plate} material={materials.castSecondary} scale={[0.22, 0.012, 0.012]} renderOrder={1020} />
        </>
      ) : heroId === 'raul-rsa' ? (
        <>
          <mesh geometry={geometries.hex} material={materials.cast} scale={0.17} renderOrder={1022} />
          <mesh geometry={geometries.hex} material={materials.castSecondary} scale={0.245} rotation={[0, 0, Math.PI / 6]} renderOrder={1021} />
          {Array.from({ length: 6 }, (_, index) => {
            const angle = index / 6 * TAU
            return (
              <mesh
                key={index}
                geometry={geometries.hex}
                material={index % 2 === 0 ? materials.cast : materials.castSecondary}
                position={[Math.cos(angle) * 0.25, Math.sin(angle) * 0.25, -0.01]}
                rotation={[0, 0, angle]}
                scale={0.055}
                renderOrder={1020}
              />
            )
          })}
        </>
      ) : heroId === 'yara-diffie' ? (
        <>
          <mesh geometry={geometries.shard} material={materials.cast} scale={[0.08, 0.15, 0.045]} renderOrder={1022} />
          <mesh geometry={geometries.ring} material={materials.castSecondary} scale={0.16} rotation={[0, Math.PI / 2, 0]} renderOrder={1021} />
          {[-2, -1, 0, 1, 2].map((slice) => (
            <mesh
              key={slice}
              geometry={geometries.plate}
              material={slice % 2 === 0 ? materials.cast : materials.castSecondary}
              position={[slice * 0.075, slice * -0.025, -Math.abs(slice) * 0.015]}
              rotation={[0, 0, slice * 0.24]}
              scale={[0.06 + Math.abs(slice) * 0.018, 0.009, 0.012]}
              renderOrder={1020 + Math.abs(slice)}
            />
          ))}
        </>
      ) : (
        <>
          <mesh geometry={geometries.sphere} material={materials.cast} scale={0.075} renderOrder={1022} />
          {[0.12, 0.17, 0.22].map((scale, index) => (
            <mesh key={scale} geometry={geometries.ring} material={index === 1 ? materials.castSecondary : materials.cast} scale={scale} rotation={[0, 0, Math.PI / 4 + index * 0.32]} renderOrder={1021} />
          ))}
          {[2, 3, 5, 7].map((prime, index) => {
            const angle = index / 4 * TAU
            return <mesh key={prime} geometry={geometries.sphere} material={materials.castSecondary} position={[Math.cos(angle) * 0.27, Math.sin(angle) * 0.27, 0]} scale={0.012 + prime * 0.002} renderOrder={1023} />
          })}
        </>
      )}
    </group>
  )
}

function clearViewmodelDepth(renderer: THREE.WebGLRenderer): void {
  renderer.clearDepth()
}

/** Procedural first-person arms. All continuous animation is imperative. */
export function FirstPersonHands({
  heroId,
  movementSpeed,
  reducedMotion,
  castSignal,
}: FirstPersonHandsProps): JSX.Element {
  const { camera, size } = useThree()
  const kit = useMemo(() => getHeroKit(heroId), [heroId])
  const style = HERO_VIEWMODEL_STYLE[heroId]
  const assets = useHandAssets(heroId, kit.accent)
  const rootRef = useRef<THREE.Group>(null)
  const swayRef = useRef<THREE.Group>(null)
  const leftRef = useRef<THREE.Group>(null)
  const rightRef = useRef<THREE.Group>(null)
  const castFocusRef = useRef<THREE.Group>(null)
  const castLightRef = useRef<THREE.PointLight>(null)
  const stridePhaseRef = useRef(0)
  const seenSerialRef = useRef(castSignal.current.serial)
  const seenAtMsRef = useRef(castSignal.current.atMs)
  const activeSlotRef = useRef<AbilitySlot>(castSignal.current.slot)
  const castAgeRef = useRef(Number.POSITIVE_INFINITY)
  const compact = size.width < 720 || size.width / Math.max(1, size.height) < 0.86

  useFrame((_, rawDelta) => {
    const root = rootRef.current
    const sway = swayRef.current
    const left = leftRef.current
    const right = rightRef.current
    if (!root || !sway || !left || !right) return

    const signal = castSignal.current
    if (signal.serial !== seenSerialRef.current || signal.atMs !== seenAtMsRef.current) {
      seenSerialRef.current = signal.serial
      seenAtMsRef.current = signal.atMs
      activeSlotRef.current = signal.slot
      castAgeRef.current = 0
      const castPalette = powerEffectPalette(kit.abilities[signal.slot].mechanic, 'cipher')
      assets.materials.cast.color.set(castPalette.primary)
      assets.materials.castSecondary.color.set(castPalette.highlight)
      if (castLightRef.current) castLightRef.current.color.set(castPalette.highlight)
    }

    const delta = Math.min(Math.max(rawDelta, 0), 0.08)
    castAgeRef.current += delta
    const speed = THREE.MathUtils.clamp(
      Math.abs(finite(movementSpeed)) / Math.max(1, kit.stats.moveSpeed),
      0,
      1.35,
    )
    stridePhaseRef.current += delta * (5.8 + speed * 5.2)

    root.position.copy(camera.position)
    root.quaternion.copy(camera.quaternion)
    const fovCompensation = camera instanceof THREE.PerspectiveCamera
      ? Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) / Math.tan(THREE.MathUtils.degToRad(75 * 0.5))
      : 1
    root.scale.setScalar((compact ? 0.82 : 1) * fovCompensation)
    root.translateY(compact ? -0.285 : -0.31)
    root.translateZ(compact ? -0.67 : -0.59)

    const motionAmount = reducedMotion ? 0 : speed
    const stride = stridePhaseRef.current
    sway.position.set(
      Math.cos(stride * 0.5) * 0.009 * motionAmount,
      Math.abs(Math.sin(stride)) * 0.018 * motionAmount,
      0,
    )
    sway.rotation.set(
      Math.sin(stride) * 0.008 * motionAmount,
      Math.cos(stride * 0.5) * 0.012 * motionAmount,
      Math.sin(stride * 0.5) * 0.026 * motionAmount,
    )

    const durationBySlot: Readonly<Record<AbilitySlot, number>> = {
      primary: 0.28,
      signature: 0.58,
      mobility: 0.42,
      ultimate: 0.92,
    }
    const castDuration = durationBySlot[activeSlotRef.current] / style.tempo
    const castProgress = clamp01(castAgeRef.current / castDuration)
    const rawCast = castAgeRef.current <= castDuration
      ? pulseEnvelope(castProgress, activeSlotRef.current === 'ultimate' ? 0.42 : 0.24)
      : 0
    const castEnergy = rawCast * (reducedMotion ? 0.5 : 1)
    const recoil = activeSlotRef.current === 'primary'
      ? Math.sin(clamp01((castProgress - 0.16) / 0.58) * Math.PI) * castEnergy
      : 0

    let leftX = -0.285
    let leftY = -0.045
    let leftZ = 0
    let leftRx = -0.48
    let leftRy = -0.12
    let leftRz = -0.34
    let rightX = 0.285
    let rightY = -0.05
    let rightZ = -0.012
    let rightRx = -0.46
    let rightRy = 0.12
    let rightRz = 0.34

    switch (activeSlotRef.current) {
      case 'primary':
        leftX = THREE.MathUtils.lerp(leftX, -0.25, castEnergy * 0.25)
        leftY = THREE.MathUtils.lerp(leftY, 0, castEnergy * 0.2)
        rightX = THREE.MathUtils.lerp(rightX, 0.2, castEnergy)
        rightY = THREE.MathUtils.lerp(rightY, 0.105, castEnergy)
        rightZ = THREE.MathUtils.lerp(rightZ, -0.19, castEnergy) + recoil * 0.11
        rightRx = THREE.MathUtils.lerp(rightRx, -0.72, castEnergy)
        rightRz = THREE.MathUtils.lerp(rightRz, 0.12, castEnergy)
        break
      case 'signature':
        leftX = THREE.MathUtils.lerp(leftX, -0.15, castEnergy)
        leftY = THREE.MathUtils.lerp(leftY, 0.12, castEnergy)
        leftZ = THREE.MathUtils.lerp(leftZ, -0.15, castEnergy)
        leftRx = THREE.MathUtils.lerp(leftRx, -0.72, castEnergy)
        leftRz = THREE.MathUtils.lerp(leftRz, -0.08, castEnergy)
        rightX = THREE.MathUtils.lerp(rightX, 0.15, castEnergy)
        rightY = THREE.MathUtils.lerp(rightY, 0.12, castEnergy)
        rightZ = THREE.MathUtils.lerp(rightZ, -0.15, castEnergy)
        rightRx = THREE.MathUtils.lerp(rightRx, -0.72, castEnergy)
        rightRz = THREE.MathUtils.lerp(rightRz, 0.08, castEnergy)
        break
      case 'mobility':
        leftX = THREE.MathUtils.lerp(leftX, -0.34, castEnergy)
        leftY = THREE.MathUtils.lerp(leftY, -0.11, castEnergy)
        leftZ = THREE.MathUtils.lerp(leftZ, 0.13, castEnergy)
        leftRx = THREE.MathUtils.lerp(leftRx, -0.25, castEnergy)
        rightX = THREE.MathUtils.lerp(rightX, 0.34, castEnergy)
        rightY = THREE.MathUtils.lerp(rightY, -0.11, castEnergy)
        rightZ = THREE.MathUtils.lerp(rightZ, 0.13, castEnergy)
        rightRx = THREE.MathUtils.lerp(rightRx, -0.25, castEnergy)
        break
      case 'ultimate':
        leftX = THREE.MathUtils.lerp(leftX, -0.13, castEnergy)
        leftY = THREE.MathUtils.lerp(leftY, 0.175, castEnergy)
        leftZ = THREE.MathUtils.lerp(leftZ, -0.22, castEnergy)
        leftRx = THREE.MathUtils.lerp(leftRx, -0.86, castEnergy)
        leftRy = THREE.MathUtils.lerp(leftRy, 0.04, castEnergy)
        leftRz = THREE.MathUtils.lerp(leftRz, -0.04, castEnergy)
        rightX = THREE.MathUtils.lerp(rightX, 0.13, castEnergy)
        rightY = THREE.MathUtils.lerp(rightY, 0.175, castEnergy)
        rightZ = THREE.MathUtils.lerp(rightZ, -0.22, castEnergy)
        rightRx = THREE.MathUtils.lerp(rightRx, -0.86, castEnergy)
        rightRy = THREE.MathUtils.lerp(rightRy, -0.04, castEnergy)
        rightRz = THREE.MathUtils.lerp(rightRz, 0.04, castEnergy)
        break
      default:
        assertNever(activeSlotRef.current)
    }

    switch (heroId) {
      case 'luma-crivo':
        if (activeSlotRef.current === 'signature' || activeSlotRef.current === 'ultimate') {
          leftX -= castEnergy * 0.055
          rightX += castEnergy * 0.055
          leftRz -= castEnergy * 0.16
          rightRz += castEnergy * 0.16
          leftRy += castEnergy * 0.08
          rightRy -= castEnergy * 0.08
        }
        break
      case 'raul-rsa':
        if (activeSlotRef.current === 'signature' || activeSlotRef.current === 'ultimate') {
          leftX = THREE.MathUtils.lerp(leftX, -0.075, castEnergy)
          rightX = THREE.MathUtils.lerp(rightX, 0.075, castEnergy)
          leftZ = THREE.MathUtils.lerp(leftZ, -0.27, castEnergy)
          rightZ = THREE.MathUtils.lerp(rightZ, -0.27, castEnergy)
          leftRz = THREE.MathUtils.lerp(leftRz, -0.015, castEnergy)
          rightRz = THREE.MathUtils.lerp(rightRz, 0.015, castEnergy)
        }
        if (activeSlotRef.current === 'mobility') {
          leftX -= castEnergy * 0.06
          rightX += castEnergy * 0.06
          leftZ += castEnergy * 0.08
          rightZ += castEnergy * 0.08
        }
        break
      case 'teo-gemeos':
        if (activeSlotRef.current === 'primary' && seenSerialRef.current % 2 === 0) {
          leftX = THREE.MathUtils.lerp(-0.285, -0.2, castEnergy)
          leftY = THREE.MathUtils.lerp(-0.045, 0.105, castEnergy)
          leftZ = THREE.MathUtils.lerp(0, -0.19, castEnergy) + recoil * 0.11
          leftRx = THREE.MathUtils.lerp(-0.48, -0.72, castEnergy)
          leftRz = THREE.MathUtils.lerp(-0.34, -0.12, castEnergy)
          rightX = THREE.MathUtils.lerp(rightX, 0.25, castEnergy)
          rightY = THREE.MathUtils.lerp(rightY, 0, castEnergy)
          rightZ = THREE.MathUtils.lerp(rightZ, -0.03, castEnergy)
        }
        if (activeSlotRef.current === 'signature' || activeSlotRef.current === 'ultimate') {
          const split = seenSerialRef.current % 2 === 0 ? -1 : 1
          leftZ += split * castEnergy * 0.045
          rightZ -= split * castEnergy * 0.045
          leftRz -= castEnergy * 0.09
          rightRz += castEnergy * 0.09
        }
        break
      case 'yara-diffie': {
        const glitchStep = Math.floor(castProgress * 14)
        const glitch = reducedMotion ? 0 : Math.sin(glitchStep * 9.73) * castEnergy * 0.018
        leftX += glitch
        rightX -= glitch * 0.72
        leftY -= glitch * 0.55
        rightY += glitch * 0.38
        if (activeSlotRef.current === 'mobility') {
          leftX -= castEnergy * 0.09
          rightX += castEnergy * 0.09
          leftRz -= castEnergy * 0.18
          rightRz += castEnergy * 0.18
        }
        break
      }
      case 'iris-mersenne': {
        // Steady the lance: the off hand braces while the shooting arm settles.
        const brace = castEnergy * 0.06
        leftX += brace * 0.4
        leftY -= brace
        rightY -= brace * 0.5
        rightZ -= castEnergy * 0.05
        leftRz += brace * 1.6
        if (activeSlotRef.current === 'ultimate') {
          leftY -= castEnergy * 0.05
          rightY -= castEnergy * 0.05
        }
        break
      }
      default:
        assertNever(heroId)
    }

    left.position.set(leftX, leftY, leftZ)
    left.rotation.set(leftRx, leftRy, leftRz)
    right.position.set(rightX, rightY, rightZ)
    right.rotation.set(rightRx, rightRy, rightRz)

    const showFocus = activeSlotRef.current === 'signature' || activeSlotRef.current === 'ultimate'
    if (castFocusRef.current) {
      castFocusRef.current.visible = showFocus && rawCast > 0.015
      castFocusRef.current.scale.setScalar(0.32 + rawCast * (activeSlotRef.current === 'ultimate' ? 1.4 : 0.82))
      const focusDirection = heroId === 'yara-diffie' || heroId === 'teo-gemeos' ? -1 : 1
      const focusSpeed = heroId === 'raul-rsa' ? 1.25 : heroId === 'yara-diffie' ? 6.2 : activeSlotRef.current === 'ultimate' ? 4.8 : 2.2
      castFocusRef.current.rotation.z += reducedMotion ? 0 : delta * focusSpeed * focusDirection
      if (heroId === 'yara-diffie' && !reducedMotion) {
        castFocusRef.current.position.x = Math.sin(Math.floor(castProgress * 11) * 5.37) * rawCast * 0.018
      } else {
        castFocusRef.current.position.x = 0
      }
    }
    assets.materials.cast.opacity = showFocus ? rawCast * 0.92 : 0
    assets.materials.castSecondary.opacity = showFocus ? rawCast * 0.78 : 0
    assets.materials.accent.emissiveIntensity = 1.25 + rawCast * (activeSlotRef.current === 'ultimate' ? 3.5 : 1.8)
    if (castLightRef.current) {
      castLightRef.current.intensity = showFocus ? rawCast * (activeSlotRef.current === 'ultimate' ? 4.5 : 2.5) : 0
    }
  }, -1)

  return (
    <group ref={rootRef} name={`first-person-hands-${heroId}`} frustumCulled={false} dispose={null}>
      <group ref={swayRef} frustumCulled={false}>
        <mesh
          geometry={assets.geometries.viewPlane}
          material={assets.materials.viewMask}
          position={[0, 0, 0.02]}
          renderOrder={999}
          frustumCulled={false}
          onBeforeRender={clearViewmodelDepth}
        />
        <group ref={leftRef} position={[-0.285, -0.045, 0]} rotation={[-0.48, -0.12, -0.34]} frustumCulled={false}>
          <HeroArm heroId={heroId} side="left" assets={assets} />
        </group>
        <group ref={rightRef} position={[0.285, -0.05, -0.012]} rotation={[-0.46, 0.12, 0.34]} frustumCulled={false}>
          <HeroArm heroId={heroId} side="right" assets={assets} />
        </group>
        <group ref={castFocusRef} position={[0, 0.09, -0.25]} visible={false} frustumCulled={false}>
          <CastFocus heroId={heroId} assets={assets} />
        </group>
        <pointLight ref={castLightRef} position={[0, 0.09, -0.28]} color={CIPHER_TEAM_COLOR} intensity={0} distance={2.2} decay={2} />
      </group>
    </group>
  )
}
