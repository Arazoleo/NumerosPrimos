import { Edges, RoundedBox, Sparkles, Stars, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel, QualityProfile } from '../../graphics/useQualitySettings'
import { decryptChallengeBlocks, RSA_STAGES } from './rsaVaultLogic'
import { useRsaVaultStore } from './rsaVaultStore'
import type { RsaStage, RsaVaultChallenge, RsaVaultPhase } from './types'

const CYAN = '#62f7e5'
const GOLD = '#ffc65a'
const VIOLET = '#a78bfa'
const RED = '#ff5d78'
const RING_RADII = [2.92, 2.35, 1.78, 1.22] as const

interface SceneProps {
  quality: QualityLevel
  profile: QualityProfile
  reducedMotion: boolean
}

function VaultChamber({ quality, profile, reducedMotion }: SceneProps): JSX.Element {
  const gridRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!reducedMotion && gridRef.current) {
      gridRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.08) * 0.025
    }
  })

  const panelPositions = useMemo(() => {
    const panelCount = quality === 'low' ? 7 : 14
    const rowCount = panelCount / 7
    return Array.from({ length: panelCount }, (_, index) => ({
      x: (index % 7 - 3) * 2.5,
      y: (Math.floor(index / 7) - (rowCount - 1) / 2) * 7.4,
    }))
  }, [quality])

  return (
    <>
      <color attach="background" args={['#03060a']} />
      <fog attach="fog" args={['#03060a', 13, 32]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[-4, 7, 9]}
        intensity={1.5}
        color="#ddfffa"
        castShadow={profile.shadows}
      />
      <pointLight position={[4.8, 2.8, 4]} intensity={30} distance={13} color={CYAN} />
      <pointLight position={[-5, -2, 3]} intensity={24} distance={12} color={VIOLET} />
      <Stars
        radius={45}
        depth={24}
        count={Math.round(profile.stars * 0.62)}
        factor={2.2}
        saturation={0.35}
        fade
        speed={reducedMotion ? 0 : 0.16}
      />
      <Sparkles
        count={Math.max(10, Math.round(profile.particles * 0.58))}
        scale={[16, 10, 9]}
        size={1.15}
        speed={reducedMotion ? 0 : 0.18}
        opacity={0.32}
        color={CYAN}
      />

      <group ref={gridRef} position={[0, 0, -2.1]}>
        {panelPositions.map(({ x, y }, index) => (
          <RoundedBox key={`${x}-${y}`} args={[2.18, 6.75, 0.18]} radius={0.07} position={[x, y, 0]}>
            <meshStandardMaterial
              color={index % 2 === 0 ? '#07111a' : '#091520'}
              metalness={0.78}
              roughness={0.44}
            />
            <Edges color={index % 3 === 0 ? '#183b48' : '#102832'} threshold={18} />
          </RoundedBox>
        ))}
      </group>
      <gridHelper args={[34, 34, '#143944', '#0a1820']} position={[0, -5.1, 0]} />
      <mesh position={[0, 5.05, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[22, 12]} />
        <meshStandardMaterial color="#050b11" metalness={0.7} roughness={0.55} />
      </mesh>
    </>
  )
}

function StageConduit({
  index,
  stage,
  active,
  complete,
  challenge,
}: {
  index: number
  stage: RsaStage
  active: boolean
  complete: boolean
  challenge: RsaVaultChallenge
}): JSX.Element {
  const angle = Math.PI / 2 - index * (Math.PI / 2)
  const radius = RING_RADII[index]
  const position: [number, number, number] = [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
    0.56 + index * 0.012,
  ]
  const equations: Readonly<Record<RsaStage, string>> = {
    factor: complete
      ? `${challenge.primeP} × ${challenge.primeQ} = ${challenge.modulus}`
      : `p × q = ${challenge.modulus}`,
    totient: complete
      ? `φ = ${challenge.totient}`
      : 'φ = (p−1)(q−1)',
    inverse: complete
      ? `d = ${challenge.privateExponent}`
      : `${challenge.publicExponent}d ≡ 1`,
    decrypt: complete ? challenge.message : 'Cᵈ mod N',
  }
  const color = complete ? CYAN : active ? GOLD : '#748b96'

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[active ? 0.11 : 0.075, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <Text
        position={[0, index === 0 ? 0.2 : -0.2, 0.02]}
        fontSize={0.16}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#020609"
      >
        {equations[stage]}
      </Text>
    </group>
  )
}

