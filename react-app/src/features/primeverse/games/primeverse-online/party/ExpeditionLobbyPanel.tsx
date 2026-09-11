import { useState } from 'react'
import type { CSSProperties } from 'react'

import type { PrimeverseOnlineClient } from '../network/PrimeverseOnlineClient'
import type { LobbySnapshot } from '../shared/protocol'
import { PRIMEVERSE_EXPEDITIONS } from '../expeditions'
import './expedition-lobby.css'

interface ExpeditionLobbyPanelProps {
  readonly client: PrimeverseOnlineClient
  readonly lobby: LobbySnapshot | null
  readonly playerId: string | null
}

/**
 * The gathering point for group expeditions: open a lobby for a game, read the
 * code out loud, everyone marks ready, and the host launches the whole party
 * into the same run.
 */
export function ExpeditionLobbyPanel({ client, lobby, playerId }: ExpeditionLobbyPanelProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')

  if (!open && !lobby) {
    return (
      <button className="pvo-lobby-toggle" type="button" onClick={() => setOpen(true)}>
        <i aria-hidden="true">⌘</i> EXPEDIÇÃO EM GRUPO
      </button>
    )
  }

  if (!lobby) {
    return (
      <section className="pvo-lobby" aria-label="Montar expedição em grupo">
        <header>
          <span>EXPEDIÇÃO EM GRUPO</span>
          <button type="button" aria-label="Fechar" onClick={() => setOpen(false)}>×</button>
        </header>

        <p className="pvo-lobby__lead">Abra um lobby e passe o código, ou entre com o código de um amigo.</p>

        <div className="pvo-lobby__games" role="group" aria-label="Abrir lobby para">
          {PRIMEVERSE_EXPEDITIONS.map((expedition) => (
            <button
              key={expedition.id}
              type="button"
              style={{ '--expedition-accent': expedition.accent } as CSSProperties}
              onClick={() => client.createLobby(expedition.id)}
            >
              <i aria-hidden="true">{expedition.glyph}</i>
              {expedition.title}
            </button>
          ))}
        </div>

        <form
          className="pvo-lobby__join"
          onSubmit={(event) => {
            event.preventDefault()
            if (code.trim().length === 4) client.joinLobby(code.trim())
          }}
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 4))}
            placeholder="CÓDIGO"
            aria-label="Código do lobby"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" disabled={code.trim().length !== 4}>ENTRAR</button>
        </form>
      </section>
    )
  }

  const me = lobby.members.find((member) => member.playerId === playerId)
  const isHost = lobby.hostId === playerId

  return (
    <section className="pvo-lobby" aria-label={`Lobby ${lobby.code}`}>
      <header>
        <span>LOBBY · {PRIMEVERSE_EXPEDITIONS.find((expedition) => expedition.id === lobby.activityId)?.title ?? lobby.activityId}</span>
        <button type="button" aria-label="Sair do lobby" onClick={() => { client.leaveLobby(); setOpen(false) }}>×</button>
      </header>

      <div className="pvo-lobby__code" aria-label={`Código ${lobby.code.split('').join(' ')}`}>
        {lobby.code.split('').map((character, index) => <b key={index}>{character}</b>)}
      </div>
      <small className="pvo-lobby__share">Passe este código para os amigos entrarem.</small>

      <ul className="pvo-lobby__members">
        {lobby.members.map((member) => (
          <li key={member.playerId} className={member.ready ? 'is-ready' : ''}>
            <i aria-hidden="true">{member.ready ? '✓' : '···'}</i>
            <span>{member.name}</span>
            {member.playerId === lobby.hostId && <em>HOST</em>}
          </li>
        ))}
        {lobby.members.length < 4 && <li className="is-empty"><i aria-hidden="true">+</i><span>vaga aberta</span></li>}
      </ul>

      <div className="pvo-lobby__actions">
        {!isHost && (
          <button
            type="button"
            className={me?.ready ? 'is-active' : ''}
            onClick={() => client.setLobbyReady(!(me?.ready ?? false))}
          >
            {me?.ready ? 'PRONTO ✓' : 'MARCAR PRONTO'}
          </button>
        )}
        {isHost && (
          <button
            type="button"
            className="pvo-lobby__launch"
            disabled={!lobby.canLaunch}
            onClick={() => client.launchLobby()}
          >
            {lobby.canLaunch ? 'INICIAR EXPEDIÇÃO →' : lobby.members.length < 2 ? 'AGUARDANDO AMIGOS…' : 'AGUARDANDO PRONTOS…'}
          </button>
        )}
      </div>
    </section>
  )
}

export default ExpeditionLobbyPanel
