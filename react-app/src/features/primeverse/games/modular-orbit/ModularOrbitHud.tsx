import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import {
  evaluateOrbitGuess,
  MAX_ORBIT_PULSES,
  MODULAR_ORBIT_ROUNDS,
} from './modularOrbitLogic'
import GameIntro from '../../ui/GameIntro'
import { useModularOrbitStore } from './modularOrbitStore'
import type { OrbitSoundEvent } from './types'

interface ModularOrbitHudProps {
  quality: QualityLevel
  onQualityChange: (quality: QualityLevel) => void
  onSoundEvent?: (event: OrbitSoundEvent) => void
}

function formatTime(milliseconds: number): string {
  const safe = Math.max(0, milliseconds)
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  const tenths = Math.floor((safe % 1_000) / 100)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
}

function useMissionClock(): number {
  const phase = useModularOrbitStore((state) => state.phase)
  const startedAt = useModularOrbitStore((state) => state.startedAt)
  const completedAt = useModularOrbitStore((state) => state.completedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt || phase === 'intro' || phase === 'complete') return undefined
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(interval)
  }, [phase, startedAt])

  if (!startedAt) return 0
  return (completedAt ?? now) - startedAt
}

function OrbitBrand({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <Link className={`orbit-brand${compact ? ' orbit-brand--compact' : ''}`} to="/jogos">
      <span className="orbit-brand__mark">%</span>
      <span>
        <strong>MODULAR ORBIT</strong>
        {!compact ? <small>PRIMEVERSE // ESTAÇÃO 03</small> : null}
      </span>
    </Link>
  )
}

function IntroPanel({ quality, onQualityChange }: ModularOrbitHudProps): JSX.Element {

  const start = useModularOrbitStore((state) => state.start)

  return (
    <GameIntro
      title="Modular Orbit"
      emphasis="Orbit"
      instruction="Cada órbita fecha em um resto. Ajuste o módulo até a trajetória voltar ao mesmo ponto."
      actionLabel="Entrar em órbita"
      accent="#6ef0d8"
      mark="mod"
      onStart={() => start()}
    >
      <QualityControl value={quality} onChange={onQualityChange} />
    </GameIntro>
  )
}

function MissionTopbar({ quality, onQualityChange }: Pick<ModularOrbitHudProps, 'quality' | 'onQualityChange'>): JSX.Element {
  const phase = useModularOrbitStore((state) => state.phase)
  const roundIndex = useModularOrbitStore((state) => state.roundIndex)
  const restart = useModularOrbitStore((state) => state.restart)

  return (
    <header className="orbit-topbar">
      <OrbitBrand compact />
      <div className="orbit-rounds" aria-label={`Órbita ${roundIndex + 1} de ${MODULAR_ORBIT_ROUNDS}`}>
        {Array.from({ length: MODULAR_ORBIT_ROUNDS }, (_, index) => (
          <i
            key={index}
            className={index < roundIndex ? 'is-complete' : index === roundIndex ? 'is-current' : ''}
          />
        ))}
        <span>{String(roundIndex + 1).padStart(2, '0')} / 0{MODULAR_ORBIT_ROUNDS}</span>
      </div>
      <div className="orbit-topbar__actions">
        <span className={`orbit-signal ${phase === 'launching' ? 'is-launching' : ''}`}>
          <i /> {phase === 'launching' ? 'SONDA EM TRÂNSITO' : 'TELEMETRIA ATIVA'}
        </span>
        <QualityControl value={quality} onChange={onQualityChange} />
        <button type="button" className="orbit-restart" onClick={restart}>Reiniciar</button>
      </div>
    </header>
  )
}

function MissionConsole({ onSoundEvent }: Pick<ModularOrbitHudProps, 'onSoundEvent'>): JSX.Element | null {
  const phase = useModularOrbitStore((state) => state.phase)
  const challenge = useModularOrbitStore((state) => state.challenge)
  const guess = useModularOrbitStore((state) => state.guess)
  const setGuess = useModularOrbitStore((state) => state.setGuess)
  const launch = useModularOrbitStore((state) => state.launch)

  if (!challenge) return null

  const parsedGuess = Number(guess)
  const canLaunch =
    phase === 'playing' &&
    guess.trim() !== '' &&
    Number.isSafeInteger(parsedGuess) &&
    parsedGuess >= 0 &&
    parsedGuess <= MAX_ORBIT_PULSES

  const adjustGuess = (delta: number) => {
    const current = Number.isSafeInteger(parsedGuess) ? parsedGuess : 0
    setGuess(String(Math.min(MAX_ORBIT_PULSES, Math.max(0, current + delta))))
    onSoundEvent?.('select')
  }

  return (
    <section className="orbit-console" aria-labelledby="orbit-mission-title">
      <div className="orbit-console__label">MISSÃO ATUAL // NÍVEL {challenge.difficulty}</div>
      <h2 id="orbit-mission-title">Encontre o menor <em>k</em></h2>
      <div className="orbit-equation" aria-label={`${challenge.start} mais k vezes ${challenge.step} é congruente a ${challenge.target}, módulo ${challenge.modulus}`}>
        <span>{challenge.start}</span>
        <i>+</i>
        <strong>k</strong>
        <i>×</i>
        <span>{challenge.step}</span>
        <i>≡</i>
        <span className="is-target">{challenge.target}</span>
        <small>(mod {challenge.modulus})</small>
      </div>
      <p>Quantos impulsos <strong>+{challenge.step}</strong> levam da estação {challenge.start} até {challenge.target} sem completar uma volta extra?</p>

      <form
        className="orbit-launch-control"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canLaunch) return
          onSoundEvent?.('launch')
          launch()
        }}
      >
        <label htmlFor="orbit-pulses">Pulsos k</label>
        <div>
          <button type="button" aria-label="Diminuir pulsos" onClick={() => adjustGuess(-1)} disabled={phase === 'launching'}>−</button>
          <input
            id="orbit-pulses"
            type="number"
            min="0"
            max={MAX_ORBIT_PULSES}
            step="1"
            inputMode="numeric"
            autoComplete="off"
            placeholder="?"
            value={guess}
            disabled={phase === 'launching'}
            onChange={(event) => setGuess(event.target.value)}
          />
          <button type="button" aria-label="Aumentar pulsos" onClick={() => adjustGuess(1)} disabled={phase === 'launching'}>+</button>
          <button className="orbit-launch" type="submit" disabled={!canLaunch}>
            {phase === 'launching' ? 'EM ÓRBITA…' : 'LANÇAR'}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
      <small className="orbit-console__hint">Dica: acompanhe as somas no sentido horário e conte cada pouso.</small>
    </section>
  )
}

