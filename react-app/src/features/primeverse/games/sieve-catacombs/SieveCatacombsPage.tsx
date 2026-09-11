import { useEffect, useState } from 'react'

import { ExpeditionPartyHud, usePrimeverseExpeditionParty } from '../primeverse-online/party'
import { useDocumentTitle } from '../../useDocumentTitle'
import SieveCatacombsCanvas from './SieveCatacombsCanvas'
import './sieve-catacombs.css'

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

export default function SieveCatacombsPage(): JSX.Element {
  useDocumentTitle('Cripta do Crivo · Primeverse')
  const reducedMotion = useReducedMotion()
  const [active, setActive] = useState(false)
  const party = usePrimeverseExpeditionParty('sieve-catacombs')

  return (
    <main className="scc-page">
      <SieveCatacombsCanvas
        active={active}
        reducedMotion={reducedMotion}
        party={party}
        onStart={() => setActive(true)}
      />
      <ExpeditionPartyHud party={party} className="pep-hud--catacombs" />
    </main>
  )
}
