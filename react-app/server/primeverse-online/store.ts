import type {
  NucleusCombatRecord,
  RelayEnvelope,
  RoomSnapshot,
  StoredPlayer,
  WorldRecord,
} from './model.js'
import type { ActivityRunId } from '../../src/features/primeverse/games/primeverse-online/shared/activities.js'

export interface StoreHealth {
  ok: boolean
  mode: 'memory' | 'redis' | 'unavailable'
  detail?: string
}

export type CombatMutationAuthority = Pick<
  StoredPlayer,
  'id' | 'resumeToken' | 'activityId' | 'runId'
>

export interface PrimeverseStore {
  readonly mode: StoreHealth['mode']
  start(): Promise<void>
  health(): Promise<StoreHealth>
  join(player: StoredPlayer, now: number): Promise<RoomSnapshot>
  /** Atomically rotate a valid reconnect token and reclaim its existing room slot. */
  resume(player: StoredPlayer, previousResumeToken: string, now: number): Promise<RoomSnapshot | null>
  updatePlayer(roomId: string, player: StoredPlayer, now: number): Promise<boolean>
  /** Compare-and-swap used by background corrections such as combat respawn. */
  updatePlayerIfCurrent(
    roomId: string,
    expected: Pick<StoredPlayer, 'id' | 'resumeToken' | 'sequence' | 'activityId' | 'runId'>,
    player: StoredPlayer,
    now: number,
  ): Promise<boolean>
  touch(roomId: string, playerId: string, resumeToken: string, now: number): Promise<boolean>
  /**
   * Detach only the matching connection generation. Unexpected drops retain a
   * short invisible resume lease; an intentional exit invalidates it.
   */
  leave(
    roomId: string,
    playerId: string,
    resumeToken: string,
    now: number,
    retainResumeLease: boolean,
  ): Promise<boolean>
  getSnapshot(roomId: string, now: number): Promise<RoomSnapshot>
  mutateWorld(
    roomId: string,
    now: number,
    mutate: (current: WorldRecord) => WorldRecord,
  ): Promise<WorldRecord>
  getNucleusCombat(roomId: string, runId: ActivityRunId, now: number): Promise<NucleusCombatRecord>
  /** Atomically serialize combat actions across every runtime serving a room. */
  mutateNucleusCombat(
    roomId: string,
    runId: ActivityRunId,
    now: number,
    mutate: (current: NucleusCombatRecord) => NucleusCombatRecord,
    authority?: CombatMutationAuthority,
  ): Promise<NucleusCombatRecord>
  publish(envelope: RelayEnvelope): Promise<void>
  subscribe(listener: (envelope: RelayEnvelope) => void): () => void
  close(): Promise<void>
}

export class StoreUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoreUnavailableError'
  }
}

export class RoomCapacityError extends Error {
  constructor() {
    super('Todas as salas estão ocupadas no momento.')
    this.name = 'RoomCapacityError'
  }
}

export class ConnectionSupersededError extends Error {
  constructor() {
    super('A conexão não controla mais este operador.')
    this.name = 'ConnectionSupersededError'
  }
}