function MissionTelemetry(): JSX.Element | null {
  const challenge = useModularOrbitStore((state) => state.challenge)
  const score = useModularOrbitStore((state) => state.score)
  const attempts = useModularOrbitStore((state) => state.attempts)
  const mistakes = useModularOrbitStore((state) => state.mistakes)
  const pendingLaunch = useModularOrbitStore((state) => state.pendingLaunch)
  const elapsed = useMissionClock()

  if (!challenge) return null
  const accuracy = attempts === 0 ? 100 : Math.round(((attempts - mistakes) / attempts) * 100)

  return (
    <aside className="orbit-telemetry" aria-label="Telemetria da missão">
      <div className="orbit-telemetry__grid">
        <div><span>SCORE</span><strong>{score.toLocaleString('pt-BR')}</strong></div>
        <div><span>TEMPO</span><strong>{formatTime(elapsed)}</strong></div>
        <div><span>PRECISÃO</span><strong>{accuracy}%</strong></div>
      </div>
      <div className="orbit-cycle">
        <span>PERÍODO DA ÓRBITA</span>
        <strong>{challenge.period} <small>estações alcançáveis</small></strong>
        <div>
          {Array.from({ length: Math.min(challenge.period, 19) }, (_, index) => (
            <i key={index} className={pendingLaunch && index < pendingLaunch.trace.length - 1 ? 'is-active' : ''} />
          ))}
        </div>
      </div>
    </aside>
  )
}

function FeedbackToast(): JSX.Element | null {
  const feedback = useModularOrbitStore((state) => state.feedback)
  const clearFeedback = useModularOrbitStore((state) => state.clearFeedback)

  useEffect(() => {
    if (!feedback) return undefined
    const timer = window.setTimeout(() => clearFeedback(feedback.id), 5_500)
    return () => window.clearTimeout(timer)
  }, [clearFeedback, feedback])

  if (!feedback) return null
  return (
    <div className={`orbit-feedback orbit-feedback--${feedback.kind}`} role="status" aria-live="polite">
      <i />
      <div><strong>{feedback.title}</strong><span>{feedback.detail}</span></div>
      <button type="button" aria-label="Fechar mensagem" onClick={() => clearFeedback(feedback.id)}>×</button>
    </div>
  )
}

