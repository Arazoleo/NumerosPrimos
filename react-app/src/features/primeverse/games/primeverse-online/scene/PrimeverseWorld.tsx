import { Billboard, Float, Sparkles, Stars, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel, QualityProfile } from '../../../graphics/useQualitySettings'
import type { DiscoveryId } from '../discovery/discoveryProgress'
import type { RealmId } from '../shared/realms'
import { ONLINE_LANDMARKS, PEDESTALS, SECRET_POINTS } from '../world'

const PRIME_VALUES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29] as const
const FACTORS = [2, 3, 5] as const
const HORIZON_PRIMES = [31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97] as const
const WAYFINDING_IDS = new Set(['garden', 'temple', 'tower', 'arch', 'observatory', 'void'])

interface PrimeverseWorldProps {
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly reducedMotion: boolean
  readonly coreProximity: React.MutableRefObject<number>
  readonly eventPhase: string
  readonly winningValue?: number | null
  readonly eventSuccess?: boolean | null
  readonly serverCoreIntensity: number
  readonly serverCoreRingSpeed: number
  readonly discoveredSecrets: readonly DiscoveryId[]
  readonly currentRealmId?: RealmId
}

function GroundRings(): JSX.Element {
  return (
    <group position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {[8, 14, 21, 30, 40].map((radius, index) => (
        <mesh key={radius}>
          <ringGeometry args={[radius - 0.025, radius + 0.025, 96]} />
          <meshBasicMaterial color={index % 2 ? '#204769' : '#3760a0'} transparent opacity={0.32 - index * 0.035} />
        </mesh>
      ))}
      {Array.from({ length: 12 }, (_, index) => (
        <mesh key={index} rotation={[0, 0, index * Math.PI / 6]} position={[0, 0, -20]}>
          <planeGeometry args={[0.025, 40]} />
          <meshBasicMaterial color="#263f72" transparent opacity={0.22} />
        </mesh>
      ))}
    </group>
  )
}

function Walkway({ from, to, color = '#21416b', width = 2.3 }: {
  readonly from: readonly [number, number, number]
  readonly to: readonly [number, number, number]
  readonly color?: string
  readonly width?: number
}): JSX.Element {
  const dx = to[0] - from[0]
  const dz = to[2] - from[2]
  const length = Math.hypot(dx, dz)
  const primeTicks = PRIME_VALUES.filter((prime) => prime < length - 0.35)
  return (
    <group position={[(from[0] + to[0]) / 2, 0.02, (from[2] + to[2]) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[length, 0.08, width]} />
        <meshStandardMaterial color="#091526" roughness={0.78} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0.048, 0]}>
        <planeGeometry args={[length - 0.4, 0.035]} />
        <meshBasicMaterial color={color} transparent opacity={0.88} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0.07, side * width * 0.46]}>
          <boxGeometry args={[length, 0.025, 0.035]} />
          <meshBasicMaterial color="#48dce7" transparent opacity={0.4} />
        </mesh>
      ))}
      {primeTicks.map((prime) => (
        <mesh key={prime} position={[-length / 2 + prime, 0.074, width * 0.32]}>
          <boxGeometry args={[0.055, 0.018, width * 0.18]} />
          <meshBasicMaterial color={color} transparent opacity={0.92} />
        </mesh>
      ))}
    </group>
  )
}

function LandmarkLabel({ name, subtitle, color, position }: {
  readonly name: string
  readonly subtitle: string
  readonly color: string
  readonly position: readonly [number, number, number]
}): JSX.Element {
  return (
    <Billboard position={[position[0], position[1], position[2]]} follow>
      <Text fontSize={0.46} color="#eaf6ff" anchorY="bottom" outlineColor="#07111f" outlineWidth={0.035}>
        {name.toUpperCase()}
      </Text>
      <Text position={[0, -0.12, 0]} fontSize={0.17} letterSpacing={0.2} color={color} anchorY="top">
        {subtitle}
      </Text>
    </Billboard>
  )
}

