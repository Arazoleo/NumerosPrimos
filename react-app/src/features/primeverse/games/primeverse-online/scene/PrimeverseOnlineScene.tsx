import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { QualityLevel, QualityProfile } from '../../../graphics/useQualitySettings'
import type { DiscoveryId } from '../discovery/discoveryProgress'
import type { PrimeverseOnlineClient, RemotePlayer } from '../network/PrimeverseOnlineClient'
import { realmForPosition, type PortalId, type RealmId } from '../shared/realms'
import type { AvatarRenderState, AvatarStateRef, CameraLook, InteractionTarget, MovementInput } from '../types'
import { DEFAULT_APPEARANCE } from '../types'
import { isInsideOnlineWorld, nearestInteraction, ONLINE_SPAWN, onlineLocationName, resolveOnlineCollision, VOID_LEVEL } from '../world'
import OnlineAvatar from './OnlineAvatar'
import { PrimeversePortalSources } from './PrimeverseGameWorlds'
import PrimeverseWorld from './PrimeverseWorld'

interface PrimeverseOnlineSceneProps {
  readonly client: PrimeverseOnlineClient
  readonly localAvatar: AvatarStateRef
  readonly remotes: readonly RemotePlayer[]
  readonly input: React.MutableRefObject<MovementInput>
  readonly look: React.MutableRefObject<CameraLook>
  readonly quality: QualityLevel
  readonly profile: QualityProfile
  readonly reducedMotion: boolean
  readonly paused: boolean
  readonly eventPhase: string
  readonly winningValue?: number | null
  readonly eventSuccess?: boolean | null
  readonly serverCoreIntensity: number
  readonly serverCoreRingSpeed: number
  readonly discoveredSecrets: readonly DiscoveryId[]
  readonly currentRealmId: RealmId
  readonly activePortalId?: PortalId | null
  readonly onPortalTravel: (portalId: PortalId) => boolean
  readonly onInteractionTarget: (target: InteractionTarget | null) => void
  readonly onLocation: (name: string) => void
  readonly onRealm: (realmId: RealmId) => void
  readonly onVoidState: (active: boolean) => void
  readonly onSecret: (id: string) => void
}

const UP = new THREE.Vector3(0, 1, 0)
const CAMERA_TARGET = new THREE.Vector3()
const CAMERA_DESIRED = new THREE.Vector3()
const CAMERA_LOOK_AT = new THREE.Vector3()
const BASE_GROUND_Y = 0.04

