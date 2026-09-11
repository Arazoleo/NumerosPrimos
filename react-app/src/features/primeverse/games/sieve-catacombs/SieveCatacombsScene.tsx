import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import {
  CELL_SIZE,
  HIT_DAMAGE,
  INTERACTION_DISTANCE,
  advanceGameState,
  applyDamage,
  createInitialGameState,
  distance2D,
  toggleFlashlight,
  type CatacombsGameState,
  type EnemyState,
  type Position2D,
} from './gameLogic'
import {
  CATACOMBS_LEVEL_IDS,
  CATACOMBS_LEVELS,
  attemptCatacombsLevelExit,
  collectCurrentCatacombsSeal,
  createInitialCatacombsCampaign,
  getCurrentCatacombsLevel,
  isCurrentCatacombsExitUnlocked,
  type CatacombsCampaignState,
  type CatacombsEnemyArchetype,
  type CatacombsEventId,
  type CatacombsLevelId,
} from './campaignLogic'
import {
  createLevelEnemies,
  getCatacombsLevelWorld,
  type LevelNoise,
  levelDrainMultiplier,
  levelSectorForPosition,
  resolveLevelMovementAroundEnemies,
  stepLevelEnemy,
  type CatacombsLevelWorld,
  type LevelEnemyBlueprint,
  type LevelSealDefinition,
} from './levelWorld'
import {
  cabinetAt,
  countFragments,
  drawerPrompt,
  openNextDrawer,
  toolsInDrawers,
  type CabinetDefinition,
} from './cabinets'
import {
  CATACOMBS_HALLUCINATIONS,
  hallucinationFrame,
  selectHallucination,
  type Hallucination,
} from './hallucinations'
import {
  getElevatorPuzzle,
  isElevatorAnswerCorrect,
  visibleFragments,
} from './elevatorPuzzle'
import { varyWorldWithSeed } from './worldVariation'
import {
  COOP_STATE_INTERVAL_MS,
  coopEnemiesToLocal,
  decodeCoopAction,
  decodeCoopState,
  electCoopHost,
  encodeCoopAction,
  encodeCoopState,
} from './catacombsCoop'
import type {
  CatacombsCoopBridge,
  CatacombsControlRef,
  CatacombsElevatorState,
  CatacombsJumpscare,
  CatacombsSnapshot,
} from './types'
import { aimFlashlightFromCamera, flashlightPowerMultiplier } from './flashlightRig'

interface SieveCatacombsSceneProps {
  readonly active: boolean
  /** Shared by a lobby launch or rolled locally: same seed, same expedition. */
  readonly runSeed: number
  readonly coop: React.MutableRefObject<CatacombsCoopBridge>
  readonly reducedMotion: boolean
  readonly controls: CatacombsControlRef
  readonly onSnapshot: (snapshot: CatacombsSnapshot) => void
}

const EYE_HEIGHT = 1.66
const WALK_SPEED = 3.35
const RUN_SPEED = 5.45

interface ActiveScare {
  readonly id: CatacombsEventId
  readonly startedAt: number
  readonly until: number
  readonly apparition: Position2D | null
}

function DungeonGeometry({ world, reducedMotion }: {
  readonly world: CatacombsLevelWorld
  readonly reducedMotion: boolean
}): JSX.Element {
  const floors = useRef<THREE.InstancedMesh>(null)
  const ceilings = useRef<THREE.InstancedMesh>(null)
  const walls = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const transform = new THREE.Object3D()
    for (const [index, tile] of world.tiles.entries()) {
      transform.position.set(tile.x, -0.11, tile.z)
      transform.rotation.set(0, 0, 0)
      transform.scale.set(1, 1, 1)
      transform.updateMatrix()
      floors.current?.setMatrixAt(index, transform.matrix)
      transform.position.y = world.ceilingHeight
      transform.updateMatrix()
      ceilings.current?.setMatrixAt(index, transform.matrix)
    }
    for (const [index, wall] of world.walls.entries()) {
      transform.position.set(wall.x, world.ceilingHeight / 2, wall.z)
      transform.rotation.set(0, wall.rotation, 0)
      transform.updateMatrix()
      walls.current?.setMatrixAt(index, transform.matrix)
    }
    if (floors.current) floors.current.instanceMatrix.needsUpdate = true
    if (ceilings.current) ceilings.current.instanceMatrix.needsUpdate = true
    if (walls.current) walls.current.instanceMatrix.needsUpdate = true
  }, [world])

  const sigils = useMemo(() => world.walls.filter((_, index) => index % 11 === 3), [world])
  return (
    <group>
      <instancedMesh ref={floors} args={[undefined, undefined, world.tiles.length]} receiveShadow>
        <boxGeometry args={[CELL_SIZE - 0.06, 0.2, CELL_SIZE - 0.06]} />
        <meshStandardMaterial color={world.palette.floor} emissive={world.palette.floorEmissive} emissiveIntensity={0.16} roughness={0.92} metalness={world.theme === 'pools' ? 0.18 : 0.05} />
      </instancedMesh>
      <instancedMesh ref={ceilings} args={[undefined, undefined, world.tiles.length]}>
        <boxGeometry args={[CELL_SIZE, 0.18, CELL_SIZE]} />
        <meshStandardMaterial color={world.palette.ceiling} emissive={world.palette.ceilingEmissive} emissiveIntensity={0.08} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={walls} args={[undefined, undefined, world.walls.length]} castShadow={!reducedMotion} receiveShadow>
        <boxGeometry args={[CELL_SIZE + 0.08, world.ceilingHeight, 0.3]} />
        <meshStandardMaterial color={world.palette.wall} emissive={world.palette.wallEmissive} emissiveIntensity={0.14} roughness={0.96} metalness={0.04} />
      </instancedMesh>
      {sigils.map((sigil, index) => (
        <group key={sigil.id} position={[sigil.x, 2.1 + index % 3 * 0.28, sigil.z]} rotation={[0, sigil.rotation, 0]}>
          <mesh position={[0, 0, 0.165]}>
            <boxGeometry args={[0.5 + index % 4 * 0.13, 0.035, 0.018]} />
            <meshBasicMaterial color={world.palette.accent} transparent opacity={0.16} />
          </mesh>
          <mesh position={[0, -0.17, 0.166]} rotation={[0, 0, index % 2 ? 0.7 : -0.7]}>
            <boxGeometry args={[0.34, 0.025, 0.018]} />
            <meshBasicMaterial color={world.palette.accent} transparent opacity={0.12} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function StoneArch({ position, color = '#234f3b' }: {
  readonly position: readonly [number, number, number]
  readonly color?: string
}): JSX.Element {
  return (
    <group position={position as [number, number, number]}>
      {[-2.35, 2.35].map((x) => (
        <mesh key={x} position={[x, 2.05, 0]} castShadow>
          <boxGeometry args={[0.46, 4.1, 0.7]} />
          <meshStandardMaterial color="#07100d" emissive={color} emissiveIntensity={0.12} roughness={0.87} />
        </mesh>
      ))}
      <mesh position={[0, 4.02, 0]} castShadow>
        <boxGeometry args={[5.15, 0.5, 0.72]} />
        <meshStandardMaterial color="#07100d" emissive={color} emissiveIntensity={0.18} roughness={0.86} />
      </mesh>
      {[2, 3, 5, 7].map((prime, index) => (
        <mesh key={prime} position={[-1.45 + index * 0.95, 4.03, 0.38]}>
          <circleGeometry args={[0.095 + prime * 0.002, prime + 2]} />
          <meshBasicMaterial color="#8cefb0" transparent opacity={0.26} />
        </mesh>
      ))}
    </group>
  )
}

function OfficeArchitecture({ world }: { readonly world: CatacombsLevelWorld }): JSX.Element {
  const panels = useMemo(() => world.tiles.filter((_, index) => index % 3 === 1), [world])
  const dividers = useMemo(() => [
    [-31, 1.05, 8, 0], [-25, 1.05, 2, Math.PI / 2], [-17, 1.05, 14, Math.PI / 2],
    [17, 1.05, 6, Math.PI / 2], [25, 1.05, -4, 0], [31, 1.05, -12, Math.PI / 2],
    [-31, 1.05, -28, 0], [-21, 1.05, -44, Math.PI / 2], [19, 1.05, -32, 0],
    [29, 1.05, -48, Math.PI / 2],
  ] as const, [])
  return (
    <group>
      {panels.map((tile, index) => (
        <group key={tile.id} position={[tile.x, world.ceilingHeight - 0.13, tile.z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.1, 0.45]} />
            <meshBasicMaterial color={index % 11 === 0 ? '#806d34' : '#fff4b2'} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {dividers.map(([x, y, z, rotation], index) => (
        <group key={index} position={[x, y, z]} rotation={[0, rotation, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[5.2, 2.1, 0.13]} />
            <meshStandardMaterial color="#77704f" emissive="#342f18" emissiveIntensity={0.1} roughness={0.94} />
          </mesh>
          <mesh position={[0, 0.3, 0.08]}>
            <planeGeometry args={[1.5, 0.42]} />
            <meshBasicMaterial color="#2c2718" transparent opacity={0.66} />
          </mesh>
        </group>
      ))}
      {[-52, -36, -20, -4, 12].map((z, index) => (
        <group key={z} position={[0, 2.15, z]}>
          <mesh><boxGeometry args={[1.8, 0.62, 0.08]} /><meshStandardMaterial color="#302c1d" roughness={0.8} /></mesh>
          <mesh position={[0, 0, 0.05]}><planeGeometry args={[1.5, 0.36]} /><meshBasicMaterial color="#d9c66c" transparent opacity={0.28 + index * 0.03} /></mesh>
        </group>
      ))}
    </group>
  )
}

function PoolsArchitecture(): JSX.Element {
  const basins = [-44, -20, 8] as const
  return (
    <group>
      {basins.map((z, index) => (
        <group key={z}>
          <mesh position={[0, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[68, 15]} />
            <meshStandardMaterial color="#0b6870" emissive="#0b414a" emissiveIntensity={0.48} metalness={0.18} roughness={0.18} transparent opacity={0.78} />
          </mesh>
          {[-30, -18, 18, 30].map((x) => (
            <group key={x} position={[x, 1.9, z + (index % 2 ? 3 : -3)]}>
              <mesh castShadow><cylinderGeometry args={[0.52, 0.62, 3.8, 10]} /><meshStandardMaterial color="#17565c" emissive="#0a3238" emissiveIntensity={0.18} roughness={0.52} /></mesh>
              <mesh position={[0, 0.65, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.7, 0.055, 8, 24]} /><meshBasicMaterial color="#5fd7d4" transparent opacity={0.28} /></mesh>
            </group>
          ))}
        </group>
      ))}
      {[-50, -26, -2].map((z, index) => (
        <group key={z} position={[index % 2 ? 6.4 : -6.4, 1.05, z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 2.4, 8]} /><meshStandardMaterial color="#42777a" metalness={0.68} roughness={0.28} /></mesh>
          <mesh position={[0, 0.4, 0.16]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.38, 0.07, 8, 18]} /><meshBasicMaterial color="#85eee4" /></mesh>
        </group>
      ))}
    </group>
  )
}

function HotelArchitecture(): JSX.Element {
  const doors = useMemo(() => [
    [-3.82, 14, Math.PI / 2, 5], [3.82, 10, -Math.PI / 2, 7],
    [-3.82, -2, Math.PI / 2, 11], [3.82, -6, -Math.PI / 2, 13],
    [-3.82, -22, Math.PI / 2, 17], [3.82, -26, -Math.PI / 2, 19],
    [-3.82, -42, Math.PI / 2, 23], [3.82, -46, -Math.PI / 2, 25],
  ] as const, [])
  return (
    <group>
      <mesh position={[0, 0.02, -16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.4, 88]} />
        <meshStandardMaterial color="#521726" emissive="#3c0c18" emissiveIntensity={0.32} roughness={0.88} />
      </mesh>
      {doors.map(([x, z, rotation, number]) => (
        <group key={number} position={[x, 1.55, z]} rotation={[0, rotation, 0]}>
          <mesh castShadow><boxGeometry args={[1.85, 3.05, 0.16]} /><meshStandardMaterial color="#271417" emissive="#3a1119" emissiveIntensity={0.16} roughness={0.74} /></mesh>
          <mesh position={[0.53, 0, 0.11]}><sphereGeometry args={[0.07, 8, 6]} /><meshStandardMaterial color="#b68b52" metalness={0.8} roughness={0.2} /></mesh>
          <mesh position={[0, 0.7, 0.11]}><circleGeometry args={[0.18, number === 23 ? 23 : 10]} /><meshBasicMaterial color={number === 23 ? '#ffd09b' : '#805447'} /></mesh>
        </group>
      ))}
      <group position={[-8, 0, 25]}>
        <mesh position={[0, 0.72, 0]} castShadow><boxGeometry args={[7, 1.44, 1.5]} /><meshStandardMaterial color="#251317" emissive="#3a131b" emissiveIntensity={0.12} roughness={0.62} /></mesh>
        <mesh position={[2.1, 1.55, 0]}><boxGeometry args={[0.5, 0.22, 0.45]} /><meshStandardMaterial color="#10090b" /></mesh>
      </group>
      {[-54, -34, -14, 6].map((z) => (
        <group key={z} position={[0, 2.8, z]}>
          <mesh><sphereGeometry args={[0.14, 8, 6]} /><meshBasicMaterial color="#f1ad74" /></mesh>
          <pointLight color="#df8059" intensity={1.7} distance={7} decay={2} />
        </group>
      ))}
    </group>
  )
}

function SectorArchitecture({ world }: { readonly world: CatacombsLevelWorld }): JSX.Element {
  if (world.theme === 'offices') return <OfficeArchitecture world={world} />
  if (world.theme === 'pools') return <PoolsArchitecture />
  if (world.theme === 'hotel') return <HotelArchitecture />
  if (world.theme === 'servers') return <ServerArchitecture />
  if (world.theme === 'cold') return <ColdVaultArchitecture />
  return <CryptArchitecture />
}

function CryptArchitecture(): JSX.Element {
  const tombs = useMemo(() => Array.from({ length: 18 }, (_, index) => ({
    x: -33 + index % 6 * 3.6,
    z: -5.8 + Math.floor(index / 6) * 6.8,
    height: 0.8 + index % 4 * 0.18,
    tilt: (index % 3 - 1) * 0.08,
  })), [])
  const shelves = useMemo(() => Array.from({ length: 12 }, (_, index) => ({
    x: 15 + index % 4 * 6,
    z: -21 + Math.floor(index / 4) * 12,
  })), [])
  return (
    <group>
      <StoneArch position={[0, 0, 13]} />
      <StoneArch position={[-14, 0, 2]} color="#425441" />
      <StoneArch position={[14, 0, -6]} color="#3f603f" />
      <StoneArch position={[-14, 0, -34]} color="#335f58" />
      <StoneArch position={[14, 0, -42]} color="#6a4d45" />

      {tombs.map((tomb, index) => (
        <group key={index} position={[tomb.x, 0, tomb.z]} rotation={[0, tomb.tilt, tomb.tilt]}>
          <mesh position={[0, tomb.height / 2, 0]} castShadow>
            <boxGeometry args={[0.72, tomb.height, 0.24]} />
            <meshStandardMaterial color="#0c1512" emissive="#173729" emissiveIntensity={0.08} roughness={0.92} />
          </mesh>
          <mesh position={[0, tomb.height + 0.12, 0]}>
            <sphereGeometry args={[0.36, 8, 5]} />
            <meshStandardMaterial color="#0b1411" roughness={1} />
          </mesh>
        </group>
      ))}

      {shelves.map((shelf, index) => (
        <group key={index} position={[shelf.x, 0, shelf.z]}>
          <mesh position={[0, 1.45, 0]} castShadow>
            <boxGeometry args={[0.48, 2.9, 3.1]} />
            <meshStandardMaterial color="#09100e" emissive="#1b3528" emissiveIntensity={0.1} roughness={0.8} />
          </mesh>
          {[0.55, 1.25, 1.95, 2.65].map((height, row) => (
            <mesh key={height} position={[0.255, height, 0]}>
              <boxGeometry args={[0.05, 0.05, 2.75]} />
              <meshBasicMaterial color={row % 2 ? '#476756' : '#72523d'} transparent opacity={0.48} />
            </mesh>
          ))}
        </group>
      ))}

      <mesh position={[-24, 0.012, -39.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7.2, 36]} />
        <meshStandardMaterial color="#071913" emissive="#0b3b2b" emissiveIntensity={0.5} roughness={0.35} metalness={0.1} />
      </mesh>
      {[[-31, -31], [-17, -31], [-31, -49], [-17, -49]].map(([x, z], index) => (
        <group key={index} position={[x, 1.2, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.38, 0.5, 2.4, 10]} />
            <meshStandardMaterial color="#08130f" emissive="#185642" emissiveIntensity={0.12} roughness={0.76} />
          </mesh>
          <mesh position={[0, 1.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.44, 0.08, 8, 18]} />
            <meshBasicMaterial color="#68b994" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}

      {[16, 24, 32].flatMap((x) => [-52, -32].map((z) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh position={[0, 2.2, 0]} castShadow>
            <cylinderGeometry args={[0.5, 0.72, 4.4, 8]} />
            <meshStandardMaterial color="#0a0d0c" emissive="#4b2626" emissiveIntensity={0.1} roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.82, 0.07, 6, 24]} />
            <meshBasicMaterial color="#8d5a49" transparent opacity={0.25} />
          </mesh>
        </group>
      )))}
    </group>
  )
}

function Seal({ definition, collected, reducedMotion }: {
  readonly definition: LevelSealDefinition
  readonly collected: boolean
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!root.current || reducedMotion || collected) return
    root.current.rotation.y = clock.elapsedTime * 0.55 + definition.prime
    root.current.position.y = 1.25 + Math.sin(clock.elapsedTime * 1.3 + definition.prime) * 0.12
  })
  return (
    <group position={[definition.position.x, 0, definition.position.z]}>
      <mesh position={[0, 0.24, 0]} receiveShadow>
        <cylinderGeometry args={[0.72, 0.92, 0.48, definition.prime + 4]} />
        <meshStandardMaterial color="#07100d" emissive={collected ? '#274435' : '#132c21'} emissiveIntensity={0.25} roughness={0.82} />
      </mesh>
      <group ref={root} position={[0, 1.25, 0]} visible={!collected}>
        <mesh castShadow>
          <octahedronGeometry args={[0.48, 0]} />
          <meshStandardMaterial color="#caffdb" emissive="#41ff89" emissiveIntensity={2.4} metalness={0.36} roughness={0.18} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.73, 0.035, 8, 38]} />
          <meshBasicMaterial color="#72ffa6" transparent opacity={0.64} />
        </mesh>
        {Array.from({ length: definition.prime }, (_, index) => {
          const angle = index / definition.prime * Math.PI * 2
          return (
            <mesh key={index} position={[Math.cos(angle) * 0.9, Math.sin(angle * 2) * 0.08, Math.sin(angle) * 0.9]}>
              <sphereGeometry args={[0.055, 7, 5]} />
              <meshBasicMaterial color="#dcffe8" />
            </mesh>
          )
        })}
        <pointLight color="#70ffa5" intensity={4} distance={5.5} decay={2} />
      </group>
      {collected && (
        <mesh position={[0, 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.48, definition.prime + 8]} />
          <meshBasicMaterial color="#49705b" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  )
}

function SupplyCell({ position }: { readonly position: Position2D }): JSX.Element {
  const root = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (root.current) root.current.rotation.y = clock.elapsedTime * 0.7
  })
  return (
    <group ref={root} position={[position.x, 0.45, position.z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.62, 10]} />
        <meshStandardMaterial color="#a9ffd0" emissive="#28b86b" emissiveIntensity={1.4} metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.12, 0.12, 0.12, 8]} /><meshBasicMaterial color="#ddffeb" /></mesh>
      <pointLight color="#4dff9a" intensity={1.8} distance={2.6} />
    </group>
  )
}

function ExitDoor({ ready, world }: {
  readonly ready: boolean
  readonly world: CatacombsLevelWorld
}): JSX.Element {
  const rings = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (rings.current && ready) rings.current.rotation.z += delta * 0.4
  })
  return (
    <group
      position={[
        world.exit.x - Math.sin(world.exitRotation) * 1.65,
        0,
        world.exit.z - Math.cos(world.exitRotation) * 1.65,
      ]}
      rotation={[0, world.exitRotation, 0]}
    >
      <mesh position={[0, 2.25, 0]} castShadow>
        <boxGeometry args={[5.8, 4.5, 0.5]} />
        <meshStandardMaterial color="#040806" emissive={ready ? '#187044' : '#351416'} emissiveIntensity={ready ? 0.6 : 0.25} roughness={0.73} metalness={0.42} />
      </mesh>
      <group ref={rings} position={[0, 2.3, -0.29]}>
        <mesh><torusGeometry args={[1.25, 0.09, 8, 48]} /><meshBasicMaterial color={ready ? '#80ffad' : '#7d292d'} transparent opacity={0.8} /></mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}><torusGeometry args={[0.82, 0.035, 6, 36]} /><meshBasicMaterial color={ready ? '#d2ffe1' : '#3b2525'} /></mesh>
        {[world.seal.prime].map((prime, index) => {
          const angle = index / 1 * Math.PI * 2
          return <mesh key={prime} position={[Math.cos(angle) * 1.02, Math.sin(angle) * 1.02, -0.03]}><circleGeometry args={[0.12, prime + 3]} /><meshBasicMaterial color={ready ? '#d9ffe6' : '#402528'} /></mesh>
        })}
      </group>
      {ready && <pointLight position={[0, 2.3, -0.5]} color="#70ffa4" intensity={7} distance={8} />}
    </group>
  )
}