function CipherCapsules({
  challenge,
  revealed,
  reducedMotion,
}: {
  challenge: RsaVaultChallenge
  revealed: boolean
  reducedMotion: boolean
}): JSX.Element {
  const groupRef = useRef<THREE.Group>(null)
  const plaintext = useMemo(() => decryptChallengeBlocks(challenge), [challenge])

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) return
    groupRef.current.position.y = -3.58 + Math.sin(clock.elapsedTime * 1.4) * 0.035
  })

  const count = challenge.encryptedBlocks.length
  return (
    <group ref={groupRef} position={[0, -3.58, 0.38]}>
      {challenge.encryptedBlocks.map((cipher, index) => {
        const x = (index - (count - 1) / 2) * 0.74
        const color = revealed ? CYAN : VIOLET
        return (
          <group key={`${challenge.id}-${index}`} position={[x, 0, 0]}>
            <RoundedBox args={[0.58, 0.52, 0.22]} radius={0.08}>
              <meshStandardMaterial
                color="#0d1721"
                emissive={color}
                emissiveIntensity={revealed ? 0.85 : 0.32}
                metalness={0.82}
                roughness={0.28}
              />
              <Edges color={color} threshold={12} />
            </RoundedBox>
            <Text position={[0, 0, 0.13]} fontSize={0.18} color="#effffc" anchorX="center" anchorY="middle">
              {(revealed ? plaintext[index] : cipher).toString()}
            </Text>
          </group>
        )
      })}
      <Text position={[0, -0.48, 0]} fontSize={0.13} color={revealed ? CYAN : '#8599a6'} anchorX="center">
        {revealed ? 'BLOCOS DECIFRADOS // A1Z26' : 'BLOCOS CIFRADOS C'}
      </Text>
    </group>
  )
}

