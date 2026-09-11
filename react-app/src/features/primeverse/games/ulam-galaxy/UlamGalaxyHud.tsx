import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import GameIntro from '../../ui/GameIntro'
import { getMissionPath, ULAM_ROUNDS } from './ulamLogic'
import { useUlamGalaxyStore } from './ulamStore'

interface UlamGalaxyHudProps {
  quality: QualityLevel
  onQualityChange: (quality: QualityLevel) => void
}

function formatTime(milliseconds: number): string {
  const safe = Math.max(0, milliseconds)
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function useMissionClock(): number {
  const phase = useUlamGalaxyStore((state) => state.phase)
  const startedAt = useUlamGalaxyStore((state) => state.startedAt)
  const completedAt = useUlamGalaxyStore((state) => state.completedAt)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!startedAt || phase === 'intro' || phase === 'complete') return undefined
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [phase, startedAt])

  if (!startedAt) return 0
  return Math.max(0, (completedAt ?? now) - startedAt)
}

function GalaxyBrand({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <Link className="ulam-brand" to="/jogos">
      <span className="ulam-brand__mark">U</span>
      <span><strong>ULAM GALAXY</strong>{compact ? null : <small>PRIMEVERSE // CARTOGRAFIA 08</small>}</span>
    </Link>
  )
}

function Intro({ quality, onQualityChange }: UlamGalaxyHudProps): JSX.Element {

  const start = useUlamGalaxyStore((state) => state.start)
  return (
    <GameIntro
      title="Ulam Galaxy"
      emphasis="Galaxy"
      instruction="Varra a espiral de inteiros e marque os primos. As diagonais que aparecerem não são coincidência."
      actionLabel="Escanear a espiral"
      accent="#a58cff"
      mark="41"
      onStart={() => start()}
    >
      <QualityControl value={quality} onChange={onQualityChange} />
    </GameIntro>
  )
}

function Topbar({ quality, onQualityChange }: UlamGalaxyHudProps): JSX.Element {
  const roundIndex = useUlamGalaxyStore((state) => state.roundIndex)
  const phase = useUlamGalaxyStore((state) => state.phase)
  const restart = useUlamGalaxyStore((state) => state.restart)
  return (
    <header className="ulam-topbar">
      <GalaxyBrand compact />
      <div className="ulam-progress" aria-label={`Região ${roundIndex + 1} de ${ULAM_ROUNDS}`}>
        {Array.from({ length: ULAM_ROUNDS }, (_, index) => <i key={index} className={index < roundIndex ? 'done' : index === roundIndex ? 'current' : ''} />)}
        <span>0{roundIndex + 1} / 0{ULAM_ROUNDS}</span>
      </div>
      <div className="ulam-topbar__actions">
        <span className={`ulam-live${phase === 'scanning' ? ' scanning' : ''}`}><i /> {phase === 'scanning' ? 'ESCANEANDO' : 'MAPA ESTÁVEL'}</span>
        <QualityControl value={quality} onChange={onQualityChange} />
        <button type="button" onClick={restart}>Reiniciar</button>
      </div>
    </header>
  )
}

function MissionConsole(): JSX.Element {
  const phase = useUlamGalaxyStore((state) => state.phase)
  const mission = useUlamGalaxyStore((state) => state.mission)
  const selected = useUlamGalaxyStore((state) => state.selectedDirection)
  const select = useUlamGalaxyStore((state) => state.selectDirection)
  const scan = useUlamGalaxyStore((state) => state.scan)
  const disabled = phase !== 'playing'

  return (
    <section className="ulam-console" aria-labelledby="ulam-mission-title">
      <div className="ulam-console__label">REGIÃO 0{mission.difficulty} // MALHA {mission.size} × {mission.size}</div>
      <h2 id="ulam-mission-title">Qual diagonal concentra <em>mais primos?</em></h2>
      <p>Parta da âncora <strong>{mission.anchor.value}</strong> e compare os próximos {mission.pathLength} setores em cada direção.</p>
      <div className="ulam-directions">
        {mission.paths.map((path) => (
          <button
            type="button"
            key={path.direction.id}
            className={selected === path.direction.id ? 'selected' : ''}
            disabled={disabled}
            aria-pressed={selected === path.direction.id}
            onClick={() => select(path.direction.id)}
          >
            <span>{path.direction.symbol}</span>
            <div><strong>{path.direction.label}</strong><small>Δ ({path.direction.dx}, {path.direction.dy})</small></div>
          </button>
        ))}
      </div>
      <button type="button" className="ulam-primary ulam-scan" disabled={!selected || disabled} onClick={scan}>
        {phase === 'scanning' ? 'Analisando trajetória…' : 'Analisar trajetória'} <span>⌁</span>
      </button>
      <details className="ulam-accessible-map">
        <summary>Leitura tabular das trajetórias</summary>
        <div>
          {mission.paths.map((path) => (
            <p key={path.direction.id}>
              <b>{path.direction.symbol} {path.direction.label}:</b>{' '}
              {path.cells.map((cell) => `${cell.value} (${cell.prime ? 'primo' : 'composto'})`).join(', ')}
            </p>
          ))}
        </div>
      </details>
    </section>
  )
}

function Telemetry(): JSX.Element {
  const mission = useUlamGalaxyStore((state) => state.mission)
  const scannerEnabled = useUlamGalaxyStore((state) => state.scannerEnabled)
  const toggleScanner = useUlamGalaxyStore((state) => state.toggleScanner)
  const score = useUlamGalaxyStore((state) => state.score)
  const mistakes = useUlamGalaxyStore((state) => state.mistakes)
  const elapsed = useMissionClock()
  return (
    <aside className="ulam-telemetry">
      <div className="ulam-telemetry__stats">
        <div><span>SCORE</span><strong>{score.toLocaleString('pt-BR')}</strong></div>
        <div><span>TEMPO</span><strong>{formatTime(elapsed)}</strong></div>
        <div><span>DESVIOS</span><strong>{String(mistakes).padStart(2, '0')}</strong></div>
      </div>
      <button type="button" className={`ulam-scanner${scannerEnabled ? ' enabled' : ''}`} aria-pressed={scannerEnabled} onClick={toggleScanner}>
        <span><i /> SCANNER PRIMO</span><strong>{scannerEnabled ? 'ON' : 'OFF'}</strong>
      </button>
      <div className="ulam-legend"><span><i /> primo</span><span><i /> composto</span><span><i /> âncora</span></div>
      <small>{mission.size ** 2} inteiros orbitando · {mission.paths.length} vetores candidatos</small>
    </aside>
  )
}

function Feedback(): JSX.Element | null {
  const feedback = useUlamGalaxyStore((state) => state.feedback)
  const clear = useUlamGalaxyStore((state) => state.clearFeedback)
  useEffect(() => {
    if (!feedback) return undefined
    const timer = window.setTimeout(() => clear(feedback.id), 4_800)
    return () => window.clearTimeout(timer)
  }, [clear, feedback])
  if (!feedback) return null
  return (
    <div className={`ulam-feedback ${feedback.kind}`} role="status" aria-live="polite">
      <i /><div><strong>{feedback.title}</strong><span>{feedback.detail}</span></div>
      <button type="button" onClick={() => clear(feedback.id)} aria-label="Fechar mensagem">×</button>
    </div>
  )
}

function RoundComplete(): JSX.Element | null {
  const phase = useUlamGalaxyStore((state) => state.phase)
  const mission = useUlamGalaxyStore((state) => state.mission)
  const next = useUlamGalaxyStore((state) => state.nextRound)
  if (phase !== 'round-complete') return null
  const path = getMissionPath(mission, mission.correctDirection)
  return (
    <div className="ulam-modal">
      <section className="ulam-panel ulam-round" role="dialog" aria-modal="true" aria-labelledby="ulam-round-title">
        <div className="ulam-round__orbit">{path.direction.symbol}</div>
        <div className="ulam-eyebrow">TRAJETÓRIA DOMINANTE CONFIRMADA</div>
        <h2 id="ulam-round-title">Uma diagonal <em>emerge.</em></h2>
        <p>A direção {path.direction.label.toLowerCase()} contém {path.primeCount} primos em {path.cells.length} setores.</p>
        <div className="ulam-proof">
          {path.cells.map((cell) => <span key={cell.value} className={cell.prime ? 'prime' : ''}><b>{cell.value}</b><small>{cell.prime ? 'PRIMO' : 'COMPOSTO'}</small></span>)}
        </div>
        <button type="button" className="ulam-primary" autoFocus onClick={next}>Abrir região 0{mission.difficulty + 1} <span>→</span></button>
      </section>
    </div>
  )
}

function Result(): JSX.Element | null {
  const result = useUlamGalaxyStore((state) => state.result)
  const start = useUlamGalaxyStore((state) => state.start)
  if (!result) return null
  return (
    <div className="ulam-modal ulam-modal--result">
      <section className="ulam-panel ulam-result" role="dialog" aria-modal="true" aria-labelledby="ulam-result-title">
        <div className="ulam-result__galaxy"><span>U</span></div>
        <div className="ulam-eyebrow">CARTOGRAFIA PRIMA CONCLUÍDA</div>
        <h2 id="ulam-result-title">A estrutura <em>apareceu.</em></h2>
        <p>A espiral não torna os primos previsíveis, mas revela como certas fórmulas preservam padrões por longas diagonais.</p>
        <div className="ulam-result__stats">
          <div><span>SCORE</span><strong>{result.score.toLocaleString('pt-BR')}</strong></div>
          <div><span>TEMPO</span><strong>{formatTime(result.elapsedMs)}</strong></div>
          <div><span>PRECISÃO</span><strong>{Math.round(ULAM_ROUNDS / (ULAM_ROUNDS + result.mistakes) * 100)}%</strong></div>
          <div><span>REGIÕES</span><strong>{result.rounds.length}/5</strong></div>
        </div>
        <div className="ulam-xp"><span>XP RECEBIDO</span><strong>+{result.xp} XP</strong>{result.isNewBest ? <small>NOVO RECORDE</small> : null}</div>
        <div className="ulam-result__actions"><button type="button" className="ulam-primary" autoFocus onClick={start}>Nova cartografia <span>↻</span></button><Link to="/jogos">Voltar ao Primeverse</Link></div>
      </section>
    </div>
  )
}

export function UlamGalaxyHud(props: UlamGalaxyHudProps): JSX.Element {
  const phase = useUlamGalaxyStore((state) => state.phase)
  if (phase === 'intro') return <div className="ulam-hud"><Intro {...props} /></div>
  const showMissionHud = phase === 'playing' || phase === 'scanning'
  return (
    <div className="ulam-hud">
      {showMissionHud ? <><Topbar {...props} /><MissionConsole /><Telemetry /></> : null}
      {showMissionHud ? <Feedback /> : null}
      <RoundComplete />
      <Result />
    </div>
  )
}
