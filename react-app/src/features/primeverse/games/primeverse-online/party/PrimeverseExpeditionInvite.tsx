import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { PRIMEVERSE_EXPEDITIONS, type PrimeverseExpedition } from '../expeditions'
import { usePrimeverseSession } from '../session/PrimeverseSessionProvider'
import type { ExpeditionActivityId } from '../shared/activities'
import './primeverse-party.css'

interface ActiveExpedition {
  readonly expedition: PrimeverseExpedition
  readonly explorers: readonly string[]
}

function signatureFor(groups: readonly ActiveExpedition[]): string {
  return groups
    .map(({ expedition, explorers }) => `${expedition.id}:${explorers.join(',')}`)
    .join('|')
}

/**
 * A room-level invitation shown in the Nexus when another explorer starts an
 * expedition. Joining is acknowledged by the server before the route changes.
 */
export default function PrimeverseExpeditionInvite(): JSX.Element | null {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeIdentity, client, snapshot } = usePrimeverseSession()
  const [pending, setPending] = useState<ExpeditionActivityId | null>(null)
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(null)

  const groups = useMemo<readonly ActiveExpedition[]>(() => (
    PRIMEVERSE_EXPEDITIONS.flatMap((expedition) => {
      const explorers = snapshot.players
        .filter((player) => player.activityId === expedition.id && player.runId !== null)
        .map((player) => player.nickname)
      return explorers.length > 0 ? [{ expedition, explorers }] : []
    })
  ), [snapshot.players])
  const signature = signatureFor(groups)

  useEffect(() => {
    if (groups.length === 0 && dismissedSignature !== null) setDismissedSignature(null)
  }, [dismissedSignature, groups.length])

  useEffect(() => {
    if (!pending || snapshot.activityId !== pending || snapshot.runId === null) return
    const expedition = PRIMEVERSE_EXPEDITIONS.find((candidate) => candidate.id === pending)
    if (expedition) navigate(expedition.path)
    setPending(null)
  }, [navigate, pending, snapshot.activityId, snapshot.runId])

  useEffect(() => {
    if (pending && snapshot.error) setPending(null)
  }, [pending, snapshot.error])

  if (!activeIdentity
    || !client
    || snapshot.status !== 'online'
    || snapshot.activityId !== 'nexus'
    || location.pathname !== '/jogos/primeverse-online'
    || groups.length === 0
    || signature === dismissedSignature) return null

  const group = groups[0]
  const extraGroups = Math.max(0, groups.length - 1)
  const names = group.explorers.length <= 2
    ? group.explorers.join(' e ')
    : `${group.explorers.slice(0, 2).join(', ')} +${group.explorers.length - 2}`

  const join = () => {
    setPending(group.expedition.id)
    if (!client.changeActivity(group.expedition.id, group.expedition.portalId)) {
      setPending(null)
    }
  }

  return (
    <aside
      className="pvp-invite"
      style={{ '--party-accent': group.expedition.accent } as React.CSSProperties}
      aria-label="Convite de expedição da sua sala"
    >
      <button
        className="pvp-invite__dismiss"
        type="button"
        onClick={() => setDismissedSignature(signature)}
        aria-label="Dispensar convite"
      >×</button>
      <div className="pvp-invite__signal" aria-hidden="true"><i /><b>{group.expedition.glyph}</b></div>
      <div className="pvp-invite__copy">
        <small>EXPEDIÇÃO ATIVA NA SUA SALA</small>
        <strong>{group.expedition.title}</strong>
        <span><i /> {names} {group.explorers.length === 1 ? 'já está lá' : 'já estão lá'}</span>
      </div>
      <button className="pvp-invite__join" type="button" onClick={join} disabled={pending !== null}>
        {pending ? 'SINCRONIZANDO…' : 'JUNTAR-SE'} <b>↗</b>
      </button>
      {extraGroups > 0 && <small className="pvp-invite__more">+{extraGroups} outra expedição ativa</small>}
      {snapshot.error && <p role="alert">{snapshot.error}</p>}
    </aside>
  )
}
