import { countdownNumber, remainingGameTime } from './types'
import { FACTOR_REACTOR_TARGETS } from './factorReactor'
import { ULAM_PRIME_SEQUENCE } from './ulamPrimeRun'
import type { PrimeverseMinigameController } from './usePrimeverseMinigames'
import './primeverse-minigames.css'

interface PrimeverseMinigameHudProps {
  readonly controller: PrimeverseMinigameController
}

function formatTime(milliseconds: number | null): string {
  if (milliseconds === null) return '—'
  return `${(milliseconds / 1_000).toFixed(2)} s`
}

function Countdown({ value }: { readonly value: number | null }): JSX.Element | null {
  if (value === null) return null
  return <strong className="pv-minigame__countdown" aria-label={`Começa em ${value}`}>{value}</strong>
}

function UlamHud({ controller }: PrimeverseMinigameHudProps): JSX.Element {
  const { ulam: state } = controller
  const nextPrime = ULAM_PRIME_SEQUENCE[state.nextPrimeIndex]
  const canStart = state.phase === 'idle' || state.phase === 'won' || state.phase === 'lost'
  return (
    <aside className="pv-minigame pv-minigame--ulam" aria-label="Corrida dos irredutíveis">
      <header className="pv-minigame__header">
        <span>Fenda de Ulam</span>
        <button type="button" className="pv-minigame__close" onClick={controller.leave} aria-label="Sair do minigame">×</button>
      </header>
      <Countdown value={countdownNumber(state)} />
      <div className="pv-minigame__timer" aria-label="Tempo restante">
        {(remainingGameTime(state) / 1_000).toFixed(1)}
        <small>s</small>
      </div>
      <p className="pv-minigame__eyebrow">SEQUÊNCIA PRIMA</p>
      <div className="pv-minigame__sequence" aria-label="Progresso da sequência">
        {ULAM_PRIME_SEQUENCE.map((prime, index) => (
          <span
            key={prime}
            className={index < state.nextPrimeIndex ? 'is-cleared' : index === state.nextPrimeIndex ? 'is-current' : ''}
          >
            {prime}
          </span>
        ))}
      </div>
      {state.phase === 'running' && <p className="pv-minigame__directive">Atravesse o alvo <strong>{nextPrime}</strong></p>}
      {state.phase === 'idle' && <p className="pv-minigame__directive">Corra pelos primos em ordem. Compostos roubam 2,5 s.</p>}
      {state.phase === 'won' && (
        <p className="pv-minigame__result">Circuito fechado em {formatTime(state.finishedTimeMs)}{state.isNewRecord ? ' · NOVO RECORDE' : ''}</p>
      )}
      {state.phase === 'lost' && <p className="pv-minigame__result is-danger">A fenda colapsou. Tente uma rota mais limpa.</p>}
      {state.feedback && state.phase === 'running' && (
        <p className={`pv-minigame__feedback is-${state.feedback.kind}`} aria-live="polite">{state.feedback.message}</p>
      )}
      <footer className="pv-minigame__footer">
        <span>Recorde {formatTime(state.bestTimeMs)}</span>
        {canStart && (
          <button type="button" onClick={() => controller.start('ulam-prime-run')}>{state.phase === 'idle' ? 'Iniciar' : 'Outra corrida'}</button>
        )}
      </footer>
    </aside>
  )
}

function ReactorHud({ controller }: PrimeverseMinigameHudProps): JSX.Element {
  const { factorReactor: state } = controller
  const target = FACTOR_REACTOR_TARGETS[state.roundIndex]
  const canStart = state.phase === 'idle' || state.phase === 'won' || state.phase === 'lost'
  return (
    <aside className="pv-minigame pv-minigame--reactor" aria-label="Reator de fatoração">
      <header className="pv-minigame__header">
        <span>Reator de Fatores</span>
        <button type="button" className="pv-minigame__close" onClick={controller.leave} aria-label="Sair do minigame">×</button>
      </header>
      <Countdown value={countdownNumber(state)} />
      <div className="pv-minigame__timer" aria-label="Tempo restante">
        {(remainingGameTime(state) / 1_000).toFixed(1)}
        <small>s</small>
      </div>
      <p className="pv-minigame__eyebrow">RODADA {Math.min(state.roundIndex + 1, 3)} / 3</p>
      {state.phase !== 'won' && (
        <div className="pv-minigame__equation">
          <span>{target ?? FACTOR_REACTOR_TARGETS[2]}</span>
          <b>÷</b>
          <strong>{state.selectedFactors.length ? state.selectedFactors.join(' × ') : '?'}</strong>
          <b>=</b>
          <em>{state.remainingTarget}</em>
        </div>
      )}
      {state.phase === 'running' && <p className="pv-minigame__directive">Ative um núcleo que divida <strong>{state.remainingTarget}</strong>.</p>}
      {state.phase === 'idle' && <p className="pv-minigame__directive">Desmonte 30, 42 e 66 usando os cinco núcleos primos.</p>}
      {state.phase === 'won' && (
        <p className="pv-minigame__result">Reator estável em {formatTime(state.finishedTimeMs)}{state.isNewRecord ? ' · NOVO RECORDE' : ''}</p>
      )}
      {state.phase === 'lost' && <p className="pv-minigame__result is-danger">Sobrecarga do núcleo. Reordene os fatores.</p>}
      {state.feedback && state.phase === 'running' && (
        <p className={`pv-minigame__feedback is-${state.feedback.kind}`} aria-live="polite">{state.feedback.message}</p>
      )}
      <footer className="pv-minigame__footer">
        <span>Recorde {formatTime(state.bestTimeMs)}</span>
        {canStart && (
          <button type="button" onClick={() => controller.start('factor-reactor')}>{state.phase === 'idle' ? 'Energizar' : 'Tentar de novo'}</button>
        )}
      </footer>
    </aside>
  )
}

export function PrimeverseMinigameHud(props: PrimeverseMinigameHudProps): JSX.Element | null {
  if (props.controller.activeGame === 'ulam-prime-run') return <UlamHud {...props} />
  if (props.controller.activeGame === 'factor-reactor') return <ReactorHud {...props} />
  return null
}

