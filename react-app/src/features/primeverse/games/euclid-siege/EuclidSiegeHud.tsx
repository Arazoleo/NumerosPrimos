import type { PointerEvent as ReactPointerEvent } from 'react'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import {
  FACTOR_LANCE_RANGE,
  formatSiegeTime,
  phaseCountdownSeconds,
  PRIME_PULSE_COOLDOWN_MS,
  SELECTABLE_PRIMES,
  SIEGE_WAVES,
  waveProgress,
  type SiegePrime,
  type SiegeState,
  type SiegeVec2,
} from './siegeLogic'
import type { SiegeQueuedAction } from './EuclidSiegeScene'

export type SiegeMoveDirection = 'up' | 'down' | 'left' | 'right'

export interface EuclidSiegeHudProps {
  readonly state: SiegeState
  readonly quality: QualityLevel
  readonly onQualityChange: (quality: QualityLevel) => void
  readonly onSelectPrime: (prime: SiegePrime) => void
  readonly onAction: (action: SiegeQueuedAction) => void
  readonly onGuardChange: (guarding: boolean) => void
  readonly onMove: (direction: SiegeMoveDirection, active: boolean) => void
  readonly onPause: () => void
}

function percentage(value: number, maximum: number): number {
  return Math.max(0, Math.min(100, maximum > 0 ? value / maximum * 100 : 0))
}

function distance(a: SiegeVec2, b: SiegeVec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function formatCooldown(readyAtMs: number, elapsedMs: number): string {
  const remaining = Math.max(0, readyAtMs - elapsedMs)
  return remaining <= 0 ? 'PRONTO' : `${(remaining / 1_000).toFixed(1)}s`
}

function HealthMeter({ label, detail, value, maximum, tone }: {
  readonly label: string
  readonly detail: string
  readonly value: number
  readonly maximum: number
  readonly tone: 'hero' | 'forge'
}): JSX.Element {
  const progress = percentage(value, maximum)
  return (
    <div className={`euclid-meter euclid-meter--${tone}`}>
      <div className="euclid-meter__label">
        <span>{label}<small>{detail}</small></span>
        <strong>{Math.ceil(value)}<i>/ {maximum}</i></strong>
      </div>
      <div className="euclid-meter__track" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
        <b style={{ left: `${progress}%` }} />
      </div>
    </div>
  )
}

function holdHandlers(onHeld: (active: boolean) => void) {
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      onHeld(true)
    },
    onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      onHeld(false)
    },
    onPointerCancel: () => onHeld(false),
    onPointerLeave: (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.buttons === 0) onHeld(false)
    },
  }
}

