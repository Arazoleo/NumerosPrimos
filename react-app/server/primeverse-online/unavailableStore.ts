import type {
  NucleusCombatRecord,
  RelayEnvelope,
  RoomSnapshot,
  StoredPlayer,
  WorldRecord,
} from './model.js'
import {
  StoreUnavailableError,
  type CombatMutationAuthority,
  type PrimeverseStore,
  type StoreHealth,
} from './store.js'
import type { ActivityRunId } from '../../src/features/primeverse/games/primeverse-online/shared/activities.js'

export class UnavailablePrimeverseStore implements PrimeverseStore {
  readonly mode = 'unavailable' as const
  private readonly reason: string

  constructor(reason: string) {
    this.reason = reason
  }

  async start(): Promise<void> {
    throw new StoreUnavailableError(this.reason)
  }

  async health(): Promise<StoreHealth> {
    return { ok: false, mode: this.mode, detail: this.reason }
  }

  async join(_player: StoredPlayer, _now: number): Promise<RoomSnapshot> {
    throw new StoreUnavailableError(this.reason)
  }

  async resume(
    _player: StoredPlayer,
    _previousResumeToken: string,
    _now: number,
  ): Promise<RoomSnapshot | null> {
    throw new StoreUnavailableError(this.reason)
  }

  async updatePlayer(_roomId: string, _player: StoredPlayer, _now: number): Promise<boolean> {
    throw new StoreUnavailableError(this.reason)
  }

  async updatePlayerIfCurrent(
    _roomId: string,
    _expected: Pick<StoredPlayer, 'id' | 'resumeToken' | 'sequence' | 'activityId' | 'runId'>,
    _player: StoredPlayer,
    _now: number,
  ): Promise<boolean> {
    throw new StoreUnavailableError(this.reason)
  }

  async touch(
    _roomId: string,
    _playerId: string,
    _resumeToken: string,
    _now: number,
  ): Promise<boolean> {
    throw new StoreUnavailableError(this.reason)
  }

  async leave(
    _roomId: string,
    _playerId: string,
    _resumeToken: string,
    _now: number,
    _retainResumeLease: boolean,
  ): Promise<boolean> {
    return false
  }

  async getSnapshot(_roomId: string, _now: number): Promise<RoomSnapshot> {
    throw new StoreUnavailableError(this.reason)
  }

  async mutateWorld(
    _roomId: string,
    _now: number,
    _mutate: (current: WorldRecord) => WorldRecord,
  ): Promise<WorldRecord> {
    throw new StoreUnavailableError(this.reason)
  }

  async getNucleusCombat(
    _roomId: string,
    _runId: ActivityRunId,
    _now: number,
  ): Promise<NucleusCombatRecord> {
    throw new StoreUnavailableError(this.reason)
  }

  async mutateNucleusCombat(
    _roomId: string,
    _runId: ActivityRunId,
    _now: number,
    _mutate: (current: NucleusCombatRecord) => NucleusCombatRecord,
    _authority?: CombatMutationAuthority,
  ): Promise<NucleusCombatRecord> {
    throw new StoreUnavailableError(this.reason)
  }

  async publish(_envelope: RelayEnvelope): Promise<void> {
    throw new StoreUnavailableError(this.reason)
  }

  subscribe(_listener: (envelope: RelayEnvelope) => void): () => void {
    return () => undefined
  }

  async close(): Promise<void> {}
}