function MechanicalDoor({
  challenge,
  phase,
  stage,
  completedStages,
  reducedMotion,
  lowDetail,
}: {
  challenge: RsaVaultChallenge
  phase: RsaVaultPhase
  stage: RsaStage
  completedStages: readonly RsaStage[]
  reducedMotion: boolean
  lowDetail: boolean
}): JSX.Element {
  const hingeRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Group>(null)
  const ringRefs = useRef<Array<THREE.Group | null>>([])
  const boltRef = useRef<THREE.Group>(null)
  const open = phase === 'unlocking' || phase === 'vault-open' || phase === 'complete'
  const activeIndex = RSA_STAGES.indexOf(stage)

  useFrame(({ clock }, delta) => {
    if (hingeRef.current) {
      const target = open ? -1.36 : 0
      hingeRef.current.rotation.y = reducedMotion
        ? target
        : THREE.MathUtils.damp(hingeRef.current.rotation.y, target, 3.15, delta)
    }
    if (boltRef.current) {
      const target = open ? Math.PI * 0.42 : 0
      boltRef.current.rotation.z = reducedMotion
        ? target
        : THREE.MathUtils.damp(boltRef.current.rotation.z, target, 4.4, delta)
    }
    if (coreRef.current) {
      const target = open ? Math.PI * 2.5 : completedStages.length * Math.PI * 0.42
      coreRef.current.rotation.z = reducedMotion
        ? target
        : THREE.MathUtils.damp(coreRef.current.rotation.z, target, 3.6, delta)
    }

    ringRefs.current.forEach((ring, index) => {
      if (!ring) return
      const complete = completedStages.includes(RSA_STAGES[index])
      const idle = index === activeIndex && !reducedMotion
        ? Math.sin(clock.elapsedTime * 0.65 + index) * 0.075
        : 0
      const solvedRotation = complete ? (index % 2 === 0 ? 1 : -1) * (index + 1) * Math.PI * 0.34 : 0
      ring.rotation.z = reducedMotion
        ? solvedRotation
        : THREE.MathUtils.damp(ring.rotation.z, solvedRotation + idle, 3.2, delta)
    })
  })

  return (
    <group>
      <RoundedBox args={[7.35, 8.25, 0.72]} radius={0.28} position={[0, -0.18, -0.42]} castShadow>
        <meshStandardMaterial color="#07131b" metalness={0.94} roughness={0.25} />
        <Edges color="#31505c" threshold={18} />
      </RoundedBox>
      <RoundedBox args={[6.72, 7.62, 0.18]} radius={0.24} position={[0, -0.18, -0.01]}>
        <meshStandardMaterial color="#0a1921" metalness={0.88} roughness={0.31} />
        <Edges color={open ? CYAN : '#254854'} threshold={18} />
      </RoundedBox>

      <group ref={hingeRef} position={[-3.28, 0, 0.14]}>
        <group position={[3.28, 0, 0]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3.38, 3.38, 0.42, lowDetail ? 32 : 64]} />
            <meshStandardMaterial color="#0d2029" metalness={0.96} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.24]}>
            <circleGeometry args={[3.16, lowDetail ? 32 : 64]} />
            <meshStandardMaterial color="#08151d" metalness={0.85} roughness={0.34} />
          </mesh>

          {RING_RADII.map((radius, index) => {
            const ringStage = RSA_STAGES[index]
            const complete = completedStages.includes(ringStage)
            const active = stage === ringStage && phase === 'playing'
            const color = complete ? CYAN : active ? GOLD : '#344e58'
            return (
              <group
                key={ringStage}
                ref={(node) => { ringRefs.current[index] = node }}
                position={[0, 0, 0.34 + index * 0.012]}
              >
                <mesh>
                  <torusGeometry args={[radius, active ? 0.09 : 0.066, lowDetail ? 6 : 9, lowDetail ? 36 : 72]} />
                  <meshStandardMaterial
                    color="#233943"
                    emissive={color}
                    emissiveIntensity={complete ? 1.45 : active ? 0.78 : 0.08}
                    metalness={0.9}
                    roughness={0.2}
                  />
                </mesh>
                {Array.from({ length: lowDetail ? 6 : 12 }, (_, tick) => {
                  const tickCount = lowDetail ? 6 : 12
                  const angle = (tick / tickCount) * Math.PI * 2
                  return (
                    <mesh
                      key={tick}
                      position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0.03]}
                      rotation={[0, 0, angle]}
                    >
                      <boxGeometry args={[0.035, tick % 3 === 0 ? 0.16 : 0.095, 0.035]} />
                      <meshBasicMaterial color={color} />
                    </mesh>
                  )
                })}
              </group>
            )
          })}

          {RSA_STAGES.map((ringStage, index) => (
            <StageConduit
              key={ringStage}
              index={index}
              stage={ringStage}
              active={stage === ringStage && phase === 'playing'}
              complete={completedStages.includes(ringStage)}
              challenge={challenge}
            />
          ))}

          <group ref={boltRef} position={[0, 0, 0.48]}>
            {Array.from({ length: lowDetail ? 4 : 8 }, (_, index) => {
              const boltCount = lowDetail ? 4 : 8
              const angle = (index / boltCount) * Math.PI * 2
              return (
                <mesh
                  key={index}
                  position={[Math.cos(angle) * 0.84, Math.sin(angle) * 0.84, 0]}
                  rotation={[0, 0, angle]}
                >
                  <boxGeometry args={[0.16, 0.58, 0.14]} />
                  <meshStandardMaterial color={open ? CYAN : '#66818b'} metalness={0.94} roughness={0.16} />
                </mesh>
              )
            })}
          </group>
          <group ref={coreRef} position={[0, 0, 0.62]}>
            <mesh>
              <icosahedronGeometry args={[0.55, 1]} />
              <meshStandardMaterial
                color="#10262c"
                emissive={open ? CYAN : stage === 'decrypt' ? VIOLET : RED}
                emissiveIntensity={open ? 2.25 : 0.72}
                metalness={0.87}
                roughness={0.18}
              />
            </mesh>
          </group>
          <Text position={[0, 0.03, 1.19]} fontSize={0.27} color="#f4fffd" anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#031014">
            {open ? challenge.message : `N ${challenge.modulus}`}
          </Text>
          <Text position={[0, -0.42, 1.12]} fontSize={0.12} color={open ? CYAN : '#8ca3aa'} anchorX="center">
            {open ? 'CHAVE ACEITA' : `CHAVE PÚBLICA (${challenge.modulus}, ${challenge.publicExponent})`}
          </Text>
        </group>
      </group>

      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * 3.9, -0.16, 0.12]}>
          {[-2.8, -1.4, 0, 1.4, 2.8].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <boxGeometry args={[0.18, 0.62, 0.18]} />
              <meshBasicMaterial color={open ? CYAN : '#2c6973'} />
            </mesh>
          ))}
        </group>
      ))}
      <Text position={[0, 4.35, 0.08]} fontSize={0.23} color={open ? CYAN : '#b4c5ca'} anchorX="center" letterSpacing={0.18}>
        {`RSA // COFRE ${challenge.level} // ${challenge.codename}`}
      </Text>
      <CipherCapsules challenge={challenge} revealed={open} reducedMotion={reducedMotion} />
      <pointLight position={[0, 0, 4]} intensity={open ? 20 : 8} distance={9} color={open ? CYAN : GOLD} />
    </group>
  )
}

