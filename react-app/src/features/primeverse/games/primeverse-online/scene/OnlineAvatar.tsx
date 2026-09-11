import { Billboard, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

import { EMOTE_DURATION_MS, EMOTE_GLYPHS } from '../shared/protocol'
import type { AvatarStateRef } from '../types'

// Every avatar reuses the same lightweight geometry pool; only its color materials differ.
const TORSO_GEOMETRY = new THREE.CapsuleGeometry(0.38, 0.62, 7, 12)
const CORE_GEOMETRY = new THREE.SphereGeometry(0.17, 16, 10)
const HEAD_GEOMETRY = new THREE.SphereGeometry(0.39, 16, 10)
const VISOR_GEOMETRY = new THREE.SphereGeometry(0.32, 16, 8)
const ANTENNA_GEOMETRY = new THREE.ConeGeometry(0.1, 0.28, 6)
const ARM_GEOMETRY = new THREE.CapsuleGeometry(0.13, 0.54, 5, 8)
const HAND_GEOMETRY = new THREE.SphereGeometry(0.15, 10, 8)
const LEG_GEOMETRY = new THREE.CapsuleGeometry(0.16, 0.6, 5, 8)
const FOOT_GEOMETRY = new THREE.BoxGeometry(0.28, 0.25, 0.42)
const EMOTE_BACKDROP_GEOMETRY = new THREE.CircleGeometry(0.43, 24)
const ARRIVAL_RING_GEOMETRY = new THREE.RingGeometry(0.42, 0.49, 36)
const ARRIVAL_BEAM_GEOMETRY = new THREE.CylinderGeometry(0.32, 0.62, 3.1, 16, 1, true)
const AURA_GEOMETRY = new THREE.TorusGeometry(0.62, 0.018, 5, 40)
const PRESENCE_RING_GEOMETRY = new THREE.RingGeometry(0.52, 0.55, 40)
const PRESENCE_DOT_GEOMETRY = new THREE.CircleGeometry(0.052, 12)
const NAMEPLATE_GEOMETRY = new THREE.PlaneGeometry(1, 1)

const damp = (current: number, target: number, smoothing: number, delta: number): number => (
  THREE.MathUtils.damp(current, target, smoothing, delta)
)

function dampRotation(
  group: THREE.Group | null,
  x: number,
  y: number,
  z: number,
  delta: number,
  smoothing = 14,
): void {
  if (!group) return
  group.rotation.x = damp(group.rotation.x, x, smoothing, delta)
  group.rotation.y = damp(group.rotation.y, y, smoothing, delta)
  group.rotation.z = damp(group.rotation.z, z, smoothing, delta)
}

interface OnlineAvatarProps {
  readonly state: AvatarStateRef
  readonly local?: boolean
  readonly reducedMotion?: boolean
}

export default function OnlineAvatar({ state, local = false, reducedMotion = false }: OnlineAvatarProps): JSX.Element {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const antenna = useRef<THREE.Mesh>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Group>(null)
  const rightLeg = useRef<THREE.Group>(null)
  const leftFoot = useRef<THREE.Mesh>(null)
  const rightFoot = useRef<THREE.Mesh>(null)
  const core = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>>(null)
  const nameMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const nameBackdropMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const nameplate = useRef<THREE.Group>(null)
  const presenceDot = useRef<THREE.Mesh>(null)
  const presenceRing = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null)
  const aura = useRef<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>(null)
  const emoteRoot = useRef<THREE.Group>(null)
  const emoteBackdrop = useRef<THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>>(null)
  const emoteHalo = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null)
  const emoteMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const emoteText = useRef<(THREE.Mesh & { text: string; sync: () => void }) | null>(null)
  const lastEmoteGlyph = useRef('✦')
  const targetPosition = useRef(new THREE.Vector3())
  const arrivalRing = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null)
  const arrivalBeam = useRef<THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>>(null)
  const arrivalScan = useRef<THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>>(null)
  const arrivalStartedAt = useRef(typeof performance === 'undefined' ? 0 : performance.now())
  const landingStartedAt = useRef(Number.NEGATIVE_INFINITY)
  const previousAnimation = useRef(state.current.animation)
  const { camera } = useThree()
  const appearance = state.current.appearance
  const initialPosition = useMemo(() => new THREE.Vector3(...state.current.position), [state])
  const visorStyle = appearance.visorStyle ?? 'slit'
  const auraStyle = appearance.auraStyle ?? 'none'
  const visorScale = visorStyle === 'halo'
    ? ([1.04, 0.58, 0.16] as const)
    : visorStyle === 'triad'
      ? ([0.78, 0.68, 0.19] as const)
      : ([1, 0.38, 0.18] as const)

  useFrame(({ clock }, delta) => {
    if (!root.current) return
    const render = state.current
    const now = performance.now()
    const smoothing = local ? 1 : 1 - Math.exp(-delta * 18)
    if (local) root.current.position.set(...render.position)
    else {
      targetPosition.current.set(...render.position)
      root.current.position.lerp(targetPosition.current, smoothing)
    }

    if (previousAnimation.current === 'jump' && render.animation !== 'jump') landingStartedAt.current = now
    previousAnimation.current = render.animation

    const arrivalAge = reducedMotion ? 2 : (now - arrivalStartedAt.current) / 1_000
    const arrivalProgress = THREE.MathUtils.clamp(arrivalAge / 0.72, 0, 1)
    const arrivalOffset = arrivalProgress - 1
    const arrivalScale = reducedMotion
      ? 1
      : Math.max(0.001, 1 + 2.70158 * arrivalOffset ** 3 + 1.70158 * arrivalOffset ** 2)
    const landingAge = (now - landingStartedAt.current) / 1_000
    const landingProgress = THREE.MathUtils.clamp(landingAge / 0.42, 0, 1)
    const landingWeight = landingAge >= 0 && landingAge < 0.42
      ? Math.sin(landingProgress * Math.PI) * (reducedMotion ? 0.35 : 1)
      : 0

    let yawDelta = render.yaw - root.current.rotation.y
    while (yawDelta > Math.PI) yawDelta -= Math.PI * 2
    while (yawDelta < -Math.PI) yawDelta += Math.PI * 2
    root.current.rotation.y += local ? yawDelta : yawDelta * smoothing

    const time = clock.elapsedTime
    const moving = render.animation === 'walk' || render.animation === 'run'
    const runWeight = render.animation === 'run' ? 1 : 0
    const locomotionWeight = render.animation === 'run' ? 1 : render.animation === 'walk' ? 0.72 : 0
    const strideRate = 7.2 + Math.min(render.speed, 7.5) * 0.72
    const strideWave = moving && !reducedMotion ? Math.sin(time * strideRate) : 0
    const stride = strideWave * (0.5 + runWeight * 0.2)
    const stepBounce = moving && !reducedMotion ? Math.abs(Math.cos(time * strideRate)) * (0.035 + runWeight * 0.035) : 0
    const idle = !moving && render.animation !== 'jump' && !reducedMotion ? Math.sin(time * 2.1) * 0.025 : 0

    const emoteAge = render.emote ? Math.max(0, Date.now() - render.emote.startedAt) : Number.POSITIVE_INFINITY
    const emoteDurationMs = render.emote?.durationMs ?? EMOTE_DURATION_MS
    const emoteKind = emoteAge < emoteDurationMs ? render.emote?.kind : undefined
    const emotePhase = Math.min(1, emoteAge / 260)
    const emoteExit = THREE.MathUtils.clamp((emoteDurationMs - emoteAge) / 260, 0, 1)
    const emoteWeight = emoteKind ? Math.sin(emotePhase * Math.PI * 0.5) * emoteExit : 0

    let leftArmX = moving ? stride : 0
    let leftArmZ = 0
    let rightArmX = moving ? -stride : 0
    let rightArmZ = 0
    let headX = 0
    let headY = 0
    let headZ = 0
    let emoteLift = 0

    if (render.animation === 'jump') {
      leftArmX = -2.12
      rightArmX = -2.12
      leftArmZ = -0.13
      rightArmZ = 0.13
    }
    if (emoteKind === 'wave') {
      rightArmX = -0.28
      rightArmZ = 2.5 + (reducedMotion ? 0 : Math.sin(time * 10) * 0.2)
      leftArmX *= 0.2
      headZ = -0.13
    } else if (emoteKind === 'celebrate') {
      leftArmZ = -2.42
      rightArmZ = 2.42
      leftArmX = reducedMotion ? 0 : Math.sin(time * 7) * 0.18
      rightArmX = -leftArmX
      emoteLift = reducedMotion ? 0.03 : Math.abs(Math.sin(time * 7)) * 0.09
    } else if (emoteKind === 'heart') {
      leftArmX = -0.9
      rightArmX = -0.9
      leftArmZ = 0.72
      rightArmZ = -0.72
      headX = 0.09
    } else if (emoteKind === 'question') {
      rightArmX = -1.18
      rightArmZ = 1.15
      leftArmZ = -0.2
      headZ = reducedMotion ? 0.18 : 0.18 + Math.sin(time * 2.8) * 0.055
      headY = -0.18
    } else if (emoteKind === 'spark') {
      leftArmX = -0.72
      rightArmX = -0.72
      leftArmZ = -1.05
      rightArmZ = 1.05
      headX = -0.12
      emoteLift = reducedMotion ? 0.04 : Math.sin(time * 12) * 0.035
    }

    leftArmX *= emoteKind ? emoteWeight : 1
    rightArmX *= emoteKind ? emoteWeight : 1
    leftArmZ *= emoteWeight || (emoteKind ? 0 : 1)
    rightArmZ *= emoteWeight || (emoteKind ? 0 : 1)
    headX *= emoteWeight
    headY *= emoteWeight
    headZ *= emoteWeight

    if (body.current) {
      body.current.position.y = idle + stepBounce + emoteLift * emoteWeight + (render.animation === 'jump' ? 0.08 : 0) - landingWeight * 0.08
      body.current.rotation.x = damp(body.current.rotation.x, moving ? 0.035 + runWeight * 0.1 : 0, 10, delta)
      body.current.rotation.z = damp(body.current.rotation.z, moving ? strideWave * 0.035 * locomotionWeight : 0, 12, delta)
      body.current.scale.set(
        arrivalScale * (1 + landingWeight * 0.055),
        arrivalScale * (1 - landingWeight * 0.1),
        arrivalScale * (1 + landingWeight * 0.055),
      )
    }
    if (arrivalRing.current) {
      const arriving = arrivalAge < 1.15
      arrivalRing.current.visible = arriving || landingWeight > 0
      arrivalRing.current.scale.setScalar(arriving ? 0.65 + arrivalAge * 2.25 : 0.8 + landingProgress * 1.45)
      arrivalRing.current.material.opacity = arriving
        ? Math.max(0, 0.72 * (1 - arrivalAge / 1.15))
        : landingWeight * 0.48
    }
    if (arrivalBeam.current) {
      arrivalBeam.current.visible = arrivalAge < 0.85
      arrivalBeam.current.material.opacity = Math.max(0, 0.22 * (1 - arrivalAge / 0.85))
      arrivalBeam.current.rotation.y = time * 0.5
      arrivalBeam.current.scale.y = 0.7 + arrivalProgress * 0.3
    }
    if (arrivalScan.current) {
      arrivalScan.current.visible = arrivalAge < 0.82
      arrivalScan.current.position.y = 0.16 + (arrivalAge * 4.2) % 2.65
      arrivalScan.current.scale.setScalar(0.72 + arrivalProgress * 0.28)
      arrivalScan.current.material.opacity = Math.max(0, Math.sin(arrivalProgress * Math.PI) * 0.75)
    }

    dampRotation(leftArm.current, leftArmX, 0, leftArmZ, delta)
    dampRotation(rightArm.current, rightArmX, 0, rightArmZ, delta)
    dampRotation(leftLeg.current, render.animation === 'jump' ? 0.68 : -stride * 0.82, 0, moving ? -strideWave * 0.025 : 0, delta)
    dampRotation(rightLeg.current, render.animation === 'jump' ? -0.28 : stride * 0.82, 0, moving ? strideWave * 0.025 : 0, delta)
    dampRotation(head.current, headX, headY, headZ, delta, 10)
    if (leftFoot.current) leftFoot.current.rotation.x = damp(leftFoot.current.rotation.x, moving ? Math.max(-0.18, stride * 0.24) : 0, 14, delta)
    if (rightFoot.current) rightFoot.current.rotation.x = damp(rightFoot.current.rotation.x, moving ? Math.max(-0.18, -stride * 0.24) : 0, 14, delta)
    if (antenna.current) antenna.current.rotation.z = reducedMotion ? 0 : damp(antenna.current.rotation.z, moving ? -strideWave * 0.11 : Math.sin(time * 2.1) * 0.025, 9, delta)
    if (core.current) {
      const sparkBoost = emoteKind === 'spark' ? emoteWeight * 2.2 : 0
      core.current.material.emissiveIntensity = 1.5 + Math.sin(time * 3.2) * 0.35 + runWeight * 0.75 + sparkBoost
      const coreScale = 1 + sparkBoost * 0.08
      core.current.scale.setScalar(coreScale)
    }

    const distance = camera.position.distanceTo(root.current.position)
    const nameOpacity = THREE.MathUtils.clamp(1 - (distance - 8) / 24, 0, local ? 0.72 : 1)
    if (nameplate.current) nameplate.current.visible = nameOpacity > 0.01 && arrivalAge > 0.18
    if (nameMaterial.current) nameMaterial.current.opacity = nameOpacity
    if (nameBackdropMaterial.current) nameBackdropMaterial.current.opacity = nameOpacity * (local ? 0.34 : 0.52)
    if (presenceDot.current) {
      const pulse = reducedMotion ? 1 : 0.86 + Math.sin(time * 3.4) * 0.14
      presenceDot.current.scale.setScalar(pulse)
    }
    if (presenceRing.current) {
      presenceRing.current.visible = arrivalAge > 0.7 && distance < 30
      presenceRing.current.rotation.z = time * (local ? 0.08 : 0.16)
      presenceRing.current.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(time * 1.8) * 0.045))
      presenceRing.current.material.opacity = THREE.MathUtils.clamp(nameOpacity * (local ? 0.055 : 0.14), 0, 0.14)
    }
    if (aura.current) {
      const isPulse = auraStyle === 'pulse'
      aura.current.rotation.y = time * (isPulse ? 0.22 : 0.62)
      aura.current.rotation.z = isPulse ? 0 : Math.sin(time * 0.8) * 0.22
      const auraPulse = reducedMotion ? 1 : 1 + Math.sin(time * (isPulse ? 2.8 : 1.8)) * (isPulse ? 0.085 : 0.025)
      aura.current.scale.setScalar(auraPulse + (emoteKind === 'spark' ? emoteWeight * 0.2 : 0))
      aura.current.material.opacity = (isPulse ? 0.16 : 0.25) + (emoteKind === 'spark' ? emoteWeight * 0.35 : 0)
    }
    if (emoteRoot.current) {
      const glyph = render.emote ? EMOTE_GLYPHS[render.emote.kind] : '✦'
      if (emoteText.current && glyph !== lastEmoteGlyph.current) {
        lastEmoteGlyph.current = glyph
        emoteText.current.text = glyph
        emoteText.current.sync()
      }
      const fadeStartsAt = emoteDurationMs * 0.72
      const fadeDuration = Math.max(1, emoteDurationMs - fadeStartsAt)
      emoteRoot.current.visible = emoteAge < emoteDurationMs
      emoteRoot.current.position.y = 3.2 + (reducedMotion ? 0 : Math.min(emoteAge / 1000, 1) * 0.28)
      emoteRoot.current.rotation.z = reducedMotion ? 0 : Math.sin(time * 2.5) * 0.035
      const fade = emoteAge < fadeStartsAt ? 1 : Math.max(0, 1 - (emoteAge - fadeStartsAt) / fadeDuration)
      const emoteScale = 0.72 + Math.sin(Math.min(1, emoteAge / 260) * Math.PI * 0.5) * 0.34
      emoteRoot.current.scale.setScalar(emoteScale)
      if (emoteBackdrop.current) emoteBackdrop.current.material.opacity = fade * 0.84
      if (emoteHalo.current) {
        emoteHalo.current.rotation.z = time * 0.62
        emoteHalo.current.material.opacity = fade * 0.82
      }
      if (emoteMaterial.current) emoteMaterial.current.opacity = fade
    }
  })

  return (
    <group ref={root} position={initialPosition} dispose={null}>
      <mesh ref={arrivalRing} geometry={ARRIVAL_RING_GEOMETRY} position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={appearance.accentColor} transparent opacity={0.72} depthWrite={false} />
      </mesh>
      <mesh ref={arrivalBeam} geometry={ARRIVAL_BEAM_GEOMETRY} position={[0, 1.45, 0]}>
        <meshBasicMaterial color={appearance.accentColor} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={arrivalScan} geometry={ARRIVAL_RING_GEOMETRY} position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={appearance.visorColor} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={presenceRing} geometry={PRESENCE_RING_GEOMETRY} position={[0, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={appearance.accentColor} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      {auraStyle !== 'none' && (
        <mesh
          ref={aura}
          geometry={AURA_GEOMETRY}
          position={auraStyle === 'pulse' ? [0, 0.18, 0] : [0, 1.42, 0]}
          rotation={auraStyle === 'pulse' ? [Math.PI / 2, 0, 0] : [0.28, 0, 0]}
        >
          <meshBasicMaterial color={appearance.accentColor} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      <group ref={body} scale={reducedMotion ? 1 : 0.001}>
        <mesh geometry={TORSO_GEOMETRY} castShadow position={[0, 1.38, 0]}>
          <meshStandardMaterial color={appearance.bodyColor} roughness={0.34} metalness={0.68} />
        </mesh>
        <mesh geometry={CORE_GEOMETRY} position={[0, 1.46, 0.37]} ref={core}>
          <meshStandardMaterial color={appearance.accentColor} emissive={appearance.accentColor} emissiveIntensity={1.7} roughness={0.16} metalness={0.38} />
        </mesh>
        <group ref={head} position={[0, 2.17, 0]}>
          <mesh geometry={HEAD_GEOMETRY} castShadow>
            <meshStandardMaterial color={appearance.bodyColor} roughness={0.28} metalness={0.72} />
          </mesh>
          <mesh geometry={VISOR_GEOMETRY} position={[0, 0.03, 0.34]} scale={visorScale}>
            <meshStandardMaterial color={appearance.visorColor} emissive={appearance.accentColor} emissiveIntensity={1.5} metalness={0.2} roughness={0.12} />
          </mesh>
          <mesh ref={antenna} geometry={ANTENNA_GEOMETRY} position={[0, 0.45, 0]}>
            <meshStandardMaterial color={appearance.accentColor} emissive={appearance.accentColor} emissiveIntensity={1.3} />
          </mesh>
        </group>

        <group ref={leftArm} position={[-0.49, 1.72, 0]}>
          <mesh geometry={ARM_GEOMETRY} castShadow position={[0, -0.42, 0]}>
            <meshStandardMaterial color={appearance.bodyColor} roughness={0.38} metalness={0.65} />
          </mesh>
          <mesh geometry={HAND_GEOMETRY} position={[0, -0.78, 0]}>
            <meshStandardMaterial color={appearance.accentColor} emissive={appearance.accentColor} emissiveIntensity={0.75} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.49, 1.72, 0]}>
          <mesh geometry={ARM_GEOMETRY} castShadow position={[0, -0.42, 0]}>
            <meshStandardMaterial color={appearance.bodyColor} roughness={0.38} metalness={0.65} />
          </mesh>
          <mesh geometry={HAND_GEOMETRY} position={[0, -0.78, 0]}>
            <meshStandardMaterial color={appearance.accentColor} emissive={appearance.accentColor} emissiveIntensity={0.75} />
          </mesh>
        </group>
        <group ref={leftLeg} position={[-0.22, 1.03, 0]}>
          <mesh geometry={LEG_GEOMETRY} castShadow position={[0, -0.45, 0]}>
            <meshStandardMaterial color={appearance.bodyColor} roughness={0.45} metalness={0.55} />
          </mesh>
          <mesh ref={leftFoot} geometry={FOOT_GEOMETRY} castShadow position={[0, -0.83, 0.09]} scale={[1.1, 0.65, 1.45]}>
            <meshStandardMaterial color="#07101d" roughness={0.6} metalness={0.45} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.22, 1.03, 0]}>
          <mesh geometry={LEG_GEOMETRY} castShadow position={[0, -0.45, 0]}>
            <meshStandardMaterial color={appearance.bodyColor} roughness={0.45} metalness={0.55} />
          </mesh>
          <mesh ref={rightFoot} geometry={FOOT_GEOMETRY} castShadow position={[0, -0.83, 0.09]} scale={[1.1, 0.65, 1.45]}>
            <meshStandardMaterial color="#07101d" roughness={0.6} metalness={0.45} />
          </mesh>
        </group>
      </group>

      <group ref={nameplate}>
        <Billboard position={[0, 2.86, 0]} follow>
          <mesh position={[0, 0.15, -0.018]} scale={[2.25, 0.38, 1]}>
            <primitive object={NAMEPLATE_GEOMETRY} attach="geometry" />
            <meshBasicMaterial ref={nameBackdropMaterial} color="#020817" transparent opacity={0.46} depthTest={false} depthWrite={false} />
          </mesh>
          <mesh ref={presenceDot} geometry={PRESENCE_DOT_GEOMETRY} position={[-0.86, 0.15, 0.006]}>
            <meshBasicMaterial color={appearance.accentColor} transparent opacity={0.95} depthTest={false} depthWrite={false} />
          </mesh>
          <Text position={[0.08, 0.03, 0.01]} fontSize={0.25} color="#f1fbff" anchorY="bottom" outlineColor="#020611" outlineWidth={0.025}>
            {state.current.nickname}
            <meshBasicMaterial ref={nameMaterial} transparent depthTest={false} depthWrite={false} />
          </Text>
        </Billboard>
      </group>

      <group ref={emoteRoot} visible={false}>
        <Billboard follow>
          <mesh ref={emoteBackdrop} geometry={EMOTE_BACKDROP_GEOMETRY} position={[0, 0, -0.015]}>
            <meshBasicMaterial color="#07111f" transparent opacity={0.84} depthTest={false} depthWrite={false} />
          </mesh>
          <mesh ref={emoteHalo} geometry={ARRIVAL_RING_GEOMETRY} position={[0, 0, -0.007]}>
            <meshBasicMaterial color={appearance.accentColor} transparent opacity={0.82} depthTest={false} depthWrite={false} />
          </mesh>
          <Text ref={emoteText} position={[0, -0.01, 0]} fontSize={0.48} color="#ffffff" outlineColor="#08111e" outlineWidth={0.025}>
            {state.current.emote ? EMOTE_GLYPHS[state.current.emote.kind] : '✦'}
            <meshBasicMaterial ref={emoteMaterial} color="#ffffff" transparent depthTest={false} depthWrite={false} />
          </Text>
        </Billboard>
      </group>
    </group>
  )
}
