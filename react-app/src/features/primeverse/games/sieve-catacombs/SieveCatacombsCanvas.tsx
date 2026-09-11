import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SceneBoundary } from '../../ui/SceneBoundary'
import {
  ExpeditionPartyAvatars,
  type PrimeverseExpeditionParty,
} from '../primeverse-online/party'
import {
  catacombsCampaignObjective,
  createInitialCatacombsCampaign,
  getCurrentCatacombsLevel,
} from './campaignLogic'
import { createInitialGameState } from './gameLogic'
import { consumeLobbyTicket } from '../primeverse-online/party/lobbyTicket'
import { usePrimeverseSession } from '../primeverse-online/session/PrimeverseSessionProvider'
import type { CatacombsCoopBridge } from './types'
import { createMusicDirector, startMusicOnFirstGesture } from '../../audio/proceduralMusic'
import { CATACOMBS_TRACK } from '../../audio/tracks'
import { useAudioResource } from '../../audio/useAudioResource'
import { createHorrorAudio } from './horrorAudio'
import CatacombsIntroCutscene from './CatacombsIntroCutscene'
import CatacombsJumpscareOverlay from './CatacombsJumpscare'
import { createLevelEnemies, getCatacombsLevelWorld } from './levelWorld'
import SieveCatacombsHud from './SieveCatacombsHud'
import SieveCatacombsScene from './SieveCatacombsScene'
import type {
  CatacombsControls,
  CatacombsSnapshot,
  HeldControl,
  PulseControl,
} from './types'

interface SieveCatacombsCanvasProps {
  readonly active: boolean
  readonly reducedMotion: boolean
  readonly party: PrimeverseExpeditionParty
  readonly onStart: () => void
}

function initialSnapshot(): CatacombsSnapshot {
  const game = createInitialGameState(0)
  const campaign = createInitialCatacombsCampaign(0)
  const level = getCurrentCatacombsLevel(campaign)
  const world = getCatacombsLevelWorld(level.id)
  return {
    game,
    campaign,
    level,
    playerPosition: { x: world.playerStart.x, y: 0, z: world.playerStart.z },
    playerYaw: 0,
    enemies: createLevelEnemies(world),
    sector: 'Recepção sem empresa',
    interactionPrompt: null,
    objectiveDistance: Math.hypot(
      world.seal.position.x - world.playerStart.x,
      world.seal.position.z - world.playerStart.z,
    ),
    objectiveBearing: 0,
    nearestEnemyDistance: Number.POSITIVE_INFINITY,
    pointerLocked: false,
    fear: 0,
    jumpscare: null,
    elevator: null,
    hallucination: null,
    cabinetPrompt: null,
    tools: [],
    fragmentsFound: 0,
    fragmentsTotal: world.cabinets.reduce(
      (total, cabinet) => total + cabinet.drawers.filter((drawer) => drawer.content === 'fragment').length,
      0,
    ),
    activeEvent: null,
    activeEventUntil: 0,
    levelTransitionUntil: 0,
    nowMs: 0,
  }
}

