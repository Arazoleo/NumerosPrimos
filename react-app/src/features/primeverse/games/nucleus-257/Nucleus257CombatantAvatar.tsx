import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import type { NucleusTeamId } from '../primeverse-online/shared/protocol'
import { isStatusActive } from './arenaLogic'
import { getHeroKit } from './classKits'
import { CIPHER_TEAM_COLOR, FRACTURE_TEAM_COLOR } from './Nucleus257Effects'
import type { CombatantState, HeroId } from './types'

const TAU = Math.PI * 2

interface CombatantModelStyle {
  readonly body: string
  readonly bodyDark: string
  readonly secondary: string
  readonly torsoRadius: number
  readonly torsoLength: number
  readonly headRadius: number
  readonly shoulder: number
}

const MODEL_STYLE: Readonly<Record<HeroId, CombatantModelStyle>> = Object.freeze({
  'luma-crivo': {
    body: '#132b2d',
    bodyDark: '#07191e',
    secondary: '#fff18d',
    torsoRadius: 0.34,
    torsoLength: 0.82,
    headRadius: 0.31,
    shoulder: 0.43,
  },
  'raul-rsa': {
    body: '#302b23',
    bodyDark: '#15130f',
    secondary: '#66dfff',
    torsoRadius: 0.48,
    torsoLength: 0.94,
    headRadius: 0.38,
    shoulder: 0.61,
  },
  'teo-gemeos': {
    body: '#32152f',
    bodyDark: '#160a1c',
    secondary: '#65eaff',
    torsoRadius: 0.35,
    torsoLength: 0.8,
    headRadius: 0.31,
    shoulder: 0.44,
  },
  'yara-diffie': {
    body: '#1b1730',
    bodyDark: '#090817',
    secondary: '#ff5ebf',
    torsoRadius: 0.33,
    torsoLength: 0.78,
    headRadius: 0.3,
    shoulder: 0.42,
  },
  'iris-mersenne': {
    body: '#12291f',
    bodyDark: '#061410',
    secondary: '#7dff8f',
    torsoRadius: 0.31,
    torsoLength: 0.82,
    headRadius: 0.29,
    shoulder: 0.4,
  },
})

export interface Nucleus257CombatantAvatarProps {
  readonly id: string
  readonly heroId: HeroId
  readonly team: NucleusTeamId
  readonly label: string
  readonly localTeam: NucleusTeamId
  readonly combatants: React.MutableRefObject<readonly CombatantState[]>
  readonly castTimes: React.MutableRefObject<Map<string, number>>
  readonly simulationNowMs: React.MutableRefObject<number>
  readonly reducedMotion: boolean
  readonly quality: QualityLevel
}

function CrivoArchitecture({ accent, secondary, quality }: {
  readonly accent: string
  readonly secondary: string
  readonly quality: QualityLevel
}): JSX.Element {
  const nodeCount = quality === 'low' ? 4 : 8
  return (
    <group name="sieve-architecture">
      <mesh position={[0, 2.49, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.41, 0.025, 4, quality === 'high' ? 24 : 16]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.49, 0]} rotation={[Math.PI / 2, 0, Math.PI / 4]}>
        <torusGeometry args={[0.29, 0.012, 4, quality === 'high' ? 20 : 12]} />
        <meshBasicMaterial color={secondary} toneMapped={false} />
      </mesh>
      {Array.from({ length: nodeCount }, (_, index) => {
        const angle = index / nodeCount * TAU
        const primeScale = [2, 3, 5, 7][index % 4]
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.5, 1.5 + (index % 2) * 0.31, Math.sin(angle) * 0.5]}
            scale={0.035 + primeScale * 0.004}
          >
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={index % 3 === 0 ? secondary : accent} toneMapped={false} />
          </mesh>
        )
      })}
      {[-1, 0, 1].map((row) => (
        <mesh key={row} position={[0, 1.35 + row * 0.2, 0.335]}>
          <boxGeometry args={[0.46 - Math.abs(row) * 0.08, 0.018, 0.022]} />
          <meshBasicMaterial color={row === 0 ? secondary : accent} transparent opacity={0.82} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function RsaArchitecture({ accent, secondary, quality }: {
  readonly accent: string
  readonly secondary: string
  readonly quality: QualityLevel
}): JSX.Element {
  return (
    <group name="rsa-architecture">
      <mesh position={[0, 1.48, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.08, 6]} />
        <meshStandardMaterial color="#352d1d" emissive={accent} emissiveIntensity={0.7} metalness={0.9} roughness={0.18} />
      </mesh>
      <mesh position={[0, 1.48, 0.53]}>
        <ringGeometry args={[0.17, 0.25, 6]} />
        <meshBasicMaterial color={secondary} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.64, 1.73, 0]} rotation={[0, 0, side * -0.12]}>
          <mesh>
            <boxGeometry args={[0.48, 0.34, 0.62]} />
            <meshStandardMaterial color="#29271f" emissive={accent} emissiveIntensity={0.25} metalness={0.88} roughness={0.23} />
          </mesh>
          <mesh position={[0, 0, 0.32]} rotation={[0, 0, Math.PI / 6]}>
            <ringGeometry args={[0.12, 0.18, 6]} />
            <meshBasicMaterial color={side === 1 ? secondary : accent} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {quality !== 'low' ? [-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.32, 1.03, -0.34]} rotation={[side * 0.08, 0, side * 0.1]}>
          <boxGeometry args={[0.26, 0.68, 0.16]} />
          <meshStandardMaterial color="#17150f" emissive={accent} emissiveIntensity={0.14} metalness={0.82} roughness={0.3} />
        </mesh>
      )) : null}
    </group>
  )
}