function WayfindingArray({ quality }: { readonly quality: QualityLevel }): JSX.Element {
  const routes = ONLINE_LANDMARKS.filter((landmark) => WAYFINDING_IDS.has(landmark.id))

  return (
    <group>
      {routes.map((landmark, index) => {
        const worldDistance = Math.hypot(landmark.position[0], landmark.position[2])
        const directionX = landmark.position[0] / worldDistance
        const directionZ = landmark.position[2] / worldDistance
        const side = index % 2 === 0 ? -1.28 : 1.28
        const x = directionX * 7.4 - directionZ * side
        const z = directionZ * 7.4 + directionX * side

        return (
          <group key={`wayfinding-${landmark.id}`} position={[x, 0, z]}>
            <mesh position={[0, 0.74, 0]} castShadow>
              <boxGeometry args={[0.09, 1.48, 0.09]} />
              <meshStandardMaterial color="#26394c" metalness={0.75} roughness={0.34} />
            </mesh>
            <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.34, 0.39, 6]} />
              <meshBasicMaterial color={landmark.accent} transparent opacity={0.58} />
            </mesh>
            <Billboard position={[0, 1.62, 0]} follow>
              <mesh>
                <boxGeometry args={[2.15, 0.64, 0.075]} />
                <meshStandardMaterial
                  color="#091423"
                  emissive={landmark.accent}
                  emissiveIntensity={0.16}
                  metalness={0.52}
                  roughness={0.34}
                />
              </mesh>
              <mesh position={[-0.82, 0, 0.055]} rotation={[0, 0, -Math.PI / 2]}>
                <circleGeometry args={[0.13, 3]} />
                <meshBasicMaterial color={landmark.accent} transparent opacity={0.95} />
              </mesh>
              <Text position={[0.12, 0.11, 0.06]} fontSize={0.2} letterSpacing={0.12} color="#eff9ff">
                {landmark.shortName}
              </Text>
              {quality !== 'low' && (
                <Text position={[0.12, -0.15, 0.06]} fontSize={0.105} letterSpacing={0.16} color={landmark.accent}>
                  {`SETOR ${Math.round(worldDistance).toString().padStart(2, '0')}`}
                </Text>
              )}
            </Billboard>
          </group>
        )
      })}
    </group>
  )
}

function PrimeHorizon({ quality }: { readonly quality: QualityLevel }): JSX.Element {
  const entries = useMemo(() => {
    const stride = quality === 'high' ? 1 : quality === 'medium' ? 2 : 3
    return HORIZON_PRIMES
      .map((prime, index) => {
        const previousPrime = index === 0 ? 29 : HORIZON_PRIMES[index - 1]
        const gap = prime - previousPrime
        const angle = index / HORIZON_PRIMES.length * Math.PI * 2 - Math.PI / 2 + (gap - 4) * 0.035
        const radius = 40.7 + index % 2 * 0.75
        return {
          prime,
          index,
          angle,
          gap,
          height: 2.5 + gap * 0.28,
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
        }
      })
      .filter((entry) => entry.index % stride === 0)
  }, [quality])
  const bodies = useRef<THREE.InstancedMesh>(null)
  const notches = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    entries.forEach((entry, instance) => {
      dummy.position.set(entry.x, entry.height / 2, entry.z)
      dummy.rotation.set(0, -entry.angle, 0)
      dummy.scale.set(0.62, entry.height, 0.86)
      dummy.updateMatrix()
      bodies.current?.setMatrixAt(instance, dummy.matrix)

      dummy.position.set(entry.x, entry.height * 0.7, entry.z)
      dummy.scale.set(0.67, 0.055, 0.91)
      dummy.updateMatrix()
      notches.current?.setMatrixAt(instance, dummy.matrix)
    })
    if (bodies.current) {
      bodies.current.instanceMatrix.needsUpdate = true
      bodies.current.computeBoundingSphere()
    }
    if (notches.current) {
      notches.current.instanceMatrix.needsUpdate = true
      notches.current.computeBoundingSphere()
    }
  }, [entries])

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, entries.length]} castShadow={quality === 'high'} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0b1726" metalness={0.48} roughness={0.68} />
      </instancedMesh>
      <instancedMesh ref={notches} args={[undefined, undefined, entries.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#3f6a91" transparent opacity={0.52} />
      </instancedMesh>
      {entries.filter((_, index) => index % Math.max(1, Math.ceil(entries.length / 3)) === 0).map((entry) => (
        <Billboard key={`horizon-label-${entry.prime}`} position={[entry.x, entry.height + 0.48, entry.z]} follow>
          <Text fontSize={0.24} color="#7294b1" outlineColor="#030611" outlineWidth={0.025}>
            {`p${entry.prime}`}
          </Text>
        </Billboard>
      ))}
    </group>
  )
}

