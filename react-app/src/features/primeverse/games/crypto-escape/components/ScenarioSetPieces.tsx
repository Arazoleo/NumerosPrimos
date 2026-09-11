import { Edges, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'

import type { QualityProfile } from '../../../graphics/useQualitySettings'
import type { EscapePhase } from '../types'

const FLOOR_Y = -2.02
const CYAN = '#5df4e6'
const BLUE = '#5fa8ff'
const VIOLET = '#957cff'
const AMBER = '#ffbd45'
const ROSE = '#ff6f91'

const BOOK_COLORS = ['#426f78', '#66598f', '#8b5a67', '#92773e', '#355b65'] as const
const TAPE_SYMBOLS = ['03', '05', '07', '11', '13', '17', '19', '23'] as const

export interface ScenarioSetPiecesProps {
  profile: QualityProfile
  reducedMotion: boolean
  phase: EscapePhase
}

interface DetailProps {
  detailed: boolean
  shadows: boolean
  illuminated: boolean
}

interface LevelMarkerProps {
  position: readonly [number, number, number]
  rotationY: number
  color: string
  eyebrow: string
  title: string
}

function LevelMarker({ position, rotationY, color, eyebrow, title }: LevelMarkerProps): JSX.Element {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, -0.018]}>
        <boxGeometry args={[2.75, 0.78, 0.055]} />
        <meshStandardMaterial color="#071118" metalness={0.76} roughness={0.36} />
        <Edges color={color} threshold={18} />
      </mesh>
      <Text position={[0, 0.17, 0.02]} fontSize={0.105} color={color} anchorX="center" letterSpacing={0.2}>
        {eyebrow}
      </Text>
      <Text position={[0, -0.13, 0.02]} fontSize={0.19} color="#ddecf0" anchorX="center" letterSpacing={0.08}>
        {title}
      </Text>
    </group>
  )
}

function ObservatoryOrrery({ detailed, shadows, illuminated }: DetailProps): JSX.Element {
  return (
    <group position={[-4.18, FLOOR_Y, 3.15]}>
      <mesh castShadow={shadows} position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.82, 1.02, 0.44, 10]} />
        <meshStandardMaterial color="#13252d" metalness={0.88} roughness={0.28} />
        <Edges color="#315762" threshold={22} />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <cylinderGeometry args={[0.64, 0.72, 0.1, 18]} />
        <meshStandardMaterial color="#0b151b" emissive={CYAN} emissiveIntensity={0.12} metalness={0.85} roughness={0.22} />
      </mesh>
      <group name="scenario-orrery" position={[0, 1.42, 0]}>
        <mesh castShadow={shadows}>
          <icosahedronGeometry args={[0.28, 1]} />
          <meshStandardMaterial color="#bdfef6" emissive={CYAN} emissiveIntensity={1.15} roughness={0.28} />
        </mesh>
        {[0, 1, 2].map((ring) => (
          <mesh
            key={ring}
            rotation={[
              ring === 0 ? Math.PI / 2 : Math.PI / 3,
              ring === 1 ? Math.PI / 3 : -Math.PI / 6,
              ring * 0.72,
            ]}
          >
            <torusGeometry args={[0.58 + ring * 0.25, 0.022, 6, detailed ? 36 : 22]} />
            <meshStandardMaterial
              color={ring === 1 ? BLUE : CYAN}
              emissive={ring === 1 ? BLUE : CYAN}
              emissiveIntensity={0.68 - ring * 0.12}
              metalness={0.55}
              roughness={0.24}
            />
          </mesh>
        ))}
        {detailed
          ? [
              [-0.72, 0.18, 0.32],
              [0.63, -0.42, -0.55],
              [0.18, 0.86, -0.38],
            ].map(([x, y, z], index) => (
              <mesh key={index} position={[x, y, z]}>
                <sphereGeometry args={[0.07 + index * 0.012, 8, 6]} />
                <meshBasicMaterial color={index === 1 ? BLUE : '#d9fff9'} />
              </mesh>
            ))
          : null}
      </group>
      {detailed && illuminated ? <pointLight position={[0, 1.5, 0]} color={CYAN} intensity={4.2} distance={3.2} /> : null}
      <Text position={[0, 0.63, 0.72]} rotation={[-0.48, 0, 0]} fontSize={0.1} color={CYAN} anchorX="center" letterSpacing={0.16}>
        MAPA DE ERATÓSTENES
      </Text>
    </group>
  )
}

