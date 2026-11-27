import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { useProgressionStore } from '../../../../progression'
import { audioBus } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import GameIntro from '../../ui/GameIntro'
import GameSettings from '../../ui/GameSettings'
import { SceneBoundary } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import { recognizeDigit, type Point } from './digitRecognizer'
import { OneEuroFilter, PenLatch } from './handGesture'
import { HandTracker, TrackerError, type TrackedFrame } from './handTracker'
import PrimeWizardScene from './PrimeWizardScene'
import { digitsToNumber, shouldCastImmediately } from './riddles'
import {
  advanceWizard,
  castSpell,
  createWizardGame,
  MAX_HEARTS,
  TOTAL_ROUNDS,
  xpForRun,
  type WizardEvent,
  type WizardState,
} from './wizardGame'
import '../../primeverse.css'
import './PrimeWizardPage.css'

const GAME_ID = 'prime-wizard'
const ACCENT = '#b9a2ff'
/** Pausa depois de levantar o dedo até o algarismo ser lido (permite 4, 5 e 7 em dois traços). */
const COMMIT_DELAY = { camera: 720, touch: 560 } as const
/** Espera por um segundo algarismo antes de lançar sozinho. */
const CAST_DELAY = 1400
const PALM_HOLD_MS = 650
const MIN_DIGIT_SIZE = 36

type Phase = 'intro' | 'playing' | 'over'
type InputMode = 'camera' | 'touch'
type CameraStatus = 'off' | 'loading' | 'ready' | 'error'

interface Flash {
  readonly id: number
  readonly kind: 'hit' | 'miss' | 'breach' | 'unknown'
  readonly text: string
}

interface FadingStroke {
  readonly points: Point[]
  born: number
}