function OrbitalCourier({ radius, height, phase, speed, color, reducedMotion }: {
  readonly radius: number
  readonly height: number
  readonly phase: number
  readonly speed: number
  readonly color: string
  readonly reducedMotion: boolean
}): JSX.Element {
  const orbit = useRef<THREE.Group>(null)
  const craft = useRef<THREE.Group>(null)

  useFrame(({ clock }, delta) => {
    if (orbit.current && !reducedMotion) orbit.current.rotation.y += delta * speed
    if (craft.current && !reducedMotion) craft.current.position.y = height + Math.sin(clock.elapsedTime * 1.25 + phase) * 0.22
  })

  return (
    <group ref={orbit} rotation={[0, phase, 0]}>
      <group ref={craft} position={[radius, height, 0]}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <octahedronGeometry args={[0.27, 0]} />
          <meshStandardMaterial color="#a9bccb" metalness={0.86} roughness={0.2} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.43, 0, 0]} rotation={[0, 0, side * 0.18]}>
            <boxGeometry args={[0.58, 0.055, 0.34]} />
            <meshStandardMaterial color="#17283b" metalness={0.72} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.31]}>
          <sphereGeometry args={[0.095, 8, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.88} />
        </mesh>
        <mesh position={[0, 0, -0.58]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.095, 0.62, 6, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.24} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

function SkyTraffic({ quality, reducedMotion }: { readonly quality: QualityLevel; readonly reducedMotion: boolean }): JSX.Element | null {
  if (quality === 'low') return null
  const couriers = quality === 'high'
    ? [
        { radius: 16, height: 7.8, phase: 0.3, speed: 0.105, color: '#65eaf4' },
        { radius: 24, height: 10.4, phase: 2.6, speed: -0.062, color: '#b38aff' },
        { radius: 31, height: 8.9, phase: 4.7, speed: 0.045, color: '#ffbb70' },
      ]
    : [{ radius: 21, height: 8.7, phase: 1.2, speed: 0.07, color: '#65eaf4' }]

  return (
    <group>
      {couriers.map((courier) => (
        <OrbitalCourier key={`${courier.radius}-${courier.phase}`} {...courier} reducedMotion={reducedMotion} />
      ))}
    </group>
  )
}

function PrimeCore({ proximity, reducedMotion, eventPhase, winningValue, serverIntensity, serverRingSpeed }: {
  readonly proximity: React.MutableRefObject<number>
  readonly reducedMotion: boolean
  readonly eventPhase: string
  readonly winningValue?: number | null
  readonly serverIntensity: number
  readonly serverRingSpeed: number
}): JSX.Element {
  const group = useRef<THREE.Group>(null)
  const shell = useRef<THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>>(null)
  const coreLight = useRef<THREE.PointLight>(null)
  const eventActive = eventPhase === 'revealed'

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime
    if (group.current && !reducedMotion) group.current.rotation.y += delta * (eventActive ? 0.95 : 0.22 * serverRingSpeed)
    if (shell.current) {
      const energy = Math.max(proximity.current, serverIntensity, eventActive ? 1 : 0)
      const pulse = 1 + Math.sin(time * (eventActive ? 7 : 2.4)) * (0.025 + energy * 0.075)
      shell.current.scale.setScalar(pulse)
      shell.current.material.emissiveIntensity = 1.25 + energy * 2.7
      if (coreLight.current) coreLight.current.intensity = 7 + energy * 14
    }
  })

  return (
    <group position={[0, 2.35, 0]} ref={group}>
      <pointLight ref={coreLight} color={eventActive ? '#fff06e' : '#9e7cff'} intensity={eventActive ? 24 : 11} distance={16} decay={2} />
      <mesh ref={shell} castShadow>
        <icosahedronGeometry args={[1.55, 2]} />
        <meshStandardMaterial color="#492a8b" emissive={eventActive ? '#ffcf4d' : '#6738d5'} emissiveIntensity={1.5} roughness={0.12} metalness={0.42} wireframe />
      </mesh>
      <mesh scale={0.72}>
        <dodecahedronGeometry args={[1.55, 1]} />
        <meshStandardMaterial color={eventActive ? '#fff5b2' : '#bca8ff'} emissive={eventActive ? '#ffb628' : '#4e27ba'} emissiveIntensity={2.2} roughness={0.14} metalness={0.75} />
      </mesh>
      {[2.25, 2.75, 3.25].map((radius, index) => (
        <mesh key={radius} rotation={[index * 0.65, index * 0.48, Math.PI / 2]}>
          <torusGeometry args={[radius, 0.018 + index * 0.008, 7, 92]} />
          <meshBasicMaterial color={index === 1 ? '#63efff' : '#b279ff'} transparent opacity={0.7} />
        </mesh>
      ))}
      {PRIME_VALUES.map((prime, index) => {
        const angle = (index / PRIME_VALUES.length) * Math.PI * 2
        const radius = index % 2 ? 2.72 : 2.27
        return (
          <Float key={prime} speed={reducedMotion ? 0 : 1 + index * 0.08} rotationIntensity={reducedMotion ? 0 : 0.15} floatIntensity={reducedMotion ? 0 : 0.25}>
            <Billboard position={[Math.cos(angle) * radius, Math.sin(index * 1.7) * 0.62, Math.sin(angle) * radius]} follow>
              <Text fontSize={0.4} color={eventActive && prime === winningValue ? '#fff26d' : '#dcd2ff'} outlineColor="#351875" outlineWidth={0.025}>{prime}</Text>
            </Billboard>
          </Float>
        )
      })}
      <LandmarkLabel name="Núcleo Primo" subtitle="ORDEM EM MOVIMENTO" color="#b793ff" position={[0, 2.5, 0]} />
    </group>
  )
}

