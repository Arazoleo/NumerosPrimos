import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProgressionStore } from '../../../progression'
import { AVAILABLE_GAMES, PRIMEVERSE_GAMES, type PrimeverseGame } from '../catalog'
import { audioBus } from '../audio/audioBus'
import { useQualitySettings } from '../graphics/useQualitySettings'
import QualityControl from '../ui/QualityControl'
import { SceneBoundary } from '../ui/SceneBoundary'
import { useDocumentTitle } from '../useDocumentTitle'
import { carouselStep, dragPixelsToAngle, nearestEquivalentAngle, resolveCarouselDrag, wrapCarouselIndex } from './carouselMath'
import PrimeverseScene from './PrimeverseScene'
import '../primeverse.css'
import './PrimeversePage.css'

interface CarouselDragSession {
  pointerId: number
  startX: number
  lastX: number
  lastTime: number
  velocityX: number
  viewportWidth: number
  startIndex: number
  baseOffset: number
  dragging: boolean
}

export default function PrimeversePage() {
  useDocumentTitle('Primeverse · Números Primos')
  const navigate = useNavigate()
  const { quality, setQuality, profile } = useQualitySettings()
  const level = useProgressionStore((state) => state.level)
  const xp = useProgressionStore((state) => state.xp)
  const [selectedId, setSelectedId] = useState(AVAILABLE_GAMES[0].id)
  const [travelTarget, setTravelTarget] = useState<PrimeverseGame | null>(null)
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [isDragging, setIsDragging] = useState(false)
  const [hasRotated, setHasRotated] = useState(false)
  const [carouselAnnouncement, setCarouselAnnouncement] = useState('')
  const timerRef = useRef<number | null>(null)
  const portalClickTimerRef = useRef<number | null>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const gameTabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const rotationOffsetRef = useRef(0)
  const carouselAngleRef = useRef(0)
  const carouselDraggingRef = useRef(false)
  const dragSessionRef = useRef<CarouselDragSession | null>(null)
  const suppressPortalClickRef = useRef(false)
  const selectedIdRef = useRef(selectedId)
  const travelTargetRef = useRef(travelTarget)
  const wheelSequenceRef = useRef<{ accumulatedDelta: number; settleTimer: number | null }>({
    accumulatedDelta: 0,
    settleTimer: null,
  })
  const selected = useMemo(
    () => PRIMEVERSE_GAMES.find((game) => game.id === selectedId) ?? AVAILABLE_GAMES[0],
    [selectedId],
  )

  selectedIdRef.current = selectedId
  travelTargetRef.current = travelTarget

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    if (portalClickTimerRef.current !== null) window.clearTimeout(portalClickTimerRef.current)
  }, [])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', updatePreference)
    return () => preference.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (hudRef.current) hudRef.current.inert = Boolean(travelTarget)
  }, [travelTarget])

  useEffect(() => {
    const selectedIndex = PRIMEVERSE_GAMES.findIndex((game) => game.id === selectedId)
    gameTabRefs.current[selectedIndex]?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [reducedMotion, selectedId])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const wheelSequence = wheelSequenceRef.current

    const settleWheel = () => {
      wheelSequence.settleTimer = null
      const totalDelta = wheelSequence.accumulatedDelta
      const direction = Math.abs(totalDelta) >= 8 ? Math.sign(totalDelta) : 0
      wheelSequence.accumulatedDelta = 0
      if (
        direction === 0
        || travelTargetRef.current
        || carouselDraggingRef.current
        || dragSessionRef.current
      ) return

      const currentIndex = Math.max(0, PRIMEVERSE_GAMES.findIndex((game) => game.id === selectedIdRef.current))
      const game = PRIMEVERSE_GAMES[wrapCarouselIndex(currentIndex + direction, PRIMEVERSE_GAMES.length)]
      selectedIdRef.current = game.id
      setSelectedId(game.id)
      setCarouselAnnouncement(`${game.title} selecionado`)
      setHasRotated(true)
    }

    const handleWheel = (event: WheelEvent) => {
      const target = event.target
      const isFallback = target instanceof Element && Boolean(target.closest('.pv-webgl-fallback'))
      if (
        event.ctrlKey
        || isFallback
        || travelTargetRef.current
        || carouselDraggingRef.current
        || dragSessionRef.current
      ) return
      let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= Math.max(1, stage.clientHeight)
      if (Math.abs(delta) < .25) return

      event.preventDefault()
      wheelSequence.accumulatedDelta += delta
      if (wheelSequence.settleTimer !== null) window.clearTimeout(wheelSequence.settleTimer)
      wheelSequence.settleTimer = window.setTimeout(settleWheel, 120)
    }

    stage.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      stage.removeEventListener('wheel', handleWheel)
      if (wheelSequence.settleTimer !== null) window.clearTimeout(wheelSequence.settleTimer)
      wheelSequence.settleTimer = null
      wheelSequence.accumulatedDelta = 0
    }
  }, [])

  const handleGameNavigation = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % PRIMEVERSE_GAMES.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + PRIMEVERSE_GAMES.length) % PRIMEVERSE_GAMES.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = PRIMEVERSE_GAMES.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    gameTabRefs.current[nextIndex]?.focus()
  }

  const selectCarouselIndex = (index: number, announce = true) => {
    const game = PRIMEVERSE_GAMES[wrapCarouselIndex(index, PRIMEVERSE_GAMES.length)]
    selectedIdRef.current = game.id
    setSelectedId(game.id)
    if (announce) setCarouselAnnouncement(`${game.title} selecionado`)
  }

  const rotateCarousel = (steps: number) => {
    if (travelTargetRef.current || steps === 0) return
    const currentIndex = Math.max(0, PRIMEVERSE_GAMES.findIndex((game) => game.id === selectedIdRef.current))
    selectCarouselIndex(currentIndex + steps)
    setHasRotated(true)
  }

  const beginCarouselDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (travelTargetRef.current || !event.isPrimary || event.button !== 0) return
    const target = event.target
    if (target instanceof Element && target.closest('a, button, input, select, textarea, [role="button"]')) return
    if (portalClickTimerRef.current !== null) window.clearTimeout(portalClickTimerRef.current)
    const wheelSequence = wheelSequenceRef.current
    if (wheelSequence.settleTimer !== null) window.clearTimeout(wheelSequence.settleTimer)
    wheelSequence.settleTimer = null
    wheelSequence.accumulatedDelta = 0
    suppressPortalClickRef.current = false
    const now = performance.now()
    const startIndex = Math.max(0, PRIMEVERSE_GAMES.findIndex((game) => game.id === selectedIdRef.current))
    dragSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: now,
      velocityX: 0,
      viewportWidth: event.currentTarget.clientWidth,
      startIndex,
      baseOffset: 0,
      dragging: false,
    }
    rotationOffsetRef.current = 0
  }

  const moveCarouselDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    const now = performance.now()
    const elapsed = Math.max(1, now - session.lastTime)
    const instantaneousVelocity = (event.clientX - session.lastX) / elapsed
    session.velocityX = session.velocityX * .62 + instantaneousVelocity * .38
    session.lastX = event.clientX
    session.lastTime = now

    const deltaX = event.clientX - session.startX
    if (!session.dragging && Math.abs(deltaX) < 8) return
    if (!session.dragging) {
      const step = carouselStep(PRIMEVERSE_GAMES.length)
      const selectedAngle = -session.startIndex * step
      session.baseOffset = carouselAngleRef.current - nearestEquivalentAngle(selectedAngle, carouselAngleRef.current)
      session.dragging = true
      carouselDraggingRef.current = true
      setIsDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    const maxOffset = carouselStep(PRIMEVERSE_GAMES.length) * 3
    const requestedDragOffset = dragPixelsToAngle(deltaX, session.viewportWidth, PRIMEVERSE_GAMES.length)
    const dragOffset = Math.min(maxOffset, Math.max(-maxOffset, requestedDragOffset))
    rotationOffsetRef.current = session.baseOffset + dragOffset
  }

  const finishCarouselDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const session = dragSessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    const deltaX = event.clientX - session.startX
    const idleTime = performance.now() - session.lastTime
    const releaseVelocity = idleTime >= 120
      ? 0
      : session.velocityX * (1 - idleTime / 120)
    const crossedThreshold = session.dragging || Math.abs(deltaX) >= 8
    const steps = cancelled || !crossedThreshold
      ? 0
      : resolveCarouselDrag({
          deltaX,
          velocityX: releaseVelocity,
          viewportWidth: session.viewportWidth,
        })

    dragSessionRef.current = null
    carouselDraggingRef.current = false
    rotationOffsetRef.current = 0
    setIsDragging(false)

    if (crossedThreshold && !cancelled) {
      suppressPortalClickRef.current = true
      portalClickTimerRef.current = window.setTimeout(() => {
        suppressPortalClickRef.current = false
        portalClickTimerRef.current = null
      }, 220)
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (steps !== 0) {
      selectCarouselIndex(session.startIndex + steps)
      setHasRotated(true)
    }
  }

  const enterGame = (game: PrimeverseGame) => {
    if (!game.path || travelTarget) return
    setSelectedId(game.id)
    setTravelTarget(game)
    audioBus.play('portal')
    timerRef.current = window.setTimeout(() => navigate(game.path as string), reducedMotion ? 80 : 620)
  }

  return (
    <main className={`primeverse-shell pv-hub ${travelTarget ? 'is-travelling' : ''}`}>
      <div
        ref={stageRef}
        className={`pv-scene-stage ${isDragging ? 'is-dragging' : ''}`}
        onPointerDown={beginCarouselDrag}
        onPointerMove={moveCarouselDrag}
        onPointerUp={(event) => finishCarouselDrag(event)}
        onPointerCancel={(event) => finishCarouselDrag(event, true)}
        onLostPointerCapture={(event) => finishCarouselDrag(event, true)}
      >
        <SceneBoundary>
          <Canvas
            className="pv-canvas"
            camera={{ position: [0, 1.1, 11.2], fov: 48, near: 0.1, far: 70 }}
            dpr={profile.dpr}
            gl={{ antialias: profile.antialias, alpha: false, powerPreference: 'high-performance' }}
            frameloop={reducedMotion && !isDragging ? 'demand' : 'always'}
            fallback={null}
            aria-hidden="true"
            tabIndex={-1}
          >
            <Suspense fallback={null}>
              <PrimeverseScene
                profile={profile}
                selectedId={selectedId}
                travelTarget={travelTarget}
                rotationOffsetRef={rotationOffsetRef}
                rotationValueRef={carouselAngleRef}
                draggingRef={carouselDraggingRef}
                suppressPortalClickRef={suppressPortalClickRef}
                isDragging={isDragging}
                reducedMotion={reducedMotion}
                onSelect={(game) => {
                  selectedIdRef.current = game.id
                  setSelectedId(game.id)
                  setCarouselAnnouncement(`${game.title} selecionado`)
                  setHasRotated(true)
                }}
              />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      </div>

      <div ref={hudRef} className="pv-hud" aria-label="Controles do Primeverse">
        <header className="pv-topbar">
          <Link className="pv-brand" to="/" aria-label="Voltar ao site Números Primos">
            <span className="pv-brand__mark">P</span>
            <span><strong>PRIMEVERSE</strong><small>NÚMEROS PRIMOS · UNIFESP</small></span>
          </Link>
          <div className="pv-topbar__actions">
            <span className="pv-profile"><strong>NÍVEL {String(level).padStart(2, '0')}</strong><i />{xp} XP</span>
            <QualityControl value={quality} onChange={setQuality} />
            <Link className="pv-icon-link" to="/" aria-label="Fechar Primeverse">×</Link>
          </div>
        </header>

        <section className="pv-hub__intro" aria-labelledby="pv-hub-title">
          <h1 id="pv-hub-title">Primeverse</h1>
          <p>Gire os portais e escolha um jogo. Cada um é uma ideia matemática que se joga.</p>
        </section>

        <div className="pv-carousel-controls" role="group" aria-label="Girar menu de jogos">
          <button
            type="button"
            className="pv-carousel-arrow"
            onClick={() => rotateCarousel(-1)}
            aria-label="Girar para o jogo anterior"
            aria-controls="pv-selected-panel"
            disabled={Boolean(travelTarget)}
          >
            ←
          </button>
          {!hasRotated && <span className="pv-carousel-hint" aria-hidden="true">↔ Arraste para girar</span>}
          <button
            type="button"
            className="pv-carousel-arrow"
            onClick={() => rotateCarousel(1)}
            aria-label="Girar para o próximo jogo"
            aria-controls="pv-selected-panel"
            disabled={Boolean(travelTarget)}
          >
            →
          </button>
        </div>

        <p className="pv-sr-only" role="status" aria-live="polite">{carouselAnnouncement}</p>

        <section
          className="pv-browser"
          aria-label="Seleção de jogos"
          style={{ '--pv-selection-accent': selected.accent } as CSSProperties}
        >
          <nav className="pv-game-strip" role="tablist" aria-label="Jogos disponíveis" aria-orientation="horizontal">
            {PRIMEVERSE_GAMES.map((game, index) => {
              const active = selected.id === game.id
              return (
                <button
                  type="button"
                  key={game.id}
                  ref={(element) => { gameTabRefs.current[index] = element }}
                  id={`pv-game-tab-${game.id}`}
                  role="tab"
                  className={active ? 'is-active' : ''}
                  onClick={() => setSelectedId(game.id)}
                  onFocus={() => setSelectedId(game.id)}
                  onKeyDown={(event) => handleGameNavigation(event, index)}
                  aria-selected={active}
                  aria-controls="pv-selected-panel"
                  tabIndex={active ? 0 : -1}
                  disabled={Boolean(travelTarget)}
                  style={{ '--pv-card-accent': game.accent } as CSSProperties}
                >
                  <span className="pv-game-strip__glyph" aria-hidden="true">{game.glyph}</span>
                  <span className="pv-game-strip__copy">
                    <strong>{game.title}</strong>
                  </span>
                </button>
              )
            })}
          </nav>

          <aside
            className="pv-selection"
            id="pv-selected-panel"
            role="tabpanel"
            aria-labelledby={`pv-game-tab-${selected.id}`}
          >
            <div className="pv-selection__glyph" aria-hidden="true">{selected.glyph}</div>
            <div className="pv-selection__copy">
              <h2>{selected.title}</h2>
              <p>{selected.mathematicalIdea}</p>
            </div>
            {selected.path ? (
              <button type="button" className="pv-launch" onClick={() => enterGame(selected)} disabled={Boolean(travelTarget)}>
                <span>Jogar agora</span><strong aria-hidden="true">→</strong>
              </button>
            ) : (
              <div className="pv-locked"><span aria-hidden="true">⌁</span> EM BREVE</div>
            )}
          </aside>

        </section>
      </div>

      <div className="pv-jump" role="status" aria-live="polite" aria-hidden={!travelTarget}>
        <span>CONEXÃO ESTABELECIDA</span>
        <strong>{travelTarget?.title}</strong>
      </div>
    </main>
  )
}