interface RunResult {
  readonly xp: number
  readonly best: number
  readonly isNewBest: boolean
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function PrimeWizardPage() {
  useDocumentTitle('Grimório Primo · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const awardXp = useProgressionStore((state) => state.awardXp)
  const updateBestScore = useProgressionStore((state) => state.updateBestScore)
  const bestScore = useProgressionStore((state) => state.bestScores[GAME_ID] ?? 0)

  const [phase, setPhase] = useState<Phase>('intro')
  const [mode, setMode] = useState<InputMode>('touch')
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('off')
  const [cameraError, setCameraError] = useState('')
  const [game, setGame] = useState<WizardState>(() => createWizardGame())
  const [runId, setRunId] = useState(0)
  const [digits, setDigits] = useState<number[]>([])
  const [flash, setFlash] = useState<Flash | null>(null)
  const [hitSignal, setHitSignal] = useState(0)
  const [missSignal, setMissSignal] = useState(0)
  const [handVisible, setHandVisible] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [reducedMotion] = useState(prefersReducedMotion)

  const stageRef = useRef<HTMLDivElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<HTMLDivElement>(null)
  const trackerRef = useRef<HandTracker | null>(null)
  const gameRef = useRef(game)
  const progressRef = useRef(0)
  const digitsRef = useRef<number[]>([])
  const strokesRef = useRef<Point[][]>([])
  const activeStrokeRef = useRef<Point[] | null>(null)
  const fadingRef = useRef<FadingStroke[]>([])
  const commitTimerRef = useRef<number | null>(null)
  const castTimerRef = useRef<number | null>(null)
  const flashIdRef = useRef(0)
  const modeRef = useRef(mode)
  const phaseRef = useRef(phase)
  const latchRef = useRef(new PenLatch())
  const filtersRef = useRef({ x: new OneEuroFilter(), y: new OneEuroFilter() })
  const palmSinceRef = useRef<number | null>(null)
  const handVisibleRef = useRef(false)

  modeRef.current = mode
  phaseRef.current = phase

  const showFlash = useCallback((kind: Flash['kind'], text: string) => {
    flashIdRef.current += 1
    setFlash({ id: flashIdRef.current, kind, text })
  }, [])

  useEffect(() => {
    if (!flash) return undefined
    const timer = window.setTimeout(() => setFlash((current) => (current?.id === flash.id ? null : current)), 1300)
    return () => window.clearTimeout(timer)
  }, [flash])

  const clearTimers = useCallback(() => {
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current)
    if (castTimerRef.current !== null) window.clearTimeout(castTimerRef.current)
    commitTimerRef.current = null
    castTimerRef.current = null
  }, [])

  const setDigitList = useCallback((next: number[]) => {
    digitsRef.current = next
    setDigits(next)
  }, [])

  const fadeCurrentInk = useCallback(() => {
    const now = performance.now()
    for (const stroke of strokesRef.current) fadingRef.current.push({ points: stroke, born: now })
    strokesRef.current = []
    activeStrokeRef.current = null
  }, [])

  const finishRun = useCallback((final: WizardState) => {
    clearTimers()
    const xp = xpForRun(final)
    awardXp(xp)
    const isNewBest = updateBestScore(GAME_ID, final.score)
    setResult({ xp, best: Math.max(bestScore, final.score), isNewBest })
    audioBus.play(final.outcome === 'victory' ? 'complete' : 'impact')
    setPhase('over')
  }, [awardXp, bestScore, clearTimers, updateBestScore])

  const applyEvent = useCallback((next: WizardState, event: WizardEvent) => {
    gameRef.current = next
    progressRef.current = next.progress
    setGame(next)
    if (event.type === 'hit') {
      setHitSignal((value) => value + 1)
      audioBus.play('correct')
      showFlash('hit', `+${event.points}`)
    } else if (event.type === 'miss') {
      setMissSignal((value) => value + 1)
      audioBus.play('error')
      showFlash('miss', 'Não é esse primo')
    } else {
      audioBus.play('impact')
      showFlash('breach', 'O golem passou')
    }
    if (event.type !== 'miss' || digitsRef.current.length > 0) setDigitList([])
    if (next.outcome) finishRun(next)
  }, [finishRun, setDigitList, showFlash])

  const cast = useCallback(() => {
    if (castTimerRef.current !== null) window.clearTimeout(castTimerRef.current)
    castTimerRef.current = null
    const current = digitsRef.current
    if (current.length === 0 || phaseRef.current !== 'playing') return
    const [next, event] = castSpell(gameRef.current, digitsToNumber(current))
    applyEvent(next, event)
  }, [applyEvent])

  const commitDigit = useCallback(() => {
    commitTimerRef.current = null
    const strokes = strokesRef.current
    if (strokes.length === 0) return
    const recognition = recognizeDigit(strokes, MIN_DIGIT_SIZE)
    fadeCurrentInk()
    if (!recognition) {
      showFlash('unknown', 'Não entendi — escreva maior')
      return
    }
    const next = [...digitsRef.current, recognition.digit].slice(-2)
    setDigitList(next)
    audioBus.play('laser')
    if (shouldCastImmediately(gameRef.current.riddle, next)) {
      cast()
    } else {
      castTimerRef.current = window.setTimeout(cast, CAST_DELAY)
    }
  }, [cast, fadeCurrentInk, setDigitList, showFlash])

  /* ------------------------------------------------------------ traços */

  const beginStroke = useCallback((point: Point) => {
    if (phaseRef.current !== 'playing') return
    clearTimers()
    const stroke = [point]
    activeStrokeRef.current = stroke
    strokesRef.current.push(stroke)
  }, [clearTimers])

  const extendStroke = useCallback((point: Point) => {
    const stroke = activeStrokeRef.current
    if (!stroke) {
      beginStroke(point)
      return
    }
    const last = stroke[stroke.length - 1]
    if (Math.hypot(point.x - last.x, point.y - last.y) >= 2) stroke.push(point)
  }, [beginStroke])

  const endStroke = useCallback(() => {
    if (!activeStrokeRef.current) return
    activeStrokeRef.current = null
    if (commitTimerRef.current !== null) window.clearTimeout(commitTimerRef.current)
    commitTimerRef.current = window.setTimeout(commitDigit, COMMIT_DELAY[modeRef.current])
  }, [commitDigit])

  const erase = useCallback(() => {
    clearTimers()
    if (strokesRef.current.length > 0) {
      fadeCurrentInk()
      return
    }
    setDigitList(digitsRef.current.slice(0, -1))
  }, [clearTimers, fadeCurrentInk, setDigitList])

  const stagePoint = (event: ReactPointerEvent<HTMLElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  /* -------------------------------------------------------------- câmera */

  const handleFrame = useCallback(({ pose, timestamp }: TrackedFrame) => {
    const stage = stageRef.current
    const video = videoRef.current
    const cursor = cursorRef.current
    if (!stage || !video || !cursor) return
    const visible = Boolean(pose)
    if (visible !== handVisibleRef.current) {
      handVisibleRef.current = visible
      setHandVisible(visible)
    }
    if (!pose) {
      latchRef.current.update(false)
      filtersRef.current.x.reset()
      filtersRef.current.y.reset()
      palmSinceRef.current = null
      cursor.dataset.visible = 'false'
      endStroke()
      return
    }

    // O vídeo aparece espelhado e em "cover": refaz a mesma conta para o cursor
    // cair exatamente sobre a ponta do dedo na imagem.
    const width = stage.clientWidth
    const height = stage.clientHeight
    const videoWidth = video.videoWidth || 640
    const videoHeight = video.videoHeight || 480
    const scale = Math.max(width / videoWidth, height / videoHeight)
    const shownWidth = videoWidth * scale
    const shownHeight = videoHeight * scale
    const rawX = (width - shownWidth) / 2 + (1 - pose.tip.x) * shownWidth
    const rawY = (height - shownHeight) / 2 + pose.tip.y * shownHeight
    const x = filtersRef.current.x.filter(rawX, timestamp)
    const y = filtersRef.current.y.filter(rawY, timestamp)

    const penDown = latchRef.current.update(pose.pointing)
    cursor.dataset.visible = 'true'
    cursor.dataset.pen = penDown ? 'down' : 'up'
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`

    if (penDown) {
      extendStroke({ x, y })
      palmSinceRef.current = null
      return
    }
    endStroke()
    if (pose.openPalm) {
      palmSinceRef.current ??= timestamp
      if (timestamp - palmSinceRef.current > PALM_HOLD_MS && digitsRef.current.length > 0 && strokesRef.current.length === 0) {
        palmSinceRef.current = null
        cast()
      }
    } else {
      palmSinceRef.current = null
    }
  }, [cast, endStroke, extendStroke])

  // O rastreador guarda um único callback; ele sempre chama a versão mais nova.
  const handleFrameRef = useRef(handleFrame)
  handleFrameRef.current = handleFrame

  const stopCamera = useCallback(() => {
    trackerRef.current?.stop()
    trackerRef.current = null
    latchRef.current.reset()
    handVisibleRef.current = false
    setHandVisible(false)
  }, [])

  const startCamera = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    stopCamera()
    setCameraStatus('loading')
    setCameraError('')
    const tracker = new HandTracker(video)
    trackerRef.current = tracker
    try {
      await tracker.start((frame) => handleFrameRef.current(frame))
      if (trackerRef.current === tracker) setCameraStatus('ready')
    } catch (error) {
      if (trackerRef.current !== tracker) return
      trackerRef.current = null
      setCameraStatus('error')
      setCameraError(error instanceof TrackerError ? error.message : 'Não foi possível iniciar a câmera.')
    }
  }, [stopCamera])

  useEffect(() => stopCamera, [stopCamera])

  /* --------------------------------------------------------------- partida */

  const startRun = useCallback((nextMode: InputMode) => {
    clearTimers()
    const fresh = createWizardGame()
    gameRef.current = fresh
    progressRef.current = 0
    strokesRef.current = []
    activeStrokeRef.current = null
    fadingRef.current = []
    setGame(fresh)
    setDigitList([])
    setResult(null)
    setFlash(null)
    setRunId((value) => value + 1)
    setMode(nextMode)
    setPhase('playing')
    if (nextMode === 'camera' && !trackerRef.current) void startCamera()
    if (nextMode === 'touch') {
      stopCamera()
      setCameraStatus('off')
    }
  }, [clearTimers, setDigitList, startCamera, stopCamera])

  const switchMode = () => {
    if (mode === 'camera') {
      stopCamera()
      setCameraStatus('off')
      setMode('touch')
    } else {
      setMode('camera')
      void startCamera()
    }
  }

  const waitingForCamera = mode === 'camera' && cameraStatus !== 'ready'

  // Relógio do jogo + desenho da tinta, num único laço.
  useEffect(() => {
    if (phase !== 'playing') return undefined
    let frame = 0
    let last = performance.now()
    const canvas = inkRef.current
    const context = canvas?.getContext('2d')

    const draw = (now: number) => {
      if (!canvas || !context) return
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      const paint = (points: readonly Point[], alpha: number) => {
        if (points.length === 0) return
        context.globalAlpha = alpha
        context.beginPath()
        context.moveTo(points[0].x, points[0].y)
        for (const point of points) context.lineTo(point.x, point.y)
        if (points.length === 1) context.lineTo(points[0].x + 0.1, points[0].y)
        context.shadowColor = ACCENT
        context.shadowBlur = 22
        context.strokeStyle = 'rgba(185, 162, 255, 0.9)'
        context.lineWidth = 12
        context.stroke()
        context.shadowBlur = 0
        context.strokeStyle = '#fbf8ff'
        context.lineWidth = 4
        context.stroke()
      }
      fadingRef.current = fadingRef.current.filter((stroke) => now - stroke.born < 520)
      for (const stroke of fadingRef.current) paint(stroke.points, 1 - (now - stroke.born) / 520)
      for (const stroke of strokesRef.current) paint(stroke, 1)
      context.globalAlpha = 1
    }

    const loop = (now: number) => {
      const seconds = Math.min(0.1, (now - last) / 1000)
      last = now
      const current = gameRef.current
      const thinking = strokesRef.current.length > 0
      if (!waitingForCamera && !current.outcome) {
        // Enquanto há tinta fresca o golem anda mais devagar: escrever não é punido.
        const [next, event] = advanceWizard(current, thinking ? seconds * 0.5 : seconds)
        if (event) applyEvent(next, event)
        else gameRef.current = next
        progressRef.current = gameRef.current.progress
      }
      if (timerRef.current) timerRef.current.style.transform = `scaleX(${1 - progressRef.current})`
      draw(now)
      frame = window.requestAnimationFrame(loop)
    }
    frame = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frame)
  }, [applyEvent, phase, waitingForCamera])

  // Teclado como alternativa acessível: algarismos, Enter lança, Backspace apaga.
  useEffect(() => {
    if (phase !== 'playing') return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea')) return
      if (/^[0-9]$/.test(event.key)) {
        clearTimers()
        const next = [...digitsRef.current, Number(event.key)].slice(-2)
        setDigitList(next)
        if (next.length >= 2) cast()
      } else if (event.key === 'Enter') {
        cast()
      } else if (event.key === 'Backspace') {
        erase()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cast, clearTimers, erase, phase, setDigitList])

  useEffect(() => () => clearTimers(), [clearTimers])

  const hearts = Array.from({ length: MAX_HEARTS }, (_, index) => index < game.hearts)
  const round = Math.min(game.round + 1, TOTAL_ROUNDS)
  const cameraHint = cameraStatus === 'loading'
    ? 'Abrindo a câmera e carregando o modelo de visão…'
    : handVisible
      ? 'Aponte só o indicador para escrever · abra a mão para lançar'
      : 'Mostre a mão para a câmera'

  return (
    <main className={`pw-page ${mode === 'camera' ? 'is-camera' : 'is-touch'}`} data-phase={phase}>
      <video ref={videoRef} className="pw-video" playsInline muted aria-hidden="true" />

      <div className="pw-scene" aria-hidden="true">
        <SceneBoundary>
          <Canvas
            camera={{ position: [0, 1.4, 7.4], fov: 52, near: 0.1, far: 80 }}
            dpr={profile.dpr}
            gl={{ antialias: profile.antialias, alpha: true, powerPreference: 'high-performance' }}
            frameloop={phase === 'intro' ? 'never' : 'always'}
          >
            <Suspense fallback={null}>
              <PrimeWizardScene
                progressRef={progressRef}
                enemyKey={runId * 100 + game.round}
                golem={game.golem}
                hitSignal={hitSignal}
                missSignal={missSignal}
                profile={profile}
                reducedMotion={reducedMotion}
                showBackdrop={mode === 'touch'}
              />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>

      <div
        ref={stageRef}
        className="pw-stage"
        onPointerDown={(event) => {
          if (event.button !== 0 && event.pointerType === 'mouse') return
          event.currentTarget.setPointerCapture(event.pointerId)
          beginStroke(stagePoint(event))
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) extendStroke(stagePoint(event))
        }}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      >
        <canvas ref={inkRef} className="pw-ink" aria-hidden="true" />
        <div ref={cursorRef} className="pw-cursor" data-visible="false" aria-hidden="true" />
      </div>

      {phase !== 'intro' && (
        <div className="pw-hud">
          <header className="pw-topbar">
            <Link className="pw-back" to="/jogos">← Primeverse</Link>
            <div className="pw-stats" aria-label="Estado da partida">
              <span className="pw-hearts" aria-label={`${game.hearts} de ${MAX_HEARTS} vidas`}>
                {hearts.map((alive, index) => <i key={index} data-alive={alive} />)}
              </span>
              <span><small>Golem</small>{String(round).padStart(2, '0')}/{TOTAL_ROUNDS}</span>
              <span><small>Pontos</small>{game.score}</span>
            </div>
            <div className="pw-actions">
              <button type="button" className="pw-chip" onClick={switchMode} aria-pressed={mode === 'camera'}>
                {mode === 'camera' ? 'Câmera ligada' : 'Usar câmera'}
              </button>
              <GameSettings value={quality} onChange={setQuality} />
            </div>
          </header>

          <section className="pw-riddle" aria-live="polite">
            <span>Enigma {round}</span>
            <h2 key={game.riddle.key + game.round}>{game.riddle.text}</h2>
            <div className="pw-timer" aria-hidden="true"><div ref={timerRef} /></div>
          </section>

          <section className="pw-spell" aria-label="Feitiço">
            <div className="pw-slots" aria-live="polite" aria-label={digits.length ? `Escrito: ${digits.join('')}` : 'Nada escrito'}>
              {digits.length === 0
                ? <span className="pw-slot is-empty">?</span>
                : digits.map((digit, index) => <span key={`${index}-${digit}`} className="pw-slot">{digit}</span>)}
            </div>
            <div className="pw-spell__actions">
              <button type="button" className="pw-button" onClick={erase}>Apagar</button>
              <button type="button" className="pw-button is-primary" onClick={cast} disabled={digits.length === 0}>Lançar</button>
            </div>
            <p className="pw-hint">
              {mode === 'camera' ? cameraHint : 'Desenhe o algarismo com o dedo ou o mouse · dois dígitos, um de cada vez'}
            </p>
          </section>

          {flash && <div key={flash.id} className={`pw-flash is-${flash.kind}`} role="status">{flash.text}</div>}

          {mode === 'camera' && cameraStatus === 'error' && (
            <div className="pw-modal" role="alertdialog" aria-labelledby="pw-camera-error">
              <h2 id="pw-camera-error">Sem câmera por enquanto</h2>
              <p>{cameraError} Você pode continuar desenhando direto na tela.</p>
              <div>
                <button type="button" className="pw-button" onClick={() => void startCamera()}>Tentar de novo</button>
                <button type="button" className="pw-button is-primary" onClick={() => { setMode('touch'); setCameraStatus('off') }}>Desenhar na tela</button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'intro' && (
        <GameIntro
          title="Grimório Primo"
          emphasis="Primo"
          instruction="Golens compostos avançam pelo portal. Escreva no ar, com o dedo, o número primo que responde ao enigma."
          actionLabel="Jogar com a câmera"
          accent={ACCENT}
          mark="7"
          keys="Indicador escreve · mão aberta lança · teclado também funciona"
          onStart={() => startRun('camera')}
        >
          <button type="button" className="pw-intro-alt" onClick={() => startRun('touch')}>Desenhar na tela</button>
          <p className="pw-intro-note">A visão computacional roda no seu aparelho. O vídeo não sai dele.</p>
        </GameIntro>
      )}

      {phase === 'over' && result && (
        <div className="pw-modal pw-result" role="dialog" aria-labelledby="pw-result-title">
          <span>{game.outcome === 'victory' ? 'Grimório completo' : 'O mago caiu'}</span>
          <h2 id="pw-result-title">{game.score} pontos</h2>
          <dl>
            <div><dt>Golens</dt><dd>{game.defeated}/{TOTAL_ROUNDS}</dd></div>
            <div><dt>Sequência</dt><dd>{game.bestStreak}</dd></div>
            <div><dt>XP</dt><dd>+{result.xp}</dd></div>
            <div><dt>Recorde</dt><dd>{result.isNewBest ? 'Novo!' : result.best}</dd></div>
          </dl>
          <div>
            <Link className="pw-button" to="/jogos">Primeverse</Link>
            <button type="button" className="pw-button is-primary" onClick={() => startRun(mode)}>Jogar de novo</button>
          </div>
        </div>
      )}

      {waitingForCamera && cameraStatus === 'loading' && phase === 'playing' && (
        <div className="pw-loading" role="status">Carregando visão computacional…</div>
      )}
    </main>
  )
}