function TwinEcho({ color, offset, echoRef }: {
  readonly color: string
  readonly offset: number
  readonly echoRef: React.RefObject<THREE.Group>
}): JSX.Element {
  return (
    <group ref={echoRef} position={[offset, 0, -0.28]}>
      <mesh position={[0, 1.28, 0]} scale={[0.84, 1, 0.42]}>
        <capsuleGeometry args={[0.34, 0.8, 4, 7]} />
        <meshBasicMaterial color={color} transparent opacity={0.09} depthWrite={false} wireframe toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.14, 0]} scale={[0.84, 1, 0.42]}>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.11} depthWrite={false} wireframe toneMapped={false} />
      </mesh>
    </group>
  )
}

function TwinsArchitecture({ accent, secondary, echoARef, echoBRef }: {
  readonly accent: string
  readonly secondary: string
  readonly echoARef: React.RefObject<THREE.Group>
  readonly echoBRef: React.RefObject<THREE.Group>
}): JSX.Element {
  return (
    <group name="twins-architecture">
      <TwinEcho color={accent} offset={-0.2} echoRef={echoARef} />
      <TwinEcho color={secondary} offset={0.2} echoRef={echoBRef} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.19, 1.48, 0.38]}>
          <mesh>
            <sphereGeometry args={[0.095, 8, 6]} />
            <meshBasicMaterial color={side === 1 ? secondary : accent} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.15, 0.022, 5, 14]} />
            <meshBasicMaterial color={side === 1 ? accent : secondary} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.48, 0.38]}>
        <boxGeometry args={[0.26, 0.018, 0.018]} />
        <meshBasicMaterial color={secondary} transparent opacity={0.78} toneMapped={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.31, 1.25, -0.35]} rotation={[Math.PI / 2, 0, side * 0.16]}>
          <torusGeometry args={[0.14, 0.035, 5, 12]} />
          <meshBasicMaterial color={side === 1 ? secondary : accent} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