function SpawnPlaza({ eventPhase, winningValue }: { readonly eventPhase: string; readonly winningValue?: number | null }): JSX.Element {
  const sequenceTerms = [2, 3, 5, 7, 11, eventPhase === 'revealed' || eventPhase === 'cooldown' ? (winningValue ?? 13) : '?'] as const

  return (
    <group>
      <mesh position={[0, 0, 13]} receiveShadow>
        <cylinderGeometry args={[7.5, 7.75, 0.22, 64]} />
        <meshStandardMaterial color="#0b1a2d" roughness={0.72} metalness={0.48} />
      </mesh>
      <mesh position={[0, 0.12, 13]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5.1, 5.16, 72]} />
        <meshBasicMaterial color="#5cecff" transparent opacity={0.55} />
      </mesh>
      <LandmarkLabel name="Praça de Spawn" subtitle="PROTOCOLO COOPERATIVO" color="#69efff" position={[0, 3.2, 14.5]} />
      <Billboard position={[0, 3.05, 17.35]} follow>
        <group>
          <mesh position={[0, 0.03, -0.08]}>
            <boxGeometry args={[7.35, 1.42, 0.08]} />
            <meshStandardMaterial color="#071426" emissive="#102d58" emissiveIntensity={0.6} transparent opacity={0.86} metalness={0.62} roughness={0.28} />
          </mesh>
          <Text position={[0, 0.48, 0]} fontSize={0.16} letterSpacing={0.18} color="#86a8c3">
            SEQUÊNCIA DO NÚCLEO
          </Text>
          {sequenceTerms.map((term, index) => {
            const answerRevealed = index === sequenceTerms.length - 1 && term === 13
            return (
              <group key={`${term}-${index}`} position={[(index - 2.5) * 1.08, -0.12, 0]}>
                <mesh>
                  <boxGeometry args={[0.82, 0.62, 0.1]} />
                  <meshStandardMaterial
                    color={answerRevealed ? '#6a5512' : '#10243e'}
                    emissive={answerRevealed ? '#f3c62d' : '#153c68'}
                    emissiveIntensity={answerRevealed ? 2.2 : 0.72}
                    transparent
                    opacity={0.94}
                  />
                </mesh>
                <Text position={[0, -0.01, 0.07]} fontSize={0.3} color={answerRevealed ? '#fff4a2' : '#d8f8ff'}>
                  {term}
                </Text>
              </group>
            )
          })}
        </group>
      </Billboard>
      {PEDESTALS.map((pedestal) => {
        const selected = winningValue === pedestal.value && eventPhase === 'revealed'
        return (
          <group key={pedestal.value} position={pedestal.position as [number, number, number]}>
            <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.63, 0.82, 0.88, 6]} />
              <meshStandardMaterial color={selected ? '#695513' : '#10233a'} emissive={selected ? '#fbd953' : '#143856'} emissiveIntensity={selected ? 2.5 : 0.65} metalness={0.78} roughness={0.25} />
            </mesh>
            <mesh position={[0, 1.04, 0]}>
              <octahedronGeometry args={[0.34, 0]} />
              <meshStandardMaterial color={selected ? '#fff7a7' : '#75e9f5'} emissive={selected ? '#ffd32f' : '#12718a'} emissiveIntensity={selected ? 3 : 1.4} />
            </mesh>
            <Billboard position={[0, 1.7, 0]} follow>
              <Text fontSize={0.42} color={selected ? '#fff6a2' : '#d8faff'} outlineColor="#06111f" outlineWidth={0.03}>{pedestal.value}</Text>
            </Billboard>
          </group>
        )
      })}
    </group>
  )
}

