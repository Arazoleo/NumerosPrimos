import { Billboard, Sky, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import {
  QUALITY_PROFILES,
  type QualityLevel,
  type QualityProfile,
} from '../../graphics/useQualitySettings'
import {
  SKYLINE_LOCATIONS,
  SKYLINE_NPCS,
  SKYLINE_PRIME_CORES,
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINELS,
  SKYLINE_SENTINEL_IDS,
  type SkylineNpcId,
  type SkylinePrimeCoreValue,
  type SkylineSentinelId,
} from './missionData'
import {
  ROOFTOP_PROPS,
  SKYLINE_ANCHORS,
  SKYLINE_BUILDINGS,
  aabbCenter,
  aabbSize,
  type RooftopProp,
  type SkylineBuilding,
} from './world'

const CYAN = '#66f4ee'
const AMBER = '#ffbd62'
const CORAL = '#ff715f'
const HAZE = '#8da9b2'
const PRIME_FACTOR_COLORS: Readonly<Record<SkylinePrimeCoreValue, string>> = {
  2: CYAN,
  3: '#a6a7ff',
  5: AMBER,
}

const LowDetailContext = createContext(false)

type CoreCollection = readonly SkylinePrimeCoreValue[] | ReadonlySet<SkylinePrimeCoreValue>
type SentinelCollection = readonly SkylineSentinelId[] | ReadonlySet<SkylineSentinelId>

export type SkylineEnemyHealth = Readonly<Partial<Record<SkylineSentinelId, number>>>
export type SkylineEnemyFactors = Readonly<Partial<Record<SkylineSentinelId, readonly SkylinePrimeCoreValue[]>>>

export interface SkylineWorldProps {
  readonly profile?: QualityProfile
  readonly quality?: QualityLevel
  readonly reducedMotion?: boolean
  readonly collectedCores?: CoreCollection
  readonly defeatedSentinels?: SentinelCollection
  /** Health may be supplied as a 0–1 ratio or as a percentage from 0–100. */
  readonly activeEnemyHealth?: SkylineEnemyHealth
  /** Prime factors whose seals have not yet been broken for each sentinel. */
  readonly remainingEnemyFactors?: SkylineEnemyFactors
  readonly activeAnchorId?: string | null
  readonly activeNpcId?: SkylineNpcId | null
  readonly highlightedCore?: SkylinePrimeCoreValue | null
  readonly beaconActive?: boolean
  readonly onCoreApproach?: (value: SkylinePrimeCoreValue) => void
  readonly onAnchorApproach?: (id: string) => void
  readonly onNpcApproach?: (id: SkylineNpcId) => void
  readonly onSentinelApproach?: (id: SkylineSentinelId) => void
  readonly onBeaconApproach?: () => void
}

interface SharedWorldVisualProps {
  readonly profile: QualityProfile
  readonly quality: QualityLevel
  readonly reducedMotion: boolean
}

interface InstanceTransform {
  readonly position: readonly [number, number, number]
  readonly scale: readonly [number, number, number]
  readonly color: THREE.Color
}

function collectionHas<T>(collection: readonly T[] | ReadonlySet<T>, value: T): boolean {
  const setLike = collection as ReadonlySet<T>
  return typeof setLike.has === 'function'
    ? setLike.has(value)
    : (collection as readonly T[]).includes(value)
}

function resolveQuality(
  profile: QualityProfile | undefined,
  quality: QualityLevel | undefined,
): { profile: QualityProfile; quality: QualityLevel } {
  const level = quality ?? (profile === QUALITY_PROFILES.low
    ? 'low'
    : profile === QUALITY_PROFILES.medium
      ? 'medium'
      : 'high')
  return { profile: profile ?? QUALITY_PROFILES[level], quality: level }
}

function seededNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

function createWindowTexture(): THREE.DataTexture {
  const width = 18
  const height = 34
  const pixels = new Uint8Array(width * height * 4)

  for (let y = 1; y < height; y += 3) {
    for (let x = 1; x < width; x += 3) {
      const lit = seededNoise(x * 31 + y * 101) > 0.53
      const warm = seededNoise(x * 71 + y * 17) > 0.72
      const index = (y * width + x) * 4
      pixels[index] = warm ? 255 : 121
      pixels[index + 1] = warm ? 194 : 226
      pixels[index + 2] = warm ? 112 : 230
      pixels[index + 3] = lit ? 205 : 38
    }
  }

  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function FacadeWindows({
  building,
  texture,
  lowDetail,
}: {
  building: SkylineBuilding
  texture: THREE.Texture
  lowDetail: boolean
}): JSX.Element {
  const [centerX, centerY, centerZ] = aabbCenter(building.bounds)
  const [width, height, depth] = aabbSize(building.bounds)
  const material = (
    <meshBasicMaterial
      map={texture}
      transparent
      opacity={0.78}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      toneMapped={false}
    />
  )

  return (
    <group>
      <mesh position={[centerX, centerY, building.bounds.max.z + 0.012]}>
        <planeGeometry args={[width * 0.84, height * 0.88]} />
        {material}
      </mesh>
      {!lowDetail ? (
        <>
          <mesh position={[centerX, centerY, building.bounds.min.z - 0.012]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[width * 0.84, height * 0.88]} />
            {material}
          </mesh>
          <mesh position={[building.bounds.max.x + 0.012, centerY, centerZ]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[depth * 0.84, height * 0.88]} />
            {material}
          </mesh>
          <mesh position={[building.bounds.min.x - 0.012, centerY, centerZ]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[depth * 0.84, height * 0.88]} />
            {material}
          </mesh>
        </>
      ) : null}
    </group>
  )
}

function RouteMarking({
  position,
  accent,
  width,
  lowDetail,
}: {
  position: readonly [number, number, number]
  accent: string
  width: number
  lowDetail: boolean
}): JSX.Element {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(0.82, width * 0.1), Math.min(0.92, width * 0.115), 24, 1, 0.2, Math.PI * 1.6]} />
        <meshBasicMaterial color={accent} transparent opacity={0.68} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {!lowDetail && [-0.22, 0, 0.22].map((offset) => (
        <mesh key={offset} position={[offset, 0, -0.92]} rotation={[0, -Math.PI / 4, 0]}>
          <boxGeometry args={[0.08, 0.018, 0.52]} />
          <meshBasicMaterial color={accent} transparent opacity={0.74} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function RouteBuildingVisual({
  building,
  windowTexture,
  shadows,
  lowDetail,
}: {
  building: SkylineBuilding
  windowTexture: THREE.Texture
  shadows: boolean
  lowDetail: boolean
}): JSX.Element {
  const center = aabbCenter(building.bounds)
  const size = aabbSize(building.bounds)
  const roofY = building.bounds.max.y
  const width = size[0]
  const depth = size[2]
  const approachZ = building.bounds.max.z + 0.014

  return (
    <group name={`route-building-${building.id}`} userData={{ kind: 'parkour-platform', id: building.id }}>
      <mesh position={center} receiveShadow={shadows} castShadow={shadows}>
        <boxGeometry args={[size[0], size[1], size[2]]} />
        <meshStandardMaterial color={building.color} metalness={0.62} roughness={0.66} />
      </mesh>
      <FacadeWindows building={building} texture={windowTexture} lowDetail={lowDetail} />

      <mesh position={[center[0], roofY + 0.035, center[2]]} receiveShadow={shadows}>
        <boxGeometry args={[width + 0.08, 0.07, depth + 0.08]} />
        <meshStandardMaterial
          color={building.roofColor}
          emissive={building.accent}
          emissiveIntensity={0.025}
          metalness={0.64}
          roughness={0.58}
        />
      </mesh>

      <mesh position={[center[0], roofY - 0.48, approachZ]}>
        <boxGeometry args={[Math.max(2.2, width * 0.58), 0.08, 0.035]} />
        <meshBasicMaterial color={building.accent} transparent opacity={0.88} toneMapped={false} />
      </mesh>
      {!lowDetail ? (
        <mesh position={[center[0], roofY - 0.83, approachZ + 0.002]}>
          <boxGeometry args={[Math.max(1.35, width * 0.31), 0.035, 0.038]} />
          <meshBasicMaterial color={building.accent} transparent opacity={0.38} toneMapped={false} />
        </mesh>
      ) : null}

      {!lowDetail && ([
        [building.bounds.min.x + 0.08, center[2], 0.1, depth],
        [building.bounds.max.x - 0.08, center[2], 0.1, depth],
        [center[0], building.bounds.min.z + 0.08, width, 0.1],
        [center[0], building.bounds.max.z - 0.08, width, 0.1],
      ] as const).map(([x, z, trimWidth, trimDepth], index) => (
        <mesh key={index} position={[x, roofY - 0.1, z]}>
          <boxGeometry args={[trimWidth, 0.2, trimDepth]} />
          <meshStandardMaterial color="#142731" metalness={0.88} roughness={0.34} />
        </mesh>
      ))}

      <RouteMarking
        position={[center[0], roofY + 0.081, center[2] + Math.min(1.1, depth * 0.12)]}
        accent={building.accent}
        width={width}
        lowDetail={lowDetail}
      />
    </group>
  )
}

function VentProp({ prop, reducedMotion }: { prop: RooftopProp; reducedMotion: boolean }): JSX.Element {
  const fanRef = useRef<THREE.Group>(null)
  const [width, height, depth] = prop.size

  useFrame((_, delta) => {
    if (!reducedMotion && fanRef.current) fanRef.current.rotation.y += delta * 3.4
  })

  return (
    <group position={prop.position} rotation={[0, prop.rotationY ?? 0, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#304852" metalness={0.8} roughness={0.38} />
      </mesh>
      <mesh position={[0, height * 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[Math.min(width, depth) * 0.29, 18]} />
        <meshStandardMaterial color="#09141b" metalness={0.6} roughness={0.7} />
      </mesh>
      <group ref={fanRef} position={[0, height * 0.525, 0]}>
        {[0, Math.PI / 2].map((rotation) => (
          <mesh key={rotation} rotation={[0, rotation, 0]}>
            <boxGeometry args={[Math.min(width, depth) * 0.58, 0.025, 0.09]} />
            <meshBasicMaterial color={CYAN} transparent opacity={0.48} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function BarrierProp({ prop }: { prop: RooftopProp }): JSX.Element {
  const [width, height, depth] = prop.size
  return (
    <group position={prop.position} rotation={[0, prop.rotationY ?? 0, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#24353d" metalness={0.74} roughness={0.5} />
      </mesh>
      {[-0.28, 0, 0.28].map((unit) => (
        <mesh key={unit} position={[unit * width, 0, depth * 0.52]} rotation={[0, 0, -0.6]}>
          <boxGeometry args={[Math.min(0.12, width * 0.04), height * 0.75, 0.018]} />
          <meshBasicMaterial color={AMBER} transparent opacity={0.8} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function CrateProp({ prop }: { prop: RooftopProp }): JSX.Element {
  const [width, height, depth] = prop.size
  return (
    <group position={prop.position} rotation={[0, prop.rotationY ?? 0, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#384b50" metalness={0.66} roughness={0.58} />
      </mesh>
      <mesh scale={[1.012, 1.012, 1.012]}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#8ba7a6" transparent opacity={0.25} wireframe />
      </mesh>
      <mesh position={[0, 0, depth * 0.506]}>
        <ringGeometry args={[Math.min(width, height) * 0.13, Math.min(width, height) * 0.18, 4]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.58} toneMapped={false} />
      </mesh>
    </group>
  )
}

function SolarProp({ prop }: { prop: RooftopProp }): JSX.Element {
  const [width, height, depth] = prop.size
  return (
    <group position={prop.position} rotation={[0, prop.rotationY ?? 0, 0]}>
      <mesh position={[-width * 0.29, -0.42, 0]} rotation={[0, 0, -0.25]}>
        <boxGeometry args={[0.08, 0.9, 0.08]} />
        <meshStandardMaterial color="#46565b" metalness={0.88} roughness={0.3} />
      </mesh>
      <mesh position={[width * 0.29, -0.42, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.08, 0.9, 0.08]} />
        <meshStandardMaterial color="#46565b" metalness={0.88} roughness={0.3} />
      </mesh>
      <mesh rotation={[-0.29, 0, 0]} castShadow>
        <boxGeometry args={[width, Math.max(0.08, height), depth]} />
        <meshStandardMaterial color="#0c303d" emissive="#277b87" emissiveIntensity={0.16} metalness={0.86} roughness={0.24} />
      </mesh>
      {[-0.26, 0, 0.26].map((unit) => (
        <mesh key={unit} position={[unit * width, 0.05, 0]} rotation={[-0.29, 0, 0]}>
          <boxGeometry args={[0.018, 0.015, depth * 0.93]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.42} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function AntennaProp({ prop, reducedMotion }: { prop: RooftopProp; reducedMotion: boolean }): JSX.Element {
  const ringsRef = useRef<THREE.Group>(null)
  const [width, height] = prop.size

  useFrame((_, delta) => {
    if (!reducedMotion && ringsRef.current) ringsRef.current.rotation.y -= delta * 0.42
  })

  return (
    <group position={prop.position} rotation={[0, prop.rotationY ?? 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[width * 0.32, width * 0.72, height, 8]} />
        <meshStandardMaterial color="#52666b" metalness={0.9} roughness={0.24} />
      </mesh>
      <group ref={ringsRef} position={[0, height * 0.28, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.86, 0.035, 5, 28]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.8, 0.25, 0]}>
          <torusGeometry args={[0.58, 0.024, 5, 24]} />
          <meshBasicMaterial color={AMBER} transparent opacity={0.54} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function LowDetailProp({ prop }: { prop: RooftopProp }): JSX.Element {
  const [width, height, depth] = prop.size
  const isAntenna = prop.kind === 'antenna'
  const isSolar = prop.kind === 'solar'
  const accent = prop.kind === 'barrier'
    ? AMBER
    : isSolar || isAntenna
      ? CYAN
      : '#5b777b'

  return (
    <group position={prop.position} rotation={[0, prop.rotationY ?? 0, 0]}>
      <mesh rotation={[isSolar ? -0.29 : 0, 0, 0]}>
        {isAntenna
          ? <cylinderGeometry args={[width * 0.32, width * 0.72, height, 6]} />
          : <boxGeometry args={[width, Math.max(0.08, height), depth]} />}
        <meshStandardMaterial
          color={isSolar ? '#10333d' : '#30464d'}
          emissive={accent}
          emissiveIntensity={0.075}
          metalness={0.7}
          roughness={0.54}
        />
      </mesh>
    </group>
  )
}

function RooftopPropVisual({
  prop,
  reducedMotion,
  lowDetail,
}: {
  prop: RooftopProp
  reducedMotion: boolean
  lowDetail: boolean
}): JSX.Element {
  if (lowDetail) return <LowDetailProp prop={prop} />

  switch (prop.kind) {
    case 'vent':
      return <VentProp prop={prop} reducedMotion={reducedMotion} />
    case 'barrier':
      return <BarrierProp prop={prop} />
    case 'crate':
      return <CrateProp prop={prop} />
    case 'solar':
      return <SolarProp prop={prop} />
    case 'antenna':
      return <AntennaProp prop={prop} reducedMotion={reducedMotion} />
  }
}

function DistantSkyline({ quality }: { quality: QualityLevel }): JSX.Element {
  const count = quality === 'low' ? 34 : quality === 'medium' ? 56 : 78
  const buildingsRef = useRef<THREE.InstancedMesh>(null)
  const crownsRef = useRef<THREE.InstancedMesh>(null)
  const transforms = useMemo<readonly InstanceTransform[]>(() => (
    Array.from({ length: count }, (_, index) => {
      const side = index % 2 === 0 ? -1 : 1
      const x = side * (17 + seededNoise(index * 7 + 1) * 70)
      const z = -105 + seededNoise(index * 11 + 2) * 148
      const width = 4 + seededNoise(index * 13 + 3) * 9
      const depth = 4 + seededNoise(index * 17 + 4) * 10
      const height = 18 + seededNoise(index * 19 + 5) * 52
      const top = -5 + seededNoise(index * 23 + 6) * 27
      const hue = 0.52 + seededNoise(index * 29 + 7) * 0.055
      const light = 0.11 + seededNoise(index * 31 + 8) * 0.08
      return {
        position: [x, top - height / 2, z] as const,
        scale: [width, height, depth] as const,
        color: new THREE.Color().setHSL(hue, 0.28, light),
      }
    })
  ), [count])

  useLayoutEffect(() => {
    const buildings = buildingsRef.current
    const crowns = crownsRef.current
    if (!buildings || (quality !== 'low' && !crowns)) return
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()

    transforms.forEach((transform, index) => {
      position.fromArray(transform.position)
      scale.fromArray(transform.scale)
      matrix.compose(position, quaternion, scale)
      buildings.setMatrixAt(index, matrix)
      buildings.setColorAt(index, transform.color)

      position.set(
        transform.position[0],
        transform.position[1] + transform.scale[1] / 2 + 0.13,
        transform.position[2],
      )
      scale.set(transform.scale[0] * 0.64, 0.18, transform.scale[2] * 0.64)
      matrix.compose(position, quaternion, scale)
      crowns?.setMatrixAt(index, matrix)
    })
    buildings.instanceMatrix.needsUpdate = true
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true
    if (crowns) crowns.instanceMatrix.needsUpdate = true
    buildings.computeBoundingSphere()
    crowns?.computeBoundingSphere()
  }, [quality, transforms])

  return (
    <group name="distant-skyline">
      <instancedMesh ref={buildingsRef} args={[undefined, undefined, transforms.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" metalness={0.36} roughness={0.9} />
      </instancedMesh>
      {quality !== 'low' ? (
        <instancedMesh ref={crownsRef} args={[undefined, undefined, transforms.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#79d8d5" transparent opacity={0.22} toneMapped={false} />
        </instancedMesh>
      ) : null}
    </group>
  )
}

function CloudSea({ quality, reducedMotion }: { quality: QualityLevel; reducedMotion: boolean }): JSX.Element {
  const count = quality === 'low' ? 18 : quality === 'medium' ? 30 : 44
  const cloudRef = useRef<THREE.InstancedMesh>(null)
  const rootRef = useRef<THREE.Group>(null)
  const transforms = useMemo<readonly InstanceTransform[]>(() => (
    Array.from({ length: count }, (_, index) => {
      const angle = seededNoise(index * 37 + 4) * Math.PI * 2
      const radius = 22 + seededNoise(index * 41 + 2) * 80
      const x = Math.cos(angle) * radius
      const z = -25 + Math.sin(angle) * radius
      const scaleX = 8 + seededNoise(index * 43 + 8) * 20
      return {
        position: [x, -14 + seededNoise(index * 47 + 3) * 5, z] as const,
        scale: [scaleX, 1.6 + seededNoise(index * 53 + 5) * 3, scaleX * 0.58] as const,
        color: new THREE.Color(HAZE),
      }
    })
  ), [count])

  useLayoutEffect(() => {
    const cloud = cloudRef.current
    if (!cloud || quality === 'low') return
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    transforms.forEach((transform, index) => {
      position.fromArray(transform.position)
      scale.fromArray(transform.scale)
      matrix.compose(position, quaternion, scale)
      cloud.setMatrixAt(index, matrix)
    })
    cloud.instanceMatrix.needsUpdate = true
    cloud.computeBoundingSphere()
  }, [quality, transforms])

  useFrame(({ clock }) => {
    if (!reducedMotion && rootRef.current) rootRef.current.position.x = Math.sin(clock.elapsedTime * 0.018) * 2.4
  })

  return (
    <group ref={rootRef} name="cloud-sea">
      <mesh position={[0, -15.4, -28]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[155, 48]} />
        <meshBasicMaterial color="#a4bcc1" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {quality !== 'low' ? (
        <instancedMesh ref={cloudRef} args={[undefined, undefined, transforms.length]}>
          <sphereGeometry args={[1, 9, 5]} />
          <meshBasicMaterial color="#bdcdd0" transparent opacity={0.12} depthWrite={false} />
        </instancedMesh>
      ) : null}
    </group>
  )
}

function AirTraffic({ reducedMotion }: { reducedMotion: boolean }): JSX.Element {
  const trafficRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!trafficRef.current) return
    const time = reducedMotion ? 0.25 : (clock.elapsedTime * 0.035) % 1
    trafficRef.current.position.set(
      THREE.MathUtils.lerp(-56, 58, time),
      17 + Math.sin(time * Math.PI * 2) * 2.2,
      -38 - Math.sin(time * Math.PI) * 22,
    )
  })

  return (
    <group ref={trafficRef} name="air-traffic">
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.28, 1.65, 6]} />
        <meshStandardMaterial color="#162b34" emissive={CYAN} emissiveIntensity={0.36} metalness={0.92} roughness={0.2} />
      </mesh>
      <mesh position={[-0.92, 0, 0]}>
        <sphereGeometry args={[0.08, 7, 5]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      <mesh position={[-4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 6, 4]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function RouteSun({ shadows }: { shadows: boolean }): JSX.Element {
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => {
    const object = new THREE.Object3D()
    object.position.set(0, 5, -30)
    return object
  }, [])

  useLayoutEffect(() => {
    const light = lightRef.current
    const parent = light?.parent
    if (!light || !parent) return undefined
    parent.add(target)
    light.target = target
    target.updateMatrixWorld()
    light.shadow.camera.updateProjectionMatrix()
    return () => {
      parent.remove(target)
    }
  }, [target])

  return (
    <directionalLight
      ref={lightRef}
      castShadow={shadows}
      color="#ffe5bd"
      intensity={2.9}
      position={[72, 43, 40]}
      shadow-mapSize-width={shadows ? 2048 : 512}
      shadow-mapSize-height={shadows ? 2048 : 512}
      shadow-camera-near={1}
      shadow-camera-far={170}
      shadow-camera-left={-52}
      shadow-camera-right={52}
      shadow-camera-top={52}
      shadow-camera-bottom={-52}
      shadow-bias={-0.00012}
    />
  )
}

export function SkylineAtmosphere({
  profile,
  quality,
  reducedMotion,
}: SharedWorldVisualProps): JSX.Element {
  return (
    <>
      <color attach="background" args={['#6f8f9b']} />
      <fog attach="fog" args={['#78949e', quality === 'low' ? 42 : 55, quality === 'low' ? 150 : 190]} />
      <Sky
        distance={450}
        sunPosition={[72, 38, 70]}
        turbidity={7.8}
        rayleigh={1.25}
        mieCoefficient={0.012}
        mieDirectionalG={0.82}
      />
      <hemisphereLight args={['#d6f4f4', '#17242b', 1.4]} />
      <RouteSun shadows={profile.shadows} />
      <directionalLight color="#78bcd0" intensity={0.62} position={[-34, 22, -80]} />
      <CloudSea quality={quality} reducedMotion={reducedMotion} />
      <AirTraffic reducedMotion={reducedMotion} />
      {quality !== 'low' ? (
        <Sparkles
          count={Math.max(10, Math.round(profile.particles * 0.48))}
          scale={[72, 30, 120]}
          position={[0, 9, -28]}
          size={1.15}
          speed={reducedMotion ? 0 : 0.08}
          opacity={0.17}
          color="#d8ffff"
        />
      ) : null}
    </>
  )
}

export function SkylineCity({
  profile,
  quality,
  reducedMotion,
}: SharedWorldVisualProps): JSX.Element {
  const windowTexture = useMemo(createWindowTexture, [])
  const lowDetail = quality === 'low'

  useEffect(() => () => windowTexture.dispose(), [windowTexture])

  return (
    <group name="skyline-city">
      <DistantSkyline quality={quality} />
      {SKYLINE_BUILDINGS.map((building) => (
        <RouteBuildingVisual
          key={building.id}
          building={building}
          windowTexture={windowTexture}
          shadows={profile.shadows}
          lowDetail={lowDetail}
        />
      ))}
      {ROOFTOP_PROPS.map((prop) => (
        <RooftopPropVisual
          key={prop.id}
          prop={prop}
          reducedMotion={reducedMotion}
          lowDetail={lowDetail}
        />
      ))}
    </group>
  )
}

function GrappleAnchorVisual({
  id,
  position,
  active,
  reducedMotion,
  onApproach,
}: {
  id: string
  position: readonly [number, number, number]
  active: boolean
  reducedMotion: boolean
  onApproach?: (id: string) => void
}): JSX.Element {
  const gyroscopeRef = useRef<THREE.Group>(null)
  const pulseRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }, delta) => {
    if (gyroscopeRef.current && !reducedMotion) {
      gyroscopeRef.current.rotation.y += delta * (active ? 1.9 : 0.62)
      gyroscopeRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.7) * 0.16
    }
    if (pulseRef.current) {
      const pulse = active && !reducedMotion ? 1 + Math.sin(clock.elapsedTime * 4.8) * 0.16 : 1
      pulseRef.current.scale.setScalar(pulse)
    }
  })

  const color = active ? AMBER : CYAN
  return (
    <group
      name={`grapple-anchor-${id}`}
      position={position}
      userData={{ kind: 'grapple-anchor', id }}
      onPointerOver={() => onApproach?.(id)}
      onClick={() => onApproach?.(id)}
    >
      <group ref={gyroscopeRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.045, 6, 30]} />
          <meshStandardMaterial color="#eafefe" emissive={color} emissiveIntensity={active ? 3.6 : 1.65} metalness={0.74} roughness={0.2} />
        </mesh>
        <mesh rotation={[Math.PI / 2.7, 0.2, 0]}>
          <torusGeometry args={[0.29, 0.025, 5, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.78} toneMapped={false} />
        </mesh>
        <mesh>
          <octahedronGeometry args={[0.15, 0]} />
          <meshStandardMaterial color="#efffff" emissive={color} emissiveIntensity={4.4} metalness={0.32} roughness={0.15} />
        </mesh>
      </group>
      <mesh ref={pulseRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.56, 0.59, 32]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.76 : 0.2} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.9, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 1.45, 5]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} toneMapped={false} />
      </mesh>
      {active ? <pointLight color={color} intensity={7} distance={5.5} decay={2} /> : null}
    </group>
  )
}

export interface GrappleAnchorsProps {
  readonly activeAnchorId?: string | null
  readonly reducedMotion?: boolean
  readonly onAnchorApproach?: (id: string) => void
}

export function GrappleAnchors({
  activeAnchorId = null,
  reducedMotion = false,
  onAnchorApproach,
}: GrappleAnchorsProps): JSX.Element {
  return (
    <group name="grapple-anchors">
      {SKYLINE_ANCHORS.map((anchor) => (
        <GrappleAnchorVisual
          key={anchor.id}
          id={anchor.id}
          position={[anchor.position.x, anchor.position.y, anchor.position.z]}
          active={anchor.id === activeAnchorId}
          reducedMotion={reducedMotion}
          onApproach={onAnchorApproach}
        />
      ))}
    </group>
  )
}

const DIGIT_SEGMENTS: Readonly<Record<number, readonly string[]>> = {
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  9: ['a', 'f', 'b', 'g', 'c', 'd'],
  10: [],
}

const SEGMENT_LAYOUT: Readonly<Record<string, {
  readonly position: readonly [number, number, number]
  readonly vertical: boolean
}>> = {
  a: { position: [0, 0.46, 0], vertical: false },
  b: { position: [0.25, 0.23, 0], vertical: true },
  c: { position: [0.25, -0.23, 0], vertical: true },
  d: { position: [0, -0.46, 0], vertical: false },
  e: { position: [-0.25, -0.23, 0], vertical: true },
  f: { position: [-0.25, 0.23, 0], vertical: true },
  g: { position: [0, 0, 0], vertical: false },
}

function Digit({ value, color, scale = 1 }: { value: number; color: string; scale?: number }): JSX.Element {
  if (value === 10) {
    return (
      <group scale={scale}>
        <mesh position={[-0.32, 0, 0]}>
          <boxGeometry args={[0.08, 0.92, 0.055]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh position={[0.22, 0, 0]}>
          <ringGeometry args={[0.22, 0.285, 24]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>
    )
  }

  return (
    <group scale={scale}>
      {(DIGIT_SEGMENTS[value] ?? []).map((segment) => {
        const layout = SEGMENT_LAYOUT[segment]
        return (
          <mesh key={segment} position={layout.position} rotation={[0, 0, layout.vertical ? Math.PI / 2 : 0]}>
            <boxGeometry args={[0.4, 0.075, 0.055]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

function NpcVisual({
  id,
  active,
  reducedMotion,
  onApproach,
}: {
  id: SkylineNpcId
  active: boolean
  reducedMotion: boolean
  onApproach?: (id: SkylineNpcId) => void
}): JSX.Element {
  const npc = SKYLINE_NPCS[id]
  const bodyRef = useRef<THREE.Group>(null)
  const signalRef = useRef<THREE.Group>(null)
  const liaison = id === 'lia'
  const cloth = liaison ? '#173b43' : '#493b28'
  const accent = npc.accent

  useFrame(({ clock }, delta) => {
    if (bodyRef.current) {
      bodyRef.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 1.6 + (liaison ? 0 : 1.8)) * 0.018
    }
    if (signalRef.current && !reducedMotion) signalRef.current.rotation.z += delta * (active ? 1.1 : 0.28)
  })

  return (
    <group
      name={`npc-${id}`}
      position={npc.position}
      userData={{ kind: 'npc', id }}
      onPointerOver={() => onApproach?.(id)}
      onClick={() => onApproach?.(id)}
    >
      <group ref={bodyRef}>
        <mesh position={[-0.17, -0.68, 0]} castShadow>
          <capsuleGeometry args={[0.105, 0.48, 3, 7]} />
          <meshStandardMaterial color="#172329" metalness={0.36} roughness={0.72} />
        </mesh>
        <mesh position={[0.17, -0.68, 0]} castShadow>
          <capsuleGeometry args={[0.105, 0.48, 3, 7]} />
          <meshStandardMaterial color="#172329" metalness={0.36} roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.02, 0]} castShadow>
          <capsuleGeometry args={[0.32, 0.58, 5, 9]} />
          <meshStandardMaterial color={cloth} emissive={accent} emissiveIntensity={active ? 0.18 : 0.045} metalness={0.44} roughness={0.62} />
        </mesh>
        <mesh position={[0, 0.36, -0.24]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[0.42, 0.52, 0.18]} />
          <meshStandardMaterial color="#10252d" metalness={0.82} roughness={0.33} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.39, -0.02, 0]} rotation={[0, 0, side * 0.12]} castShadow>
            <capsuleGeometry args={[0.09, 0.58, 3, 7]} />
            <meshStandardMaterial color={cloth} metalness={0.38} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0.75, 0]} castShadow>
          <sphereGeometry args={[0.245, 12, 9]} />
          <meshStandardMaterial color={liaison ? '#6e4b3d' : '#72513b'} roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.78, 0.205]}>
          <boxGeometry args={[0.38, 0.1, 0.055]} />
          <meshStandardMaterial color="#071319" emissive={accent} emissiveIntensity={2.2} metalness={0.92} roughness={0.18} />
        </mesh>
        {liaison ? (
          <mesh position={[0, 0.8, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.07, 6, 12, Math.PI * 1.45]} />
            <meshStandardMaterial color="#102e36" metalness={0.44} roughness={0.7} />
          </mesh>
        ) : (
          <mesh position={[-0.33, 0.64, 0.12]} rotation={[0.2, 0, 0.2]}>
            <boxGeometry args={[0.18, 0.33, 0.12]} />
            <meshStandardMaterial color="#d29a51" emissive={AMBER} emissiveIntensity={0.3} metalness={0.58} roughness={0.45} />
          </mesh>
        )}
      </group>

      <Billboard position={[0, 1.48, 0]} follow>
        <group ref={signalRef}>
          <mesh>
            <ringGeometry args={[0.23, 0.27, liaison ? 3 : 6]} />
            <meshBasicMaterial color={accent} transparent opacity={active ? 0.95 : 0.38} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.055, 12]} />
            <meshBasicMaterial color={accent} transparent opacity={active ? 0.9 : 0.34} toneMapped={false} />
          </mesh>
        </group>
      </Billboard>
      {active ? <pointLight position={[0, 0.65, 0.45]} color={accent} intensity={4.8} distance={3.8} /> : null}
    </group>
  )
}

export interface SkylineNpcsProps {
  readonly activeNpcId?: SkylineNpcId | null
  readonly reducedMotion?: boolean
  readonly onNpcApproach?: (id: SkylineNpcId) => void
}

export function SkylineNpcs({
  activeNpcId = null,
  reducedMotion = false,
  onNpcApproach,
}: SkylineNpcsProps): JSX.Element {
  return (
    <group name="mission-npcs">
      {(Object.keys(SKYLINE_NPCS) as SkylineNpcId[]).map((id) => (
        <NpcVisual
          key={id}
          id={id}
          active={id === activeNpcId}
          reducedMotion={reducedMotion}
          onApproach={onNpcApproach}
        />
      ))}
    </group>
  )
}

function PrimeCoreVisual({
  value,
  highlighted,
  reducedMotion,
  onApproach,
}: {
  value: SkylinePrimeCoreValue
  highlighted: boolean
  reducedMotion: boolean
  onApproach?: (value: SkylinePrimeCoreValue) => void
}): JSX.Element {
  const core = SKYLINE_PRIME_CORES[value]
  const lowDetail = useContext(LowDetailContext)
  const coreRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    if (coreRef.current) {
      coreRef.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2.2 + value) * 0.11
      if (!reducedMotion) {
        coreRef.current.rotation.y += delta * 0.72
        coreRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.7 + value) * 0.18
      }
    }
    if (ringRef.current && !reducedMotion) ringRef.current.rotation.z -= delta * (highlighted ? 1.45 : 0.48)
  })

  const color = value === 2 ? CYAN : value === 3 ? '#95a8ff' : AMBER
  return (
    <group
      name={`prime-core-${value}`}
      position={core.position}
      userData={{ kind: 'prime-core', value }}
      onPointerOver={() => onApproach?.(value)}
      onClick={() => onApproach?.(value)}
    >
      <group ref={coreRef}>
        <mesh castShadow>
          <dodecahedronGeometry args={[0.34, 0]} />
          <meshStandardMaterial
            color="#eaffff"
            emissive={color}
            emissiveIntensity={highlighted ? 4.8 : 2.7}
            metalness={0.72}
            roughness={0.16}
          />
        </mesh>
        {!lowDetail ? (
          <mesh scale={1.22}>
            <icosahedronGeometry args={[0.34, 0]} />
            <meshBasicMaterial color={color} transparent opacity={0.22} wireframe toneMapped={false} />
          </mesh>
        ) : null}
        <Billboard position={[0, 0, 0.39]} follow>
          <Digit value={value} color="#061316" scale={0.38} />
        </Billboard>
      </group>
      <Billboard follow>
        <group ref={ringRef}>
          <mesh>
            <ringGeometry args={[0.52, 0.555, 32, 1, 0.18, Math.PI * 1.55]} />
            <meshBasicMaterial color={color} transparent opacity={highlighted ? 0.88 : 0.42} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      </Billboard>
      {!lowDetail ? (
        <Sparkles count={6} scale={1.4} size={1.35} speed={reducedMotion ? 0 : 0.34} color={color} opacity={0.62} />
      ) : null}
      {highlighted ? <pointLight color={color} intensity={6.5} distance={4.5} /> : null}
    </group>
  )
}

export interface PrimeCoresProps {
  readonly collectedCores?: CoreCollection
  readonly highlightedCore?: SkylinePrimeCoreValue | null
  readonly reducedMotion?: boolean
  readonly onCoreApproach?: (value: SkylinePrimeCoreValue) => void
}

export function PrimeCores({
  collectedCores = [],
  highlightedCore = null,
  reducedMotion = false,
  onCoreApproach,
}: PrimeCoresProps): JSX.Element {
  return (
    <group name="prime-cores">
      {SKYLINE_PRIME_CORE_VALUES.map((value) => collectionHas(collectedCores, value) ? null : (
        <PrimeCoreVisual
          key={value}
          value={value}
          highlighted={value === highlightedCore}
          reducedMotion={reducedMotion}
          onApproach={onCoreApproach}
        />
      ))}
    </group>
  )
}

function HealthPips({ health, color }: { health: number; color: string }): JSX.Element {
  const lowDetail = useContext(LowDetailContext)
  const litPips = Math.ceil(health * 4)

  if (lowDetail) {
    return (
      <Billboard position={[0, 1.62, 0]} follow>
        <mesh>
          <boxGeometry args={[0.72, 0.055, 0.018]} />
          <meshBasicMaterial color="#26343a" transparent opacity={0.52} toneMapped={false} />
        </mesh>
        <mesh position={[-0.36 * (1 - health), 0, 0.012]} scale={[Math.max(0.01, health), 1, 1]}>
          <boxGeometry args={[0.68, 0.045, 0.018]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      </Billboard>
    )
  }

  return (
    <Billboard position={[0, 1.62, 0]} follow>
      <group>
        {[0, 1, 2, 3].map((index) => (
          <mesh key={index} position={[(index - 1.5) * 0.19, 0, 0]}>
            <boxGeometry args={[0.145, 0.055, 0.018]} />
            <meshBasicMaterial
              color={index < litPips ? color : '#26343a'}
              transparent
              opacity={index < litPips ? 0.9 : 0.42}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </Billboard>
  )
}

function factorSealStates(
  factors: readonly SkylinePrimeCoreValue[],
  remainingFactors: readonly SkylinePrimeCoreValue[],
): readonly boolean[] {
  const remainingCounts = new Map<SkylinePrimeCoreValue, number>()
  remainingFactors.forEach((factor) => {
    remainingCounts.set(factor, (remainingCounts.get(factor) ?? 0) + 1)
  })

  return factors.map((factor) => {
    const available = remainingCounts.get(factor) ?? 0
    if (available <= 0) return false
    remainingCounts.set(factor, available - 1)
    return true
  })
}

function FactorSeals({
  factors,
  remainingFactors,
}: {
  factors: readonly SkylinePrimeCoreValue[]
  remainingFactors: readonly SkylinePrimeCoreValue[]
}): JSX.Element {
  const lowDetail = useContext(LowDetailContext)
  const states = factorSealStates(factors, remainingFactors)
  const centerOffset = (factors.length - 1) / 2

  return (
    <Billboard position={[0, 1.94, 0]} follow>
      <group name="sentinel-factor-seals">
        {factors.map((factor, index) => {
          const remaining = states[index]
          const factorColor = PRIME_FACTOR_COLORS[factor]
          const color = remaining ? factorColor : '#536167'

          return (
            <group
              key={`${factor}-${index}`}
              name={`factor-seal-${factor}-${index}`}
              position={[(index - centerOffset) * 0.48, 0, 0]}
              userData={{ kind: 'prime-factor-seal', factor, remaining }}
            >
              <mesh rotation={[0, 0, Math.PI / 4]}>
                <boxGeometry args={[0.31, 0.31, 0.025]} />
                <meshBasicMaterial
                  color={remaining ? '#10272d' : '#192126'}
                  transparent
                  opacity={remaining ? 0.9 : 0.58}
                  toneMapped={false}
                />
              </mesh>
              <mesh position={[0, 0, 0.018]} rotation={[0, 0, Math.PI / 4]}>
                <ringGeometry args={[0.19, 0.218, 4]} />
                <meshBasicMaterial
                  color={color}
                  transparent
                  opacity={remaining ? 0.96 : 0.34}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                />
              </mesh>
              <group position={[0, 0, 0.04]}>
                <Digit value={factor} color={color} scale={0.2} />
              </group>
              {remaining && !lowDetail ? (
                <mesh position={[0, 0, -0.012]}>
                  <circleGeometry args={[0.27, 20]} />
                  <meshBasicMaterial
                    color={factorColor}
                    transparent
                    opacity={0.12}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </mesh>
              ) : null}
              {!remaining ? (
                <>
                  <mesh position={[0, 0, 0.072]} rotation={[0, 0, Math.PI / 4]}>
                    <boxGeometry args={[0.42, 0.035, 0.018]} />
                    <meshBasicMaterial color="#a35d54" transparent opacity={0.72} toneMapped={false} />
                  </mesh>
                  <mesh position={[0, 0, 0.073]} rotation={[0, 0, -Math.PI / 4]}>
                    <boxGeometry args={[0.42, 0.022, 0.018]} />
                    <meshBasicMaterial color="#704a48" transparent opacity={0.58} toneMapped={false} />
                  </mesh>
                </>
              ) : null}
            </group>
          )
        })}
      </group>
    </Billboard>
  )
}

function SentinelWreck({ id }: { id: SkylineSentinelId }): JSX.Element {
  const sentinel = SKYLINE_SENTINELS[id]
  return (
    <group name={`sentinel-wreck-${id}`} position={sentinel.position} rotation={[0.12, 0.5, 0.72]}>
      <mesh position={[0, -0.78, 0]} castShadow>
        <dodecahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial color="#1b2428" metalness={0.82} roughness={0.66} />
      </mesh>
      <mesh position={[0.42, -0.91, 0.2]} rotation={[0.3, 0.2, 1.1]}>
        <boxGeometry args={[0.48, 0.13, 0.22]} />
        <meshStandardMaterial color="#2b3031" metalness={0.76} roughness={0.72} />
      </mesh>
      <mesh position={[-0.24, -0.58, 0.24]}>
        <sphereGeometry args={[0.055, 7, 5]} />
        <meshBasicMaterial color={CORAL} transparent opacity={0.35} toneMapped={false} />
      </mesh>
    </group>
  )
}

function SentinelVisual({
  id,
  health,
  remainingFactors,
  reducedMotion,
  onApproach,
}: {
  id: SkylineSentinelId
  health: number
  remainingFactors: readonly SkylinePrimeCoreValue[]
  reducedMotion: boolean
  onApproach?: (id: SkylineSentinelId) => void
}): JSX.Element {
  const sentinel = SKYLINE_SENTINELS[id]
  const lowDetail = useContext(LowDetailContext)
  const hoverRef = useRef<THREE.Group>(null)
  const scannerRef = useRef<THREE.Group>(null)
  const wounded = health < 0.5
  const color = wounded ? '#ffb04d' : CORAL

  useFrame(({ clock }, delta) => {
    if (hoverRef.current) {
      hoverRef.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2 + sentinel.compositeNumber) * 0.1
    }
    if (scannerRef.current && !reducedMotion) scannerRef.current.rotation.y += delta * (wounded ? 2.1 : 0.68)
  })

  return (
    <group
      name={`sentinel-${id}`}
      position={sentinel.position}
      userData={{ kind: 'sentinel', id, compositeNumber: sentinel.compositeNumber }}
      onPointerOver={() => onApproach?.(id)}
      onClick={() => onApproach?.(id)}
    >
      <group ref={hoverRef}>
        <mesh castShadow>
          <dodecahedronGeometry args={[0.52, 0]} />
          <meshStandardMaterial color="#222d32" emissive={color} emissiveIntensity={wounded ? 0.28 : 0.12} metalness={0.86} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.45, 0.06]} castShadow>
          <boxGeometry args={[0.58, 0.3, 0.4]} />
          <meshStandardMaterial color="#31383a" metalness={0.91} roughness={0.27} />
        </mesh>
        <mesh position={[0, 0.48, 0.275]}>
          <boxGeometry args={[0.4, 0.075, 0.04]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.57, 0.05, 0]} rotation={[0, 0, side * 0.22]}>
            <mesh castShadow>
              <octahedronGeometry args={[0.25, 0]} />
              <meshStandardMaterial color="#3c4548" metalness={0.9} roughness={0.28} />
            </mesh>
            <mesh position={[side * 0.27, -0.2, 0]} rotation={[0, 0, side * 0.38]}>
              <boxGeometry args={[0.5, 0.13, 0.19]} />
              <meshStandardMaterial color="#252f32" metalness={0.86} roughness={0.36} />
            </mesh>
          </group>
        ))}
        <group ref={scannerRef} position={[0, -0.55, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.055, 6, 24]} />
            <meshStandardMaterial color="#1a252a" emissive={color} emissiveIntensity={1.9} metalness={0.84} roughness={0.22} />
          </mesh>
          {[0, Math.PI / 2].map((rotation) => (
            <mesh key={rotation} rotation={[0, rotation, 0]} position={[0, -0.15, 0]}>
              <coneGeometry args={[0.12, 0.38, 5]} />
              <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} />
            </mesh>
          ))}
        </group>
        <Billboard follow position={[0, 0.02, 0.49]}>
          <Digit value={sentinel.compositeNumber} color={color} scale={0.43} />
        </Billboard>
      </group>
      <HealthPips health={health} color={color} />
      <FactorSeals factors={sentinel.primeFactors} remainingFactors={remainingFactors} />
      <mesh position={[0, -1.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.48, 0.58, 30]} />
        <meshBasicMaterial color={color} transparent opacity={0.24} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {!lowDetail ? (
        <Sparkles count={wounded ? 8 : 4} scale={1.5} size={1.1} speed={reducedMotion ? 0 : 0.42} color={color} opacity={0.5} />
      ) : null}
    </group>
  )
}

function normalizedHealth(value: number | undefined): number {
  if (value === undefined) return 1
  return THREE.MathUtils.clamp(value > 1 ? value / 100 : value, 0, 1)
}

export interface CompositeSentinelsProps {
  readonly defeatedSentinels?: SentinelCollection
  readonly activeEnemyHealth?: SkylineEnemyHealth
  readonly remainingEnemyFactors?: SkylineEnemyFactors
  readonly reducedMotion?: boolean
  readonly onSentinelApproach?: (id: SkylineSentinelId) => void
}

export function CompositeSentinels({
  defeatedSentinels = [],
  activeEnemyHealth = {},
  remainingEnemyFactors = {},
  reducedMotion = false,
  onSentinelApproach,
}: CompositeSentinelsProps): JSX.Element {
  return (
    <group name="composite-sentinels">
      {SKYLINE_SENTINEL_IDS.map((id) => {
        const health = normalizedHealth(activeEnemyHealth[id])
        const defeated = collectionHas(defeatedSentinels, id) || health <= 0
        return defeated
          ? <SentinelWreck key={id} id={id} />
          : (
            <SentinelVisual
              key={id}
              id={id}
              health={health}
              remainingFactors={remainingEnemyFactors[id] ?? SKYLINE_SENTINELS[id].primeFactors}
              reducedMotion={reducedMotion}
              onApproach={onSentinelApproach}
            />
          )
      })}
    </group>
  )
}

export interface ApexBeaconProps {
  readonly active?: boolean
  readonly reducedMotion?: boolean
  readonly onApproach?: () => void
}

export function ApexBeacon({
  active = false,
  reducedMotion = false,
  onApproach,
}: ApexBeaconProps): JSX.Element {
  const lowDetail = useContext(LowDetailContext)
  const ringsRef = useRef<THREE.Group>(null)
  const beamRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }, delta) => {
    if (ringsRef.current && !reducedMotion) ringsRef.current.rotation.y += delta * (active ? 1.2 : 0.34)
    if (beamRef.current) {
      const scale = active && !reducedMotion ? 1 + Math.sin(clock.elapsedTime * 3.2) * 0.12 : 1
      beamRef.current.scale.x = scale
      beamRef.current.scale.z = scale
    }
  })

  return (
    <group
      name="apex-beacon"
      position={SKYLINE_LOCATIONS.apexBeacon}
      userData={{ kind: 'apex-beacon' }}
      onPointerOver={() => onApproach?.()}
      onClick={() => onApproach?.()}
    >
      <mesh position={[0, -1.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.98, 1.35, 8]} />
        <meshStandardMaterial color="#243940" emissive={CYAN} emissiveIntensity={active ? 0.28 : 0.06} metalness={0.86} roughness={0.32} />
      </mesh>
      <mesh position={[0, -0.67, 0]}>
        <cylinderGeometry args={[0.4, 0.56, 0.2, 12]} />
        <meshStandardMaterial color="#d9ffff" emissive={active ? CYAN : '#44696c'} emissiveIntensity={active ? 4.5 : 0.45} metalness={0.5} roughness={0.18} />
      </mesh>
      <group ref={ringsRef} position={[0, -0.46, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.82, 0.045, 6, 36]} />
          <meshBasicMaterial color={active ? CYAN : '#719295'} transparent opacity={active ? 0.88 : 0.28} toneMapped={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2.6, 0, 0]}>
          <torusGeometry args={[0.57, 0.025, 5, 28]} />
          <meshBasicMaterial color={active ? AMBER : '#58777a'} transparent opacity={active ? 0.68 : 0.2} toneMapped={false} />
        </mesh>
      </group>
      {active ? (
        <>
          <mesh ref={beamRef} position={[0, 28, 0]}>
            <cylinderGeometry args={[0.48, 1.4, 57, 18, 1, true]} />
            <meshBasicMaterial
              color={CYAN}
              transparent
              opacity={0.12}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
          <pointLight position={[0, 1.2, 0]} color={CYAN} intensity={12} distance={12} decay={2} />
          {!lowDetail ? (
            <Sparkles count={14} scale={[3, 8, 3]} position={[0, 3.5, 0]} size={1.8} speed={reducedMotion ? 0 : 0.35} color={CYAN} opacity={0.7} />
          ) : null}
        </>
      ) : null}
    </group>
  )
}

export function SkylineWorld({
  profile: suppliedProfile,
  quality: suppliedQuality,
  reducedMotion = false,
  collectedCores = [],
  defeatedSentinels = [],
  activeEnemyHealth = {},
  remainingEnemyFactors = {},
  activeAnchorId = null,
  activeNpcId = null,
  highlightedCore = null,
  beaconActive = false,
  onCoreApproach,
  onAnchorApproach,
  onNpcApproach,
  onSentinelApproach,
  onBeaconApproach,
}: SkylineWorldProps): JSX.Element {
  const { profile, quality } = resolveQuality(suppliedProfile, suppliedQuality)

  return (
    <LowDetailContext.Provider value={quality === 'low'}>
      <SkylineAtmosphere profile={profile} quality={quality} reducedMotion={reducedMotion} />
      <SkylineCity profile={profile} quality={quality} reducedMotion={reducedMotion} />
      <GrappleAnchors
        activeAnchorId={activeAnchorId}
        reducedMotion={reducedMotion}
        onAnchorApproach={onAnchorApproach}
      />
      <SkylineNpcs activeNpcId={activeNpcId} reducedMotion={reducedMotion} onNpcApproach={onNpcApproach} />
      <PrimeCores
        collectedCores={collectedCores}
        highlightedCore={highlightedCore}
        reducedMotion={reducedMotion}
        onCoreApproach={onCoreApproach}
      />
      <CompositeSentinels
        defeatedSentinels={defeatedSentinels}
        activeEnemyHealth={activeEnemyHealth}
        remainingEnemyFactors={remainingEnemyFactors}
        reducedMotion={reducedMotion}
        onSentinelApproach={onSentinelApproach}
      />
      <ApexBeacon active={beaconActive} reducedMotion={reducedMotion} onApproach={onBeaconApproach} />
    </LowDetailContext.Provider>
  )
}

export default SkylineWorld