function PlayerController({ client, localAvatar, input, look, paused, reducedMotion, coreProximity, onInteractionTarget, onLocation, onRealm, onVoidState, onSecret, onPortalTravel }: {
  readonly client: PrimeverseOnlineClient
  readonly localAvatar: AvatarStateRef
  readonly input: React.MutableRefObject<MovementInput>
  readonly look: React.MutableRefObject<CameraLook>
  readonly paused: boolean
  readonly reducedMotion: boolean
  readonly coreProximity: React.MutableRefObject<number>
  readonly onInteractionTarget: (target: InteractionTarget | null) => void
  readonly onLocation: (name: string) => void
  readonly onRealm: (realmId: RealmId) => void
  readonly onVoidState: (active: boolean) => void
  readonly onSecret: (id: string) => void
  readonly onPortalTravel: (portalId: PortalId) => boolean
}): null {
  const { camera } = useThree()
  const velocity = useRef(new THREE.Vector3())
  const grounded = useRef(true)
  const lastTarget = useRef<string | null>(null)
  const lastLocation = useRef('Praça de Spawn')
  const lastRealm = useRef<RealmId>('nexus')
  const respawningUntil = useRef(0)
  const wasVoid = useRef(false)
  const cameraReady = useRef(false)
  const hubSessionNormalized = useRef(false)

  useEffect(() => {
    const player = localAvatar.current.position
    camera.position.set(player[0], player[1] + 4.2, player[2] + 7.2)
    camera.lookAt(player[0], player[1] + 1.35, player[2])
    cameraReady.current = true
  }, [camera, localAvatar])

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const now = performance.now()
    const state = localAvatar.current

    const correction = client.consumeAuthoritativeCorrection()
    if (correction) {
      const correctionRealm = realmForPosition(correction.position)
      if (!hubSessionNormalized.current && correctionRealm?.id !== 'nexus') {
        hubSessionNormalized.current = true
        state.position = [...ONLINE_SPAWN]
        state.yaw = Math.PI
        state.animation = 'idle'
        state.speed = 0
        velocity.current.set(0, 0, 0)
        grounded.current = true
        // Activity handoff is owned by the hub shell. A correction left by an
        // expedition must not consume the same server interaction throttle and
        // prevent change_activity('nexus') from being acknowledged.
        if (client.getSnapshot().activityId === 'nexus') {
          client.sendInteraction('spawn-plaza', 'respawn')
        }
      } else {
        hubSessionNormalized.current = true
        const isLongJump = Math.hypot(
          correction.position[0] - state.position[0],
          correction.position[2] - state.position[2],
        ) > 18
        state.position = [...correction.position]
        state.yaw = correction.yaw
        state.animation = correction.animation
        state.speed = 0
        velocity.current.set(0, 0, 0)
        grounded.current = state.position[1] <= BASE_GROUND_Y + 0.08
        if (isLongJump) {
          camera.position.set(state.position[0], state.position[1] + 4.2, state.position[2] + 7.2)
          camera.lookAt(state.position[0], state.position[1] + 1.35, state.position[2])
        }
      }
    }

    if (paused) {
      velocity.current.x = 0
      velocity.current.z = 0
      input.current.jumpQueued = false
      if (grounded.current) {
        state.animation = 'idle'
        state.speed = 0
      }
    } else if (respawningUntil.current > 0) {
      if (now >= respawningUntil.current) {
        state.position = [...ONLINE_SPAWN]
        state.yaw = 0
        state.animation = 'idle'
        state.speed = 0
        velocity.current.set(0, 0, 0)
        grounded.current = true
        respawningUntil.current = 0
        wasVoid.current = false
        onVoidState(false)
        client.sendInteraction('spawn-plaza', 'respawn')
      }
    } else if (!paused) {
      const keyboardX = (input.current.keys.has('KeyD') ? 1 : 0) - (input.current.keys.has('KeyA') ? 1 : 0)
      const keyboardZ = (input.current.keys.has('KeyW') ? 1 : 0) - (input.current.keys.has('KeyS') ? 1 : 0)
      const localX = THREE.MathUtils.clamp(keyboardX + input.current.touchX, -1, 1)
      const localZ = THREE.MathUtils.clamp(keyboardZ + input.current.touchZ, -1, 1)
      const inputLength = Math.min(1, Math.hypot(localX, localZ))
      const sprint = input.current.sprintHeld || input.current.keys.has('ShiftLeft') || input.current.keys.has('ShiftRight')
      const targetSpeed = inputLength > 0 ? (sprint ? 7.4 : 4.25) : 0
      const forwardX = -Math.sin(look.current.yaw)
      const forwardZ = -Math.cos(look.current.yaw)
      const rightX = Math.cos(look.current.yaw)
      const rightZ = -Math.sin(look.current.yaw)
      const normalized = Math.max(1, Math.hypot(localX, localZ))
      const moveX = (forwardX * localZ + rightX * localX) / normalized
      const moveZ = (forwardZ * localZ + rightZ * localX) / normalized
      const acceleration = grounded.current ? 18 : 7.5
      velocity.current.x = THREE.MathUtils.damp(velocity.current.x, moveX * targetSpeed, acceleration, delta)
      velocity.current.z = THREE.MathUtils.damp(velocity.current.z, moveZ * targetSpeed, acceleration, delta)

      if (input.current.jumpQueued && grounded.current) {
        velocity.current.y = 7.15
        grounded.current = false
      }
      input.current.jumpQueued = false
      velocity.current.y -= 18.5 * delta

      const previous = state.position
      const requested: readonly [number, number, number] = [
        previous[0] + velocity.current.x * delta,
        previous[1] + velocity.current.y * delta,
        previous[2] + velocity.current.z * delta,
      ]
      const resolved = resolveOnlineCollision(previous, requested)
      if (resolved[0] === previous[0] && Math.abs(requested[0] - previous[0]) > 0.001) velocity.current.x = 0
      if (resolved[2] === previous[2] && Math.abs(requested[2] - previous[2]) > 0.001) velocity.current.z = 0

      if (resolved[1] <= BASE_GROUND_Y) {
        resolved[1] = BASE_GROUND_Y
        velocity.current.y = 0
        grounded.current = true
      }
      state.position = resolved
      const planarSpeed = Math.hypot(velocity.current.x, velocity.current.z)
      state.speed = planarSpeed
      if (!grounded.current) state.animation = 'jump'
      else if (planarSpeed > 5.15) state.animation = 'run'
      else if (planarSpeed > 0.28) state.animation = 'walk'
      else state.animation = 'idle'
      // The procedural avatar faces local +Z (its visor is on that side), so
      // rotate +Z onto the world-space velocity vector.
      if (planarSpeed > 0.22) state.yaw = Math.atan2(velocity.current.x, velocity.current.z)

      if (!isInsideOnlineWorld(state.position) || state.position[1] < VOID_LEVEL) {
        respawningUntil.current = now + (reducedMotion ? 120 : 720)
        wasVoid.current = true
        onVoidState(true)
      }

      const target = nearestInteraction(state.position)
      if ((target?.id ?? null) !== lastTarget.current) {
        lastTarget.current = target?.id ?? null
        onInteractionTarget(target)
      }
      if (input.current.keys.has('InteractQueued')) {
        input.current.keys.delete('InteractQueued')
        if (target) {
          if (target.id.startsWith('pedestal-')) client.sendInteraction(target.id as `pedestal-${12 | 13 | 15 | 17}`, 'vote')
          else if (target.id.startsWith('secret-')) {
            client.sendInteraction(target.id as 'secret-997' | 'secret-mersenne' | 'secret-constellation', 'discover')
            onSecret(target.id)
          } else if (target.id.startsWith('portal-')) {
            const portalId = target.id as PortalId
            if (!onPortalTravel(portalId)) client.sendInteraction(portalId, 'travel')
          } else client.sendInteraction('prime-core', 'activate')
        }
      }

      const locationName = onlineLocationName(state.position)
      if (locationName !== lastLocation.current) {
        lastLocation.current = locationName
        onLocation(locationName)
      }
      const realm = realmForPosition(state.position)
      if (realm && realm.id !== lastRealm.current) {
        lastRealm.current = realm.id
        onRealm(realm.id)
      }

      coreProximity.current = THREE.MathUtils.clamp(1 - Math.hypot(state.position[0], state.position[2]) / 11, 0, 1)
      client.sendMovement(state.position, state.yaw, state.animation)
    }

    if (!cameraReady.current) return
    const avatarPosition = localAvatar.current.position
    const yaw = look.current.yaw
    const pitch = look.current.pitch
    CAMERA_TARGET.set(avatarPosition[0], avatarPosition[1] + 1.25, avatarPosition[2])
    const distance = 6.5
    CAMERA_DESIRED.set(
      CAMERA_TARGET.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      CAMERA_TARGET.y + 2.15 + Math.sin(pitch) * distance,
      CAMERA_TARGET.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    )
    const cameraDamping = reducedMotion ? 20 : 9.5
    camera.position.lerp(CAMERA_DESIRED, 1 - Math.exp(-delta * cameraDamping))
    CAMERA_LOOK_AT.copy(CAMERA_TARGET)
    if (!reducedMotion && localAvatar.current.animation === 'run') {
      CAMERA_LOOK_AT.y += Math.sin(clock.elapsedTime * 12) * 0.018
      camera.position.y += Math.sin(clock.elapsedTime * 12) * 0.012
    }
    camera.up.copy(UP)
    camera.lookAt(CAMERA_LOOK_AT)
  })

  return null
}

