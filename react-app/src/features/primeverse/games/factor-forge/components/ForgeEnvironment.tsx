import { Float, Stars } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'

import { QUALITY_SETTINGS } from '../useForgeQuality'
import type { ForgeQuality } from '../types'

interface ForgeEnvironmentProps {
  quality: ForgeQuality
}

function OrbitalRig(): JSX.Element {
  const rigRef = useRef<Group>(null)
  const ringRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (rigRef.current) rigRef.current.rotation.y += delta * 0.055
    if (ringRef.current) ringRef.current.rotation.z -= delta * 0.09
  })

  return (
    <group ref={rigRef} position={[0, -1.8, -4]}>
      <mesh ref={ringRef} rotation={[Math.PI / 2.7, 0, 0]}>
        <torusGeometry args={[8.4, 0.018, 8, 128]} />
        <meshBasicMaterial color="#29d8ff" transparent opacity={0.22} />
      </mesh>
      <mesh rotation={[Math.PI / 2.15, 0.25, 0.2]}>
        <torusGeometry args={[11.5, 0.012, 6, 128]} />
        <meshBasicMaterial color="#ffc82f" transparent opacity={0.12} />
      </mesh>
    </group>
  )
}

function FloatingGlyphs({ quality }: ForgeEnvironmentProps): JSX.Element | null {
  if (quality === 'low') return null

  const glyphs = [
    { position: [-8, 3.3, -7] as const, scale: 0.25 },
    { position: [8.5, 1.4, -9] as const, scale: 0.32 },
    { position: [-6.5, -4.5, -8] as const, scale: 0.2 },
  ]

  return (
    <group>
      {glyphs.map(({ position, scale }, index) => (
        <Float key={index} speed={0.55 + index * 0.1} rotationIntensity={0.35} floatIntensity={0.6}>
          <mesh position={position} scale={scale} rotation={[0.6, index, 0.4]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={index === 1 ? '#ffc82f' : '#26cfff'} wireframe transparent opacity={0.2} />
          </mesh>
        </Float>
      ))}
    </group>
  )
}

export function ForgeEnvironment({ quality }: ForgeEnvironmentProps): JSX.Element {
  const settings = QUALITY_SETTINGS[quality]

  return (
    <>
      <color attach="background" args={['#03050b']} />
      <fog attach="fog" args={['#03050b', 13, 38]} />
      <ambientLight intensity={0.32} color="#9bbfff" />
      <directionalLight
        castShadow={settings.shadows}
        color="#d9f6ff"
        intensity={1.4}
        position={[5, 8, 8]}
        shadow-mapSize-width={quality === 'high' ? 2048 : 1024}
        shadow-mapSize-height={quality === 'high' ? 2048 : 1024}
      />
      <pointLight color="#24d8ff" intensity={24} distance={16} position={[-5, 1, 3]} />
      <pointLight color="#ffbd2e" intensity={18} distance={14} position={[5, -3, 1]} />
      <Stars
        radius={70}
        depth={45}
        count={settings.stars}
        factor={2.2}
        saturation={0.25}
        fade
        speed={0.22}
      />
      <OrbitalRig />
      <FloatingGlyphs quality={quality} />
      <gridHelper
        args={[34, 34, '#174958', '#0b1c28']}
        position={[0, -7.2, -1.5]}
        rotation={[0, 0, 0]}
      />
      <mesh receiveShadow={settings.shadows} position={[0, -7.24, -1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 34]} />
        <meshStandardMaterial color="#050a11" roughness={0.9} metalness={0.25} />
      </mesh>
    </>
  )
}