interface StalkerAppearance {
  readonly body: string
  readonly emissive: string
  readonly idleEye: string
  readonly activeEye: string
  readonly glow: string
  readonly eyes: number
  readonly scale: number
  /** Cipher glyphs orbiting the creature, one per archetype. */
  readonly glyphs: readonly string[]
}

const STALKER_APPEARANCE: Readonly<Record<CatacombsEnemyArchetype, StalkerAppearance>> = {
  'keylogger-wraith': {
    body: '#0d0c06', emissive: '#6b5f18', idleEye: '#ffe98a', activeEye: '#ff3b21',
    glow: '#e8d66d', eyes: 6, scale: 0.88, glyphs: ['0', '1', '0', '1', '1', '0'],
  },
  'hash-collider': {
    body: '#02090d', emissive: '#0b545f', idleEye: '#7cfff0', activeEye: '#ff4f6d',
    glow: '#4ee7e1', eyes: 4, scale: 0.95, glyphs: ['a', 'f', '3', 'c', '9', 'e'],
  },
  'man-in-the-middle': {
    body: '#0d0406', emissive: '#5c101f', idleEye: '#ffb27a', activeEye: '#ff1440',
    glow: '#dd694c', eyes: 2, scale: 1, glyphs: ['<', '>', '<', '>', '=', '='],
  },
  'factoring-warden': {
    body: '#010301', emissive: '#0a2413', idleEye: '#8dffb4', activeEye: '#ff1f3d',
    glow: '#66ff91', eyes: 7, scale: 1.08, glyphs: ['7', '×', '7', 'φ', 'n', 'd'],
  },
  'brute-forcer': {
    body: '#120604', emissive: '#6b1c0c', idleEye: '#ffa878', activeEye: '#ff2a12',
    glow: '#ff8f6a', eyes: 5, scale: 1.04, glyphs: ['0', '1', '2', '3', '4', '5'],
  },
  'cold-key-keeper': {
    body: '#05101a', emissive: '#12455f', idleEye: '#cfefff', activeEye: '#4fd4ff',
    glow: '#bfe6ff', eyes: 3, scale: 1.12, glyphs: ['❄', 'k', '❄', 'g', '^', 'a'],
  },
}

/**
 * Tall, thin, wrong-proportioned silhouettes: long arms, an elongated jawed head and
 * a ring of cipher glyphs. They twitch while hunting and open the jaw to strike.
 */
interface StalkerBodyProps {
  readonly appearance: StalkerAppearance
  readonly eyes: React.RefObject<THREE.MeshBasicMaterial>
  readonly head: React.RefObject<THREE.Group>
  readonly jaw: React.RefObject<THREE.Group>
}

function EyeCluster({
  appearance,
  eyes,
  size = 0.03,
  spread = 0.078,
  offset = 0.17,
}: {
  readonly appearance: StalkerAppearance
  readonly eyes: React.RefObject<THREE.MeshBasicMaterial>
  readonly size?: number
  readonly spread?: number
  readonly offset?: number
}): JSX.Element {
  const columns = Math.min(4, appearance.eyes)
  return (
    <>
      {Array.from({ length: appearance.eyes }, (_, index) => {
        const row = Math.floor(index / columns)
        const column = index % columns
        return (
          <mesh
            key={`eye-${index}`}
            position={[(column - (columns - 1) / 2) * spread, 0.11 - row * spread * 1.1, offset]}
          >
            <sphereGeometry args={[size, 8, 6]} />
            <meshBasicMaterial ref={index === 0 ? eyes : undefined} color={appearance.idleEye} toneMapped={false} />
          </mesh>
        )
      })}
    </>
  )
}

