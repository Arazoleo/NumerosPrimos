import { Link } from 'react-router-dom'

import type { PrimeverseExpeditionParty } from './usePrimeverseExpeditionParty'
import './expedition-party.css'

interface ExpeditionPartyHudProps {
  readonly party: PrimeverseExpeditionParty
  readonly className?: string
  readonly returnPath?: string
}

const STATUS_LABEL: Readonly<Record<PrimeverseExpeditionParty['status'], string>> = {
  solo: 'MODO SOLO',
  joining: 'SINCRONIZANDO',
  party: 'EQUIPE CONECTADA',
  reconnecting: 'RECONECTANDO',
  offline: 'SEM SINAL · OFFLINE',
  blocked: 'ENTRE PELO PORTAL',
}

function shortRoom(roomId: string | null): string {
  if (!roomId) return 'LOCAL'
  return roomId.length > 12 ? `${roomId.slice(0, 10)}…` : roomId
}

export default function ExpeditionPartyHud({
  party,
  className = '',
  returnPath = '/jogos/primeverse-online',
}: ExpeditionPartyHudProps): JSX.Element {
  const visibleMembers = party.members.slice(0, 4)
  const extraMembers = Math.max(0, party.members.length - visibleMembers.length)
  return (
    <aside
      className={`pep-hud pep-hud--${party.status} ${className}`.trim()}
      aria-label="Presença da expedição"
      title={party.error ?? undefined}
    >
      <header>
        <span className="pep-hud__signal" aria-hidden="true" />
        <strong>{STATUS_LABEL[party.status]}</strong>
        <small>SALA {shortRoom(party.roomId)}</small>
        <Link to={returnPath} aria-label="Voltar ao Primeverse Online">NEXUS ↗</Link>
      </header>
      <div className="pep-hud__members" aria-label={`${party.members.length || 1} explorador(es)`}>
        {visibleMembers.length === 0 ? (
          <span className="pep-hud__solo"><i>1</i><b>VOCÊ</b></span>
        ) : visibleMembers.map((member) => (
          <span key={member.id} title={`${member.nickname}${member.local ? ' (você)' : ''}`}>
            <i style={{ '--pep-member-color': member.appearance.accentColor } as React.CSSProperties}>
              {member.nickname.slice(0, 1).toUpperCase()}
            </i>
            <b>{member.local ? 'VOCÊ' : member.nickname}</b>
          </span>
        ))}
        {extraMembers > 0 && <em>+{extraMembers}</em>}
      </div>
    </aside>
  )
}