function RemoteAvatar({ player, client, reducedMotion, paused }: {
  readonly player: RemotePlayer
  readonly client: PrimeverseOnlineClient
  readonly reducedMotion: boolean
  readonly paused: boolean
}): JSX.Element {
  const first = client.sampleRemote(player.id)
  const state = useRef<AvatarRenderState>({
    position: first?.position ?? [0, BASE_GROUND_Y, 13],
    yaw: first?.yaw ?? 0,
    animation: first?.animation ?? 'idle',
    speed: 0,
    nickname: player.nickname,
    appearance: player.appearance ?? DEFAULT_APPEARANCE,
    emote: player.emote,
  })

  useEffect(() => {
    state.current.nickname = player.nickname
    state.current.appearance = player.appearance
    state.current.emote = player.emote
  }, [player.appearance, player.emote, player.nickname])

  useFrame(() => {
    if (paused) {
      state.current.animation = 'idle'
      state.current.speed = 0
      return
    }
    const sample = client.sampleRemote(player.id)
    if (!sample) return
    const prior = state.current.position
    state.current.position = sample.position
    state.current.speed = Math.hypot(sample.position[0] - prior[0], sample.position[2] - prior[2]) * 15
    state.current.yaw = sample.yaw
    state.current.animation = sample.animation
  })

  return <OnlineAvatar state={state} reducedMotion={reducedMotion} />
}

