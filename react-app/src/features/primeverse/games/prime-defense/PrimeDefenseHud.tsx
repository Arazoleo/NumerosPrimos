import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import {
  analyzeDefensePlan,
  createWaveEnemies,
  DEFENSE_DIVISORS,
  DEFENSE_LANES,
  DEFENSE_SLOTS,
  DEFENSE_WAVES,
  getPlacementEnergy,
  TOWER_COSTS,
  towerId,
} from './defenseLogic'
import GameIntro from '../../ui/GameIntro'
import { usePrimeDefenseStore } from './defenseStore'
import type {
  DefenseLane,
  DefenseOutcome,
  DefenseSoundEvent,
} from './types'

interface PrimeDefenseHudProps {
  quality: QualityLevel
  onQualityChange: (quality: QualityLevel) => void
  onSoundEvent?: (event: DefenseSoundEvent) => void
}

function formatTime(milliseconds: number): string {
  const safe = Math.max(0, milliseconds)
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function useDefenseClock(): number {
  const phase = usePrimeDefenseStore((state) => state.phase)
  const startedAt = usePrimeDefenseStore((state) => state.startedAt)
  const completedAt = usePrimeDefenseStore((state) => state.completedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt || phase === 'intro' || phase === 'victory' || phase === 'defeat') {
      return undefined
    }
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [phase, startedAt])

  if (!startedAt) return 0
  return (completedAt ?? now) - startedAt
}

