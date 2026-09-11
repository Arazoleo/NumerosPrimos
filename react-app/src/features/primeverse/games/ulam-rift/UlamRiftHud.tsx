import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import GameIntro from '../../ui/GameIntro'
import type { UlamRiftTelemetry } from './UlamRiftScene'
import {
  ULAM_RIFT_PRIMES,
  ULAM_RIFT_SECTORS,
  ULAM_RIFT_TOWERS,
  formatRiftTime,
  getUlamRiftObjective,
  type UlamRiftState,
} from './ulamRiftLogic'

interface UlamRiftHudProps {
  readonly state: UlamRiftState
  readonly telemetry: UlamRiftTelemetry
  readonly interaction: string | null
  readonly paused: boolean
  readonly quality: QualityLevel
  readonly onQualityChange: (quality: QualityLevel) => void
  readonly onStart: () => void
  readonly onRestart: () => void
  readonly onPauseChange: (paused: boolean) => void
  readonly onTouchMove: (x: number, z: number) => void
  readonly onSprint: (held: boolean) => void
  readonly onJump: () => void
  readonly onInteract: () => void
}

function RiftMark(): JSX.Element {
  return <span className="ulam-rift-mark" aria-hidden="true"><i /><b>U</b></span>
}

function TouchControls({ onMove, onSprint, onJump, onInteract }: {
  readonly onMove: (x: number, z: number) => void
  readonly onSprint: (held: boolean) => void
  readonly onJump: () => void
  readonly onInteract: () => void
}): JSX.Element {
  const origin = useRef<{ x: number; y: number } | null>(null)
  const stick = useRef<HTMLElement>(null)
  const stickPosition = useRef({ x: 0, y: 0 })
  const paintFrame = useRef<number | null>(null)

  const queueStickPaint = (x: number, y: number) => {
    stickPosition.current = { x, y }
    if (paintFrame.current !== null) return
    paintFrame.current = window.requestAnimationFrame(() => {
      paintFrame.current = null
      if (stick.current) {
        const next = stickPosition.current
        stick.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
      }
    })
  }

  useEffect(() => () => {
    if (paintFrame.current !== null) window.cancelAnimationFrame(paintFrame.current)
  }, [])

  const update = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!origin.current) origin.current = { x: event.clientX, y: event.clientY }
    const dx = event.clientX - origin.current.x
    const dy = event.clientY - origin.current.y
    const length = Math.max(1, Math.hypot(dx, dy))
    const radius = Math.min(32, length)
    const x = dx / length * radius
    const y = dy / length * radius
    queueStickPaint(x, y)
    onMove(x / 32, -y / 32)
  }
  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    origin.current = null
    queueStickPaint(0, 0)
    onMove(0, 0)
  }
  return (
    <div className="ulam-rift-touch" aria-label="Controles de toque">
      <div
        className="ulam-rift-touch__stick"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          origin.current = { x: event.clientX, y: event.clientY }
          update(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event)
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <i /><b ref={stick} />
      </div>
      <div className="ulam-rift-touch__actions">
        <button
          type="button"
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onSprint(true) }}
          onPointerUp={() => onSprint(false)}
          onPointerCancel={() => onSprint(false)}
        >CORRER</button>
        <button type="button" onClick={onJump}>SALTO</button>
        <button type="button" className="is-primary" onClick={onInteract}>E</button>
      </div>
    </div>
  )
}

