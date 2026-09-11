import { Edges, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group, Mesh } from 'three'
import { MathUtils } from 'three'

import { CAESAR_PUZZLE, decodeCaesar, normalizeCaesarShift } from '../caesarLogic'
import type { WorldPosition } from './layout'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LETTER_COUNT = ALPHABET.length
const STEP_ANGLE = (Math.PI * 2) / LETTER_COUNT
const DEFAULT_POSITION: WorldPosition = [0, 0, 0]

const CYAN = '#5df4e6'
const VIOLET = '#a28aff'
const AMBER = '#ffc553'

export interface CaesarMechanismProps {
  shift: number
  active: boolean
  solved: boolean
  reducedMotion?: boolean
  position?: WorldPosition
  onRotate?: (direction: -1 | 1) => void
  onSubmit?: () => void
  onInteract?: () => void
}

function letterPosition(index: number, radius: number): readonly [number, number, number] {
  const angle = Math.PI / 2 - index * STEP_ANGLE
  return [Math.cos(angle) * radius, Math.sin(angle) * radius, 0.34]
}

function AlphabetRing({
  radius,
  inner = false,
  active,
  solved,
}: {
  radius: number
  inner?: boolean
  active: boolean
  solved: boolean
}): JSX.Element {
  const accent = solved ? CYAN : inner ? AMBER : VIOLET

  return (
    <>
      <mesh position={[0, 0, inner ? 0.15 : 0.05]}>
        <torusGeometry args={[radius, inner ? 0.2 : 0.22, 10, 80]} />
        <meshStandardMaterial
          color={inner ? '#263b40' : '#172d38'}
          emissive={active || solved ? accent : '#061014'}
          emissiveIntensity={solved ? 0.72 : active ? 0.3 : 0.06}
          metalness={0.92}
          roughness={0.2}
        />
      </mesh>

      {[...ALPHABET].map((letter, index) => {
        const angle = Math.PI / 2 - index * STEP_ANGLE
        const highlighted = index === 0
        return (
          <group key={`${inner ? 'inner' : 'outer'}-${letter}`}>
            <mesh
              position={[
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                inner ? 0.27 : 0.18,
              ]}
              rotation={[0, 0, angle]}
            >
              <boxGeometry args={[highlighted ? 0.055 : 0.025, inner ? 0.22 : 0.25, 0.035]} />
              <meshBasicMaterial
                color={highlighted ? accent : active ? '#6f8a92' : '#3c5159'}
              />
            </mesh>
            <Text
              position={letterPosition(index, inner ? radius - 0.29 : radius + 0.31)}
              fontSize={inner ? 0.15 : 0.17}
              color={highlighted ? '#ffffff' : active || solved ? '#d8e8e9' : '#71868e'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.009}
              outlineColor="#02080b"
            >
              {letter}
            </Text>
          </group>
        )
      })}
    </>
  )
}

function RotationControl({
  direction,
  enabled,
  solved,
  onRotate,
}: {
  direction: -1 | 1
  enabled: boolean
  solved: boolean
  onRotate?: (direction: -1 | 1) => void
}): JSX.Element {
  const accent = solved ? CYAN : enabled ? AMBER : '#425961'

  return (
    <group
      position={[direction * 2.05, -1.72, 0.35]}
      onPointerDown={(event) => {
        if (enabled) event.stopPropagation()
      }}
      onClick={(event) => {
        if (!enabled) return
        event.stopPropagation()
        onRotate?.(direction)
      }}
    >
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.46, 0.18, 20]} />
        <meshStandardMaterial
          color={enabled ? '#31474c' : '#14242a'}
          emissive={enabled ? accent : '#050c0f'}
          emissiveIntensity={enabled ? 0.46 : 0.05}
          metalness={0.9}
          roughness={0.2}
        />
        <Edges color={accent} threshold={18} />
      </mesh>
      <Text
        position={[0, 0, 0.12]}
        fontSize={0.34}
        color={enabled ? '#fff8dd' : '#60757c'}
        anchorX="center"
        anchorY="middle"
      >
        {direction < 0 ? '−' : '+'}
      </Text>
    </group>
  )
}

