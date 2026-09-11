import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import { EMOTE_GLYPHS, type Emote, type WorldState } from './shared/protocol'
import { countConnectedPlayers, PRIMEVERSE_RECONNECT_ATTEMPTS, type OnlineClientSnapshot } from './network/PrimeverseOnlineClient'
import type { InteractionTarget } from './types'

interface OnlineHudProps {
  readonly network: OnlineClientSnapshot
  readonly world: WorldState | null
  readonly quality: QualityLevel
  readonly onQualityChange: (quality: QualityLevel) => void
  readonly location: string
  readonly showWorldEvent?: boolean
  readonly interaction: InteractionTarget | null
  readonly emoteOpen: boolean
  readonly onEmoteOpenChange: (open: boolean) => void
  readonly onEmote: (emote: Emote) => void
  readonly onInteract: () => void
  readonly onJump: () => void
  readonly onSprintChange: (held: boolean) => void
  readonly debug: boolean
  readonly fps: number
  readonly toast: string | null
  readonly onLeave: () => void
}

const STATUS_LABELS = {
  idle: 'EM ESPERA',
  connecting: 'SINCRONIZANDO',
  online: 'ONLINE',
  reconnecting: 'RECONECTANDO',
  offline: 'SEM SINAL',
  error: 'ERRO',
} as const

const EMOTES = Object.keys(EMOTE_GLYPHS) as Emote[]

function formatCountdown(endAt: number | null, now: number): string {
  if (!endAt) return '--'
  return `${Math.max(0, Math.ceil((endAt - now) / 1_000))}s`
}