function DiffieArchitecture({ accent, secondary, quality, glitchRef }: {
  readonly accent: string
  readonly secondary: string
  readonly quality: QualityLevel
  readonly glitchRef: React.RefObject<THREE.Group>
}): JSX.Element {
  const shardCount = quality === 'low' ? 5 : 9
  return (
    <group name="diffie-architecture">
      <mesh position={[0, 1.2, -0.18]} rotation={[0.06, 0, 0]}>
        <coneGeometry args={[0.68, 1.65, 7, 1, true]} />
        <meshStandardMaterial color="#100d24" emissive={accent} emissiveIntensity={0.2} transparent opacity={0.86} side={THREE.DoubleSide} />
      </mesh>
      <group ref={glitchRef}>
        {Array.from({ length: shardCount }, (_, index) => {
          const angle = index / shardCount * TAU
          return (
            <mesh
              key={index}
              position={[Math.cos(angle) * (0.38 + (index % 2) * 0.16), 0.94 + (index % 4) * 0.36, Math.sin(angle) * (0.38 + (index % 2) * 0.16)]}
              rotation={[index * 0.31, -angle, index * 0.47]}
              scale={[0.055 + (index % 3) * 0.018, 0.18, 0.035]}
            >
              <octahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={index % 2 === 0 ? accent : secondary} transparent opacity={0.74} toneMapped={false} />
            </mesh>
          )
        })}
        {[-2, -1, 0, 1, 2].map((slice) => (
          <mesh key={slice} position={[slice * 0.13, 1.56 - Math.abs(slice) * 0.08, 0.43]} rotation={[0, 0, slice * 0.17]}>
            <boxGeometry args={[0.11 + Math.abs(slice) * 0.025, 0.025, 0.03]} />
            <meshBasicMaterial color={slice % 2 === 0 ? secondary : accent} transparent opacity={0.82} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function Nucleus257CombatantAvatar({
  id,
  heroId,
  team,
  label,
  localTeam,
  combatants,
  castTimes,
  simulationNowMs,
  reducedMotion,
  quality,
}: Nucleus257CombatantAvatarProps): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const model = useRef<THREE.Group>(null)
  const identity = useRef<THREE.Group>(null)
  const echoA = useRef<THREE.Group>(null)
  const echoB = useRef<THREE.Group>(null)
  const glitch = useRef<THREE.Group>(null)
  const health = useRef<THREE.Mesh>(null)
  const shield = useRef<THREE.Mesh>(null)
  const aura = useRef<THREE.MeshStandardMaterial>(null)
  const kit = getHeroKit(heroId)
  const style = MODEL_STYLE[heroId]
  const teamColor = team === localTeam ? CIPHER_TEAM_COLOR : FRACTURE_TEAM_COLOR

  useFrame(({ clock }) => {
    const current = combatants.current.find((candidate) => candidate.id === id)
    if (!current || !root.current) return
    const nowMs = simulationNowMs.current
    const revealed = isStatusActive(current, 'revealed', nowMs)
    const cloaked = isStatusActive(current, 'cloaked', nowMs) && !revealed
    root.current.visible = current.alive && !cloaked
    if (!current.alive || cloaked) return
    root.current.position.set(current.position.x, current.position.y, current.position.z)
    root.current.rotation.y = Math.atan2(current.facing.x, current.facing.z)
    const castingAge = nowMs - (castTimes.current.get(id) ?? -10_000)
    const castKick = castingAge >= 0 && castingAge < 220
      ? Math.sin(castingAge / 220 * Math.PI)
      : 0
    if (model.current) {
      model.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 3.2 + id.length) * 0.035
      model.current.rotation.z = castKick * -0.09
    }
    if (identity.current) {
      identity.current.rotation.y = reducedMotion ? 0 : clock.elapsedTime * (heroId === 'raul-rsa' ? 0.12 : 0.42)
    }
    if (echoA.current && echoB.current) {
      const echo = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 5.4 + id.length) * 0.08
      echoA.current.position.x = -0.2 - echo
      echoB.current.position.x = 0.2 + echo
      echoA.current.position.z = -0.28 - Math.abs(echo) * 0.8
      echoB.current.position.z = -0.28 + Math.abs(echo) * 0.35
    }
    if (glitch.current) {
      const step = Math.floor(clock.elapsedTime * 7 + id.length)
      glitch.current.position.x = reducedMotion ? 0 : Math.sin(step * 5.71) * 0.045
      glitch.current.position.y = reducedMotion ? 0 : Math.cos(step * 8.13) * 0.025
      glitch.current.rotation.y = reducedMotion ? 0 : Math.sin(step * 3.17) * 0.025
    }
    if (health.current) {
      const ratio = Math.max(0.001, current.health / current.maxHealth)
      health.current.scale.x = ratio
      health.current.position.x = -0.75 + ratio * 0.75
    }
    if (shield.current) {
      const ratio = Math.max(0.001, current.shield / Math.max(1, current.maxShield))
      shield.current.scale.x = ratio
      shield.current.position.x = -0.75 + ratio * 0.75
    }
    if (aura.current) {
      const protectedSpawn = isStatusActive(current, 'spawn-protected', nowMs)
      const reflecting = isStatusActive(current, 'reflecting', nowMs)
      aura.current.opacity = protectedSpawn ? 0.4 : reflecting ? 0.32 : revealed ? 0.24 : 0.12
      aura.current.emissiveIntensity = protectedSpawn ? 2.2 : reflecting ? 1.8 : revealed ? 1.35 : 0.55
    }
  })

  return (
    <group ref={root} name={`combatant-${heroId}`}>
      <group ref={model}>
        <mesh position={[0, 1.28, 0]} castShadow={quality === 'high'}>
          <capsuleGeometry args={[style.torsoRadius, style.torsoLength, 7, 10]} />
          <meshStandardMaterial color={style.body} emissive={kit.accent} emissiveIntensity={0.16} metalness={0.7} roughness={0.31} />
        </mesh>
        <mesh position={[0, 2.15, 0]} castShadow={quality === 'high'}>
          <sphereGeometry args={[style.headRadius, quality === 'low' ? 10 : 16, 9]} />
          <meshStandardMaterial color={style.bodyDark} emissive={kit.accent} emissiveIntensity={0.13} metalness={0.76} roughness={0.25} />
        </mesh>
        <mesh position={[0, 2.17, style.headRadius * 0.93]}>
          <boxGeometry args={[heroId === 'yara-diffie' ? 0.36 : heroId === 'raul-rsa' ? 0.54 : 0.46, 0.075, 0.035]} />
          <meshBasicMaterial color={teamColor} toneMapped={false} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * style.shoulder, 1.38, 0]} rotation={[0, 0, side * -0.08]}>
            <mesh castShadow={quality === 'high'}>
              <capsuleGeometry args={[heroId === 'raul-rsa' ? 0.16 : 0.12, heroId === 'raul-rsa' ? 0.74 : 0.68, 5, 8]} />
              <meshStandardMaterial color={style.bodyDark} metalness={0.68} roughness={0.37} />
            </mesh>
            <mesh position={[0, 0.28, 0.08]}>
              <sphereGeometry args={[0.07, 8, 6]} />
              <meshBasicMaterial color={side === 1 ? style.secondary : kit.accent} toneMapped={false} />
            </mesh>
          </group>
        ))}

        {heroId === 'luma-crivo' ? (
          <group ref={identity}><CrivoArchitecture accent={kit.accent} secondary={style.secondary} quality={quality} /></group>
        ) : heroId === 'raul-rsa' ? (
          <group ref={identity}><RsaArchitecture accent={kit.accent} secondary={style.secondary} quality={quality} /></group>
        ) : heroId === 'teo-gemeos' ? (
          <TwinsArchitecture accent={kit.accent} secondary={style.secondary} echoARef={echoA} echoBRef={echoB} />
        ) : (
          <DiffieArchitecture accent={kit.accent} secondary={style.secondary} quality={quality} glitchRef={glitch} />
        )}

        <mesh position={[0, 1.35, 0]}>
          <sphereGeometry args={[heroId === 'raul-rsa' ? 0.82 : 0.74, 14, 9]} />
          <meshStandardMaterial ref={aura} color={teamColor} emissive={teamColor} transparent opacity={0.12} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[heroId === 'raul-rsa' ? 0.78 : 0.7, 0.035, 6, quality === 'low' ? 20 : 28]} />
          <meshBasicMaterial color={teamColor} transparent opacity={0.72} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>

      <Billboard position={[0, 2.9, 0]} follow>
        <group>
          <mesh>
            <planeGeometry args={[1.5, 0.09]} />
            <meshBasicMaterial color="#081015" transparent opacity={0.82} depthWrite={false} />
          </mesh>
          <mesh ref={health} position={[0, 0, 0.002]} scale={[1, 1, 1]}>
            <planeGeometry args={[1.5, 0.055]} />
            <meshBasicMaterial color={teamColor} depthWrite={false} />
          </mesh>
          <mesh ref={shield} position={[0, 0.075, 0.003]} scale={[1, 1, 1]}>
            <planeGeometry args={[1.5, 0.022]} />
            <meshBasicMaterial color={kit.accent} depthWrite={false} />
          </mesh>
          <Text position={[0, 0.22, 0]} fontSize={0.14} color={teamColor} anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor="#020509">
            {label}
          </Text>
        </group>
      </Billboard>
    </group>
  )
}