function DefenseBrand({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <Link className={`defense-brand${compact ? ' defense-brand--compact' : ''}`} to="/jogos">
      <span className="defense-brand__mark">Δ</span>
      <span>
        <strong>PRIME DEFENSE</strong>
        {!compact ? <small>PRIMEVERSE // ESTAÇÃO 04</small> : null}
      </span>
    </Link>
  )
}

function IntroPanel({ quality, onQualityChange }: PrimeDefenseHudProps): JSX.Element {

  const start = usePrimeDefenseStore((state) => state.start)

  return (
    <GameIntro
      title="Prime Defense"
      emphasis="Defense"
      instruction="Ondas compostas avançam pela grade. Coloque torres primas para fatorar cada invasor antes que ele alcance o núcleo."
      actionLabel="Iniciar defesa"
      accent="#ff7a6b"
      mark="5"
      onStart={() => start()}
    >
      <QualityControl value={quality} onChange={onQualityChange} />
    </GameIntro>
  )
}

function MissionTopbar({ quality, onQualityChange }: Pick<PrimeDefenseHudProps, 'quality' | 'onQualityChange'>): JSX.Element {
  const phase = usePrimeDefenseStore((state) => state.phase)
  const waveIndex = usePrimeDefenseStore((state) => state.waveIndex)
  const lives = usePrimeDefenseStore((state) => state.lives)
  const restart = usePrimeDefenseStore((state) => state.restart)

  return (
    <header className="defense-topbar">
      <DefenseBrand compact />
      <div className="defense-wave-progress" aria-label={`Onda ${waveIndex + 1} de ${DEFENSE_WAVES.length}`}>
        <div>
          {DEFENSE_WAVES.map((wave, index) => (
            <i
              key={wave.id}
              className={index < waveIndex ? 'is-complete' : index === waveIndex ? 'is-current' : ''}
            />
          ))}
        </div>
        <span>ONDA {String(waveIndex + 1).padStart(2, '0')} / 0{DEFENSE_WAVES.length}</span>
      </div>
      <div className="defense-integrity" aria-label={`${lives} pontos de integridade`}>
        <span>INTEGRIDADE</span>
        <div>{Array.from({ length: 6 }, (_, index) => <i key={index} className={index < lives ? 'is-live' : ''} />)}</div>
      </div>
      <div className="defense-topbar__actions">
        <span className={`defense-signal${phase === 'running' ? ' is-running' : ''}`}>
          <i /> {phase === 'running' ? 'ONDA EM CURSO' : 'MALHA ONLINE'}
        </span>
        <QualityControl value={quality} onChange={onQualityChange} />
        <button type="button" className="defense-restart" onClick={restart}>Reiniciar</button>
      </div>
    </header>
  )
}

function FilterPalette({ onSoundEvent }: Pick<PrimeDefenseHudProps, 'onSoundEvent'>): JSX.Element {
  const phase = usePrimeDefenseStore((state) => state.phase)
  const waveIndex = usePrimeDefenseStore((state) => state.waveIndex)
  const placements = usePrimeDefenseStore((state) => state.placements)
  const selectedDivisor = usePrimeDefenseStore((state) => state.selectedDivisor)
  const selectDivisor = usePrimeDefenseStore((state) => state.selectDivisor)

  const isTutorialActive = usePrimeDefenseStore((state) => state.isTutorialActive)
  const tutorialStep = usePrimeDefenseStore((state) => state.tutorialStep)
  const nextTutorialStep = usePrimeDefenseStore((state) => state.nextTutorialStep)

  const wave = DEFENSE_WAVES[waveIndex]
  const used = getPlacementEnergy(placements)

  return (
    <aside className="defense-palette" aria-label="Banco de filtros divisores" style={{ position: 'relative', zIndex: isTutorialActive && tutorialStep === 1 ? 100 : 1 }}>
      <div className="defense-palette__heading">
        <div><span>BANCO DE FILTROS</span><strong>Escolha uma frequência</strong></div>
        <small>{wave.energy - used} energia livre</small>
      </div>
      <div className="defense-energy">
        <div><span>CONSUMO</span><strong>{used} / {wave.energy}</strong></div>
        <progress max={wave.energy} value={used}>{used} de {wave.energy}</progress>
      </div>
      <div className="defense-filter-list">
        {DEFENSE_DIVISORS.map((divisor) => (
          <button
            key={divisor}
            type="button"
            className={`${selectedDivisor === divisor ? 'is-selected' : ''} ${isTutorialActive && tutorialStep === 1 ? 'tutorial-highlight' : ''}`}
            aria-pressed={selectedDivisor === divisor}
            disabled={phase !== 'planning'}
            data-divisor={divisor}
            onClick={() => {
              selectDivisor(divisor)
              onSoundEvent?.('select')
              if (isTutorialActive && tutorialStep === 1) nextTutorialStep()
            }}
          >
            <span>{divisor}</span>
            <div><strong>FILTRO ÷ {divisor}</strong><small>{TOWER_COSTS[divisor]} ENERGIA</small></div>
            <i aria-hidden="true">{selectedDivisor === divisor ? '✓' : '+'}</i>
          </button>
        ))}
      </div>
      <p className="defense-palette__tip">
        Um filtro detém <strong>todos os múltiplos</strong> de seu divisor naquela pista.
      </p>
    </aside>
  )
}

function outcomeClass(outcome: DefenseOutcome, resolved: boolean, active: boolean): string {
  const classes = [`is-${outcome.kind}`]
  if (resolved) classes.push('is-resolved')
  if (active) classes.push('is-active')
  return classes.join(' ')
}

function DefenseBoard({ onSoundEvent }: Pick<PrimeDefenseHudProps, 'onSoundEvent'>): JSX.Element {
  const phase = usePrimeDefenseStore((state) => state.phase)
  const waveIndex = usePrimeDefenseStore((state) => state.waveIndex)
  const placements = usePrimeDefenseStore((state) => state.placements)
  const lives = usePrimeDefenseStore((state) => state.lives)
  const selectedDivisor = usePrimeDefenseStore((state) => state.selectedDivisor)
  const activeEnemyIndex = usePrimeDefenseStore((state) => state.activeEnemyIndex)
  const runQueue = usePrimeDefenseStore((state) => state.runQueue)
  const outcomes = usePrimeDefenseStore((state) => state.currentWaveOutcomes)
  const placeTower = usePrimeDefenseStore((state) => state.placeTower)
  const launchWave = usePrimeDefenseStore((state) => state.launchWave)

  const isTutorialActive = usePrimeDefenseStore((state) => state.isTutorialActive)
  const tutorialStep = usePrimeDefenseStore((state) => state.tutorialStep)
  const nextTutorialStep = usePrimeDefenseStore((state) => state.nextTutorialStep)
  const skipTutorial = usePrimeDefenseStore((state) => state.skipTutorial)

  const wave = DEFENSE_WAVES[waveIndex]
  const enemies = useMemo(() => createWaveEnemies(wave, waveIndex), [wave, waveIndex])
  const analysis = useMemo(
    () => analyzeDefensePlan(wave, waveIndex, placements),
    [placements, wave, waveIndex],
  )
  const outcomesByEnemy = useMemo(
    () => new Map(analysis.outcomes.map((outcome) => [outcome.enemy.id, outcome])),
    [analysis.outcomes],
  )
  const resolvedIds = useMemo(() => new Set(outcomes.map((outcome) => outcome.enemy.id)), [outcomes])
  const activeEnemyId = phase === 'running' ? runQueue[activeEnemyIndex]?.id : null

  const install = (lane: DefenseLane, slot: 0 | 1 | 2) => {
    const valid = placeTower(lane, slot)
    onSoundEvent?.(valid ? 'place' : 'breach')
    if (valid && isTutorialActive && tutorialStep === 2) nextTutorialStep()
  }

  return (
    <section className="defense-board" aria-labelledby="defense-wave-title" style={{ position: 'relative', zIndex: isTutorialActive && (tutorialStep === 2 || tutorialStep === 3) ? 100 : 1 }}>
      <div className="defense-board__head">
        <div>
          <span>ONDA {String(waveIndex + 1).padStart(2, '0')} // {wave.id.toUpperCase()}</span>
          <h1 id="defense-wave-title">{wave.name}</h1>
          <p>{wave.briefing}</p>
        </div>
        <div className="defense-forecast" aria-label="Previsão da defesa atual">
          <span>SIMULAÇÃO</span>
          <div><strong>{analysis.intercepted}</strong><small>cobertos</small></div>
          <div><strong>{analysis.primes}</strong><small>primos</small></div>
          <div className={analysis.breaches > 0 ? 'has-risk' : ''}><strong>{analysis.breaches}</strong><small>riscos</small></div>
          <div className={lives <= 2 ? 'has-risk' : ''}><strong>{lives}</strong><small>integridade</small></div>
        </div>
      </div>

      <div className="defense-lanes" aria-label="Tabuleiro de três pistas">
        {DEFENSE_LANES.map((lane) => (
          <div className="defense-lane" key={lane}>
            <div className="defense-lane__label"><span>0{lane + 1}</span><small>PISTA</small></div>
            <div className="defense-enemy-preview" aria-label={`Sequência da pista ${lane + 1}`}>
              {enemies.filter((enemy) => enemy.lane === lane).map((enemy) => {
                const outcome = outcomesByEnemy.get(enemy.id)
                if (!outcome) return null
                const resolved = resolvedIds.has(enemy.id)
                const active = activeEnemyId === enemy.id
                return (
                  <span
                    key={enemy.id}
                    className={outcomeClass(outcome, resolved, active)}
                    title={outcome.explanation}
                    aria-label={`${enemy.value}: ${outcome.kind === 'prime-passed' ? 'primo autorizado' : outcome.kind === 'intercepted' ? `coberto pelo divisor ${outcome.divisor}` : 'composto sem cobertura'}`}
                  >
                    {enemy.value}
                    <i aria-hidden="true">
                      {outcome.kind === 'prime-passed' ? 'P' : outcome.kind === 'intercepted' ? `÷${outcome.divisor}` : '!'}
                    </i>
                  </span>
                )
              })}
            </div>
            <div className="defense-slot-row" aria-label={`Slots defensivos da pista ${lane + 1}`}>
              {DEFENSE_SLOTS.map((slot) => {
                const placement = placements.find((candidate) => candidate.id === towerId(lane, slot))
                const label = placement
                  ? placement.divisor === selectedDivisor
                    ? `Remover filtro ${placement.divisor} da pista ${lane + 1}, slot ${slot + 1}`
                    : `Trocar filtro ${placement.divisor} por ${selectedDivisor} na pista ${lane + 1}, slot ${slot + 1}`
                  : `Instalar filtro ${selectedDivisor} na pista ${lane + 1}, slot ${slot + 1}`
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`${placement ? 'is-occupied' : ''} ${isTutorialActive && tutorialStep === 2 && !placement ? 'tutorial-highlight' : ''}`}
                    data-divisor={placement?.divisor}
                    aria-label={label}
                    disabled={phase !== 'planning'}
                    onClick={() => install(lane, slot)}
                  >
                    <span>{placement ? placement.divisor : '+'}</span>
                    <small>{placement ? `÷ ${placement.divisor}` : `S${slot + 1}`}</small>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="defense-board__footer">
        <p>
          <i className="is-prime" /> primos atravessam
          <i className="is-covered" /> compostos cobertos
          <i className="is-risk" /> compostos em risco
        </p>
        <button
          type="button"
          className={`defense-launch ${isTutorialActive && tutorialStep === 3 ? 'tutorial-highlight' : ''}`}
          disabled={phase !== 'planning'}
          onClick={() => {
            if (!launchWave()) return
            onSoundEvent?.('launch')
            // FINALIZA O TUTORIAL:
            if (isTutorialActive) skipTutorial()
          }}
        >
          {phase === 'running' ? 'ONDA EM CURSO…' : 'EXECUTAR ONDA'}
          <span aria-hidden="true">▷</span>
        </button>
      </div>
    </section>
  )
}

function Telemetry(): JSX.Element {
  const phase = usePrimeDefenseStore((state) => state.phase)
  const score = usePrimeDefenseStore((state) => state.score)
  const coreCharge = usePrimeDefenseStore((state) => state.coreCharge)
  const intercepted = usePrimeDefenseStore((state) => state.intercepted)
  const recentOutcomes = usePrimeDefenseStore((state) => state.recentOutcomes)
  const elapsed = useDefenseClock()
  const latest = recentOutcomes[recentOutcomes.length - 1]

  return (
    <aside className="defense-telemetry" aria-label="Telemetria da defesa">
      <div className="defense-telemetry__metrics">
        <div><span>SCORE</span><strong>{score.toLocaleString('pt-BR')}</strong></div>
        <div><span>TEMPO</span><strong>{formatTime(elapsed)}</strong></div>
        <div><span>NÚCLEO</span><strong>{coreCharge}<small> primos</small></strong></div>
        <div><span>INTERCEPTADOS</span><strong>{intercepted}</strong></div>
      </div>
      <div className="defense-proof">
        <span>PROVA MAIS RECENTE</span>
        {latest ? (
          <div className={`is-${latest.kind}`}>
            <strong>{latest.enemy.value}</strong>
            <p>{latest.explanation}</p>
          </div>
        ) : (
          <p>{phase === 'planning' ? 'Execute a onda para abrir o canal de análise.' : 'Aguardando telemetria…'}</p>
        )}
      </div>
    </aside>
  )
}

function FeedbackToast(): JSX.Element | null {
  const feedback = usePrimeDefenseStore((state) => state.feedback)
  const clearFeedback = usePrimeDefenseStore((state) => state.clearFeedback)

  useEffect(() => {
    if (!feedback) return undefined
    const timer = window.setTimeout(() => clearFeedback(feedback.id), 4_200)
    return () => window.clearTimeout(timer)
  }, [clearFeedback, feedback])

  if (!feedback) return null
  return (
    <div className={`defense-feedback defense-feedback--${feedback.kind}`} role="status" aria-live="polite">
      <i />
      <div><strong>{feedback.title}</strong><span>{feedback.detail}</span></div>
      <button type="button" aria-label="Fechar mensagem" onClick={() => clearFeedback(feedback.id)}>×</button>
    </div>
  )
}

function WaveResultPanel({ onSoundEvent }: Pick<PrimeDefenseHudProps, 'onSoundEvent'>): JSX.Element | null {
  const waveIndex = usePrimeDefenseStore((state) => state.waveIndex)
  const summary = usePrimeDefenseStore(
    (state) => state.waveSummaries[state.waveSummaries.length - 1],
  )
  const outcomes = usePrimeDefenseStore((state) => state.currentWaveOutcomes)
  const nextWave = usePrimeDefenseStore((state) => state.nextWave)
  if (!summary) return null

  return (
    <div className="defense-modal-wrap defense-modal-wrap--result">
      <section className="defense-panel defense-wave-result" role="dialog" aria-modal="true" aria-labelledby="defense-wave-result-title">
        <div className={`defense-result-mark${summary.perfect ? ' is-perfect' : ''}`} aria-hidden="true">
          {summary.perfect ? '✓' : '△'}
        </div>
        <div className="defense-eyebrow">ONDA {String(waveIndex + 1).padStart(2, '0')} CONTIDA</div>
        <h2 id="defense-wave-result-title">
          {summary.perfect ? <>Cobertura <em>integral.</em></> : <>Núcleo ainda <em>operacional.</em></>}
        </h2>
        <div className="defense-wave-stats">
          <div><span>INTERCEPTADOS</span><strong>{summary.intercepted}</strong></div>
          <div><span>PRIMOS</span><strong>{summary.primesPassed}</strong></div>
          <div><span>BRECHAS</span><strong>{summary.breaches}</strong></div>
          <div><span>PONTOS</span><strong>+{summary.points.toLocaleString('pt-BR')}</strong></div>
        </div>
        <div className="defense-wave-log" aria-label="Relatório matemático da onda">
          {outcomes.map((outcome) => (
            <div key={outcome.enemy.id} className={`is-${outcome.kind}`}>
              <strong>{outcome.enemy.value}</strong><span>{outcome.explanation}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="defense-primary"
          autoFocus
          onClick={() => {
            if (!nextWave()) return
            onSoundEvent?.('wave-complete')
          }}
        >
          Preparar onda {waveIndex + 2} <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  )
}

function FinalResultPanel(): JSX.Element | null {
  const result = usePrimeDefenseStore((state) => state.result)
  const bestScore = usePrimeDefenseStore((state) => state.bestScore)
  const restart = usePrimeDefenseStore((state) => state.restart)
  if (!result) return null

  return (
    <div className="defense-modal-wrap defense-modal-wrap--final">
      <section className={`defense-panel defense-final${result.victory ? ' is-victory' : ' is-defeat'}`} role="dialog" aria-modal="true" aria-labelledby="defense-final-title">
        <div className="defense-final__sigil" aria-hidden="true">{result.victory ? 'Δ' : '!'}</div>
        <div className="defense-eyebrow">{result.victory ? 'PROTOCOLO DE DEFESA CONCLUÍDO' : 'INTEGRIDADE ESGOTADA'}</div>
        <h2 id="defense-final-title">
          {result.victory ? <>Núcleo <em>preservado.</em></> : <>Defesa <em>rompida.</em></>}
        </h2>
        <p>
          {result.victory
            ? `${result.primesPassed} números primos atravessaram a triagem; ${result.intercepted} compostos foram provados e neutralizados.`
            : `Você conteve ${result.intercepted} compostos antes da falha. Recalibre as pistas marcadas em vermelho e tente outra formação.`}
        </p>
        <div className="defense-final__score">
          <span>SCORE FINAL</span><strong>{result.score.toLocaleString('pt-BR')}</strong>
          {result.isNewBest ? <small>NOVO RECORDE</small> : <small>MELHOR {bestScore.toLocaleString('pt-BR')}</small>}
        </div>
        <div className="defense-final__grid">
          <div><span>ONDAS</span><strong>{result.wavesCleared} / 5</strong></div>
          <div><span>TEMPO</span><strong>{formatTime(result.elapsedMs)}</strong></div>
          <div><span>BRECHAS</span><strong>{result.breaches}</strong></div>
          <div><span>XP RECEBIDO</span><strong>+{result.xp}</strong></div>
        </div>
        <div className="defense-final__actions">
          <button type="button" className="defense-primary" autoFocus onClick={restart}>
            {result.victory ? 'Defender novamente' : 'Recalibrar defesa'} <span aria-hidden="true">↻</span>
          </button>
          <Link className="defense-text-link" to="/jogos">Voltar ao Primeverse</Link>
        </div>
      </section>
    </div>
  )
}

function TutorialOverlay(): JSX.Element | null {
  const isTutorialActive = usePrimeDefenseStore((state) => state.isTutorialActive)
  const tutorialStep = usePrimeDefenseStore((state) => state.tutorialStep)
  const skipTutorial = usePrimeDefenseStore((state) => state.skipTutorial)

  if (!isTutorialActive) return null

  let message = ""
  if (tutorialStep === 1) message = "Selecione um filtro de divisor na paleta."
  else if (tutorialStep === 2) message = "Instale o filtro em um dos espaços vazios (S1, S2, S3) nas pistas."
  else if (tutorialStep === 3) message = "Acompanhe a simulação e clique em EXECUTAR ONDA."
  else {
    skipTutorial()
    return null
  }

  return (
    <>
      {/* Fundo escuro */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          zIndex: 50,
          pointerEvents: 'auto'
        }} 
      />
      
      {/* Painel de texto flutuante */}
      <div 
        className="tutorial-dialog" 
        style={{ 
          position: 'fixed', 
          top: '10%', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          zIndex: 101, 
          background: '#0a1012',
          padding: '24px 32px', 
          border: '1px solid #4a9e9e',
          borderRadius: '4px', 
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
        }}
      >
        <p style={{ color: '#fff', marginBottom: '16px', fontSize: '1.1rem', fontWeight: 500 }}>{message}</p>
        <button 
          type="button" 
          onClick={skipTutorial} 
          style={{ color: '#4a9e9e', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Pular Tutorial
        </button>
      </div>
    </>
  )
}

export function PrimeDefenseHud(props: PrimeDefenseHudProps): JSX.Element {
  const phase = usePrimeDefenseStore((state) => state.phase)

  if (phase === 'intro') {
    return <div className="defense-hud"><IntroPanel {...props} /></div>
  }

  const missionVisible = phase === 'planning' || phase === 'running'
  return (
    <div className="defense-hud">
      <TutorialOverlay />
      
      {missionVisible ? (
        <>
          <MissionTopbar quality={props.quality} onQualityChange={props.onQualityChange} />
          <div className="defense-mission-layout">
            <FilterPalette onSoundEvent={props.onSoundEvent} />
            <DefenseBoard onSoundEvent={props.onSoundEvent} />
            <Telemetry />
          </div>
          <FeedbackToast />
        </>
      ) : null}
      
      {phase === 'wave-result' ? <WaveResultPanel onSoundEvent={props.onSoundEvent} /> : null}
      {phase === 'victory' || phase === 'defeat' ? <FinalResultPanel /> : null}
    </div>
  )
}