export default function EuclidSiegeHud({
  state,
  quality,
  onQualityChange,
  onSelectPrime,
  onAction,
  onGuardChange,
  onMove,
  onPause,
}: EuclidSiegeHudProps): JSX.Element {
  const wave = state.waveIndex >= 0 ? SIEGE_WAVES[state.waveIndex] : null
  const waveCounter = waveProgress(state)
  const pulseCooldown = Math.max(0, state.player.pulseReadyAtMs - state.elapsedMs)
  const nearest = state.enemies.reduce<(typeof state.enemies)[number] | null>((closest, enemy) => {
    if (!closest) return enemy
    return distance(enemy.position, state.player.position) < distance(closest.position, state.player.position) ? enemy : closest
  }, null)
  const nearestDistance = nearest ? distance(nearest.position, state.player.position) : Number.POSITIVE_INFINITY
  const targetReachable = nearestDistance <= FACTOR_LANCE_RANGE + (nearest?.radius ?? 0)
  const canFight = state.phase === 'wave'
  const countdown = phaseCountdownSeconds(state)
  const lowHealth = percentage(state.player.hp, state.player.maxHp) <= 28
  const lowForge = percentage(state.forgeHp, state.forgeMaxHp) <= 28

  return (
    <div className={`euclid-hud${lowHealth || lowForge ? ' euclid-hud--danger' : ''}`}>
      <div className="euclid-hud__vignette" aria-hidden="true" />

      <header className="euclid-hud__top">
        <div className="euclid-hud__brand">
          <span className="euclid-hud__brand-mark" aria-hidden="true">∏</span>
          <span><strong>CERCO DE EUCLIDES</strong><small>FORTALEZA ÁUREA // DEFESA ATIVA</small></span>
        </div>
        <div className="euclid-hud__wave">
          <span>ONDA</span>
          <strong>{String(waveCounter.current).padStart(2, '0')}<i>/ {String(waveCounter.total).padStart(2, '0')}</i></strong>
          <small>{state.enemies.length} INVASOR{state.enemies.length === 1 ? '' : 'ES'}</small>
        </div>
        <div className="euclid-hud__score">
          <span>PONTOS</span><strong>{state.score.toLocaleString('pt-BR')}</strong><small>{formatSiegeTime(state.elapsedMs)}</small>
        </div>
        <button type="button" className="euclid-hud__pause" onClick={onPause} aria-label="Pausar cerco">II</button>
      </header>

      <aside className="euclid-hud__status" aria-label="Integridade">
        <HealthMeter label="ARTÍFICE" detail="VIDA" value={state.player.hp} maximum={state.player.maxHp} tone="hero" />
        <HealthMeter label="FORJA" detail="INTEGRIDADE" value={state.forgeHp} maximum={state.forgeMaxHp} tone="forge" />
        <div className="euclid-combo">
          <span>CADEIA IRREDUTÍVEL</span>
          <strong>×{state.combo}</strong>
          <small>MELHOR ×{state.bestCombo}</small>
        </div>
      </aside>

      <section className="euclid-objective" aria-live="polite">
        <span>{state.phase === 'intermission' ? 'MURALHAS EM RECOMPOSIÇÃO' : wave?.subtitle ?? 'PROTOCOLO DE DEFESA'}</span>
        <h2>{state.phase === 'countdown' ? 'A forja está despertando' : wave?.title ?? 'Fortaleza Áurea'}</h2>
        <p>{wave?.objective ?? 'Escolha um primo. Fatore o escudo composto. Ataque o núcleo exposto.'}</p>
        <div className="euclid-objective__route" aria-hidden="true">
          {SIEGE_WAVES.map((entry, index) => (
            <i key={entry.title} className={index < state.waveIndex ? 'done' : index === state.waveIndex ? 'active' : ''} />
          ))}
        </div>
      </section>

      {nearest && canFight && (
        <aside className={`euclid-target${targetReachable ? ' is-close' : ''}`}>
          <span>{targetReachable ? 'ALVO AO ALCANCE' : 'AMEAÇA MAIS PRÓXIMA'}</span>
          <strong>{nearest.composite}</strong>
          <div>
            <small>{nearest.shieldRemaining > 1 ? 'ESCUDO RESTANTE' : 'NÚCLEO EXPOSTO'}</small>
            <b>{nearest.shieldRemaining > 1 ? nearest.shieldRemaining : 'ATACAR'}</b>
          </div>
          <em>{nearestDistance.toFixed(1)}m</em>
        </aside>
      )}

      <div key={state.message.serial} className={`euclid-message euclid-message--${state.message.tone}`} role="status">
        <i aria-hidden="true" />{state.message.text}
      </div>

      <section className="euclid-factor-deck" aria-label="Selecionar fator primo">
        <div className="euclid-factor-deck__title">
          <span>CHAVE PRIMA</span>
          <strong>{state.selectedPrime}</strong>
          <small>ESCOLHA O DIVISOR DO ESCUDO</small>
        </div>
        <div className="euclid-factor-deck__keys">
          {SELECTABLE_PRIMES.map((prime, index) => (
            <button
              key={prime}
              type="button"
              className={state.selectedPrime === prime ? 'is-active' : ''}
              onClick={() => onSelectPrime(prime)}
              aria-pressed={state.selectedPrime === prime}
              aria-label={`Selecionar fator primo ${prime}`}
            >
              <small>{index + 1}</small><strong>{prime}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="euclid-actions" aria-label="Ações de combate">
        <button type="button" onClick={() => onAction('attack')} disabled={!canFight}>
          <kbd>J</kbd><span><strong>LÂMINA ÁUREA</strong><small>{formatCooldown(state.player.attackReadyAtMs, state.elapsedMs)}</small></span>
        </button>
        <button type="button" className="euclid-actions__factor" onClick={() => onAction('factor')} disabled={!canFight}>
          <kbd>F</kbd><span><strong>FATORAR POR {state.selectedPrime}</strong><small>{formatCooldown(state.player.factorReadyAtMs, state.elapsedMs)}</small></span>
        </button>
        <button
          type="button"
          className="euclid-actions__pulse"
          onClick={() => onAction('pulse')}
          disabled={!canFight || pulseCooldown > 0}
          style={{ '--pulse-ready': `${100 - pulseCooldown / PRIME_PULSE_COOLDOWN_MS * 100}%` } as React.CSSProperties}
        >
          <kbd>Q</kbd><span><strong>PULSO DE EUCLIDES</strong><small>{formatCooldown(state.player.pulseReadyAtMs, state.elapsedMs)}</small></span>
        </button>
        <button
          type="button"
          className="euclid-actions__guard"
          disabled={!canFight}
          {...holdHandlers(onGuardChange)}
        >
          <kbd>E</kbd><span><strong>ÉGIDE DA FORJA</strong><small>SEGURE PARA APARAR</small></span>
        </button>
      </section>

      <div className="euclid-mobile-pad" aria-label="Movimento por toque">
        <button type="button" className="up" aria-label="Mover para cima" {...holdHandlers((active) => onMove('up', active))}>▲</button>
        <button type="button" className="left" aria-label="Mover para esquerda" {...holdHandlers((active) => onMove('left', active))}>◀</button>
        <i aria-hidden="true">◆</i>
        <button type="button" className="right" aria-label="Mover para direita" {...holdHandlers((active) => onMove('right', active))}>▶</button>
        <button type="button" className="down" aria-label="Mover para baixo" {...holdHandlers((active) => onMove('down', active))}>▼</button>
      </div>

      <footer className="euclid-hud__footer">
        <span><kbd>WASD</kbd> MOVER</span><span><kbd>1–6</kbd> FATOR</span><span><kbd>J</kbd> ATACAR</span><span><kbd>F</kbd> FATORAR</span><span><kbd>Q</kbd> PULSO</span><span><kbd>E</kbd> DEFENDER</span>
        <label>
          QUALIDADE
          <select value={quality} onChange={(event) => onQualityChange(event.target.value as QualityLevel)}>
            <option value="low">LOW</option><option value="medium">MID</option><option value="high">HIGH</option>
          </select>
        </label>
      </footer>

      {(state.phase === 'countdown' || state.phase === 'intermission') && (
        <div className="euclid-countdown" aria-live="assertive">
          <span>{state.phase === 'countdown' ? 'AQUECENDO O CORAÇÃO' : `ONDA ${state.waveIndex + 2} SE APROXIMA`}</span>
          <strong>{countdown || 'AGORA'}</strong>
          <small>{state.phase === 'countdown' ? 'Escolha um fator primo' : '+16 vida · +12 integridade'}</small>
        </div>
      )}
    </div>
  )
}