function RoundCompletePanel({ onSoundEvent }: Pick<ModularOrbitHudProps, 'onSoundEvent'>): JSX.Element | null {
  const challenge = useModularOrbitStore((state) => state.challenge)
  const roundIndex = useModularOrbitStore((state) => state.roundIndex)
  const nextRound = useModularOrbitStore((state) => state.nextRound)

  const trace = useMemo(
    () => challenge ? evaluateOrbitGuess(challenge, challenge.solution).trace : [],
    [challenge],
  )
  if (!challenge) return null

  return (
    <div className="orbit-modal-wrap orbit-modal-wrap--round">
      <section
        className="orbit-panel orbit-round-complete"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orbit-round-title"
      >
        <div className="orbit-dock-mark">✓</div>
        <div className="orbit-eyebrow">ESTAÇÃO-ALVO ALCANÇADA</div>
        <h2 id="orbit-round-title">Órbita <em>sincronizada.</em></h2>
        <div className="orbit-proof">
          <strong>{challenge.start} + {challenge.solution} × {challenge.step} = {challenge.start + challenge.solution * challenge.step}</strong>
          <span>{challenge.start + challenge.solution * challenge.step} mod {challenge.modulus} = {challenge.target}</span>
        </div>
        <div className="orbit-trace" aria-label={`Rota: ${trace.join(', ')}`}>
          {trace.map((residue, index) => (
            <span key={`${index}-${residue}`} className={index === trace.length - 1 ? 'is-target' : ''}>
              {residue}{index < trace.length - 1 ? <i>→</i> : null}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="orbit-primary"
          autoFocus
          onClick={() => {
            onSoundEvent?.('select')
            nextRound()
          }}
        >
          Calibrar órbita {roundIndex + 2} <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  )
}

function ResultPanel({ onSoundEvent }: Pick<ModularOrbitHudProps, 'onSoundEvent'>): JSX.Element | null {
  const result = useModularOrbitStore((state) => state.result)
  const start = useModularOrbitStore((state) => state.start)
  if (!result) return null

  const accuracy = result.attempts === 0
    ? 100
    : Math.round(((result.attempts - result.mistakes) / result.attempts) * 100)

  return (
    <div className="orbit-modal-wrap orbit-modal-wrap--result">
      <section
        className="orbit-panel orbit-result"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orbit-result-title"
      >
        <div className="orbit-result__halo"><span>%</span></div>
        <div className="orbit-eyebrow">ROTA MODULAR CONCLUÍDA</div>
        <h2 id="orbit-result-title">
          {result.mistakes === 0
            ? <>Navegação <em>perfeita no ciclo.</em></>
            : <>Rota <em>concluída.</em></>}
        </h2>
        <p>Cinco sistemas congruentes cartografados. Cada volta termina onde a aritmética previu.</p>
        <div className="orbit-result__stats">
          <div><span>SCORE</span><strong>{result.score.toLocaleString('pt-BR')}</strong></div>
          <div><span>PRECISÃO</span><strong>{accuracy}%</strong></div>
          <div><span>TEMPO</span><strong>{formatTime(result.elapsedMs)}</strong></div>
          <div><span>TENTATIVAS</span><strong>{result.attempts}</strong></div>
        </div>
        <div className="orbit-xp">
          <span>XP RECEBIDO</span><strong>+{result.xp} XP</strong>
          {result.isNewBest ? <small>NOVO RECORDE</small> : null}
        </div>
        <div className="orbit-result__actions">
          <button
            type="button"
            className="orbit-primary"
            autoFocus
            onClick={() => {
              onSoundEvent?.('select')
              start()
            }}
          >
            Nova missão <span aria-hidden="true">↻</span>
          </button>
          <Link className="orbit-secondary" to="/jogos">Voltar ao Primeverse</Link>
        </div>
      </section>
    </div>
  )
}

export function ModularOrbitHud(props: ModularOrbitHudProps): JSX.Element {
  const phase = useModularOrbitStore((state) => state.phase)
  const feedbackVisible = useModularOrbitStore((state) => state.feedback !== null)
  const missionVisible = phase === 'playing' || phase === 'launching'

  if (phase === 'intro') return <IntroPanel {...props} />

  return (
    <div className={`modular-orbit__hud${feedbackVisible ? ' has-feedback' : ''}`}>
      {missionVisible ? (
        <>
          <MissionTopbar quality={props.quality} onQualityChange={props.onQualityChange} />
          <MissionConsole onSoundEvent={props.onSoundEvent} />
          <MissionTelemetry />
          <FeedbackToast />
        </>
      ) : null}
      {phase === 'round-complete' ? <RoundCompletePanel onSoundEvent={props.onSoundEvent} /> : null}
      {phase === 'complete' ? <ResultPanel onSoundEvent={props.onSoundEvent} /> : null}
    </div>
  )
}