function PrimeGarden({ reducedMotion }: { readonly reducedMotion: boolean }): JSX.Element {
  const primes = [2, 3, 5, 7, 11, 13]
  return (
    <group position={[-21, 0, -5]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[5.8, 6.15, 0.2, 10]} />
        <meshStandardMaterial color="#0b211f" roughness={0.9} metalness={0.14} />
      </mesh>
      {primes.map((prime, index) => {
        const angle = index / primes.length * Math.PI * 2
        const height = 1 + prime * 0.1
        return (
          <group key={prime} position={[Math.cos(angle) * 3.4, 0, Math.sin(angle) * 3.4]}>
            <mesh position={[0, height / 2, 0]} castShadow>
              <cylinderGeometry args={[0.13, 0.26, height, 6]} />
              <meshStandardMaterial color="#285e57" emissive="#0c3c32" emissiveIntensity={0.8} />
            </mesh>
            <Float speed={reducedMotion ? 0 : 1.3} floatIntensity={reducedMotion ? 0 : 0.22}>
              <mesh position={[0, height + 0.33, 0]} rotation={[0.5, 0.3, 0.2]}>
                <octahedronGeometry args={[0.38, 0]} />
                <meshStandardMaterial color="#8cffc1" emissive="#1fd677" emissiveIntensity={1.7} roughness={0.16} />
              </mesh>
              <Billboard position={[0, height + 0.9, 0]} follow>
                <Text fontSize={0.32} color="#baffd6">{prime}</Text>
              </Billboard>
            </Float>
          </group>
        )
      })}
      <LandmarkLabel name="Jardim Primo" subtitle="CRESCIMENTO IRREDUTÍVEL" color="#70ffb1" position={[0, 3.9, 0]} />
    </group>
  )
}

function FactorTemple({ reducedMotion }: { readonly reducedMotion: boolean }): JSX.Element {
  return (
    <group position={[21, 0, -5]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[7.6, 0.16, 6.3]} />
        <meshStandardMaterial color="#20180f" roughness={0.77} metalness={0.4} />
      </mesh>
      {[-3, 3].flatMap((x) => [-2.2, 2.2].map((z) => (
        <group key={`${x}-${z}`} position={[x, 1.65, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.31, 0.44, 3.3, 8]} />
            <meshStandardMaterial color="#64472b" metalness={0.53} roughness={0.4} />
          </mesh>
        </group>
      )))}
      <pointLight position={[0, 3.2, 0]} color="#ffb35f" intensity={3.4} distance={10} decay={2} />
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[7.4, 0.45, 5.8]} />
        <meshStandardMaterial color="#382817" emissive="#45250b" emissiveIntensity={0.52} metalness={0.55} />
      </mesh>
      <Float speed={reducedMotion ? 0 : 1.1} floatIntensity={reducedMotion ? 0 : 0.2}>
        <Billboard position={[0, 2.15, 0]} follow>
          <Text fontSize={0.82} color="#ffd089" outlineColor="#3b1b05" outlineWidth={0.045}>30</Text>
          <Text position={[0, -0.78, 0]} fontSize={0.29} color="#ffbd69">2 × 3 × 5</Text>
        </Billboard>
      </Float>
      {FACTORS.map((factor, index) => (
        <mesh key={factor} position={[(index - 1) * 1.35, 1.05, 0]}>
          <dodecahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial color="#ffbc67" emissive="#a74c0f" emissiveIntensity={1.3} />
        </mesh>
      ))}
      <LandmarkLabel name="Templo dos Fatores" subtitle="30 = 2 · 3 · 5" color="#ffba6c" position={[0, 4.35, 0]} />
    </group>
  )
}