export default function UlamRiftHud({
  state,
  telemetry,
  interaction,
  paused,
  quality,
  onQualityChange,
  onStart,
  onRestart,
  onPauseChange,
  onTouchMove,
  onSprint,
  onJump,
  onInteract,
}: UlamRiftHudProps): JSX.Element {
  const objective = getUlamRiftObjective(state)
  const progress = objective.current / objective.total * 100
  const currentSectorIndex = useMemo(
    () => Math.max(0, ULAM_RIFT_SECTORS.findIndex((sector) => sector.name === telemetry.sector)),
    [telemetry.sector],
  )

  return (
    <div className="ulam-rift-hud">
      <header className="ulam-rift-topbar">
        <Link to="/jogos/primeverse-online" className="ulam-rift-brand" aria-label="Voltar ao Primeverse Online">
          <RiftMark />
          <span><strong>FENDA DE ULAM</strong><small>EXPEDIÇÃO SOLO // PRIMEVERSE</small></span>
        </Link>
        <div className="ulam-rift-sector"><small>SETOR ATUAL</small><strong>{telemetry.sector}</strong></div>
        <div className="ulam-rift-topbar__actions">
          <QualityControl value={quality} onChange={onQualityChange} />
          <button type="button" onClick={onRestart}>REINICIAR</button>
          <button type="button" onClick={() => onPauseChange(!paused)} aria-label={paused ? 'Continuar' : 'Pausar'}>{paused ? '▶' : 'Ⅱ'}</button>
        </div>
      </header>

      {state.phase === 'running' && (
        <>
          <aside className="ulam-rift-objective" aria-live="polite">
            <span>OBJETIVO // {objective.kind === 'prime' ? 'TERMO' : objective.kind === 'tower' ? 'TORRE' : 'TRAVESSIA'}</span>
            <h1>{objective.title}</h1>
            <p>{objective.detail}</p>
            <div><i style={{ width: `${progress}%` }} /></div>
            <small>{objective.current}/12 MARCOS · SINAL A {Math.round(telemetry.objectiveDistance)} m</small>
          </aside>

          <aside className="ulam-rift-vitals">
            <div className="ulam-rift-integrity"><span>INTEGRIDADE</span><i><b style={{ width: `${state.integrity}%` }} /></i><strong>{state.integrity}</strong></div>
            <div className="ulam-rift-sequence" aria-label="Sequência prima">
              {ULAM_RIFT_PRIMES.map((prime, index) => (
                <span key={prime} className={index < state.nextPrimeIndex ? 'is-found' : index === state.nextPrimeIndex ? 'is-next' : ''}>{prime}</span>
              ))}
            </div>
          </aside>

          <aside className="ulam-rift-route" aria-label="Mapa dos setores">
            {ULAM_RIFT_SECTORS.map((sector, index) => (
              <span key={sector.id} className={index < currentSectorIndex ? 'is-cleared' : index === currentSectorIndex ? 'is-current' : ''}>
                <i style={{ '--sector-color': sector.accent } as React.CSSProperties} />
                <small>{String(index + 1).padStart(2, '0')}</small>
                <b>{sector.name}</b>
              </span>
            ))}
          </aside>

          <div className="ulam-rift-towers" aria-label="Torres ativadas">
            {ULAM_RIFT_TOWERS.map((tower) => (
              <span key={tower.id} className={state.activatedTowerIds.includes(tower.id) ? 'is-active' : ''} title={tower.name}>
                <i style={{ '--tower-color': tower.accent } as React.CSSProperties} />
              </span>
            ))}
          </div>

          {interaction && (
            <button type="button" className="ulam-rift-interact" onClick={onInteract}>
              <kbd>E</kbd><span><small>INTERAGIR</small>{interaction}</span>
            </button>
          )}

          <footer className="ulam-rift-controls">
            <span><kbd>WASD</kbd> MOVER</span>
            <span><kbd>SHIFT</kbd> CORRER</span>
            <span><kbd>SPACE</kbd> SALTAR</span>
            <span><b /> ARRASTAR CÂMERA</span>
          </footer>

          <TouchControls onMove={onTouchMove} onSprint={onSprint} onJump={onJump} onInteract={onInteract} />
        </>
      )}

      {state.feedback && state.phase === 'running' && (
        <div className={`ulam-rift-feedback is-${state.feedback.kind}`} role="status">{state.feedback.message}</div>
      )}

      {paused && state.phase === 'running' && (
        <div className="ulam-rift-pause">
          <span>TRAVESSIA SUSPENSA</span>
          <button type="button" onClick={() => onPauseChange(false)}>CONTINUAR</button>
        </div>
      )}

      {state.phase === 'ready' && (
        <GameIntro
          title="Fenda de Ulam"
          emphasis="de Ulam"
          instruction="Uma sequência viva rasgou o céu. Atravesse quatro setores até a Coroa, saltando de termo primo em termo primo."
          actionLabel="Entrar na fenda"
          accent="#a58cff"
          mark="19"
          keys="WASD mover · Shift correr · Espaço saltar · E ativar"
          onStart={onStart}
        />
      )}

      {(state.phase === 'won' || state.phase === 'lost') && (
        <section className={`ulam-rift-result ulam-rift-result--${state.phase}`}>
          <span>{state.phase === 'won' ? 'EXPEDIÇÃO CONCLUÍDA' : 'ECO DESFEITO'}</span>
          <h1>{state.phase === 'won' ? 'A Coroa despertou.' : 'A Fenda venceu desta vez.'}</h1>
          <p>{state.phase === 'won'
            ? 'Você atravessou a sequência inteira e ligou os quatro pontos de retorno.'
            : 'Use os checkpoints, evite os compostos e não atravesse um pulso vermelho.'}</p>
          <div>
            <span><small>TEMPO</small><b>{formatRiftTime(state.elapsedMs)}</b></span>
            <span><small>TERMOS</small><b>{state.nextPrimeIndex}/8</b></span>
            <span><small>QUEDAS</small><b>{state.falls}</b></span>
            <span><small>DANOS</small><b>{state.hits}</b></span>
          </div>
          <button type="button" onClick={onRestart}>{state.phase === 'won' ? 'NOVA TRAVESSIA' : 'TENTAR NOVAMENTE'}</button>
          <Link to="/jogos/primeverse-online">VOLTAR AO PRIMEVERSE ONLINE</Link>
        </section>
      )}
    </div>
  )
}
