import { Sparkles, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { DoubleSide } from 'three'

import type { QualityProfile } from '../../../graphics/useQualitySettings'
import type { EscapePhase } from '../types'
import { ESCAPE_ZONE_Z_POSITIONS } from './layout'

export {
  CAESAR_POSITION,
  ESCAPE_ZONE_Z_POSITIONS,
  GATE_Z_POSITIONS,
  LENS_POSITION,
  MODULAR_POSITION,
  PRIME_BOX_POSITION,
  RSA_VAULT_POSITION,
  SPECTRAL_PLAQUE_POSITION,
} from './layout'

const FLOOR_Y = -2.18
const CEILING_Y = 4.25
const CYAN = '#5df4e6'
const VIOLET = '#957cff'
const AMBER = '#ffbd45'

export interface EscapeEnvironmentProps {
  profile: QualityProfile
  reducedMotion: boolean
  phase: EscapePhase
}

interface ZoneShellProps {
  index: number
  centerZ: number
  shadows: boolean
  illuminated: boolean
}

const ZONE_NAMES = ['ARQUIVO', 'CÂMARA DE CÉSAR', 'CÂMARA MODULAR', 'ANTECÂMARA', 'NÚCLEO RSA'] as const
const ZONE_ACCENTS = [CYAN, '#5fa8ff', VIOLET, AMBER, '#ff6f91'] as const

function ZoneShell({ index, centerZ, shadows, illuminated }: ZoneShellProps): JSX.Element {
  const accent = ZONE_ACCENTS[index]

  return (
    <group position={[0, 0, centerZ]}>
      <mesh receiveShadow={shadows} position={[0, FLOOR_Y, 0]}>
        <boxGeometry args={[11.8, 0.26, 10.55]} />
        <meshStandardMaterial color="#07121a" metalness={0.78} roughness={0.42} />
      </mesh>
      <mesh position={[0, CEILING_Y, 0]}>
        <boxGeometry args={[11.8, 0.22, 10.55]} />
        <meshStandardMaterial color="#050b12" metalness={0.7} roughness={0.55} />
      </mesh>

      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * 5.92, 1.02, 0]}>
          <mesh receiveShadow={shadows}>
            <boxGeometry args={[0.3, 6.18, 10.55]} />
            <meshStandardMaterial color="#08141d" metalness={0.74} roughness={0.48} />
          </mesh>
          {[3.9, 1.3, -1.3, -3.9].map((z) => (
            <mesh key={z} position={[-side * 0.18, 0, z]}>
              <boxGeometry args={[0.08, 5.45, 0.055]} />
              <meshBasicMaterial color={accent} transparent opacity={0.22} />
            </mesh>
          ))}
          <mesh position={[-side * 0.2, -2.57, 0]}>
            <boxGeometry args={[0.09, 0.055, 9.5]} />
            <meshBasicMaterial color={accent} transparent opacity={0.52} />
          </mesh>
        </group>
      ))}

      {[-4.75, -2.4, 0, 2.4, 4.75].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[-5.1, 1.02, 0]}>
            <boxGeometry args={[0.32, 6.35, 0.3]} />
            <meshStandardMaterial color="#172935" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[5.1, 1.02, 0]}>
            <boxGeometry args={[0.32, 6.35, 0.3]} />
            <meshStandardMaterial color="#172935" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[0, 4.02, 0]}>
            <boxGeometry args={[10.45, 0.3, 0.3]} />
            <meshStandardMaterial color="#132630" metalness={0.86} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {[[-3.25, -2.02], [0, -2.02], [3.25, -2.02]].map(([x, y]) => (
        <mesh key={x} position={[x, y, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.55, 9.55]} />
          <meshStandardMaterial
            color="#091821"
            emissive={accent}
            emissiveIntensity={0.055}
            metalness={0.82}
            roughness={0.4}
          />
        </mesh>
      ))}

      <Text
        position={[-5.68, 3.08, 1.25]}
        rotation={[0, Math.PI / 2, 0]}
        fontSize={0.22}
        color={accent}
        anchorX="center"
        letterSpacing={0.18}
      >
        {`0${index + 1} · ${ZONE_NAMES[index]}`}
      </Text>
      <pointLight
        visible={illuminated}
        position={[index % 2 === 0 ? -3.7 : 3.7, 2.7, 0]}
        color={accent}
        intensity={index === 3 ? 9 : 6}
        distance={8.5}
      />
    </group>
  )
}