/** Escritórios: a stack of keycaps with a CRT head and coiled-cable arms. */
function KeyloggerBody({ appearance, eyes, head, jaw }: StalkerBodyProps): JSX.Element {
  return (
    <group>
      {[0, 1, 2, 3, 4].map((row) => (
        <mesh key={row} position={[0, 0.55 + row * 0.46, 0]} castShadow>
          <boxGeometry args={[0.62 - row * 0.045, 0.4, 0.42 - row * 0.03]} />
          <meshStandardMaterial
            color={appearance.body}
            emissive={appearance.emissive}
            emissiveIntensity={row % 2 ? 0.36 : 0.14}
            roughness={0.72}
          />
        </mesh>
      ))}
      {[-0.42, 0.42].map((x) => (
        <group key={x} position={[x, 2.35, 0]} rotation={[0, 0, x < 0 ? 0.3 : -0.3]}>
          {[0, 1, 2, 3, 4, 5].map((link) => (
            <mesh key={link} position={[0, -0.16 - link * 0.24, Math.sin(link * 1.7) * 0.05]} castShadow>
              <torusGeometry args={[0.055, 0.022, 5, 9]} />
              <meshStandardMaterial color="#0e0d07" emissive={appearance.emissive} emissiveIntensity={0.1} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={head} position={[0, 3.06, 0.04]}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.42, 0.4]} />
          <meshStandardMaterial color="#0b0a05" emissive={appearance.emissive} emissiveIntensity={0.2} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.205]}>
          <planeGeometry args={[0.42, 0.32]} />
          <meshBasicMaterial color="#050403" toneMapped={false} />
        </mesh>
        <EyeCluster appearance={appearance} eyes={eyes} size={0.026} spread={0.06} offset={0.215} />
        <group ref={jaw} position={[0, -0.16, 0.18]}>
          {[0, 1, 2, 3, 4, 5, 6].map((key) => (
            <mesh key={key} position={[-0.16 + key * 0.055, -0.05, 0]}>
              <boxGeometry args={[0.045, 0.05, 0.03]} />
              <meshBasicMaterial color={key % 2 ? appearance.idleEye : '#2b2410'} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

/** Piscinas: two drowned bodies fused out of alignment — the collision itself. */
function HashColliderBody({ appearance, eyes, head, jaw }: StalkerBodyProps): JSX.Element {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.16, 0, side * 0.06]} rotation={[0, side * 0.22, side * 0.05]}>
          <mesh position={[0, 1.55, 0]} castShadow>
            <capsuleGeometry args={[0.27, 1.5, 5, 10]} />
            <meshStandardMaterial
              color={appearance.body}
              emissive={appearance.emissive}
              emissiveIntensity={0.24}
              roughness={0.42}
              metalness={0.24}
              transparent
              opacity={0.93}
            />
          </mesh>
          <mesh position={[side * 0.34, 1.7, 0]} rotation={[0, 0, side * 0.5]} castShadow>
            <capsuleGeometry args={[0.06, 1.5, 4, 7]} />
            <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.12} roughness={0.6} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3, 4, 5].map((drip) => (
        <mesh key={drip} position={[(drip % 3 - 1) * 0.2, 0.2 + drip * 0.32, 0.22]}>
          <sphereGeometry args={[0.03, 6, 5]} />
          <meshBasicMaterial color={appearance.glow} transparent opacity={0.5} />
        </mesh>
      ))}
      <group ref={head} position={[0, 2.9, 0.02]}>
        {[-1, 1].map((half) => (
          <mesh key={half} position={[half * 0.11, half * 0.04, 0]} castShadow>
            <sphereGeometry args={[0.2, 10, 8, 0, Math.PI]} />
            <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.3} roughness={0.34} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <EyeCluster appearance={appearance} eyes={eyes} size={0.036} spread={0.09} offset={0.19} />
        <group ref={jaw} position={[0, -0.2, 0.06]}>
          <mesh>
            <coneGeometry args={[0.16, 0.3, 8, 1, true]} />
            <meshStandardMaterial color="#02181d" emissive={appearance.emissive} emissiveIntensity={0.2} side={THREE.DoubleSide} roughness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** Hotel: an impeccable bellhop whose face is a mirror pointed back at you. */
function ManInTheMiddleBody({ appearance, eyes, head, jaw }: StalkerBodyProps): JSX.Element {
  return (
    <group>
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[0.78, 1.7, 0.46]} />
        <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.24} roughness={0.66} />
      </mesh>
      {[0, 1, 2, 3, 4].map((button) => (
        <mesh key={button} position={[0, 1 + button * 0.3, 0.235]}>
          <cylinderGeometry args={[0.028, 0.028, 0.01, 8]} />
          <meshStandardMaterial color="#d8a15c" metalness={0.8} roughness={0.28} />
        </mesh>
      ))}
      {[-0.45, 0.45].map((x) => (
        <mesh key={x} position={[x, 1.55, 0.04]} rotation={[0, 0, x < 0 ? 0.08 : -0.08]} castShadow>
          <capsuleGeometry args={[0.085, 1.35, 4, 8]} />
          <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.1} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0.56, 0.72, 0.1]} castShadow>
        <boxGeometry args={[0.34, 0.42, 0.2]} />
        <meshStandardMaterial color="#241014" roughness={0.8} />
      </mesh>
      {[-0.19, 0.19].map((x) => (
        <mesh key={x} position={[x, 0.42, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.62, 4, 8]} />
          <meshStandardMaterial color="#0d0407" roughness={0.9} />
        </mesh>
      ))}
      <group ref={head} position={[0, 2.62, 0.02]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.21, 0.23, 0.46, 12]} />
          <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.18} roughness={0.62} />
        </mesh>
        <mesh position={[0, 0, 0.2]}>
          <circleGeometry args={[0.17, 20]} />
          <meshStandardMaterial color="#d7e4ea" metalness={1} roughness={0.06} />
        </mesh>
        <EyeCluster appearance={appearance} eyes={eyes} size={0.05} spread={0.14} offset={0.215} />
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.2, 0.24, 0.16, 12]} />
          <meshStandardMaterial color="#4f1721" emissive="#7a1e2e" emissiveIntensity={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.03, 12]} />
          <meshStandardMaterial color="#3c1119" roughness={0.6} />
        </mesh>
        <group ref={jaw} position={[0, -0.22, 0.12]}>
          <mesh>
            <boxGeometry args={[0.22, 0.1, 0.14]} />
            <meshStandardMaterial color="#12060a" roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

/** Cripta: a hunched slab of grave-stone crowned with seven eyes. */
function FactoringWardenBody({ appearance, eyes, head, jaw }: StalkerBodyProps): JSX.Element {
  return (
    <group>
      <mesh position={[0, 1.15, -0.1]} rotation={[0.22, 0, 0]} castShadow>
        <boxGeometry args={[1.15, 2.1, 0.72]} />
        <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.26} roughness={1} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((crack) => (
        <mesh key={crack} position={[-0.4 + crack * 0.16, 0.7 + (crack % 3) * 0.5, 0.37]} rotation={[0, 0, crack * 0.4]}>
          <boxGeometry args={[0.03, 0.42, 0.01]} />
          <meshBasicMaterial color={appearance.glow} transparent opacity={0.3} toneMapped={false} />
        </mesh>
      ))}
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, 1.25, 0.1]} rotation={[0.3, 0, x < 0 ? 0.25 : -0.25]} castShadow>
          <capsuleGeometry args={[0.12, 1.7, 4, 8]} />
          <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.14} roughness={1} />
        </mesh>
      ))}
      <group ref={head} position={[0, 2.5, 0.16]} rotation={[0.24, 0, 0]}>
        <mesh castShadow>
          <dodecahedronGeometry args={[0.3, 0]} />
          <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.22} roughness={0.98} flatShading />
        </mesh>
        <EyeCluster appearance={appearance} eyes={eyes} size={0.032} spread={0.08} offset={0.24} />
        {Array.from({ length: 7 }, (_, spike) => {
          const angle = spike / 7 * Math.PI * 2
          return (
            <mesh key={spike} position={[Math.cos(angle) * 0.3, 0.3, Math.sin(angle) * 0.3]} rotation={[0.2, -angle, 0]}>
              <coneGeometry args={[0.035, 0.28, 5]} />
              <meshStandardMaterial color="#0b1a10" emissive={appearance.glow} emissiveIntensity={0.16} roughness={0.9} />
            </mesh>
          )
        })}
        <group ref={jaw} position={[0, -0.24, 0.1]}>
          <mesh>
            <coneGeometry args={[0.2, 0.36, 6, 1, true]} />
            <meshStandardMaterial color="#050b06" emissive={appearance.emissive} emissiveIntensity={0.2} side={THREE.DoubleSide} roughness={1} />
          </mesh>
          {[-0.08, 0, 0.08].map((x) => (
            <mesh key={x} position={[x, -0.06, 0.1]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.02, 0.12, 4]} />
              <meshBasicMaterial color="#e9f3ea" toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

/** Servidores: low, wide and many-legged, with a scanner bar for a face. */
function BruteForcerBody({ appearance, eyes, head }: StalkerBodyProps): JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[1.5, 0.66, 1.05]} />
        <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.3} roughness={0.55} metalness={0.4} />
      </mesh>
      {[0, 1, 2, 3, 4].map((slot) => (
        <mesh key={slot} position={[-0.55 + slot * 0.28, 0.95, 0.53]}>
          <planeGeometry args={[0.2, 0.5]} />
          <meshBasicMaterial color={slot % 2 ? appearance.glow : '#2a0d08'} toneMapped={false} transparent opacity={0.7} />
        </mesh>
      ))}
      {[[-0.62, 0.42], [0.62, 0.42], [-0.62, -0.42], [0.62, -0.42], [-0.66, 0], [0.66, 0]].map(([x, z], leg) => (
        <group key={leg} position={[x, 0.95, z]} rotation={[0, 0, x < 0 ? 0.5 : -0.5]}>
          <mesh position={[x < 0 ? -0.18 : 0.18, -0.12, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.5, 4, 7]} />
            <meshStandardMaterial color="#160806" roughness={0.85} metalness={0.3} />
          </mesh>
          <mesh position={[x < 0 ? -0.32 : 0.32, -0.6, 0]} rotation={[0, 0, x < 0 ? -0.9 : 0.9]} castShadow>
            <capsuleGeometry args={[0.036, 0.66, 4, 7]} />
            <meshStandardMaterial color="#120605" roughness={0.9} metalness={0.25} />
          </mesh>
        </group>
      ))}
      <group ref={head} position={[0, 1.32, 0.34]} rotation={[0.2, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.24, 0.4]} />
          <meshStandardMaterial color="#1c0b08" emissive={appearance.emissive} emissiveIntensity={0.26} roughness={0.5} metalness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.21]}>
          <planeGeometry args={[0.72, 0.08]} />
          <meshBasicMaterial color={appearance.activeEye} toneMapped={false} transparent opacity={0.75} />
        </mesh>
        <EyeCluster appearance={appearance} eyes={eyes} size={0.024} spread={0.13} offset={0.215} />
      </group>
    </group>
  )
}

/** Cofre frio: a legless column of ice hung with the keys it confiscated. */
function ColdKeeperBody({ appearance, eyes, head, jaw }: StalkerBodyProps): JSX.Element {
  return (
    <group>
      <mesh position={[0, 1.6, 0]} castShadow>
        <coneGeometry args={[0.56, 3.1, 6]} />
        <meshStandardMaterial
          color={appearance.body}
          emissive={appearance.emissive}
          emissiveIntensity={0.34}
          roughness={0.16}
          metalness={0.28}
          transparent
          opacity={0.86}
          flatShading
        />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6].map((shard) => {
        const angle = shard / 7 * Math.PI * 2
        return (
          <mesh
            key={shard}
            position={[Math.cos(angle) * 0.42, 0.5 + (shard % 3) * 0.7, Math.sin(angle) * 0.42]}
            rotation={[shard * 0.3, angle, 0.4]}
          >
            <octahedronGeometry args={[0.11, 0]} />
            <meshStandardMaterial color={appearance.glow} transparent opacity={0.55} roughness={0.1} metalness={0.4} flatShading />
          </mesh>
        )
      })}
      {[-0.3, 0, 0.3].map((x, index) => (
        <group key={x} position={[x, 1.5 - index * 0.14, 0.48]}>
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.44, 5]} />
            <meshBasicMaterial color="#7fb6d8" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, -0.48, 0]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.07, 0.16, 0.02]} />
            <meshStandardMaterial color="#cfd8dd" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      ))}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 2.1, 0]} rotation={[0, 0, x < 0 ? 0.4 : -0.4]} castShadow>
          <capsuleGeometry args={[0.055, 1.25, 4, 7]} />
          <meshStandardMaterial color={appearance.body} emissive={appearance.emissive} emissiveIntensity={0.2} roughness={0.2} transparent opacity={0.9} />
        </mesh>
      ))}
      <group ref={head} position={[0, 3.25, 0.02]}>
        <mesh castShadow>
          <octahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial
            color={appearance.body}
            emissive={appearance.emissive}
            emissiveIntensity={0.4}
            roughness={0.08}
            metalness={0.35}
            transparent
            opacity={0.92}
            flatShading
          />
        </mesh>
        <EyeCluster appearance={appearance} eyes={eyes} size={0.038} spread={0.1} offset={0.2} />
        <group ref={jaw} position={[0, -0.2, 0.08]}>
          <mesh>
            <coneGeometry args={[0.14, 0.26, 5, 1, true]} />
            <meshStandardMaterial color="#07222e" emissive={appearance.glow} emissiveIntensity={0.2} side={THREE.DoubleSide} roughness={0.2} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function StalkerBody({
  archetype,
  ...props
}: StalkerBodyProps & { readonly archetype: CatacombsEnemyArchetype }): JSX.Element {
  if (archetype === 'keylogger-wraith') return <KeyloggerBody {...props} />
  if (archetype === 'hash-collider') return <HashColliderBody {...props} />
  if (archetype === 'man-in-the-middle') return <ManInTheMiddleBody {...props} />
  if (archetype === 'brute-forcer') return <BruteForcerBody {...props} />
  if (archetype === 'cold-key-keeper') return <ColdKeeperBody {...props} />
  return <FactoringWardenBody {...props} />
}