function UlamTower(): JSX.Element {
  const blocks = useMemo(() => Array.from({ length: 34 }, (_, index) => {
    const radius = 1.4 + index * 0.045
    const angle = index * 0.71
    return { index, x: Math.cos(angle) * radius, y: 0.25 + index * 0.16, z: Math.sin(angle) * radius, prime: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31].includes(index) }
  }), [])
  const primeBlocks = useMemo(() => blocks.filter((block) => block.prime), [blocks])
  const compositeBlocks = useMemo(() => blocks.filter((block) => !block.prime), [blocks])
  const primeInstances = useRef<THREE.InstancedMesh>(null)
  const compositeInstances = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    const populate = (mesh: THREE.InstancedMesh | null, entries: typeof blocks) => {
      if (!mesh) return
      entries.forEach((block, instance) => {
        dummy.position.set(block.x, block.y, block.z)
        dummy.rotation.set(0, -block.index * 0.71, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(instance, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    populate(primeInstances.current, primeBlocks)
    populate(compositeInstances.current, compositeBlocks)
  }, [blocks, compositeBlocks, primeBlocks])

  return (
    <group position={[-18, 0, -24]}>
      <mesh position={[0, 2.75, 0]} castShadow>
        <cylinderGeometry args={[2.35, 3.1, 5.5, 8, 1, true]} />
        <meshStandardMaterial color="#211633" side={THREE.DoubleSide} roughness={0.62} metalness={0.45} />
      </mesh>
      <instancedMesh ref={compositeInstances} args={[undefined, undefined, compositeBlocks.length]}>
        <boxGeometry args={[0.48, 0.12, 0.48]} />
        <meshStandardMaterial color="#493754" emissive="#190d26" emissiveIntensity={0.25} />
      </instancedMesh>
      <instancedMesh ref={primeInstances} args={[undefined, undefined, primeBlocks.length]}>
        <boxGeometry args={[0.48, 0.12, 0.48]} />
        <meshStandardMaterial color="#ff7acf" emissive="#a31c76" emissiveIntensity={1.4} />
      </instancedMesh>
      <mesh position={[0, 5.6, 0]}>
        <coneGeometry args={[1.7, 1.8, 8]} />
        <meshStandardMaterial color="#432060" emissive="#4b166e" emissiveIntensity={0.9} />
      </mesh>
      <LandmarkLabel name="Torre de Ulam" subtitle="A ESPIRAL OBSERVA" color="#ff6ec7" position={[0, 7.1, 0]} />
    </group>
  )
}

function CryptoArch(): JSX.Element {
  return (
    <group position={[18, 0, -24]}>
      {[-2.6, 2.6].map((x) => (
        <group key={x} position={[x, 2.25, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.15, 4.5, 1.3]} />
            <meshStandardMaterial color="#102747" metalness={0.72} roughness={0.22} emissive="#0a2f63" emissiveIntensity={0.7} />
          </mesh>
          {[0, 1, 2, 3].map((index) => (
            <mesh key={index} position={[0, -1.55 + index * 1.02, 0.665]}>
              <boxGeometry args={[0.67, 0.035, 0.02]} />
              <meshBasicMaterial color="#6eb8ff" transparent opacity={0.75} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 4.52, 0]}>
        <torusGeometry args={[2.64, 0.55, 10, 36, Math.PI]} />
        <meshStandardMaterial color="#174278" emissive="#124a91" emissiveIntensity={1.1} metalness={0.76} />
      </mesh>
      <Billboard position={[0, 2.65, 0]} follow>
        <Text fontSize={0.42} color="#9bd0ff">p × q → n</Text>
      </Billboard>
      <LandmarkLabel name="Arco Criptográfico" subtitle="CHAVE PÚBLICA // PORTAL" color="#69a9ff" position={[0, 6.2, 0]} />
    </group>
  )
}

function Observatory(): JSX.Element {
  return (
    <group position={[0, 0, -35]}>
      <mesh position={[0, 1.9, 0]} castShadow>
        <sphereGeometry args={[3.4, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#17213c" emissive="#111a45" emissiveIntensity={0.58} metalness={0.67} roughness={0.34} wireframe />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[3.45, 3.75, 1.05, 20]} />
        <meshStandardMaterial color="#101a2b" metalness={0.57} />
      </mesh>
      <group position={[0, 3.1, 0]} rotation={[0.28, 0, -0.55]}>
        <mesh>
          <cylinderGeometry args={[0.31, 0.46, 4.3, 12]} />
          <meshStandardMaterial color="#5e6b8e" metalness={0.82} roughness={0.23} />
        </mesh>
        <mesh position={[0, 2.05, 0]}>
          <sphereGeometry args={[0.72, 18, 10]} />
          <meshStandardMaterial color="#83baff" emissive="#2858be" emissiveIntensity={1.2} />
        </mesh>
      </group>
      <LandmarkLabel name="Observatório" subtitle="CONJECTURAS ALÉM DO HORIZONTE" color="#c2d2ff" position={[0, 6.3, 0]} />
    </group>
  )
}

function VoidPlatform(): JSX.Element {
  const rings = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (rings.current) rings.current.rotation.y -= delta * 0.15
  })
  return (
    <group position={[0, -0.5, 31]}>
      <group ref={rings}>
        {[0, 1, 2].map((index) => (
          <mesh key={index} rotation={[Math.PI / 2, index * 0.48, 0]} position={[0, index * 0.32, 0]}>
            <torusGeometry args={[4.6 - index * 0.8, 0.13, 7, 7]} />
            <meshStandardMaterial color="#4d112d" emissive="#a30f45" emissiveIntensity={1.25} metalness={0.72} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[4.2, 3.25, 0.75, 9]} />
        <meshStandardMaterial color="#160b19" metalness={0.7} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <tetrahedronGeometry args={[0.82, 1]} />
        <meshStandardMaterial color="#ff668c" emissive="#c30d4e" emissiveIntensity={2.1} wireframe />
      </mesh>
      <LandmarkLabel name="Plataforma do Vazio" subtitle="NÃO HÁ FATOR ABAIXO DE ZERO" color="#ff668c" position={[0, 3.2, 0]} />
    </group>
  )
}

function Secrets({ reducedMotion, discoveredSecrets }: {
  readonly reducedMotion: boolean
  readonly discoveredSecrets: readonly DiscoveryId[]
}): JSX.Element {
  return (
    <>
      {SECRET_POINTS.map((secret) => {
        const discovered = discoveredSecrets.includes(secret.id)
        return (
          <Float key={secret.id} speed={reducedMotion ? 0 : 1.7} floatIntensity={reducedMotion ? 0 : 0.2}>
            <group position={secret.position as [number, number, number]}>
              <mesh scale={discovered ? 1.22 : 1}>
                <octahedronGeometry args={[0.34, 0]} />
                <meshStandardMaterial
                  color={discovered ? '#bff9ff' : '#fff3a5'}
                  emissive={discovered ? '#18bad2' : '#e39013'}
                  emissiveIntensity={discovered ? 3.1 : 2.6}
                />
              </mesh>
              {discovered && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.52, 0.56, 24]} />
                  <meshBasicMaterial color="#73efff" transparent opacity={0.62} depthWrite={false} />
                </mesh>
              )}
              <Billboard position={[0, 0.7, 0]} follow>
                <Text fontSize={discovered ? 0.17 : 0.22} color={discovered ? '#bff9ff' : '#ffeeb6'} outlineColor="#06111f" outlineWidth={0.018}>
                  {discovered ? secret.label : '?'}
                </Text>
              </Billboard>
            </group>
          </Float>
        )
      })}
    </>
  )
}

export default function PrimeverseWorld({ quality, profile, reducedMotion, coreProximity, eventPhase, winningValue, eventSuccess, serverCoreIntensity, serverCoreRingSpeed, discoveredSecrets, currentRealmId = 'nexus' }: PrimeverseWorldProps): JSX.Element {
  const realmKey = String(currentRealmId)
  const isHorror = realmKey === 'sieve-catacombs'
  const background = isHorror ? '#010203' : realmKey === 'ulam-run' ? '#0c0310' : realmKey === 'factor-forge' ? '#100704' : '#030611'
  const fogColor = isHorror ? '#030608' : realmKey === 'ulam-run' ? '#120619' : realmKey === 'factor-forge' ? '#170c07' : '#050917'
  const fogNear = isHorror ? 6 : quality === 'low' ? 30 : 42
  const fogFar = isHorror ? (quality === 'low' ? 24 : 34) : quality === 'low' ? 70 : 92
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
      <hemisphereLight args={[isHorror ? '#263044' : '#7ea8ff', '#030507', isHorror ? 0.16 : 1.25]} />
      <ambientLight intensity={isHorror ? 0.065 : 0.42} color={isHorror ? '#60708a' : '#a9bfff'} />
      <directionalLight position={[16, 28, 14]} intensity={isHorror ? 0.32 : 2.2} color={isHorror ? '#8290a3' : '#cfdeff'} castShadow={profile.shadows} shadow-mapSize-width={quality === 'high' ? 1536 : 768} shadow-mapSize-height={quality === 'high' ? 1536 : 768} />
      <Stars radius={75} depth={36} count={Math.min(profile.stars, quality === 'high' ? 1600 : 850)} factor={3} saturation={0.5} fade speed={reducedMotion ? 0 : 0.3} />
      {quality !== 'low' && <Sparkles count={Math.min(profile.particles, 46)} scale={[72, 18, 72]} size={1.4} speed={reducedMotion ? 0 : 0.16} color="#6ebfff" opacity={0.42} />}

      <mesh position={[0, -0.13, -2]} receiveShadow>
        <cylinderGeometry args={[43.5, 44.5, 0.24, 72]} />
        <meshStandardMaterial color="#07101d" roughness={0.92} metalness={0.18} />
      </mesh>
      <GroundRings />
      <PrimeHorizon quality={quality} />
      <WayfindingArray quality={quality} />
      <SkyTraffic quality={quality} reducedMotion={reducedMotion} />
      <Walkway from={[0, 0, 7]} to={[0, 0, 3.4]} />
      <Walkway from={[-5.2, 0, -2.2]} to={[-15.6, 0, -4.2]} color="#2a8b6b" />
      <Walkway from={[5.2, 0, -2.2]} to={[16.4, 0, -4.2]} color="#a06b37" />
      <Walkway from={[-6.2, 0, -7]} to={[-15.8, 0, -20.4]} color="#832d79" />
      <Walkway from={[6.2, 0, -7]} to={[15.8, 0, -20.4]} color="#285ca4" />
      <Walkway from={[0, 0, -9]} to={[0, 0, -31.2]} color="#7181bb" />
      <Walkway from={[0, 0, 20.2]} to={[0, -0.25, 27]} color="#8d254c" width={1.6} />

      <SpawnPlaza eventPhase={eventPhase} winningValue={winningValue} />
      <PrimeCore proximity={coreProximity} reducedMotion={reducedMotion} eventPhase={eventSuccess === false ? 'idle' : eventPhase} winningValue={winningValue} serverIntensity={serverCoreIntensity} serverRingSpeed={serverCoreRingSpeed} />
      <PrimeGarden reducedMotion={reducedMotion} />
      <FactorTemple reducedMotion={reducedMotion} />
      <UlamTower />
      <CryptoArch />
      <Observatory />
      <VoidPlatform />
      <Secrets reducedMotion={reducedMotion} discoveredSecrets={discoveredSecrets} />

      {ONLINE_LANDMARKS.map((landmark, index) => (
        <mesh key={`beacon-${landmark.id}`} position={[landmark.position[0], 0.012, landmark.position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[index === 1 ? 5.1 : 1.1, index === 1 ? 5.16 : 1.14, 48]} />
          <meshBasicMaterial color={landmark.accent} transparent opacity={0.34} />
        </mesh>
      ))}
    </>
  )
}
