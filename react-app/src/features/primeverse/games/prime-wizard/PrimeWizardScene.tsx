import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import * as THREE from 'three'
import type { QualityProfile } from '../../graphics/useQualitySettings'

const PATH_START_Z = -30
const PATH_END_Z = 2.4
const CUBE = 0.42
const GAP = 0.1

const enemyColor = new THREE.Color('#ff7a59')
const enemyHurt = new THREE.Color('#ffffff')
const spellColor = new THREE.Color('#b9a2ff')

export interface WizardSceneSignals {
  /** Avanço do golem atual (0–1), escrito pela página a cada quadro. */
  readonly progressRef: MutableRefObject<number>
  /** Muda a cada golem novo. */
  readonly enemyKey: number
  readonly golem: { readonly rows: number; readonly columns: number }
  /** Incrementa a cada feitiço certeiro. */
  readonly hitSignal: number
  /** Incrementa a cada feitiço errado. */
  readonly missSignal: number
}

interface Props extends WizardSceneSignals {
  readonly profile: QualityProfile
  readonly reducedMotion: boolean
  readonly showBackdrop: boolean
}

function enemyPosition(progress: number, time: number, target: THREE.Vector3) {
  const z = PATH_START_Z + (PATH_END_Z - PATH_START_Z) * progress
  return target.set(Math.sin(time * 0.6) * 1.1 * (1 - progress), 0.9 + Math.sin(time * 1.7) * 0.18, z)
}

function cubeOffsets(rows: number, columns: number): THREE.Vector3[] {
  const offsets: THREE.Vector3[] = []
  const step = CUBE + GAP
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      offsets.push(new THREE.Vector3((column - (columns - 1) / 2) * step, (row - (rows - 1) / 2) * step, 0))
    }
  }
  return offsets
}

/** O golem composto: um retângulo de blocos, porque todo composto se arruma em retângulo. */
function Golem({ progressRef, golem, missSignal, reducedMotion, onPosition }: {
  progressRef: MutableRefObject<number>
  golem: { rows: number; columns: number }
  missSignal: number
  reducedMotion: boolean
  onPosition: (position: THREE.Vector3) => void
}) {
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.MeshStandardMaterial>(null)
  const hurt = useRef(0)
  const spawn = useRef(0)
  const offsets = useMemo(() => cubeOffsets(golem.rows, golem.columns), [golem.rows, golem.columns])
  const scratch = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (missSignal > 0) hurt.current = 1
  }, [missSignal])

  useFrame(({ clock }, delta) => {
    if (!group.current || !material.current) return
    const time = reducedMotion ? 0 : clock.elapsedTime
    spawn.current = Math.min(1, spawn.current + delta * 1.8)
    const position = enemyPosition(progressRef.current, time, scratch)
    group.current.position.lerp(position, spawn.current < 1 ? 1 : 0.25)
    if (!reducedMotion) {
      group.current.rotation.y = Math.sin(time * 0.9) * 0.45
      group.current.rotation.x = Math.sin(time * 0.7) * 0.18
    }
    const scale = THREE.MathUtils.smoothstep(spawn.current, 0, 1) * (1 + hurt.current * 0.18)
    group.current.scale.setScalar(scale)
    hurt.current = Math.max(0, hurt.current - delta * 2.4)
    material.current.color.copy(enemyColor).lerp(enemyHurt, hurt.current)
    material.current.emissiveIntensity = 0.9 + hurt.current * 1.5 + progressRef.current * 0.6
    onPosition(group.current.position)
  })

  return (
    <group ref={group} position={[0, 0.9, PATH_START_Z]} scale={0}>
      {offsets.map((offset, index) => (
        <mesh key={index} position={offset}>
          <boxGeometry args={[CUBE, CUBE, CUBE]} />
          <meshStandardMaterial ref={index === 0 ? material : undefined} color={enemyColor} emissive={enemyColor} emissiveIntensity={0.9} roughness={0.35} metalness={0.2} />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[golem.columns * (CUBE + GAP) + 0.2, golem.rows * (CUBE + GAP) + 0.2, CUBE + 0.2]} />
        <meshBasicMaterial color={enemyColor} wireframe transparent opacity={0.18} />
      </mesh>
    </group>
  )
}

interface Burst {
  readonly id: number
  readonly origin: THREE.Vector3
  readonly count: number
}

/** Os blocos do golem voam em pedaços quando o feitiço acerta. */
function Debris({ burst, onDone }: { burst: Burst; onDone: (id: number) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const age = useRef(0)
  const pieces = useMemo(() => Array.from({ length: burst.count }, () => ({
    position: burst.origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.4)),
    velocity: new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 6 + 1, (Math.random() - 0.3) * 6),
    spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
  })), [burst])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame((_, delta) => {
    if (!mesh.current) return
    age.current += delta
    const life = age.current / 0.9
    if (life >= 1) {
      onDone(burst.id)
      return
    }
    pieces.forEach((piece, index) => {
      piece.velocity.y -= 12 * delta
      piece.position.addScaledVector(piece.velocity, delta)
      dummy.position.copy(piece.position)
      dummy.rotation.set(piece.spin.x * age.current, piece.spin.y * age.current, piece.spin.z * age.current)
      dummy.scale.setScalar(CUBE * (1 - life))
      dummy.updateMatrix()
      mesh.current?.setMatrixAt(index, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, burst.count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffd2a8" toneMapped={false} />
    </instancedMesh>
  )
}

/** Raio do feitiço: do círculo mágico até o golem. */
function Beam({ to, onDone }: { to: THREE.Vector3; onDone: () => void }) {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshBasicMaterial>(null)
  const age = useRef(0)
  const from = useMemo(() => new THREE.Vector3(0, -1.1, 1.6), [])
  const geometry = useMemo(() => {
    const length = from.distanceTo(to)
    const shape = new THREE.CylinderGeometry(0.05, 0.16, length, 8, 1, true)
    shape.translate(0, length / 2, 0)
    shape.rotateX(Math.PI / 2)
    return shape
  }, [from, to])

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => { mesh.current?.lookAt(to) }, [to])

  useFrame((_, delta) => {
    age.current += delta
    if (material.current) material.current.opacity = Math.max(0, 1 - age.current / 0.35)
    if (age.current > 0.35) onDone()
  })

  return (
    <mesh ref={mesh} position={from} geometry={geometry}>
      <meshBasicMaterial ref={material} color={spellColor} transparent toneMapped={false} />
    </mesh>
  )
}

function MagicCircle({ reducedMotion }: { reducedMotion: boolean }) {
  const outer = useRef<THREE.Mesh>(null)
  const inner = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (reducedMotion) return
    if (outer.current) outer.current.rotation.z += delta * 0.2
    if (inner.current) inner.current.rotation.z -= delta * 0.35
  })
  return (
    <group position={[0, -1.25, 1.6]} rotation={[-Math.PI / 2, 0, 0]} scale={0.62}>
      <mesh ref={outer}>
        <ringGeometry args={[2.2, 2.26, 7, 1]} />
        <meshBasicMaterial color={spellColor} transparent opacity={0.32} toneMapped={false} />
      </mesh>
      <mesh ref={inner}>
        <ringGeometry args={[1.4, 1.44, 5, 1]} />
        <meshBasicMaterial color={spellColor} transparent opacity={0.22} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[2.6, 2.62, 96, 1]} />
        <meshBasicMaterial color={spellColor} transparent opacity={0.25} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Starfield({ count }: { count: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 80
      positions[index * 3 + 1] = Math.random() * 30 - 4
      positions[index * 3 + 2] = -Math.random() * 60 - 4
    }
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return buffer
  }, [count])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.08} color="#d9d2ff" transparent opacity={0.7} sizeAttenuation />
    </points>
  )
}