function PrimeWave({ active }: { readonly active: boolean }): JSX.Element | null {
  const root = useRef<THREE.Mesh>(null)
  const bornAt = useRef(performance.now())
  useEffect(() => { bornAt.current = performance.now() }, [active])
  useFrame(() => {
    if (!root.current || !active) return
    const alpha = Math.min(1, (performance.now() - bornAt.current) / 1600)
    root.current.scale.setScalar(1 + alpha * 14)
    const material = root.current.material as THREE.MeshBasicMaterial
    material.opacity = (1 - alpha) * 0.72
  })
  if (!active) return null
  return (
    <mesh ref={root} position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1.02, 72]} />
      <meshBasicMaterial color="#fff29a" transparent opacity={0.72} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

export default function PrimeverseOnlineScene(props: PrimeverseOnlineSceneProps): JSX.Element {
  const coreProximity = useRef(0)
  const waveKey = useMemo(() => `${props.eventPhase}-${props.winningValue ?? 0}`, [props.eventPhase, props.winningValue])

  return (
    <>
      <PrimeverseWorld
        quality={props.quality}
        profile={props.profile}
        reducedMotion={props.reducedMotion}
        coreProximity={coreProximity}
        eventPhase={props.eventPhase}
        winningValue={props.winningValue}
        eventSuccess={props.eventSuccess}
        serverCoreIntensity={props.serverCoreIntensity}
        serverCoreRingSpeed={props.serverCoreRingSpeed}
        discoveredSecrets={props.discoveredSecrets}
        currentRealmId={props.currentRealmId}
      />
      <PrimeversePortalSources
        quality={props.quality}
        reducedMotion={props.reducedMotion}
        activePortalId={props.activePortalId}
        fromRealm="nexus"
        onPortalSelect={(route) => { props.onPortalTravel(route.id) }}
      />
      <OnlineAvatar state={props.localAvatar} local reducedMotion={props.reducedMotion} />
      {props.remotes.map((player) => <RemoteAvatar key={player.id} player={player} client={props.client} reducedMotion={props.reducedMotion} paused={props.paused} />)}
      <PrimeWave key={waveKey} active={props.eventPhase === 'revealed' && props.eventSuccess === true && props.winningValue === 13} />
      <PlayerController
        client={props.client}
        localAvatar={props.localAvatar}
        input={props.input}
        look={props.look}
        paused={props.paused}
        reducedMotion={props.reducedMotion}
        coreProximity={coreProximity}
        onInteractionTarget={props.onInteractionTarget}
        onLocation={props.onLocation}
        onRealm={props.onRealm}
        onVoidState={props.onVoidState}
        onSecret={props.onSecret}
        onPortalTravel={props.onPortalTravel}
      />
    </>
  )
}