function AirlockFrames({ shadows }: { shadows: boolean }): JSX.Element {
  return (
    <group>
      {[11.35, 0.5, -10.5, -21.5, -32.5, -43.35].map((z, index) => (
        <group key={z} position={[0, 0, z]}>
          <mesh castShadow={shadows} position={[-5.35, 0.95, 0]}>
            <boxGeometry args={[1.2, 6.5, 0.55]} />
            <meshStandardMaterial color="#172731" metalness={0.92} roughness={0.24} />
          </mesh>
          <mesh castShadow={shadows} position={[5.35, 0.95, 0]}>
            <boxGeometry args={[1.2, 6.5, 0.55]} />
            <meshStandardMaterial color="#172731" metalness={0.92} roughness={0.24} />
          </mesh>
          <mesh castShadow={shadows} position={[0, 3.82, 0]}>
            <boxGeometry args={[9.6, 0.75, 0.55]} />
            <meshStandardMaterial color="#172731" metalness={0.92} roughness={0.24} />
          </mesh>
          <mesh position={[0, 3.38, 0.29]}>
            <boxGeometry args={[8.25, 0.055, 0.055]} />
            <meshBasicMaterial
              color={index === 5 ? '#ff6f91' : index % 2 === 0 ? CYAN : VIOLET}
              transparent
              opacity={0.68}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Ventilation({ reducedMotion }: { reducedMotion: boolean }): JSX.Element {
  const fansRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (reducedMotion || !fansRef.current) return
    fansRef.current.children.forEach((fan, index) => {
      fan.rotation.z += delta * (index % 2 === 0 ? 0.45 : -0.38)
    })
  })

  return (
    <group ref={fansRef}>
      {ESCAPE_ZONE_Z_POSITIONS.map((z, index) => (
        <group key={z} position={[index % 2 === 0 ? 5.68 : -5.68, 2.65, z]} rotation={[0, index % 2 === 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <mesh>
            <torusGeometry args={[0.63, 0.065, 6, 32]} />
            <meshStandardMaterial color="#263c46" metalness={0.9} roughness={0.3} />
          </mesh>
          {[0, Math.PI / 2].map((rotation) => (
            <mesh key={rotation} rotation={[0, 0, rotation]}>
              <boxGeometry args={[1.05, 0.08, 0.06]} />
              <meshBasicMaterial color={ZONE_ACCENTS[index]} transparent opacity={0.55} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function ScanningBeam({ reducedMotion }: { reducedMotion: boolean }): JSX.Element {
  const beamRef = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (!beamRef.current) return
    beamRef.current.position.z = reducedMotion
      ? -21.5
      : -16 + Math.sin(clock.elapsedTime * 0.3) * 27
  })

  return (
    <mesh ref={beamRef} position={[0, 0.65, -16]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10.1, 0.035]} />
      <meshBasicMaterial color={CYAN} transparent opacity={0.14} depthWrite={false} side={DoubleSide} />
    </mesh>
  )
}

const ACTIVE_ZONE_BY_PHASE: Readonly<Record<EscapePhase, number>> = {
  intro: 0,
  searching: 0,
  'prime-box': 0,
  'caesar-lock': 1,
  'modular-lock': 2,
  'spectral-clue': 3,
  'rsa-vault': 4,
  escaped: 4,
}

export function EscapeEnvironment({ profile, reducedMotion, phase }: EscapeEnvironmentProps): JSX.Element {
  const activeZone = ACTIVE_ZONE_BY_PHASE[phase]

  return (
    <>
      <color attach="background" args={['#02060a']} />
      <fog attach="fog" args={['#02060a', 14, 48]} />
      <ambientLight color="#c9eef2" intensity={0.22} />
      {/* Sky/ground split gives the corridors volume instead of a flat wash. */}
      <hemisphereLight color="#8fdcff" groundColor="#04131a" intensity={0.42} />
      <directionalLight
        castShadow={profile.shadows}
        color="#d7fffb"
        intensity={1.15}
        position={[-4, 8, 7]}
        shadow-mapSize-width={profile.shadows ? 1024 : 512}
        shadow-mapSize-height={profile.shadows ? 1024 : 512}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={38}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      {ESCAPE_ZONE_Z_POSITIONS.map((z, index) => (
        <ZoneShell
          key={z}
          index={index}
          centerZ={z}
          shadows={profile.shadows}
          illuminated={index === activeZone}
        />
      ))}
      <AirlockFrames shadows={profile.shadows} />
      <Ventilation reducedMotion={reducedMotion} />
      <ScanningBeam reducedMotion={reducedMotion} />
      <Sparkles
        count={Math.max(8, Math.round(profile.particles * 0.58))}
        scale={[10.5, 5.6, 53]}
        position={[0, 0.6, -16]}
        color={CYAN}
        opacity={0.22}
        size={0.65}
        speed={reducedMotion ? 0 : 0.12}
      />
    </>
  )
}