function CameraRig({ reducedMotion }: { reducedMotion: boolean }): null {
  const camera = useThree((state) => state.camera)
  const pointer = useThree((state) => state.pointer)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  const target = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (!reducedMotion) return
    camera.position.set(0, height < 650 ? 0.25 : 0.1, width < 720 ? 13.6 : 11.4)
    camera.lookAt(0, -0.15, 0)
  }, [camera, height, reducedMotion, width])

  useFrame((_, delta) => {
    if (reducedMotion) return
    const compact = width < 720
    const short = height < 650
    target.set(
      pointer.x * (compact ? 0.2 : 0.48),
      -0.12 + pointer.y * (short ? 0.08 : 0.22),
      compact ? 13.6 : short ? 12.1 : 11.35,
    )
    camera.position.x = THREE.MathUtils.damp(camera.position.x, target.x, 2.6, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, target.y, 2.6, delta)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, target.z, 2.6, delta)
    camera.lookAt(0, -0.15, 0)
  })
  return null
}

export function RsaVaultScene({ quality, profile, reducedMotion }: SceneProps): JSX.Element {
  const challenge = useRsaVaultStore((state) => state.challenge)
  const phase = useRsaVaultStore((state) => state.phase)
  const stage = useRsaVaultStore((state) => state.stage)
  const completedStages = useRsaVaultStore((state) => state.completedStages)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  const scale = width < 520 ? 0.72 : width < 760 ? 0.82 : height < 650 ? 0.88 : 1
  const displayCompleted = phase === 'intro' ? [] : completedStages

  return (
    <>
      <VaultChamber quality={quality} profile={profile} reducedMotion={reducedMotion} />
      <group position={[width < 760 ? 0 : 1.05, height < 650 ? 0.25 : -0.12, 0]} scale={scale}>
        <MechanicalDoor
          challenge={challenge}
          phase={phase}
          stage={stage}
          completedStages={displayCompleted}
          reducedMotion={reducedMotion}
          lowDetail={quality === 'low'}
        />
      </group>
      <CameraRig reducedMotion={reducedMotion} />
    </>
  )
}