export function CaesarMechanism({
  shift,
  active,
  solved,
  reducedMotion = false,
  position = DEFAULT_POSITION,
  onRotate,
  onSubmit,
  onInteract,
}: CaesarMechanismProps): JSX.Element {
  const innerRingRef = useRef<Group>(null)
  const haloRef = useRef<Mesh>(null)
  const normalizedShift = Number.isSafeInteger(shift) ? normalizeCaesarShift(shift) : 0
  const decodedMessage = solved
    ? CAESAR_PUZZLE.plaintext
    : decodeCaesar(CAESAR_PUZZLE.ciphertext, normalizedShift)
  const decoded = solved || decodedMessage === CAESAR_PUZZLE.plaintext
  const manipulating = Boolean(onRotate)
  const canSubmit = active && manipulating && !solved && Boolean(onSubmit)

  useFrame(({ clock }, delta) => {
    if (innerRingRef.current) {
      const target = -normalizedShift * STEP_ANGLE
      if (reducedMotion) {
        innerRingRef.current.rotation.z = target
      } else {
        const current = innerRingRef.current.rotation.z
        const shortest = MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI
        innerRingRef.current.rotation.z = MathUtils.damp(current, current + shortest, 9, delta)
      }
    }

    if (haloRef.current) {
      haloRef.current.rotation.z = reducedMotion ? 0 : clock.elapsedTime * 0.08
    }
  })

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation()
        if (!manipulating) onInteract?.()
      }}
    >
      <mesh castShadow receiveShadow position={[0, 0.14, -0.28]}>
        <boxGeometry args={[5.35, 5, 0.48]} />
        <meshStandardMaterial color="#09171e" metalness={0.88} roughness={0.3} />
        <Edges color={active ? VIOLET : '#29434e'} threshold={18} />
      </mesh>

      <mesh position={[0, 0.42, -0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.34, 2.34, 0.22, 64]} />
        <meshStandardMaterial
          color="#0c1c24"
          emissive={solved ? CYAN : active ? VIOLET : '#03080b'}
          emissiveIntensity={solved ? 0.32 : active ? 0.12 : 0.02}
          metalness={0.9}
          roughness={0.25}
        />
      </mesh>

      <group position={[0, 0.42, 0]}>
        <AlphabetRing radius={1.87} active={active} solved={solved} />
        <group ref={innerRingRef}>
          <AlphabetRing radius={1.21} inner active={active} solved={solved} />
        </group>

        <mesh position={[0, 2.52, 0.36]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.18, 0.42, 3]} />
          <meshStandardMaterial
            color={decoded ? '#eafffb' : '#fff1bd'}
            emissive={decoded ? CYAN : AMBER}
            emissiveIntensity={decoded ? 1.8 : active ? 1.1 : 0.25}
            metalness={0.72}
            roughness={0.18}
          />
        </mesh>

        <mesh ref={haloRef} position={[0, 0, -0.05]}>
          <torusGeometry args={[2.48, 0.025, 5, 92]} />
          <meshBasicMaterial
            color={solved ? CYAN : VIOLET}
            transparent
            opacity={active || solved ? 0.54 : 0.12}
          />
        </mesh>

        <group
          onPointerDown={(event) => {
            if (canSubmit) event.stopPropagation()
          }}
          onClick={(event) => {
            if (!canSubmit) return
            event.stopPropagation()
            onSubmit?.()
          }}
        >
          <mesh position={[0, 0, 0.22]}>
            <circleGeometry args={[0.72, 36]} />
            <meshStandardMaterial
              color="#061116"
              emissive={decoded ? CYAN : VIOLET}
              emissiveIntensity={decoded ? 0.52 : active ? 0.16 : 0.04}
              metalness={0.82}
              roughness={0.26}
            />
            <Edges color={decoded ? CYAN : VIOLET} />
          </mesh>
          <Text
            position={[0, 0.22, 0.28]}
            fontSize={0.13}
            color={active || solved ? '#b9ceff' : '#627580'}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.12}
          >
            CÉSAR +{normalizedShift}
          </Text>
          <Text
            position={[0, -0.04, 0.29]}
            fontSize={0.18}
            color={decoded ? '#effffc' : '#fff2c1'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#030a0d"
          >
            {CAESAR_PUZZLE.ciphertext} → {decodedMessage}
          </Text>
          {canSubmit ? (
            <Text
              position={[0, -0.33, 0.29]}
              fontSize={0.075}
              color={CYAN}
              anchorX="center"
              letterSpacing={0.1}
            >
              TOQUE PARA TRANSMITIR
            </Text>
          ) : null}
        </group>
      </group>

      <RotationControl
        direction={-1}
        enabled={active && manipulating && !solved}
        solved={solved}
        onRotate={onRotate}
      />
      <RotationControl
        direction={1}
        enabled={active && manipulating && !solved}
        solved={solved}
        onRotate={onRotate}
      />

      <Text
        position={[0, -2.25, 0.12]}
        fontSize={0.17}
        color={solved ? CYAN : active ? VIOLET : '#617985'}
        anchorX="center"
        letterSpacing={0.18}
      >
        {solved ? 'MENSAGEM DECIFRADA' : 'DISCO DE CÉSAR'}
      </Text>

      {active ? (
        <pointLight
          position={[0, 0.35, 2.6]}
          color={solved ? CYAN : VIOLET}
          intensity={solved ? 9 : 6}
          distance={6}
        />
      ) : null}
    </group>
  )
}