function ArchiveWall({ detailed, shadows }: DetailProps): JSX.Element {
  const bookCount = detailed ? 14 : 8

  return (
    <group position={[4.72, FLOOR_Y, 8.6]}>
      <mesh castShadow={shadows} position={[0, 1.72, 0]}>
        <boxGeometry args={[0.48, 3.45, 2.7]} />
        <meshStandardMaterial color="#0c1a21" metalness={0.74} roughness={0.44} />
        <Edges color="#294954" threshold={20} />
      </mesh>
      {[0.35, 1.15, 1.95, 2.75, 3.38].map((y) => (
        <mesh key={y} position={[-0.31, y, 0]}>
          <boxGeometry args={[0.2, 0.08, 2.5]} />
          <meshStandardMaterial color="#35515a" metalness={0.85} roughness={0.32} />
        </mesh>
      ))}
      {Array.from({ length: bookCount }, (_, index) => {
        const shelf = index % 4
        const slot = Math.floor(index / 4)
        const z = -0.9 + slot * 0.48 + (shelf % 2) * 0.08
        const height = 0.38 + (index % 3) * 0.08
        return (
          <mesh key={index} castShadow={shadows} position={[-0.44, 0.42 + shelf * 0.8 + height / 2, z]}>
            <boxGeometry args={[0.18, height, 0.31]} />
            <meshStandardMaterial
              color={BOOK_COLORS[index % BOOK_COLORS.length]}
              emissive={index % 5 === 0 ? CYAN : '#000000'}
              emissiveIntensity={index % 5 === 0 ? 0.18 : 0}
              roughness={0.58}
              metalness={0.22}
            />
          </mesh>
        )
      })}
      <group position={[-0.49, 2.38, -0.53]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <boxGeometry args={[1.22, 0.48, 0.04]} />
          <meshBasicMaterial color="#061116" />
        </mesh>
        <Text position={[0, 0, 0.026]} fontSize={0.11} color={CYAN} anchorX="center" letterSpacing={0.13}>
          ARQUIVO 02—97
        </Text>
      </group>
    </group>
  )
}

function CipherGearWall({ detailed, shadows }: DetailProps): JSX.Element {
  const gears = detailed
    ? ([[-0.5, 1.15, 0.58], [0.62, 1.78, 0.42], [0.52, 0.68, 0.32]] as const)
    : ([[-0.38, 1.25, 0.55], [0.58, 1.62, 0.36]] as const)

  return (
    <group position={[4.82, -1.72, -4.8]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh castShadow={shadows} position={[0, 1.35, 0]}>
        <boxGeometry args={[2.65, 3.2, 0.28]} />
        <meshStandardMaterial color="#111827" metalness={0.82} roughness={0.34} />
        <Edges color="#3f5886" threshold={18} />
      </mesh>
      <group name="scenario-cipher-gears">
        {gears.map(([x, y, radius], index) => (
          <group key={index} position={[x, y, -0.2]}>
            <mesh castShadow={shadows}>
              <torusGeometry args={[radius, 0.105, 6, detailed ? 20 : 14]} />
              <meshStandardMaterial
                color={index === 1 ? '#534d83' : '#29455f'}
                emissive={index === 1 ? VIOLET : BLUE}
                emissiveIntensity={0.18}
                metalness={0.9}
                roughness={0.25}
              />
            </mesh>
            {[0, Math.PI / 2].map((rotation) => (
              <mesh key={rotation} rotation={[0, 0, rotation]}>
                <boxGeometry args={[radius * 1.55, 0.09, 0.12]} />
                <meshStandardMaterial color="#6b79a0" metalness={0.88} roughness={0.28} />
              </mesh>
            ))}
            <mesh>
              <cylinderGeometry args={[0.1, 0.1, 0.2, 8]} />
              <meshStandardMaterial color="#c7dbec" metalness={0.92} roughness={0.16} />
            </mesh>
          </group>
        ))}
      </group>
      <Text position={[0, 2.62, -0.19]} fontSize={0.12} color={BLUE} anchorX="center" letterSpacing={0.17}>
        DESLOCAMENTO / 03
      </Text>
      <mesh position={[0, 0.02, -0.19]}>
        <boxGeometry args={[1.95, 0.055, 0.04]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.75} />
      </mesh>
    </group>
  )
}

function PunchTapeBench({ detailed, shadows, illuminated }: DetailProps): JSX.Element {
  const symbols = detailed ? TAPE_SYMBOLS : TAPE_SYMBOLS.slice(0, 5)

  return (
    <group position={[-4.4, FLOOR_Y, -16.1]}>
      <mesh castShadow={shadows} position={[0, 1.02, 0]}>
        <boxGeometry args={[1.35, 0.18, 3.25]} />
        <meshStandardMaterial color="#172331" metalness={0.82} roughness={0.34} />
      </mesh>
      {[[-0.48, 0], [0.48, 0]].map(([x], index) => (
        <mesh key={index} castShadow={shadows} position={[x, 0.49, 0]}>
          <boxGeometry args={[0.14, 1.05, 2.85]} />
          <meshStandardMaterial color="#263847" metalness={0.86} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 1.18, 0]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[1.02, 0.035, 2.75]} />
        <meshStandardMaterial color="#d1b879" emissive={AMBER} emissiveIntensity={0.1} roughness={0.82} />
      </mesh>
      {symbols.map((symbol, index) => {
        const z = -1.14 + index * (2.28 / Math.max(1, symbols.length - 1))
        return (
          <group key={symbol} position={[-0.53, 1.24 + index * 0.006, z]} rotation={[-Math.PI / 2, 0, Math.PI / 2 - 0.08]}>
            <mesh>
              <circleGeometry args={[0.08, 8]} />
              <meshBasicMaterial color={index % 2 === 0 ? '#071016' : AMBER} />
            </mesh>
            <Text position={[0.25, 0, 0.015]} fontSize={0.11} color="#231e13" anchorX="center">
              {symbol}
            </Text>
          </group>
        )
      })}
      <group name="scenario-data-reels" position={[0, 1.78, -0.92]} rotation={[0, Math.PI / 2, 0]}>
        {[-0.42, 0.42].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <torusGeometry args={[0.28, 0.065, 6, detailed ? 20 : 14]} />
            <meshStandardMaterial color="#8d7442" emissive={AMBER} emissiveIntensity={0.22} metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>
      {detailed && illuminated ? <pointLight position={[0.5, 1.55, 0]} color={AMBER} intensity={2.6} distance={3.1} /> : null}
    </group>
  )
}

function SpectralPrismLab({ detailed, shadows, illuminated }: DetailProps): JSX.Element {
  return (
    <group position={[4.28, FLOOR_Y, -27.2]}>
      <mesh castShadow={shadows} position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.74, 0.95, 0.6, 8]} />
        <meshStandardMaterial color="#151e2d" metalness={0.86} roughness={0.3} />
        <Edges color="#554e7a" threshold={18} />
      </mesh>
      <group name="scenario-spectral-prism" position={[-0.08, 1.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow={shadows}>
          <cylinderGeometry args={[0.54, 0.54, 1.02, 3]} />
          <meshPhysicalMaterial
            color="#bfb3ff"
            emissive={VIOLET}
            emissiveIntensity={0.28}
            transparent
            opacity={0.56}
            transmission={detailed ? 0.42 : 0}
            roughness={0.14}
            metalness={0.1}
            depthWrite={false}
          />
        </mesh>
      </group>
      <Line points={[[-0.38, 1.36, 0], [-1.18, 1.36, 0]]} color={CYAN} lineWidth={1.4} transparent opacity={0.72} />
      <Line points={[[0.32, 1.36, 0], [1.05, 1.78, 0.16]]} color={ROSE} lineWidth={1.2} transparent opacity={0.58} />
      <Line points={[[0.32, 1.36, 0], [1.1, 1.23, -0.04]]} color={VIOLET} lineWidth={1.2} transparent opacity={0.62} />
      {detailed ? (
        <Line points={[[0.32, 1.36, 0], [1, 0.88, -0.16]]} color={BLUE} lineWidth={1.2} transparent opacity={0.56} />
      ) : null}
      {detailed && illuminated ? <pointLight position={[0, 1.4, 0]} color={VIOLET} intensity={4.5} distance={3.5} /> : null}
      <Text position={[0, 0.72, 0.58]} rotation={[-0.4, 0, 0]} fontSize={0.095} color={VIOLET} anchorX="center" letterSpacing={0.15}>
        ESPECTRO 2·3·5·7
      </Text>
    </group>
  )
}

function VaultCrystalRacks({ detailed, shadows, illuminated }: DetailProps): JSX.Element {
  const crystalCount = detailed ? 7 : 4

  return (
    <group position={[-4.55, FLOOR_Y, -38.2]}>
      <mesh castShadow={shadows} position={[0, 1.18, 0]}>
        <boxGeometry args={[1.15, 2.35, 3.05]} />
        <meshStandardMaterial color="#15121c" metalness={0.82} roughness={0.35} />
        <Edges color="#63394d" threshold={18} />
      </mesh>
      <group name="scenario-vault-crystals">
        {Array.from({ length: crystalCount }, (_, index) => {
          const column = index % 2
          const row = Math.floor(index / 2)
          const color = index % 2 === 0 ? ROSE : AMBER
          return (
            <group key={index} position={[0.68, 0.55 + row * 0.64, -0.72 + column * 1.42]} rotation={[0, 0, index % 2 === 0 ? -0.1 : 0.12]}>
              <mesh castShadow={shadows}>
                <coneGeometry args={[0.18, 0.52, 5]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.58} metalness={0.18} roughness={0.2} />
              </mesh>
              <mesh position={[0, -0.29, 0]}>
                <cylinderGeometry args={[0.21, 0.24, 0.12, 6]} />
                <meshStandardMaterial color="#39404b" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          )
        })}
      </group>
      {[0.38, 1.08, 1.78, 2.34].map((y) => (
        <mesh key={y} position={[0.61, y, 0]}>
          <boxGeometry args={[0.12, 0.06, 2.55]} />
          <meshBasicMaterial color={ROSE} transparent opacity={0.38} />
        </mesh>
      ))}
      {detailed && illuminated ? <pointLight position={[0.45, 1.5, 0]} color={ROSE} intensity={3.8} distance={3.4} /> : null}
      <Text position={[0.7, 2.65, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={0.11} color={ROSE} anchorX="center" letterSpacing={0.16}>
        CHAVES / QUARENTENA
      </Text>
    </group>
  )
}

/**
 * Low-poly environmental storytelling kept along the side walls so the central
 * navigation lane and every puzzle interaction remain unobstructed.
 */
function getActiveLevel(phase: EscapePhase): 1 | 2 | 3 {
  if (phase === 'intro' || phase === 'searching' || phase === 'prime-box') return 1
  if (phase === 'caesar-lock' || phase === 'modular-lock') return 2
  return 3
}

export function ScenarioSetPieces({ profile, reducedMotion, phase }: ScenarioSetPiecesProps): JSX.Element {
  const rootRef = useRef<Group>(null)
  const detailed = profile.particles >= 30
  const activeLevel = getActiveLevel(phase)

  useFrame(({ clock }, delta) => {
    if (reducedMotion || !rootRef.current) return

    const orrery = rootRef.current.getObjectByName('scenario-orrery')
    const gears = rootRef.current.getObjectByName('scenario-cipher-gears')
    const reels = rootRef.current.getObjectByName('scenario-data-reels')
    const prism = rootRef.current.getObjectByName('scenario-spectral-prism')
    const crystals = rootRef.current.getObjectByName('scenario-vault-crystals')

    if (orrery) orrery.rotation.y += delta * 0.16
    if (gears) {
      gears.children.forEach((gear, index) => {
        gear.rotation.z += delta * (index % 2 === 0 ? 0.24 : -0.3)
      })
    }
    if (reels) {
      reels.children.forEach((reel) => {
        reel.rotation.z += delta * 0.18
      })
    }
    if (prism) prism.rotation.x = Math.sin(clock.elapsedTime * 0.45) * 0.16
    if (crystals) crystals.position.y = Math.sin(clock.elapsedTime * 0.65) * 0.025
  })

  return (
    <group ref={rootRef} name="scenario-set-pieces">
      <ObservatoryOrrery detailed={detailed} shadows={profile.shadows} illuminated={activeLevel === 1} />
      <ArchiveWall detailed={detailed} shadows={profile.shadows} illuminated={activeLevel === 1} />

      <CipherGearWall detailed={detailed} shadows={profile.shadows} illuminated={activeLevel === 2} />
      <PunchTapeBench detailed={detailed} shadows={profile.shadows} illuminated={activeLevel === 2} />

      <SpectralPrismLab detailed={detailed} shadows={profile.shadows} illuminated={activeLevel === 3} />
      <VaultCrystalRacks detailed={detailed} shadows={profile.shadows} illuminated={activeLevel === 3} />

      <LevelMarker
        position={[-5.7, 3.08, 8.7]}
        rotationY={Math.PI / 2}
        color={CYAN}
        eyebrow="NÍVEL I"
        title="OBSERVATÓRIO / ARQUIVO"
      />
      <LevelMarker
        position={[5.7, 3.08, -11.1]}
        rotationY={-Math.PI / 2}
        color={BLUE}
        eyebrow="NÍVEL II"
        title="OFICINA DE CIFRAS"
      />
      <LevelMarker
        position={[-5.7, 3.08, -33.1]}
        rotationY={Math.PI / 2}
        color={ROSE}
        eyebrow="NÍVEL III"
        title="COFRE ESPECTRAL"
      />
    </group>
  )
}