export default function SieveCatacombsCanvas({
  active,
  reducedMotion,
  party,
  onStart,
}: SieveCatacombsCanvasProps): JSX.Element {
  const [runId, setRunId] = useState(1)
  const { client, snapshot: online } = usePrimeverseSession()
  // Everything the scene loop needs to run shared simulation, kept in one ref so
  // the 60 Hz frame never touches React state.
  const coop = useRef<CatacombsCoopBridge>({
    client: null, playerId: null, peerIds: [], partyState: null, peerPositions: [], active: false,
  })
  coop.current = {
    client,
    playerId: online.playerId,
    peerIds: online.players
      .filter((peer) => peer.activityId === 'sieve-catacombs' && peer.runId === online.runId)
      .map((peer) => peer.id),
    partyState: online.partyState,
    peerPositions: online.players
      .filter((peer) => peer.activityId === 'sieve-catacombs' && peer.runId === online.runId)
      .map((peer) => {
        const sampled = party.sampleRemote(peer.id)
        return sampled ? { x: sampled.position[0], z: sampled.position[2] } : null
      })
      .filter((position): position is { x: number; z: number } => position !== null),
    active: Boolean(
      client
      && online.status === 'online'
      && online.activityId === 'sieve-catacombs'
      && online.runId !== null,
    ),
  }
  // A lobby launch hands everyone the same seed; a solo run rolls its own, so no
  // two expeditions place the seals and cabinets alike.
  const runSeed = useMemo(() => (
    consumeLobbyTicket('sieve-catacombs')?.seed ?? Math.floor(Math.random() * 0xffffffff)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [runId])
  const [snapshot, setSnapshot] = useState<CatacombsSnapshot>(initialSnapshot)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const getAudio = useAudioResource(createHorrorAudio)
  const getMusic = useAudioResource(() => createMusicDirector(CATACOMBS_TRACK))
  const audioMemory = useRef({
    activeEvent: null as CatacombsSnapshot['activeEvent'],
    health: 100,
    jumpscareId: '',
    levelIndex: 0,
    phase: snapshot.game.phase,
    seals: 0,
  })
  const controls = useRef<CatacombsControls>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    interactPulse: 0,
    flashlightPulse: 0,
    puzzleAnswer: '',
    puzzleSubmitPulse: 0,
    puzzleClosePulse: 0,
  })

  const setHeldControl = useCallback((control: HeldControl, pressed: boolean) => {
    controls.current[control] = pressed
  }, [])

  const pulseControl = useCallback((control: PulseControl) => {
    if (control === 'interact') controls.current.interactPulse += 1
    else controls.current.flashlightPulse += 1
  }, [])

  const submitElevatorAnswer = useCallback((answer: string) => {
    controls.current.puzzleAnswer = answer
    controls.current.puzzleSubmitPulse += 1
  }, [])

  const closeElevatorPanel = useCallback(() => {
    controls.current.puzzleClosePulse += 1
  }, [])

  const [cutscene, setCutscene] = useState<'idle' | 'playing' | 'done'>('idle')

  const beginExpedition = useCallback(() => {
    void getAudio().unlock().then((unlocked) => {
      if (unlocked) getAudio().play('level')
    })
    getAudio().setActive(true)
    void getMusic().start()
    onStart()
  }, [getAudio, getMusic, onStart])

  const start = useCallback(() => {
    if (cutscene === 'done') {
      beginExpedition()
      return
    }
    // The click is the gesture the browser wants: unlock audio for the classroom.
    void getAudio().unlock()
    void getMusic().start()
    getMusic().setIntensity(0.12)
    setCutscene('playing')
  }, [beginExpedition, cutscene, getAudio, getMusic])

  const finishCutscene = useCallback(() => {
    setCutscene('done')
    getAudio().play('level')
    beginExpedition()
  }, [beginExpedition, getAudio])

  const restart = useCallback(() => {
    controls.current = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      interactPulse: 0,
      flashlightPulse: 0,
      puzzleAnswer: '',
      puzzleSubmitPulse: 0,
      puzzleClosePulse: 0,
    }
    setSnapshot(initialSnapshot())
    setRunId((current) => current + 1)
    audioMemory.current = { activeEvent: null, health: 100, jumpscareId: '', levelIndex: 0, phase: 'playing', seals: 0 }
    start()
  }, [start])

  useEffect(() => {
    getAudio().setEnabled(soundEnabled)
    getMusic().setEnabled(soundEnabled)
  }, [getAudio, getMusic, soundEnabled])

  // Autoplay policies silence a soundtrack started before any interaction.
  useEffect(() => {
    if (!active) return undefined
    return startMusicOnFirstGesture(getMusic())
  }, [active, getMusic])

  useEffect(() => {
    if (!active || snapshot.game.phase !== 'playing') return
    const moving = controls.current.forward
      || controls.current.backward
      || controls.current.left
      || controls.current.right
    const animation = moving ? controls.current.sprint ? 'run' : 'walk' : 'idle'
    party.sendTransform(
      [snapshot.playerPosition.x, snapshot.playerPosition.y, snapshot.playerPosition.z],
      snapshot.playerYaw,
      animation,
    )
  }, [active, party, snapshot])

  useEffect(() => {
    const sound = getAudio()
    sound.setActive(active && snapshot.game.phase === 'playing')
    sound.update({
      fear: snapshot.fear,
      flashlightOn: snapshot.game.flashlightOn,
      levelIndex: snapshot.campaign.levelIndex,
      nowMs: snapshot.nowMs,
      threatDistance: snapshot.nearestEnemyDistance,
    })
    const proximity = Number.isFinite(snapshot.nearestEnemyDistance)
      ? Math.max(0, 1 - snapshot.nearestEnemyDistance / 18)
      : 0
    // Carrying the seal back to the elevator is the chase: the music goes with it.
    const carryingSeal = snapshot.campaign.collectedPrimes.includes(snapshot.level.sealPrime)
    getMusic().setIntensity(
      snapshot.game.phase === 'playing'
        ? Math.min(1, snapshot.fear / 100 * 0.68 + proximity * 0.46 + (carryingSeal ? 0.22 : 0))
        : 0.1,
    )
    if (snapshot.game.phase !== 'playing') getMusic().stop()

    const previous = audioMemory.current
    if (snapshot.activeEvent && snapshot.activeEvent !== previous.activeEvent) sound.play('scare')
    if (snapshot.jumpscare && snapshot.jumpscare.id !== previous.jumpscareId) sound.play('jumpscare')
    if (snapshot.game.health < previous.health) sound.play('hurt')
    if (snapshot.game.collectedPrimes.length > previous.seals) sound.play('seal')
    if (snapshot.campaign.levelIndex > previous.levelIndex) sound.play('level')
    if (snapshot.game.phase === 'won' && previous.phase !== 'won') sound.play('escape')
    audioMemory.current = {
      activeEvent: snapshot.activeEvent,
      health: snapshot.game.health,
      jumpscareId: snapshot.jumpscare?.id ?? previous.jumpscareId,
      levelIndex: snapshot.campaign.levelIndex,
      phase: snapshot.game.phase,
      seals: snapshot.game.collectedPrimes.length,
    }
  }, [active, getAudio, getMusic, snapshot])



  const statusClass = useMemo(() => {
    if (snapshot.game.phase !== 'playing') return snapshot.game.phase
    if (snapshot.nearestEnemyDistance < 4.5) return 'critical'
    if (snapshot.nearestEnemyDistance < 10) return 'danger'
    return 'safe'
  }, [snapshot.game.phase, snapshot.nearestEnemyDistance])

  return (
    <section
      className={`scc-game scc-game--${statusClass} scc-game--${snapshot.level.id}${snapshot.fear >= 62 ? ' scc-game--distorted' : ''}${snapshot.activeEventUntil > snapshot.nowMs ? ' scc-game--scare' : ''}`}
      aria-label="Cripta do Crivo, campanha de terror liminal em primeira pessoa"
    >
      <SceneBoundary>
        <Canvas
          className="scc-canvas"
          camera={{ fov: 74, near: 0.06, far: 125, position: [0, 1.65, 20] }}
          dpr={[1, 1.45]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          shadows={!reducedMotion}
        >
          <Suspense fallback={null}>
            <SieveCatacombsScene
              key={runId}
              active={active}
              runSeed={runSeed}
              coop={coop}
              reducedMotion={reducedMotion}
              controls={controls}
              onSnapshot={setSnapshot}
            />
            <ExpeditionPartyAvatars
              peers={party.peers}
              sampleRemote={party.sampleRemote}
              reducedMotion={reducedMotion}
            />
          </Suspense>
        </Canvas>
      </SceneBoundary>

      <div className="scc-vignette" aria-hidden="true" />
      <div className="scc-noise" aria-hidden="true" />
      {snapshot.game.invulnerableUntil > snapshot.nowMs && <div className="scc-hit" aria-hidden="true" />}
      {cutscene === 'playing' && <CatacombsIntroCutscene onFinish={finishCutscene} />}
      {snapshot.jumpscare && snapshot.jumpscare.until > snapshot.nowMs && (
        <CatacombsJumpscareOverlay key={snapshot.jumpscare.id} scare={snapshot.jumpscare} />
      )}

      <SieveCatacombsHud
        active={active}
        snapshot={snapshot}
        objective={catacombsCampaignObjective(snapshot.campaign)}
        soundEnabled={soundEnabled}
        onStart={start}
        onRestart={restart}
        onToggleSound={() => setSoundEnabled((current) => !current)}
        onHeldControl={setHeldControl}
        onPulseControl={pulseControl}
        onSubmitElevatorAnswer={submitElevatorAnswer}
        onCloseElevatorPanel={closeElevatorPanel}
      />
    </section>
  )
}
