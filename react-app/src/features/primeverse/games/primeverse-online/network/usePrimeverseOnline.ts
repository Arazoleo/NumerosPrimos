import { usePrimeverseSession } from '../session/PrimeverseSessionProvider'

/**
 * Compatibility facade for consumers that only need networking. The Provider,
 * rather than the current route, owns the client lifecycle.
 */
export function usePrimeverseOnline() {
  const { client, snapshot } = usePrimeverseSession()
  return { client, snapshot }
}
