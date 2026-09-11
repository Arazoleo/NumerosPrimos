import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'

import {
  PrimeverseOnlineClient,
  type OnlineClientSnapshot,
} from '../network/PrimeverseOnlineClient'
import {
  clearPrimeverseSessionStorage,
  markPrimeverseSessionActive,
  persistPrimeverseIdentity,
  persistPrimeverseResumeToken,
  readActivePrimeverseSession,
  readPrimeverseIdentity,
  readPrimeverseResumeToken,
  type SessionIdentity,
} from './sessionStorage'

interface PrimeverseSessionValue {
  readonly savedIdentity: SessionIdentity
  readonly activeIdentity: SessionIdentity | null
  readonly client: PrimeverseOnlineClient | null
  readonly snapshot: OnlineClientSnapshot
  readonly startSession: (identity: SessionIdentity) => void
  readonly endSession: () => void
}

interface PrimeverseSessionState {
  readonly savedIdentity: SessionIdentity
  readonly activeIdentity: SessionIdentity | null
  readonly client: PrimeverseOnlineClient | null
}

const EMPTY_PLAYERS: OnlineClientSnapshot['players'] = Object.freeze([])
const EMPTY_SNAPSHOT: OnlineClientSnapshot = Object.freeze({
  status: 'idle',
  playerId: null,
  roomId: null,
  activityId: 'nexus',
  runId: null,
  players: EMPTY_PLAYERS,
  world: null,
  lastWorldEvent: null,
  nucleusState: null,
  nucleusEvents: [], partyState: null, partyActions: [], lobby: null, lobbyLaunch: null,
  latencyMs: null,
  networkRate: 0,
  clockOffsetMs: 0,
  reconnectAttempt: 0,
  error: null,
  errorCode: null,
  revision: 0,
})

const PrimeverseSessionContext = createContext<PrimeverseSessionValue | null>(null)

function createSessionClient(identity: SessionIdentity): PrimeverseOnlineClient {
  return new PrimeverseOnlineClient({
    nickname: identity.nickname,
    appearance: identity.appearance,
    resumeToken: readPrimeverseResumeToken(),
    onResumeTokenChange: persistPrimeverseResumeToken,
  })
}

function initialSessionState(): PrimeverseSessionState {
  const savedIdentity = readPrimeverseIdentity()
  const activeIdentity = readActivePrimeverseSession()
  return {
    savedIdentity,
    activeIdentity,
    client: activeIdentity ? createSessionClient(activeIdentity) : null,
  }
}

function noopSubscribe(): () => void {
  return () => undefined
}

export function PrimeverseSessionProvider({ children }: PropsWithChildren): JSX.Element {
  const [session, setSession] = useState<PrimeverseSessionState>(initialSessionState)
  const client = session.client

  const subscribe = useCallback((listener: () => void) => (
    client ? client.subscribe(listener) : noopSubscribe()
  ), [client])
  const getSnapshot = useCallback(() => client?.getSnapshot() ?? EMPTY_SNAPSHOT, [client])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (!client) return undefined
    client.connect()
    // Route changes do not unmount this Provider. If the app itself is torn
    // down (reload/HMR), retain the server lease so sessionStorage can resume.
    return () => client.destroy({ preserveResumeLease: true })
  }, [client])

  const startSession = useCallback((identity: SessionIdentity) => {
    if (client) return
    // A manually started session is a new identity lease. Any token left by a
    // prior explicit leave must not be attached to it.
    clearPrimeverseSessionStorage()
    persistPrimeverseIdentity(identity)
    markPrimeverseSessionActive()
    const nextClient = createSessionClient(identity)
    setSession((current) => ({
      savedIdentity: identity,
      activeIdentity: identity,
      client: current.client ?? nextClient,
    }))
  }, [client])

  const endSession = useCallback(() => {
    clearPrimeverseSessionStorage()
    client?.destroy()
    setSession((current) => ({ ...current, activeIdentity: null, client: null }))
  }, [client])

  const value = useMemo<PrimeverseSessionValue>(() => ({
    savedIdentity: session.savedIdentity,
    activeIdentity: session.activeIdentity,
    client,
    snapshot,
    startSession,
    endSession,
  }), [client, endSession, session.activeIdentity, session.savedIdentity, snapshot, startSession])

  return (
    <PrimeverseSessionContext.Provider value={value}>
      {children}
    </PrimeverseSessionContext.Provider>
  )
}

export function usePrimeverseSession(): PrimeverseSessionValue {
  const session = useContext(PrimeverseSessionContext)
  if (!session) throw new Error('usePrimeverseSession must be used inside PrimeverseSessionProvider.')
  return session
}
