import { useEffect, useState } from 'react'

import {
  HORROR_REALM_ID,
  HORROR_STALKER_GOAL,
  defeatedHorrorStalkers,
  pulseCooldownRemaining,
} from './adventureState'
import type { PrimeverseAdventureController } from './usePrimeverseAdventure'
import './primeverse-adventure.css'

export interface PrimeverseAdventureHudProps {
  readonly controller: PrimeverseAdventureController
  readonly minigameActive?: boolean
}

function hudClock(): number {
  if (typeof performance !== 'undefined') return performance.now()
  return Date.now()
}

export function PrimeverseAdventureHud({
  controller,
  minigameActive = false,
}: PrimeverseAdventureHudProps): JSX.Element | null {
  const { state, objective } = controller
  const [nowMs, setNowMs] = useState(hudClock)
  const isHorror = state.realm === HORROR_REALM_ID
  const hasCombat = state.realm !== 'nexus'
  const pulseRemaining = pulseCooldownRemaining(state, nowMs)

  useEffect(() => {
    if (!hasCombat || state.pulseReadyAtMs <= hudClock()) return undefined
    const timer = window.setInterval(() => setNowMs(hudClock()), 100)
    return () => window.clearInterval(timer)
  }, [hasCombat, state.pulseReadyAtMs])

  if (minigameActive) return null

  const progress = Math.min(100, (objective.current / Math.max(1, objective.total)) * 100)
  const stalkers = Math.min(HORROR_STALKER_GOAL, defeatedHorrorStalkers(state))

  return (
    <aside
      className={`pvo-adventure pvo-adventure--${objective.tone} ${objective.completed ? 'is-complete' : ''}`}
      aria-label="Objetivo da aventura"
    >
      <header className="pvo-adventure__header">
        <span>{objective.eyebrow}</span>
        <b>{objective.current}/{objective.total}</b>
      </header>

      <h2>{objective.title}</h2>
      <p>{objective.instruction}</p>

      <div
        className="pvo-adventure__progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={objective.total}
        aria-valuenow={objective.current}
        aria-label="Progresso do objetivo"
      >
        <i style={{ '--adventure-progress': `${progress}%` } as React.CSSProperties} />
      </div>

      {hasCombat && (
        <div className="pvo-adventure__horror">
          <div className="pvo-adventure__integrity">
            <span>INTEGRIDADE <b>{state.integrity}</b></span>
            <i><b style={{ '--integrity': `${state.integrity}%` } as React.CSSProperties} /></i>
          </div>
          {isHorror && (
            <div className="pvo-adventure__inventory" aria-label="Progresso nas Catacumbas">
              <span><b>{state.sealsCollected.length}</b>/3 SELOS</span>
              <span><b>{stalkers}</b>/{HORROR_STALKER_GOAL} SOMBRAS</span>
            </div>
          )}
          <div className="pvo-adventure__actions">
            {isHorror && (
              <button
                type="button"
                className={state.lanternOn ? 'is-active' : ''}
                onClick={controller.toggleLantern}
                disabled={state.integrity <= 0}
                aria-pressed={state.lanternOn}
              >
                <kbd>F</kbd><span>{state.lanternOn ? 'APAGAR LUZ' : 'LANTERNA'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => controller.castPulse()}
              disabled={state.integrity <= 0 || pulseRemaining > 0}
            >
              <kbd>R</kbd><span>{pulseRemaining > 0 ? `${(pulseRemaining / 1_000).toFixed(1)} s` : 'PULSO'}</span>
            </button>
          </div>
          {state.integrity <= 0 && (
            <button type="button" className="pvo-adventure__reset" onClick={isHorror ? controller.resetHorror : controller.recover}>
              RECOMPOR ECO
            </button>
          )}
        </div>
      )}

      {state.feedback && (
        <div className={`pvo-adventure__feedback is-${state.feedback.kind}`} role="status">
          {state.feedback.message}
        </div>
      )}
    </aside>
  )
}