/**
 * Shared stalker rig: placement, hunting twitch, jaw and glyph ring. Each archetype
 * supplies its own body, so no two floors are stalked by the same silhouette.
 */
function Stalker({
  blueprint,
  enemies,
  reducedMotion,
}: {
  readonly blueprint: LevelEnemyBlueprint
  readonly enemies: React.MutableRefObject<readonly EnemyState[]>
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const frame = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const jaw = useRef<THREE.Group>(null)
  const glyphRing = useRef<THREE.Group>(null)
  const eyes = useRef<THREE.MeshBasicMaterial>(null)
  const glow = useRef<THREE.PointLight>(null)
  const camera = useThree((state) => state.camera)
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  const appearance = STALKER_APPEARANCE[blueprint.archetype]
  const seed = useMemo(() => blueprint.number * 0.618, [blueprint.number])

  useFrame(({ clock }, delta) => {
    const enemy = enemies.current.find((candidate) => candidate.id === blueprint.id)
    if (!enemy || !root.current) return
    const hunting = enemy.mode === 'chase' || enemy.mode === 'attack'
    const time = clock.elapsedTime
    targetPosition.set(enemy.x, reducedMotion ? 0 : Math.sin(time * 2.2 + enemy.x) * 0.05, enemy.z)
    root.current.position.lerp(targetPosition, 1 - Math.exp(-delta * 12))
    root.current.lookAt(camera.position.x, root.current.position.y + 1.9, camera.position.z)

    if (frame.current) {
      const twitch = hunting && !reducedMotion
        ? Math.sin(time * 27 + seed) * 0.055 + Math.sin(time * 63 + seed) * 0.02
        : Math.sin(time * 1.4 + seed) * 0.02
      frame.current.rotation.z = twitch
      frame.current.rotation.x = hunting && !reducedMotion ? -0.12 + Math.sin(time * 9 + seed) * 0.04 : -0.04
      const lunge = enemy.mode === 'attack' && !reducedMotion ? 1.06 + Math.sin(time * 18) * 0.04 : 1
      frame.current.scale.setScalar(appearance.scale * lunge)
    }
    if (head.current) {
      head.current.rotation.z = reducedMotion ? 0.1 : 0.1 + Math.sin(time * 3.1 + seed) * 0.12
      head.current.rotation.x = hunting ? -0.24 : -0.06
    }
    if (jaw.current) {
      const open = enemy.mode === 'attack' ? 0.85 : hunting ? 0.3 : 0.06
      jaw.current.rotation.x = THREE.MathUtils.lerp(jaw.current.rotation.x, open, 1 - Math.exp(-delta * 14))
    }
    if (glyphRing.current && !reducedMotion) {
      glyphRing.current.rotation.y += delta * (hunting ? 2.4 : 0.5)
    }
    if (eyes.current) {
      eyes.current.color.set(hunting ? appearance.activeEye : enemy.mode === 'stunned' ? '#f3fff6' : appearance.idleEye)
    }
    if (glow.current) glow.current.intensity = hunting ? 2.6 : 0.38
  })

  return (
    <group ref={root} position={[blueprint.spawn.x, 0, blueprint.spawn.z]}>
      <group ref={frame} scale={appearance.scale}>
        <StalkerBody
          archetype={blueprint.archetype}
          appearance={appearance}
          eyes={eyes}
          head={head}
          jaw={jaw}
        />
      </group>
      <group ref={glyphRing} position={[0, 2.1 * appearance.scale, 0]}>
        {appearance.glyphs.map((glyph, index) => {
          const angle = index / appearance.glyphs.length * Math.PI * 2
          return (
            <mesh
              key={`${glyph}-${index}`}
              position={[Math.cos(angle) * 0.86, Math.sin(angle * 2 + seed) * 0.32, Math.sin(angle) * 0.86]}
              rotation={[0, -angle, 0]}
            >
              <planeGeometry args={[0.09, 0.13]} />
              <meshBasicMaterial
                color={appearance.glow}
                transparent
                opacity={0.36}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          )
        })}
      </group>
      <pointLight ref={glow} position={[0, 3 * appearance.scale, 0.3]} color={appearance.glow} intensity={0.5} distance={3.2} />
    </group>
  )
}

function SearchableCabinet({
  cabinet,
  openedDrawers,
  accent,
  reducedMotion,
}: {
  readonly cabinet: CabinetDefinition
  readonly openedDrawers: readonly string[]
  readonly accent: string
  readonly reducedMotion: boolean
}): JSX.Element {
  const drawers = useRef<Array<THREE.Group | null>>([])
  const height = 0.62 * cabinet.drawers.length + 0.24

  useFrame((_, delta) => {
    for (const [index, drawer] of cabinet.drawers.entries()) {
      const group = drawers.current[index]
      if (!group) continue
      const target = openedDrawers.includes(drawer.id) ? 0.46 : 0
      group.position.z = reducedMotion
        ? target
        : THREE.MathUtils.damp(group.position.z, target, 6.4, delta)
    }
  })

  return (
    <group position={[cabinet.position.x, 0, cabinet.position.z]} rotation={[0, cabinet.rotation, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.24, height, 0.62]} />
        <meshStandardMaterial color="#20262a" metalness={0.72} roughness={0.46} />
      </mesh>
      {cabinet.drawers.map((drawer, index) => {
        const y = 0.42 + index * 0.62
        const opened = openedDrawers.includes(drawer.id)
        return (
          <group
            key={drawer.id}
            ref={(group) => { drawers.current[index] = group }}
            position={[0, y, 0]}
          >
            <mesh position={[0, 0, 0.32]} castShadow>
              <boxGeometry args={[1.1, 0.52, 0.08]} />
              <meshStandardMaterial
                color={opened ? '#161c20' : '#2b3439'}
                emissive={opened ? '#000000' : accent}
                emissiveIntensity={opened ? 0 : 0.06}
                metalness={0.78}
                roughness={0.38}
              />
            </mesh>
            {opened && (
              <mesh position={[0, -0.1, 0.06]} receiveShadow>
                <boxGeometry args={[1.02, 0.3, 0.54]} />
                <meshStandardMaterial color="#0b0f11" roughness={1} />
              </mesh>
            )}
            <mesh position={[0, 0.02, 0.38]}>
              <boxGeometry args={[0.42, 0.05, 0.05]} />
              <meshStandardMaterial color="#8f9ba0" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[0, height + 0.02, 0]}>
        <boxGeometry args={[1.3, 0.06, 0.68]} />
        <meshStandardMaterial color="#151b1e" metalness={0.6} roughness={0.6} />
      </mesh>
      <mesh position={[0, height - 0.16, 0.33]}>
        <planeGeometry args={[0.5, 0.1]} />
        <meshBasicMaterial color={accent} transparent opacity={0.34} toneMapped={false} />
      </mesh>
    </group>
  )
}

function ServerArchitecture(): JSX.Element {
  const racks = useMemo(() => Array.from({ length: 22 }, (_, index) => ({
    x: (index % 2 === 0 ? -1 : 1) * (14 + (index % 5) * 4.6),
    z: 12 - Math.floor(index / 2) * 5.4,
    height: 2.5 + (index % 3) * 0.22,
  })), [])
  return (
    <group>
      {racks.map((rack) => (
        <group key={`${rack.x}:${rack.z}`} position={[rack.x, 0, rack.z]}>
          <mesh position={[0, rack.height / 2, 0]} castShadow>
            <boxGeometry args={[1.1, rack.height, 2.2]} />
            <meshStandardMaterial color="#1b1113" metalness={0.68} roughness={0.42} />
          </mesh>
          {[0, 1, 2, 3, 4].map((slot) => (
            <mesh key={slot} position={[0.57, 0.5 + slot * 0.42, 0]}>
              <planeGeometry args={[0.02, 0.05]} />
              <meshBasicMaterial color={slot % 2 ? '#ff8f6a' : '#ffd0b8'} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function ColdVaultArchitecture(): JSX.Element {
  const shelves = useMemo(() => Array.from({ length: 16 }, (_, index) => ({
    x: (index % 2 === 0 ? -1 : 1) * (13 + (index % 4) * 5.2),
    z: 4 - Math.floor(index / 2) * 6.2,
  })), [])
  return (
    <group>
      {shelves.map((shelf) => (
        <group key={`${shelf.x}:${shelf.z}`} position={[shelf.x, 0, shelf.z]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[0.9, 2.2, 2.6]} />
            <meshStandardMaterial color="#12303c" metalness={0.5} roughness={0.34} />
          </mesh>
          {[0, 1, 2, 3].map((row) => (
            <mesh key={row} position={[0.47, 0.5 + row * 0.5, 0]}>
              <boxGeometry args={[0.04, 0.34, 2.3]} />
              <meshStandardMaterial color="#0d222b" emissive="#bfe6ff" emissiveIntensity={0.08} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

const GLOVE = '#221c18'
const SKIN = '#b08163'

/** One gloved finger: two phalanges wrapped around whatever the hand holds. */
function Finger({
  position,
  rotation,
  length = 0.052,
  curl = 0.9,
}: {
  readonly position: readonly [number, number, number]
  readonly rotation?: readonly [number, number, number]
  readonly length?: number
  readonly curl?: number
}): JSX.Element {
  return (
    <group position={position as [number, number, number]} rotation={(rotation ?? [0, 0, 0]) as [number, number, number]}>
      <mesh>
        <capsuleGeometry args={[0.0125, length, 3, 6]} />
        <meshStandardMaterial color={GLOVE} roughness={0.92} />
      </mesh>
      <group position={[0, -length / 2 - 0.012, 0]} rotation={[curl, 0, 0]}>
        <mesh position={[0, -length / 2.6, 0]}>
          <capsuleGeometry args={[0.0115, length * 0.72, 3, 6]} />
          <meshStandardMaterial color={SKIN} roughness={0.78} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * Both hands, seen down the barrel of the flashlight: the right one grips the
 * torch, the left one carries the Caesar disc once it has been found and lifts it
 * into view while the elevator keypad is open.
 */
function FirstPersonViewModel({
  controls,
  game,
  tools,
  elevatorOpen,
  reducedMotion,
}: {
  readonly controls: CatacombsControlRef
  readonly game: React.MutableRefObject<CatacombsGameState>
  readonly tools: React.MutableRefObject<readonly string[]>
  readonly elevatorOpen: React.MutableRefObject<boolean>
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Group>(null)
  const disc = useRef<THREE.Group>(null)
  const emitter = useRef<THREE.MeshStandardMaterial>(null)
  const camera = useThree((state) => state.camera)
  const offset = useMemo(() => new THREE.Vector3(), [])
  const previousYaw = useRef(0)
  const sway = useRef(0)

  useFrame(({ clock }, delta) => {
    if (!root.current) return
    const moving = controls.current.forward || controls.current.backward
      || controls.current.left || controls.current.right
    const sprinting = controls.current.sprint && moving
    const time = clock.elapsedTime
    const bob = moving && !reducedMotion ? Math.sin(time * (sprinting ? 11 : 7.4)) * (sprinting ? 0.026 : 0.016) : 0
    const roll = moving && !reducedMotion ? Math.cos(time * (sprinting ? 5.5 : 3.7)) * 0.02 : 0

    // Hands lag behind the look direction, then settle: the weight of the torch.
    const yawDelta = THREE.MathUtils.euclideanModulo(
      camera.rotation.y - previousYaw.current + Math.PI,
      Math.PI * 2,
    ) - Math.PI
    previousYaw.current = camera.rotation.y
    sway.current = reducedMotion
      ? 0
      : THREE.MathUtils.damp(sway.current, THREE.MathUtils.clamp(yawDelta * 2.6, -0.16, 0.16), 6, delta)

    offset.set(0, -0.06 + bob, -0.32)
    camera.localToWorld(offset)
    root.current.position.copy(offset)
    root.current.quaternion.copy(camera.quaternion)
    root.current.rotateY(sway.current)
    root.current.rotateZ(roll - sway.current * 0.35)

    const hurt = game.current.invulnerableUntil > performance.now() && !reducedMotion
      ? Math.sin(time * 42) * 0.012
      : 0
    if (rightArm.current) {
      rightArm.current.position.set(0.2, -0.17 + hurt, -0.02)
      rightArm.current.rotation.set(0.26 + bob * 0.6, -0.12, -0.16)
    }
    if (leftArm.current) {
      // The disc is raised in front of the face while reading the keypad.
      const reading = elevatorOpen.current && tools.current.length > 0
      const targetY = reading ? -0.12 : -0.28
      const targetZ = reading ? -0.16 : 0.02
      leftArm.current.position.x = -0.21
      leftArm.current.position.y = reducedMotion
        ? targetY
        : THREE.MathUtils.damp(leftArm.current.position.y, targetY + bob * 0.5, 7, delta)
      leftArm.current.position.z = reducedMotion
        ? targetZ
        : THREE.MathUtils.damp(leftArm.current.position.z, targetZ, 7, delta)
      leftArm.current.rotation.set(reading ? -0.35 : 0.42, 0.2, 0.22)
      leftArm.current.visible = tools.current.length > 0 || !reading
    }
    if (disc.current) {
      disc.current.visible = tools.current.length > 0
      if (!reducedMotion) disc.current.rotation.z += delta * 0.35
    }
    if (emitter.current) {
      const on = game.current.flashlightOn
      emitter.current.color.set(on ? '#e0ffea' : '#34423a')
      emitter.current.emissive.set(on ? '#a2ffc0' : '#050a07')
      emitter.current.emissiveIntensity = on ? 2.1 : 0.06
    }
  })

  return (
    <group ref={root}>
      <group ref={rightArm}>
        <mesh position={[0.03, -0.12, 0.16]} rotation={[0.32, 0, -0.08]}>
          <capsuleGeometry args={[0.045, 0.24, 4, 8]} />
          <meshStandardMaterial color="#1a1614" roughness={0.95} />
        </mesh>
        <mesh position={[0.02, -0.03, 0.055]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[0.088, 0.05, 0.115]} />
          <meshStandardMaterial color={GLOVE} roughness={0.9} />
        </mesh>
        {[0, 1, 2, 3].map((finger) => (
          <Finger
            key={finger}
            position={[-0.016 + finger * 0.024, 0.012, 0.012]}
            rotation={[-1.15, 0, 0]}
            length={0.05 - finger * 0.004}
            curl={0.95}
          />
        ))}
        <Finger position={[0.052, -0.022, 0.045]} rotation={[-0.5, 0, -1.1]} length={0.042} curl={0.7} />

        <mesh position={[0, 0.006, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.031, 0.2, 14]} />
          <meshStandardMaterial color="#232c28" metalness={0.68} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.006, -0.145]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.03, 0.06, 16]} />
          <meshStandardMaterial color="#2d3833" metalness={0.74} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.006, -0.176]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.046, 0.046, 0.012, 16]} />
          <meshStandardMaterial ref={emitter} color="#e0ffea" emissive="#a2ffc0" emissiveIntensity={2.1} />
        </mesh>
        <mesh position={[0.026, 0.03, -0.02]}>
          <boxGeometry args={[0.012, 0.012, 0.03]} />
          <meshStandardMaterial color="#7d1f28" emissive="#4a0d13" emissiveIntensity={0.4} roughness={0.6} />
        </mesh>
      </group>

      <group ref={leftArm}>
        <mesh position={[-0.02, -0.12, 0.17]} rotation={[0.36, 0, 0.1]}>
          <capsuleGeometry args={[0.043, 0.23, 4, 8]} />
          <meshStandardMaterial color="#1a1614" roughness={0.95} />
        </mesh>
        <mesh position={[0, -0.02, 0.055]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.086, 0.048, 0.11]} />
          <meshStandardMaterial color={GLOVE} roughness={0.9} />
        </mesh>
        {[0, 1, 2, 3].map((finger) => (
          <Finger
            key={finger}
            position={[-0.03 + finger * 0.024, 0.004, 0.006]}
            rotation={[-0.75, 0, 0]}
            length={0.05 - finger * 0.004}
            curl={0.55}
          />
        ))}
        <Finger position={[-0.056, -0.024, 0.04]} rotation={[-0.45, 0, 1.05]} length={0.042} curl={0.6} />
        <group ref={disc} position={[0, 0.028, 0.012]} rotation={[-0.9, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.062, 0.062, 0.006, 24]} />
            <meshStandardMaterial color="#cbb26a" roughness={0.82} />
          </mesh>
          <mesh position={[0, 0.004, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.005, 24]} />
            <meshStandardMaterial color="#efe0a8" roughness={0.7} emissive="#5a4a12" emissiveIntensity={0.25} />
          </mesh>
          {Array.from({ length: 12 }, (_, index) => {
            const angle = index / 12 * Math.PI * 2
            return (
              <mesh key={index} position={[Math.cos(angle) * 0.052, 0.005, Math.sin(angle) * 0.052]}>
                <boxGeometry args={[0.006, 0.002, 0.006]} />
                <meshBasicMaterial color="#3a2f0c" />
              </mesh>
            )
          })}
        </group>
      </group>
    </group>
  )
}

function AtmosphericParticles({ world, reducedMotion }: {
  readonly world: CatacombsLevelWorld
  readonly reducedMotion: boolean
}): JSX.Element {
  const points = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const values = new Float32Array(210 * 3)
    for (let index = 0; index < 210; index += 1) {
      const seed = (index * 9301 + 49297) % 233280
      values[index * 3] = -35 + (seed / 233280) * 70
      values[index * 3 + 1] = 0.4 + ((seed * 17) % 233280) / 233280 * world.ceilingHeight
      values[index * 3 + 2] = -64 + ((seed * 41) % 233280) / 233280 * 96
    }
    return values
  }, [world.ceilingHeight])
  useFrame((_, delta) => {
    if (points.current && !reducedMotion) points.current.rotation.y += delta * 0.004
  })
  return (
    <points ref={points}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color={world.palette.accent} size={world.theme === 'pools' ? 0.045 : 0.035} transparent opacity={world.theme === 'offices' ? 0.18 : 0.3} depthWrite={false} />
    </points>
  )
}

function FlickeringWorldLight({
  color,
  fear,
  index,
  intensity,
  position,
  scare,
  reducedMotion,
}: {
  readonly color: string
  readonly fear: React.MutableRefObject<number>
  readonly index: number
  readonly intensity: number
  readonly position: readonly [number, number, number]
  readonly scare: React.MutableRefObject<ActiveScare | null>
  readonly reducedMotion: boolean
}): JSX.Element {
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (!light.current) return
    const activeScare = scare.current
    const eventActive = activeScare !== null && activeScare.until > performance.now()
    const blackout = eventActive && (
      activeScare.id === 'fluorescent-blackout'
      || activeScare.id === 'water-level-shift'
      || activeScare.id === 'room-23-loop'
      || activeScare.id === 'warden-awakens'
    )
    const nervous = fear.current > 68 && !reducedMotion
    const wave = Math.sin(clock.elapsedTime * (17 + index * 2.7) + index * 4.1)
    const hardFlicker = wave > 0.38 ? 1 : 0.08
    const multiplier = blackout ? hardFlicker * 0.24 : nervous ? 0.86 + wave * 0.14 : 1
    light.current.intensity = intensity * multiplier
  })
  return <pointLight ref={light} position={position} color={color} intensity={intensity} distance={12} decay={2} />
}

function Hallucination({
  scare,
  reducedMotion,
}: {
  readonly scare: React.MutableRefObject<ActiveScare | null>
  readonly reducedMotion: boolean
}): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.MeshBasicMaterial>(null)
  const eyes = useRef<THREE.MeshBasicMaterial>(null)
  const camera = useThree((state) => state.camera)
  useFrame(({ clock }) => {
    if (!root.current || !body.current || !eyes.current) return
    const event = scare.current
    const nowMs = performance.now()
    const visible = Boolean(event?.apparition && event.until > nowMs)
    root.current.visible = visible
    if (!visible || !event?.apparition) return
    const duration = Math.max(1, event.until - event.startedAt)
    const progress = clamp01((nowMs - event.startedAt) / duration)
    const envelope = Math.sin(progress * Math.PI)
    const shimmer = reducedMotion ? 1 : 0.72 + Math.sin(clock.elapsedTime * 31) * 0.18
    root.current.position.set(
      event.apparition.x,
      reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2.1) * 0.045,
      event.apparition.z,
    )
    root.current.lookAt(camera.position.x, 1.4, camera.position.z)
    body.current.opacity = envelope * 0.84 * shimmer
    eyes.current.opacity = envelope * (0.5 + shimmer * 0.5)
  })
  return (
    <group ref={root} visible={false}>
      <mesh position={[0, 1.42, 0]}>
        <coneGeometry args={[0.78, 3.1, 7]} />
        <meshBasicMaterial ref={body} color="#000000" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, 2.85, 0]}>
        <sphereGeometry args={[0.38, 8, 6]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[0, 2.88, 0.34]}>
        <planeGeometry args={[0.28, 0.055]} />
        <meshBasicMaterial ref={eyes} color="#f4f0cf" transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function cloneCampaign(state: CatacombsCampaignState): CatacombsCampaignState {
  return {
    ...state,
    collectedPrimes: [...state.collectedPrimes],
    completedLevels: state.completedLevels.map((completed) => ({ ...completed })),
  }
}

function nearestEnemyToPlayer(
  enemies: readonly EnemyState[],
  player: Position2D,
): number {
  return enemies.reduce(
    (nearest, enemy) => Math.min(nearest, distance2D(enemy, player)),
    Number.POSITIVE_INFINITY,
  )
}

function isBlackoutEvent(id: CatacombsEventId): boolean {
  return id === 'fluorescent-blackout'
    || id === 'water-level-shift'
    || id === 'room-23-loop'
    || id === 'warden-awakens'
}

function interactionPromptFor(
  world: CatacombsLevelWorld,
  campaign: CatacombsCampaignState,
  game: CatacombsGameState,
  player: Position2D,
  openedDrawers: readonly string[] = [],
): string | null {
  if (game.phase !== 'playing') return null
  const cabinet = cabinetAt(world.cabinets, player)
  const cabinetHint = cabinet ? drawerPrompt(cabinet, openedDrawers) : null
  if (cabinetHint) return cabinetHint
  const supply = world.supplies.find((item) => (
    !game.collectedSupplies.includes(item.id)
    && distance2D(player, item.position) <= INTERACTION_DISTANCE
  ))
  if (supply) return 'E  RECOLHER CÉLULA'

  const sealCollected = campaign.collectedPrimes.includes(world.seal.prime)
  if (!sealCollected && distance2D(player, world.seal.position) <= INTERACTION_DISTANCE) {
    return 'E  PURIFICAR SELO ' + world.seal.prime
  }
  if (distance2D(player, world.exit) <= INTERACTION_DISTANCE + 0.6) {
    if (!sealCollected) return 'E  EXAMINAR ELEVADOR SELADO'
    return campaign.levelIndex === CATACOMBS_LEVELS.length - 1
      ? 'E  ESCAPAR DO NÍVEL 49'
      : 'E  DESCER AO PRÓXIMO NÍVEL'
  }
  return null
}

export default function SieveCatacombsScene({
  active,
  runSeed,
  coop,
  reducedMotion,
  controls,
  onSnapshot,
}: SieveCatacombsSceneProps): JSX.Element {
  // Each floor is varied with its own derived seed, so floors differ from each
  // other while the whole run stays reproducible from one number.
  const worldForLevel = useCallback(
    (level: number | CatacombsLevelId) => varyWorldWithSeed(
      getCatacombsLevelWorld(level),
      runSeed + (typeof level === 'number' ? level : CATACOMBS_LEVEL_IDS.indexOf(level)) * 7_919,
    ),
    [runSeed],
  )
  const { camera, gl } = useThree()
  const [levelIndex, setLevelIndex] = useState(0)
  const world = useMemo(() => worldForLevel(levelIndex), [levelIndex, worldForLevel])
  const levelDefinition = CATACOMBS_LEVELS[levelIndex] ?? CATACOMBS_LEVELS[0]
  const [, setVisualRevision] = useState(0)
  const initialWorld = useMemo(() => worldForLevel(0), [worldForLevel])
  const runtimeWorld = useRef<CatacombsLevelWorld>(initialWorld)
  const campaign = useRef<CatacombsCampaignState>(createInitialCatacombsCampaign(performance.now()))
  const player = useRef<Position2D>({ ...initialWorld.playerStart })
  const yaw = useRef(0)
  const pitch = useRef(-0.02)
  const game = useRef<CatacombsGameState>(createInitialGameState(performance.now()))
  const enemies = useRef<readonly EnemyState[]>(createLevelEnemies(initialWorld))
  const fear = useRef(0)
  const activeScare = useRef<ActiveScare | null>(null)
  const jumpscare = useRef<CatacombsJumpscare | null>(null)
  const lastJumpscareAt = useRef(0)
  const openedDrawers = useRef<readonly string[]>([])
  const carriedTools = useRef<readonly string[]>([])
  const solvedPuzzles = useRef<readonly string[]>([])
  const lastCoopSentAt = useRef(0)
  const appliedCoopSeq = useRef(-1)
  const coopAttackAt = useRef(new Map<string, number>())
  const lastNoise = useRef<LevelNoise | null>(null)
  const elevator = useRef<CatacombsElevatorState | null>(null)
  const hallucination = useRef<{ readonly vision: Hallucination; readonly startedAt: number } | null>(null)
  const seenVisions = useRef<readonly string[]>([])
  const sealTakenAt = useRef(0)
  /** Mirror of `elevator` for the view model, which only needs the open/closed bit. */
  const elevatorPanelOpen = useRef(false)
  const seenPuzzleSubmit = useRef(0)
  const seenPuzzleClose = useRef(0)
  const triggeredScares = useRef(new Set<CatacombsEventId>())
  const lastScareEndedAt = useRef(0)
  const levelTransitionUntil = useRef(0)
  const aiAccumulator = useRef(0)
  const keyboard = useRef({ forward: false, backward: false, left: false, right: false, sprint: false })
  const keyboardInteract = useRef(0)
  const keyboardFlashlight = useRef(0)
  const seenInteract = useRef(0)
  const seenFlashlight = useRef(0)
  const pointerLocked = useRef(false)
  const lastSnapshotAt = useRef(0)
  const flashlight = useRef<THREE.SpotLight>(null)
  const flashlightFill = useRef<THREE.PointLight>(null)
  const flashlightTarget = useRef<THREE.Object3D>(null)
  const forward = useMemo(() => new THREE.Vector3(), [])
  const flashlightPosition = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const previousExposure = gl.toneMappingExposure
    gl.toneMappingExposure = 1.14
    return () => { gl.toneMappingExposure = previousExposure }
  }, [gl])

  useEffect(() => {
    const firstWorld = worldForLevel(0)
    if (active) {
      const startedAt = performance.now()
      const initialCampaign = createInitialCatacombsCampaign(startedAt)
      campaign.current = initialCampaign
      runtimeWorld.current = firstWorld
      player.current = { ...firstWorld.playerStart }
      yaw.current = 0
      pitch.current = -0.02
      game.current = {
        ...createInitialGameState(startedAt),
        message: 'O elevador parou em um andar que não consta na planta.',
        messageUntil: startedAt + 6_000,
      }
      enemies.current = createLevelEnemies(firstWorld)
      fear.current = 4
      activeScare.current = null
      jumpscare.current = null
      lastJumpscareAt.current = 0
      openedDrawers.current = []
      hallucination.current = null
      seenVisions.current = []
      sealTakenAt.current = 0
      carriedTools.current = []
      solvedPuzzles.current = []
      lastNoise.current = null
      elevator.current = null
      seenPuzzleSubmit.current = controls.current.puzzleSubmitPulse
      seenPuzzleClose.current = controls.current.puzzleClosePulse
      triggeredScares.current = new Set()
      lastScareEndedAt.current = startedAt
      levelTransitionUntil.current = startedAt + 3_000
      aiAccumulator.current = 0
      lastSnapshotAt.current = 0
      seenInteract.current = keyboardInteract.current + controls.current.interactPulse
      seenFlashlight.current = keyboardFlashlight.current + controls.current.flashlightPulse
      setLevelIndex(0)
      setVisualRevision((current) => current + 1)
    }
    camera.position.set(firstWorld.playerStart.x, EYE_HEIGHT, firstWorld.playerStart.z)
    camera.rotation.order = 'YXZ'
    const canvas = gl.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0

    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase()
      if (key === 'w' || key === 'arrowup') keyboard.current.forward = pressed
      if (key === 's' || key === 'arrowdown') keyboard.current.backward = pressed
      if (key === 'a' || key === 'arrowleft') keyboard.current.left = pressed
      if (key === 'd' || key === 'arrowright') keyboard.current.right = pressed
      if (key === 'shift') keyboard.current.sprint = pressed
      if (pressed && !event.repeat && key === 'e') keyboardInteract.current += 1
      if (pressed && !event.repeat && key === 'f') keyboardFlashlight.current += 1
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'e', 'f'].includes(key)) {
        event.preventDefault()
      }
    }
    const keyDown = (event: KeyboardEvent) => setKey(event, true)
    const keyUp = (event: KeyboardEvent) => setKey(event, false)
    const moveLook = (movementX: number, movementY: number) => {
      if (!active || game.current.phase !== 'playing' || elevator.current !== null) return
      yaw.current -= movementX * 0.00235
      pitch.current = THREE.MathUtils.clamp(pitch.current - movementY * 0.002, -1.12, 1.05)
    }
    const mouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas) moveLook(event.movementX, event.movementY)
    }
    const pointerDown = (event: PointerEvent) => {
      if (!active || game.current.phase !== 'playing' || elevator.current !== null) return
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
      if (event.pointerType === 'mouse' && document.pointerLockElement !== canvas) void canvas.requestPointerLock?.()
    }
    const pointerMove = (event: PointerEvent) => {
      if (!dragging || document.pointerLockElement === canvas) return
      moveLook(event.clientX - lastX, event.clientY - lastY)
      lastX = event.clientX
      lastY = event.clientY
    }
    const pointerUp = () => { dragging = false }
    const lockChange = () => {
      pointerLocked.current = document.pointerLockElement === canvas
      lastSnapshotAt.current = 0
    }
    const blur = () => {
      keyboard.current = { forward: false, backward: false, left: false, right: false, sprint: false }
      dragging = false
    }

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('mousemove', mouseMove)
    window.addEventListener('blur', blur)
    document.addEventListener('pointerlockchange', lockChange)
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    window.addEventListener('pointerup', pointerUp)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('mousemove', mouseMove)
      window.removeEventListener('blur', blur)
      document.removeEventListener('pointerlockchange', lockChange)
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerup', pointerUp)
      if (document.pointerLockElement === canvas) document.exitPointerLock?.()
    }
  }, [active, camera, controls, gl, worldForLevel])

  /** Rides the elevator down: advances the campaign and rebuilds the next floor. */
  const descendElevator = (nowMs: number): boolean => {
    const result = attemptCatacombsLevelExit(campaign.current, nowMs)
    campaign.current = result.state
    if (result.status === 'level-advanced') {
      const nextWorld = worldForLevel(result.state.levelIndex)
      runtimeWorld.current = nextWorld
      player.current = { ...nextWorld.playerStart }
      yaw.current = 0
      pitch.current = -0.02
      enemies.current = createLevelEnemies(nextWorld, nextWorld.playerStart)
      triggeredScares.current = new Set()
      activeScare.current = null
      elevator.current = null
      openedDrawers.current = []
      lastNoise.current = null
      lastScareEndedAt.current = nowMs
      levelTransitionUntil.current = nowMs + 3_200
      aiAccumulator.current = 0
      fear.current = Math.max(8, fear.current - 22)
      game.current = {
        ...game.current,
        health: 100,
        battery: Math.min(100, game.current.battery + 22),
        invulnerableUntil: nowMs + 2_400,
        message: result.feedback,
        messageUntil: nowMs + 5_000,
      }
      setLevelIndex(result.state.levelIndex)
      setVisualRevision((current) => current + 1)
      return true
    }
    if (result.status === 'campaign-complete') {
      elevator.current = null
      game.current = {
        ...game.current,
        phase: 'won',
        flashlightOn: false,
        message: result.feedback,
        messageUntil: Number.POSITIVE_INFINITY,
      }
      setVisualRevision((current) => current + 1)
      return false
    }
    game.current = { ...game.current, message: result.feedback, messageUntil: nowMs + 3_000 }
    return false
  }

  /** In a party, my intent also goes to the run's host so the world stays one. */
  const sendCoopAction = (action: Parameters<typeof encodeCoopAction>[0]): void => {
    const bridge = coop.current
    if (!bridge.active || !bridge.client || bridge.peerIds.length === 0) return
    bridge.client.sendPartyAction(encodeCoopAction(action))
  }

  const isCoopGuestNow = (): boolean => {
    const bridge = coop.current
    if (!bridge.active || !bridge.playerId || bridge.peerIds.length === 0) return false
    return electCoopHost([bridge.playerId, ...bridge.peerIds]) !== bridge.playerId
  }

  const triggerJumpscare = (
    blueprint: LevelEnemyBlueprint,
    nowMs: number,
    lethal: boolean,
  ): void => {
    // Mini scare: a few frames of the creature filling the screen, never a stun-lock.
    const duration = reducedMotion ? 240 : lethal ? 900 : 520
    jumpscare.current = {
      id: `${blueprint.id}:${Math.round(nowMs)}`,
      enemyId: blueprint.id,
      name: blueprint.name,
      archetype: blueprint.archetype,
      startedAt: nowMs,
      until: nowMs + duration,
      lethal,
    }
    lastJumpscareAt.current = nowMs
    lastSnapshotAt.current = 0
  }

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(Math.max(rawDelta, 0), 0.05)
    const clockDelta = Math.min(Math.max(rawDelta, 0), 0.1)
    const nowMs = performance.now()
    const currentWorld = runtimeWorld.current
    const currentControls = controls.current
    const wantsForward = keyboard.current.forward || currentControls.forward
    const wantsBackward = keyboard.current.backward || currentControls.backward
    const wantsLeft = keyboard.current.left || currentControls.left
    const wantsRight = keyboard.current.right || currentControls.right
    const sprinting = keyboard.current.sprint || currentControls.sprint
    const moving = wantsForward || wantsBackward || wantsLeft || wantsRight

    if (jumpscare.current && jumpscare.current.until <= nowMs) {
      jumpscare.current = null
      lastSnapshotAt.current = 0
    }

    if (activeScare.current && activeScare.current.until <= nowMs) {
      lastScareEndedAt.current = activeScare.current.until
      activeScare.current = null
      lastSnapshotAt.current = 0
    }

    const flashlightPulse = keyboardFlashlight.current + currentControls.flashlightPulse
    if (active && flashlightPulse !== seenFlashlight.current) {
      seenFlashlight.current = flashlightPulse
      game.current = toggleFlashlight(game.current, nowMs)
      lastSnapshotAt.current = 0
    }

    let transitionedThisFrame = false
    if (active && game.current.phase === 'playing') {
      game.current = advanceGameState(
        game.current,
        clockDelta,
        nowMs,
        levelDrainMultiplier(currentWorld),
      )

      // Elevator keypad: the cipher is the only way past a floor.
      if (currentControls.puzzleClosePulse !== seenPuzzleClose.current) {
        seenPuzzleClose.current = currentControls.puzzleClosePulse
        elevator.current = null
        lastSnapshotAt.current = 0
      }
      if (currentControls.puzzleSubmitPulse !== seenPuzzleSubmit.current) {
        seenPuzzleSubmit.current = currentControls.puzzleSubmitPulse
        const panel = elevator.current
        if (panel && !panel.solved) {
          if (isElevatorAnswerCorrect(panel.puzzle, currentControls.puzzleAnswer)) {
            solvedPuzzles.current = [...solvedPuzzles.current, currentWorld.id]
            elevator.current = { ...panel, solved: true, feedback: panel.puzzle.solvedMessage }
            game.current = {
              ...game.current,
              message: panel.puzzle.solvedMessage,
              messageUntil: nowMs + 4_000,
            }
            if (isCoopGuestNow()) {
              // The host rides everyone down together on receiving this.
              sendCoopAction({ kind: 'solve-puzzle', levelId: currentWorld.id })
              elevator.current = null
            } else {
              sendCoopAction({ kind: 'solve-puzzle', levelId: currentWorld.id })
              transitionedThisFrame = descendElevator(nowMs) || transitionedThisFrame
            }
          } else {
            // A wrong code is loud: whatever walks this floor now knows where you are.
            elevator.current = {
              ...panel,
              attempts: panel.attempts + 1,
              feedback: panel.puzzle.wrongMessage,
            }
            lastNoise.current = { position: { ...player.current }, intensity: 0.85, atMs: nowMs }
            fear.current = Math.min(100, fear.current + 9)
          }
          lastSnapshotAt.current = 0
        }
      }
      const localX = Number(wantsRight) - Number(wantsLeft)
      const localZ = Number(wantsBackward) - Number(wantsForward)
      const length = Math.hypot(localX, localZ)
      if (length > 0 && elevator.current === null && hallucination.current === null) {
        const normalizedX = localX / length
        const normalizedZ = localZ / length
        const sin = Math.sin(yaw.current)
        const cos = Math.cos(yaw.current)
        const speed = sprinting ? RUN_SPEED : WALK_SPEED
        const proposed = {
          x: player.current.x + (normalizedX * cos + normalizedZ * sin) * speed * delta,
          z: player.current.z + (-normalizedX * sin + normalizedZ * cos) * speed * delta,
        }
        player.current = resolveLevelMovementAroundEnemies(
          currentWorld,
          player.current,
          proposed,
          enemies.current,
        )
      }

      const interactPulse = keyboardInteract.current + currentControls.interactPulse
      if (interactPulse !== seenInteract.current && elevator.current === null) {
        seenInteract.current = interactPulse
        const nearbySupply = currentWorld.supplies.find((supply) => (
          !game.current.collectedSupplies.includes(supply.id)
          && distance2D(player.current, supply.position) <= INTERACTION_DISTANCE
        ))
        const sealCollected = campaign.current.collectedPrimes.includes(currentWorld.seal.prime)
        const nearbyCabinet = cabinetAt(currentWorld.cabinets, player.current)

        if (nearbyCabinet && drawerPrompt(nearbyCabinet, openedDrawers.current)) {
          const result = openNextDrawer(nearbyCabinet, openedDrawers.current)
          openedDrawers.current = result.openedDrawers
          // Tools stay in your pocket for the rest of the run, unlike the drawers.
          carriedTools.current = Array.from(new Set([
            ...carriedTools.current,
            ...toolsInDrawers(currentWorld.cabinets, result.openedDrawers),
          ]))
          const battery = result.drawer?.content === 'battery' ? 26 : 0
          // A medkit buys back exactly one of the three hits.
          const healed = result.drawer?.content === 'medkit' ? HIT_DAMAGE : 0
          game.current = {
            ...game.current,
            health: Math.min(100, game.current.health + healed),
            battery: Math.min(100, game.current.battery + battery),
            message: result.message,
            messageUntil: nowMs + 4_200,
          }
          // Every drawer makes noise; a jammed one makes a lot.
          lastNoise.current = {
            position: { ...player.current },
            intensity: result.noise,
            atMs: nowMs,
          }
          fear.current = Math.min(100, fear.current + (result.drawer?.content === 'noise' ? 12 : 4))
          setVisualRevision((current) => current + 1)
        } else if (nearbySupply) {
          game.current = {
            ...game.current,
            battery: Math.min(100, game.current.battery + 34),
            collectedSupplies: [...game.current.collectedSupplies, nearbySupply.id],
            message: 'Célula de emergência: +34% de bateria.',
            messageUntil: nowMs + 2_600,
          }
          sendCoopAction({ kind: 'collect-supply', supplyId: nearbySupply.id })
          setVisualRevision((current) => current + 1)
        } else if (!sealCollected && distance2D(player.current, currentWorld.seal.position) <= INTERACTION_DISTANCE) {
          const result = collectCurrentCatacombsSeal(campaign.current, currentWorld.seal.prime)
          campaign.current = result.state
          game.current = {
            ...game.current,
            health: Math.min(100, game.current.health + HIT_DAMAGE),
            battery: Math.min(100, game.current.battery + 16),
            collectedPrimes: [...result.state.collectedPrimes],
            message: result.feedback,
            messageUntil: nowMs + 4_600,
          }
          fear.current = Math.max(0, fear.current - 14)
          sealTakenAt.current = nowMs
          sendCoopAction({ kind: 'collect-seal', prime: currentWorld.seal.prime })
          setVisualRevision((current) => current + 1)
        } else if (distance2D(player.current, currentWorld.exit) <= INTERACTION_DISTANCE + 0.6) {
          const puzzle = getElevatorPuzzle(currentWorld.id)
          const solvedHere = solvedPuzzles.current.includes(currentWorld.id)
          if (sealCollected && !solvedHere) {
            // The seal only unlocks the keypad; the cipher unlocks the floor.
            elevator.current = {
              puzzle,
              fragments: visibleFragments(puzzle, countFragments(currentWorld.cabinets, openedDrawers.current)),
              solved: false,
              attempts: 0,
              feedback: '',
            }
            if (document.pointerLockElement === gl.domElement) document.exitPointerLock?.()
            setVisualRevision((current) => current + 1)
          } else {
            transitionedThisFrame = descendElevator(nowMs) || transitionedThisFrame
          }
        } else {
          game.current = { ...game.current, message: 'Nada responde aqui.', messageUntil: nowMs + 1_500 }
        }
        lastSnapshotAt.current = 0
      }

      forward.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current))
      const coopBridge = coop.current
      const coopHostId = coopBridge.active && coopBridge.playerId && coopBridge.peerIds.length > 0
        ? electCoopHost([coopBridge.playerId, ...coopBridge.peerIds])
        : null
      const skipLocalAi = coopHostId !== null && coopHostId !== coopBridge.playerId
      if (!transitionedThisFrame) {
        aiAccumulator.current += clockDelta
        if (!skipLocalAi && aiAccumulator.current >= 1 / 12) {
          const aiDelta = Math.min(aiAccumulator.current, 0.1)
          aiAccumulator.current = 0
          let attackerId = ''
          let damage = 0
          const sealCollected = campaign.current.collectedPrimes.includes(currentWorld.seal.prime)
          enemies.current = enemies.current.map((enemy) => {
            const blueprint = currentWorld.enemies.find((candidate) => candidate.id === enemy.id)
            if (!blueprint) return enemy
            const toEnemyX = enemy.x - player.current.x
            const toEnemyZ = enemy.z - player.current.z
            const enemyDistance = Math.hypot(toEnemyX, toEnemyZ) || 1
            const horizontalDot = forward.x * toEnemyX / enemyDistance + forward.z * toEnemyZ / enemyDistance
            const aimDot = horizontalDot * Math.max(0, Math.cos(pitch.current))
            // In a party, each creature hunts whoever is closest — host or friend.
            const partyTargets = [player.current, ...coop.current.peerPositions]
            const quarry = partyTargets.reduce((closest, candidate) => (
              distance2D(enemy, candidate) < distance2D(enemy, closest) ? candidate : closest
            ))
            const quarryIsMe = quarry === player.current
            const result = stepLevelEnemy(enemy, blueprint, currentWorld, {
              noise: lastNoise.current,
              player: quarry,
              flashlightOn: game.current.flashlightOn,
              flashlightAimDot: aimDot,
              sprinting: Boolean(sprinting && moving),
              nowMs,
              deltaSeconds: aiDelta,
              fear: fear.current,
              sealCollected,
            })
            // A bite aimed at a friend lands on their client, not on mine.
            if (result.damage > damage && quarryIsMe) {
              damage = result.damage
              attackerId = blueprint.id
            }
            return result.enemy
          })
          const attacker = currentWorld.enemies.find((candidate) => candidate.id === attackerId)
          if (damage > 0) {
            const before = game.current
            game.current = applyDamage(before, damage, nowMs, attacker?.name ?? 'Uma presença')
            if (game.current.health < before.health) {
              fear.current = Math.min(100, fear.current + 22)
              if (attacker) triggerJumpscare(attacker, nowMs, game.current.phase === 'lost')
            }
            lastSnapshotAt.current = 0
          }

          // A creature closing in without landing a blow still gets one short scare.
          if (damage <= 0 && nowMs - lastJumpscareAt.current > 12_000) {
            const lunging = enemies.current.find((enemy) => (
              (enemy.mode === 'chase' || enemy.mode === 'attack')
              && distance2D(enemy, player.current) < 2.2
            ))
            const lungingBlueprint = lunging
              ? currentWorld.enemies.find((candidate) => candidate.id === lunging.id)
              : undefined
            if (lungingBlueprint) triggerJumpscare(lungingBlueprint, nowMs, false)
          }
        }

        // Hallucinations: quiet-moment cutscenes built from this floor's mathematics.
        if (hallucination.current) {
          const frame = hallucinationFrame(
            hallucination.current.vision,
            nowMs - hallucination.current.startedAt,
          )
          if (frame.finished) {
            hallucination.current = null
            lastSnapshotAt.current = 0
          }
        } else if (elevator.current === null && levelTransitionUntil.current < nowMs) {
          const vision = selectHallucination({
            levelId: currentWorld.id,
            levelElapsedMs: nowMs - campaign.current.levelStartedAtMs,
            player: player.current,
            fear: fear.current,
            sealJustTaken: nowMs - sealTakenAt.current < 900,
            seenIds: seenVisions.current,
            nearestEnemyDistance: nearestEnemyToPlayer(enemies.current, player.current),
          }, CATACOMBS_HALLUCINATIONS)
          if (vision) {
            hallucination.current = { vision, startedAt: nowMs }
            seenVisions.current = [...seenVisions.current, vision.id]
            fear.current = Math.min(100, fear.current + vision.severity * 10)
            lastSnapshotAt.current = 0
          }
        }

        // ---------------------------------------------------------------- co-op
        const bridge = coop.current
        const inParty = bridge.active && bridge.client && bridge.playerId && bridge.peerIds.length > 0
        const hostId = inParty ? electCoopHost([bridge.playerId as string, ...bridge.peerIds]) : null
        const isCoopHost = inParty && hostId === bridge.playerId
        const isCoopGuest = inParty && hostId !== bridge.playerId

        if (isCoopHost && bridge.client) {
          // Intents from the party become world facts on the host's simulation.
          for (const raw of bridge.client.consumePartyActions()) {
            const action = decodeCoopAction(raw.data)
            if (!action) continue
            if (action.kind === 'open-drawer') {
              const cabinet = currentWorld.cabinets.find((candidate) => candidate.id === action.cabinetId)
              if (cabinet) {
                const result = openNextDrawer(cabinet, openedDrawers.current)
                openedDrawers.current = result.openedDrawers
                lastNoise.current = { position: { ...cabinet.position }, intensity: result.noise, atMs: nowMs }
              }
            } else if (action.kind === 'collect-supply') {
              if (!game.current.collectedSupplies.includes(action.supplyId)) {
                game.current = {
                  ...game.current,
                  collectedSupplies: [...game.current.collectedSupplies, action.supplyId],
                }
              }
            } else if (action.kind === 'collect-seal') {
              const result = collectCurrentCatacombsSeal(campaign.current, action.prime as never)
              campaign.current = result.state
              if (result.status === 'seal-collected') {
                game.current = { ...game.current, collectedPrimes: [...result.state.collectedPrimes] }
                sealTakenAt.current = nowMs
              }
            } else if (action.kind === 'solve-puzzle') {
              if (!solvedPuzzles.current.includes(action.levelId)) {
                solvedPuzzles.current = [...solvedPuzzles.current, action.levelId]
                transitionedThisFrame = descendElevator(nowMs) || transitionedThisFrame
              }
            }
            lastSnapshotAt.current = 0
          }
          if (nowMs - lastCoopSentAt.current >= COOP_STATE_INTERVAL_MS) {
            lastCoopSentAt.current = nowMs
            bridge.client.sendPartyState(encodeCoopState({
              levelIndex: campaign.current.levelIndex,
              enemies: enemies.current.map((enemy) => ({
                id: enemy.id, x: enemy.x, z: enemy.z, mode: enemy.mode,
              })),
              openedDrawers: openedDrawers.current,
              collectedPrimes: [...campaign.current.collectedPrimes],
              collectedSupplies: [...game.current.collectedSupplies],
              solvedPuzzles: solvedPuzzles.current,
            }))
          }
        }

        if (isCoopGuest && bridge.partyState && bridge.partyState.fromId === hostId
          && bridge.partyState.seq !== appliedCoopSeq.current) {
          appliedCoopSeq.current = bridge.partyState.seq
          const shared = decodeCoopState(bridge.partyState.data)
          if (shared) {
            // The host's floor wins: falling behind a level means riding down now.
            if (shared.levelIndex > campaign.current.levelIndex) {
              solvedPuzzles.current = [...solvedPuzzles.current, currentWorld.id]
              transitionedThisFrame = descendElevator(nowMs) || transitionedThisFrame
            }
            enemies.current = coopEnemiesToLocal(shared.enemies, enemies.current)
            openedDrawers.current = shared.openedDrawers
            game.current = {
              ...game.current,
              collectedPrimes: [...shared.collectedPrimes],
              collectedSupplies: [...shared.collectedSupplies],
            }
            campaign.current = { ...campaign.current, collectedPrimes: [...shared.collectedPrimes] as never }
            lastSnapshotAt.current = 0
          }
        }

        if (isCoopGuest) {
          // Replicated creatures still bite: contact plus attack mode is a hit.
          for (const enemy of enemies.current) {
            if (enemy.mode !== 'attack') continue
            if (distance2D(enemy, player.current) > 1.6) continue
            const lastAt = coopAttackAt.current.get(enemy.id) ?? 0
            if (nowMs - lastAt < 1_800) continue
            coopAttackAt.current.set(enemy.id, nowMs)
            const before = game.current
            game.current = applyDamage(before, HIT_DAMAGE, nowMs, 'Uma presença compartilhada')
            if (game.current.health < before.health) {
              fear.current = Math.min(100, fear.current + 22)
              const blueprint = currentWorld.enemies.find((candidate) => candidate.id === enemy.id)
              if (blueprint) triggerJumpscare(blueprint, nowMs, game.current.phase === 'lost')
            }
          }
        }

        if (lastNoise.current && nowMs - lastNoise.current.atMs > 2_600) lastNoise.current = null

        const nearestEnemyDistance = nearestEnemyToPlayer(enemies.current, player.current)
        const chaseCount = enemies.current.filter((enemy) => enemy.mode === 'chase' || enemy.mode === 'attack').length
        const proximity = clamp01((15 - nearestEnemyDistance) / 13)
        const eventPressure = activeScare.current ? 4.2 : 0
        const lightPressure = game.current.flashlightOn ? -0.62 : 0.82
        const movementPressure = sprinting && moving ? 0.18 : 0
        fear.current = THREE.MathUtils.clamp(
          fear.current + (lightPressure + proximity * 5.4 + chaseCount * 1.4 + eventPressure + movementPressure) * clockDelta,
          0,
          100,
        )

        const levelElapsedMs = nowMs - campaign.current.levelStartedAtMs
        if (!activeScare.current && nowMs - lastScareEndedAt.current > 4_000) {
          const sealCollected = campaign.current.collectedPrimes.includes(currentWorld.seal.prime)
          const candidate = currentWorld.scares.find((scare) => (
            !triggeredScares.current.has(scare.id)
            && levelElapsedMs >= scare.minLevelElapsedMs
            && (!scare.requiresSeal || sealCollected)
            && distance2D(player.current, scare.position) <= scare.radius
            && (!isBlackoutEvent(scare.id) || (game.current.battery > 18 && nearestEnemyDistance > 7))
          ))
          if (candidate) {
            const duration = reducedMotion ? 1_700 : isBlackoutEvent(candidate.id) ? 2_650 : 2_250
            triggeredScares.current.add(candidate.id)
            activeScare.current = {
              id: candidate.id,
              startedAt: nowMs,
              until: nowMs + duration,
              apparition: candidate.apparition ? { ...candidate.apparition } : null,
            }
            game.current = {
              ...game.current,
              message: candidate.message,
              messageUntil: nowMs + duration + 1_200,
            }
            fear.current = Math.min(100, fear.current + 13)
            lastSnapshotAt.current = 0
          }
        }
      }

      if (game.current.phase !== 'playing' && document.pointerLockElement === gl.domElement) {
        document.exitPointerLock?.()
      }
    }

    elevatorPanelOpen.current = elevator.current !== null
    const scareActive = activeScare.current !== null && activeScare.current.until > nowMs
    const bob = active && moving && !reducedMotion && game.current.phase === 'playing'
      ? Math.sin(clock.elapsedTime * (sprinting ? 12 : 8)) * 0.025
      : 0
    const hurt = !reducedMotion && game.current.invulnerableUntil > nowMs
      ? Math.sin(clock.elapsedTime * 47) * 0.009
      : 0
    const jolt = !reducedMotion && jumpscare.current !== null && jumpscare.current.until > nowMs
      ? Math.sin(clock.elapsedTime * 71) * 0.028
      : 0
    // A vision takes the body, not the controls. The knees give a little, the head
    // hangs, and a fine shiver runs through it: exhaustion, not a cutscene camera.
    const vision = hallucination.current
    const visionFrame = vision ? hallucinationFrame(vision.vision, nowMs - vision.startedAt) : null
    const visionWeight = reducedMotion ? 0 : (visionFrame?.envelope ?? 0) * (vision?.vision.severity ?? 0)
    const visionTime = clock.elapsedTime
    /** Knees buckling: the eye line sinks and sways as if the legs were tired. */
    const visionSag = visionWeight * (0.34 + Math.sin(visionTime * 0.9) * 0.06)
    /** Fine tremor, fast and small, layered over the slow sway. */
    const visionShiver = visionWeight * (
      Math.sin(visionTime * 31) * 0.011 + Math.sin(visionTime * 47.3) * 0.006
    )
    const visionDrift = visionWeight * Math.sin(visionTime * 1.6) * 0.05
    const visionRoll = visionWeight * (0.06 + Math.sin(visionTime * 0.8) * 0.035)
    /** The head hangs forward as the vision takes hold. */
    const visionHang = visionWeight * 0.19
    const scareDrift = scareActive && !reducedMotion
      ? Math.sin(clock.elapsedTime * 17) * 0.0035
      : 0
    camera.position.set(
      player.current.x + hurt + jolt + visionShiver,
      EYE_HEIGHT + bob + scareDrift + jolt * 0.4 - visionSag - visionDrift,
      player.current.z + jolt * 0.6 + visionShiver * 0.6,
    )
    camera.rotation.set(
      pitch.current - visionHang + visionShiver * 0.35,
      yaw.current + visionShiver * 0.5,
      hurt * 0.22 + scareDrift + jolt * 0.5 + visionRoll,
      'YXZ',
    )

    if (flashlight.current && flashlightTarget.current) {
      aimFlashlightFromCamera(
        camera,
        flashlight.current,
        flashlightTarget.current,
        forward,
        flashlightPosition,
      )
      const beamOn = active && game.current.phase === 'playing' && game.current.flashlightOn
      const power = flashlightPowerMultiplier(game.current.battery, clock.elapsedTime, reducedMotion)
      const scarePulse = scareActive && !reducedMotion ? 0.96 + Math.sin(clock.elapsedTime * 19) * 0.04 : 1
      flashlight.current.visible = beamOn
      flashlight.current.intensity = levelDefinition.light.flashlightIntensity * power * scarePulse
      if (flashlightFill.current) {
        flashlightFill.current.position.copy(camera.position)
        flashlightFill.current.intensity = beamOn
          ? levelDefinition.light.flashlightFillIntensity * power
          : active ? 1.3 : 0
        flashlightFill.current.distance = beamOn ? 8.5 : 4.5
      }
    }

    if (nowMs - lastSnapshotAt.current >= 90) {
      lastSnapshotAt.current = nowMs
      const snapshotWorld = runtimeWorld.current
      const snapshotCampaign = campaign.current
      const snapshotLevel = getCurrentCatacombsLevel(snapshotCampaign)
      const sealCollected = snapshotCampaign.collectedPrimes.includes(snapshotWorld.seal.prime)
      const objectiveTarget = sealCollected ? snapshotWorld.exit : snapshotWorld.seal.position
      const dx = objectiveTarget.x - player.current.x
      const dz = objectiveTarget.z - player.current.z
      const worldBearing = Math.atan2(-dx, -dz)
      const relativeBearing = THREE.MathUtils.euclideanModulo(worldBearing - yaw.current + Math.PI, Math.PI * 2) - Math.PI
      onSnapshot({
        game: {
          ...game.current,
          collectedPrimes: [...game.current.collectedPrimes],
          collectedSupplies: [...game.current.collectedSupplies],
        },
        campaign: cloneCampaign(snapshotCampaign),
        level: snapshotLevel,
        playerPosition: { x: player.current.x, y: 0, z: player.current.z },
        playerYaw: yaw.current,
        enemies: enemies.current.map((enemy) => ({ ...enemy, lastKnown: { ...enemy.lastKnown } })),
        sector: levelSectorForPosition(snapshotWorld, player.current),
        interactionPrompt: interactionPromptFor(
          snapshotWorld,
          snapshotCampaign,
          game.current,
          player.current,
          openedDrawers.current,
        ),
        objectiveDistance: Math.hypot(dx, dz),
        objectiveBearing: relativeBearing,
        nearestEnemyDistance: nearestEnemyToPlayer(enemies.current, player.current),
        pointerLocked: pointerLocked.current,
        fear: fear.current,
        jumpscare: jumpscare.current,
        elevator: elevator.current,
        hallucination: hallucination.current
          ? {
            vision: hallucination.current.vision,
            frame: hallucinationFrame(hallucination.current.vision, nowMs - hallucination.current.startedAt),
          }
          : null,
        tools: carriedTools.current,
        cabinetPrompt: (() => {
          const cabinet = cabinetAt(snapshotWorld.cabinets, player.current)
          return cabinet ? drawerPrompt(cabinet, openedDrawers.current) : null
        })(),
        fragmentsFound: countFragments(snapshotWorld.cabinets, openedDrawers.current),
        fragmentsTotal: snapshotWorld.cabinets.reduce(
          (total, cabinet) => total + cabinet.drawers.filter((drawer) => drawer.content === 'fragment').length,
          0,
        ),
        activeEvent: activeScare.current?.id ?? null,
        activeEventUntil: activeScare.current?.until ?? 0,
        levelTransitionUntil: levelTransitionUntil.current,
        nowMs,
      })
    }
  })

  const collected = game.current.collectedPrimes
  const usedSupplies = game.current.collectedSupplies
  const exitReady = isCurrentCatacombsExitUnlocked(campaign.current)
  return (
    <>
      <color attach="background" args={[levelDefinition.light.background]} />
      <fog
        attach="fog"
        args={[
          levelDefinition.light.fog,
          levelDefinition.light.fogNear,
          levelDefinition.light.fogFar,
        ]}
      />
      <ambientLight color={world.palette.haze} intensity={levelDefinition.light.ambientIntensity} />
      <hemisphereLight
        color={world.palette.accent}
        groundColor={levelDefinition.light.background}
        intensity={levelDefinition.light.hemisphereIntensity}
      />
      {world.lights.map((light, index) => (
        <FlickeringWorldLight
          key={light.x + ':' + light.z}
          color={light.color}
          fear={fear}
          index={index}
          intensity={light.intensity}
          position={[light.x, light.height ?? world.ceilingHeight - 0.45, light.z]}
          scare={activeScare}
          reducedMotion={reducedMotion}
        />
      ))}

      <DungeonGeometry key={world.id} world={world} reducedMotion={reducedMotion} />
      <SectorArchitecture key={'architecture-' + world.id} world={world} />
      <Seal
        definition={world.seal}
        collected={collected.includes(world.seal.prime)}
        reducedMotion={reducedMotion}
      />
      {world.supplies
        .filter((supply) => !usedSupplies.includes(supply.id))
        .map((supply) => <SupplyCell key={supply.id} position={supply.position} />)}
      <ExitDoor ready={exitReady} world={world} />
      {world.cabinets.map((cabinet) => (
        <SearchableCabinet
          key={cabinet.id}
          cabinet={cabinet}
          openedDrawers={game.current.phase === 'playing' ? openedDrawers.current : []}
          accent={world.palette.accent}
          reducedMotion={reducedMotion}
        />
      ))}
      {world.enemies.map((blueprint) => (
        <Stalker
          key={blueprint.id}
          blueprint={blueprint}
          enemies={enemies}
          reducedMotion={reducedMotion}
        />
      ))}
      <AtmosphericParticles key={'particles-' + world.id} world={world} reducedMotion={reducedMotion} />
      <Hallucination scare={activeScare} reducedMotion={reducedMotion} />

      <spotLight
        ref={flashlight}
        color="#dcffe7"
        intensity={levelDefinition.light.flashlightIntensity}
        distance={32}
        angle={0.56}
        penumbra={0.86}
        decay={1.42}
        castShadow={!reducedMotion}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-near={0.25}
        shadow-camera-far={32}
        shadow-bias={-0.00035}
        shadow-normalBias={0.035}
      />
      <pointLight ref={flashlightFill} color="#b9ffd0" intensity={0} distance={4.5} decay={2} />
      <object3D ref={flashlightTarget} />
      <FirstPersonViewModel
        controls={controls}
        game={game}
        tools={carriedTools}
        elevatorOpen={elevatorPanelOpen}
        reducedMotion={reducedMotion}
      />
    </>
  )
}