/** Caminho do portal até o mago: linhas no chão que somem na distância. */
function Path() {
  const geometry = useMemo(() => {
    const points: number[] = []
    for (let z = PATH_START_Z; z <= PATH_END_Z; z += 1.6) points.push(-3, -1.25, z, 3, -1.25, z)
    points.push(-3, -1.25, PATH_START_Z, -3, -1.25, PATH_END_Z, 3, -1.25, PATH_START_Z, 3, -1.25, PATH_END_Z)
    const buffer = new THREE.BufferGeometry()
    buffer.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return buffer
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#6d5bd0" transparent opacity={0.22} />
    </lineSegments>
  )
}

export default function PrimeWizardScene({ progressRef, enemyKey, golem, hitSignal, missSignal, profile, reducedMotion, showBackdrop }: Props) {
  const enemyAt = useRef(new THREE.Vector3(0, 0.9, PATH_START_Z))
  const previousGolem = useRef(golem)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [beams, setBeams] = useState<Array<{ id: number; to: THREE.Vector3 }>>([])

  useEffect(() => {
    if (hitSignal === 0) return
    const origin = enemyAt.current.clone()
    const count = Math.min(24, previousGolem.current.rows * previousGolem.current.columns)
    setBursts((current) => [...current, { id: hitSignal, origin, count }])
    setBeams((current) => [...current, { id: hitSignal, to: origin }])
  }, [hitSignal])

  useEffect(() => {
    previousGolem.current = golem
  }, [golem])

  return (
    <>
      {showBackdrop && <color attach="background" args={['#07060d']} />}
      {showBackdrop && <fog attach="fog" args={['#07060d', 14, 46]} />}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 4, 4]} intensity={30} color="#c8b8ff" />
      <pointLight position={[0, 2, -24]} intensity={60} color="#ff8a66" distance={30} />
      {showBackdrop && <Starfield count={Math.round(profile.stars / 3)} />}
      <Path />
      <MagicCircle reducedMotion={reducedMotion} />
      <Golem
        key={enemyKey}
        progressRef={progressRef}
        golem={golem}
        missSignal={missSignal}
        reducedMotion={reducedMotion}
        onPosition={(position) => enemyAt.current.copy(position)}
      />
      {bursts.map((burst) => (
        <Debris key={burst.id} burst={burst} onDone={(id) => setBursts((current) => current.filter((item) => item.id !== id))} />
      ))}
      {beams.map((beam) => (
        <Beam key={beam.id} to={beam.to} onDone={() => setBeams((current) => current.filter((item) => item.id !== beam.id))} />
      ))}
    </>
  )
}