export default function OnlineHud({ network, world, quality, onQualityChange, location, showWorldEvent = true, interaction, emoteOpen, onEmoteOpenChange, onEmote, onInteract, onJump, onSprintChange, debug, fps, toast, onLeave }: OnlineHudProps): JSX.Element {
  const [now, setNow] = useState(Date.now())
  const sequence = world?.sequence

  useEffect(() => {
    if (!sequence?.phaseEndsAt) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [sequence?.phaseEndsAt])

  return (
    <div className="pvo-hud">
      <header className="pvo-hud__top">
        <div className="pvo-brand">
          <span className="pvo-brand__sigil" aria-hidden="true"><i />P</span>
          <span><strong>PRIMEVERSE</strong><small>ONLINE // {network.roomId ?? 'LOCALIZANDO SALA'}</small></span>
        </div>
        <div className="pvo-status-cluster">
          <span className={`pvo-network pvo-network--${network.status}`}><i />{STATUS_LABELS[network.status]}</span>
          <span className="pvo-presence"><b>{countConnectedPlayers(network)}</b><small>EXPLORADORES</small></span>
          <button type="button" className="pvo-icon-button" onClick={onLeave} aria-label="Sair para a entrada">ESC</button>
        </div>
      </header>

      {showWorldEvent && <aside className="pvo-objective" aria-label="Evento cooperativo">
        <p><i /> EVENTO DE MUNDO</p>
        <h2>Qual termo continua<br />a sequência?</h2>
        <strong>2 · 3 · 5 · 7 · 11 · ?</strong>
        <div className="pvo-objective__phase">
          <span>{sequence?.phase === 'voting' ? 'VOTAÇÃO ABERTA' : sequence?.phase === 'revealed' ? 'PADRÃO REVELADO' : sequence?.phase === 'cooldown' ? 'NÚCLEO ESTABILIZANDO' : 'ENCONTRE OS PEDESTAIS'}</span>
          {sequence?.phaseEndsAt && <b>{formatCountdown(sequence.phaseEndsAt, now + network.clockOffsetMs)}</b>}
        </div>
        {sequence?.phase === 'voting' && (
          <div className="pvo-votes" aria-label={`${sequence.totalVotes} votos registrados`}>
            {([12, 13, 15, 17] as const).map((value) => (
              <span key={value}><i style={{ '--votes': sequence.voteCounts[value] } as React.CSSProperties} />{value}<b>{sequence.voteCounts[value]}</b></span>
            ))}
          </div>
        )}
        {sequence?.phase === 'revealed' && (
          <p className={`pvo-result pvo-result--${sequence.success ? 'success' : 'retry'}`}>
            {sequence.success ? '✦ Ressonância coletiva: 13 é primo.' : 'A resposta era 13. A próxima onda virá.'}
          </p>
        )}
        <small>Aproxime-se de um pedestal e pressione <kbd>E</kbd>. Cada explorador tem um voto.</small>
      </aside>}

      <aside className="pvo-location" aria-live="polite">
        <small>SETOR ATUAL</small>
        <strong>{location}</strong>
        <span><i /> coordenadas compartilhadas</span>
      </aside>

      {interaction && (
        <button type="button" className="pvo-interact" onClick={onInteract}>
          <kbd>E</kbd><span><small>INTERAGIR</small>{interaction.label}</span>
        </button>
      )}

      <div className={`pvo-emotes ${emoteOpen ? 'pvo-emotes--open' : ''}`}>
        <button type="button" className="pvo-emotes__toggle" onClick={() => onEmoteOpenChange(!emoteOpen)} aria-expanded={emoteOpen}>
          <kbd>Q</kbd><span>EMOTES</span>
        </button>
        <div className="pvo-emotes__wheel" role="menu" aria-label="Emotes">
          {EMOTES.map((emote, index) => (
            <button key={emote} type="button" style={{ '--index': index } as React.CSSProperties} onClick={() => onEmote(emote)} role="menuitem" aria-label={`Emote ${emote}`}>
              <span>{EMOTE_GLYPHS[emote]}</span><kbd>{index + 1}</kbd>
            </button>
          ))}
        </div>
      </div>

      <footer className="pvo-controls">
        <span><kbd>WASD</kbd> MOVER</span>
        <span><kbd>SHIFT</kbd> CORRER</span>
        <span><kbd>SPACE</kbd> SALTAR</span>
        <span><b className="pvo-mouse-icon" /> ARRASTAR CÂMERA</span>
      </footer>

      <div className="pvo-touch" aria-label="Controles de toque">
        <div className="pvo-touch__joystick" data-pvo-joystick><i data-pvo-stick /></div>
        <div className="pvo-touch__actions">
          <button type="button" onPointerDown={() => onSprintChange(true)} onPointerUp={() => onSprintChange(false)} onPointerCancel={() => onSprintChange(false)}>RUN</button>
          <button type="button" onClick={onJump}>↑</button>
          <button type="button" onClick={onInteract}>E</button>
          <button type="button" onClick={() => onEmoteOpenChange(!emoteOpen)}>Q</button>
        </div>
      </div>

      <div className="pvo-quality-wrap"><QualityControl value={quality} onChange={onQualityChange} /></div>

      {debug && (
        <aside className="pvo-debug">
          <b>NETWORK DEBUG</b>
          <span>fps <strong>{fps}</strong></span>
          <span>ping <strong>{network.latencyMs ?? '--'} ms</strong></span>
          <span>rx <strong>{network.networkRate} pkt/s</strong></span>
          <span>room <strong>{network.roomId ?? '--'}</strong></span>
          <span>peers <strong>{network.players.length}</strong></span>
          <span>revision <strong>{network.revision}</strong></span>
        </aside>
      )}

      {toast && <div className="pvo-toast" role="status">{toast}</div>}

      {(network.status === 'reconnecting' || network.status === 'offline' || network.status === 'error') && (
        <div className="pvo-connection-notice" role="status">
          <i />
          <span><strong>{network.status === 'reconnecting' ? `RECONECTANDO ${network.reconnectAttempt}/${PRIMEVERSE_RECONNECT_ATTEMPTS}` : 'SINAL INTERROMPIDO'}</strong>{network.error}</span>
          {network.status !== 'reconnecting' && <Link to="/jogos">Voltar aos jogos</Link>}
        </div>
      )}
    </div>
  )
}
