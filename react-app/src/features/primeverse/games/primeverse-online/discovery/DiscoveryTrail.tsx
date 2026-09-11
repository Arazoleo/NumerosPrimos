import {
  DISCOVERY_IDS,
  isDiscoveryComplete,
  nextDiscovery,
  type DiscoveryProgress,
} from './discoveryProgress'

interface DiscoveryTrailProps {
  readonly progress: DiscoveryProgress
}

export default function DiscoveryTrail({ progress }: DiscoveryTrailProps): JSX.Element {
  const complete = isDiscoveryComplete(progress)
  const next = nextDiscovery(progress)
  const count = progress.discovered.length

  return (
    <aside
      aria-label={`Códice Primo: ${count} de ${DISCOVERY_IDS.length} sinais encontrados`}
      className={`pvo-discovery ${complete ? 'pvo-discovery--complete' : ''}`}
    >
      <header className="pvo-discovery__header">
        <span>{complete ? '✦ ARQUIVO CONCLUÍDO' : 'CÓDICE PRIMO'}</span>
        <strong>{count}/{DISCOVERY_IDS.length}</strong>
      </header>

      <div className="pvo-discovery__nodes" aria-hidden="true">
        {DISCOVERY_IDS.map((id, index) => {
          const found = progress.discovered.includes(id)
          const active = next?.id === id
          return (
            <span key={id} className={found ? 'is-found' : active ? 'is-next' : ''}>
              {found ? '✓' : index + 1}
            </span>
          )
        })}
        <i style={{ width: `${(count / DISCOVERY_IDS.length) * 100}%` }} />
      </div>

      <div className="pvo-discovery__clue" aria-live="polite">
        <strong>{complete ? 'EMBLEMA IRREDUTÍVEL' : `PRÓXIMO · ${next?.location ?? 'SINAL DESCONHECIDO'}`}</strong>
        <small>{complete
          ? 'As três assinaturas formaram uma constelação prima.'
          : next?.clue ?? 'Explore o mapa para localizar uma assinatura.'}</small>
      </div>
    </aside>
  )
}
