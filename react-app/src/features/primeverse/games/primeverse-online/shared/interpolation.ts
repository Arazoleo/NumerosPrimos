import {
  type PlayerAnimation,
  type Vec3,
} from './protocol'

export const SNAPSHOT_BUFFER_MIN_MS = 50
export const SNAPSHOT_BUFFER_MAX_MS = 100
export const DEFAULT_SNAPSHOT_BUFFER_MS = 80
export const DEFAULT_MAX_SNAPSHOTS = 24

export interface RemoteTransformSnapshot {
  readonly position: Vec3
  readonly yaw: number
  readonly animation: PlayerAnimation
  readonly sequence: number
  readonly serverTime: number
}

export interface InterpolatedTransform extends RemoteTransformSnapshot {
  /** The delayed server timeline sampled for this render. */
  readonly sampledAt: number
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function lerpNumber(from: number, to: number, alpha: number): number {
  assertFinite(from, 'from')
  assertFinite(to, 'to')
  assertFinite(alpha, 'alpha')
  return from + (to - from) * clamp01(alpha)
}

export function lerpVec3(from: Vec3, to: Vec3, alpha: number): Vec3 {
  return {
    x: lerpNumber(from.x, to.x, alpha),
    y: lerpNumber(from.y, to.y, alpha),
    z: lerpNumber(from.z, to.z, alpha),
  }
}

export function normalizeYaw(yaw: number): number {
  assertFinite(yaw, 'yaw')
  const fullTurn = Math.PI * 2
  return ((yaw + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}

/** Interpolate over the shortest arc, including across the -PI/PI seam. */
export function interpolateYaw(from: number, to: number, alpha: number): number {
  assertFinite(alpha, 'alpha')
  const delta = normalizeYaw(to - from)
  return normalizeYaw(from + delta * clamp01(alpha))
}

export function interpolateSnapshot(
  from: RemoteTransformSnapshot,
  to: RemoteTransformSnapshot,
  sampledAt: number,
): InterpolatedTransform {
  assertFinite(sampledAt, 'sampledAt')
  const span = to.serverTime - from.serverTime
  const alpha = span <= 0 ? 1 : clamp01((sampledAt - from.serverTime) / span)
  return {
    position: lerpVec3(from.position, to.position, alpha),
    yaw: interpolateYaw(from.yaw, to.yaw, alpha),
    animation: alpha < 0.5 ? from.animation : to.animation,
    sequence: alpha < 0.5 ? from.sequence : to.sequence,
    serverTime: lerpNumber(from.serverTime, to.serverTime, alpha),
    sampledAt,
  }
}

function validateSnapshot(snapshot: RemoteTransformSnapshot): void {
  assertFinite(snapshot.position.x, 'snapshot.position.x')
  assertFinite(snapshot.position.y, 'snapshot.position.y')
  assertFinite(snapshot.position.z, 'snapshot.position.z')
  assertFinite(snapshot.yaw, 'snapshot.yaw')
  assertFinite(snapshot.serverTime, 'snapshot.serverTime')
  if (!Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 0) {
    throw new RangeError('snapshot.sequence must be a non-negative safe integer.')
  }
}

function copySnapshot(snapshot: RemoteTransformSnapshot): RemoteTransformSnapshot {
  return {
    ...snapshot,
    position: { ...snapshot.position },
  }
}

/**
 * Small ordered snapshot buffer for a single remote player. It intentionally
 * never extrapolates: temporary packet gaps hold the latest trustworthy pose.
 */
export class SnapshotBuffer {
  readonly bufferMs: number
  readonly maxSnapshots: number
  #snapshots: RemoteTransformSnapshot[] = []

  constructor(
    bufferMs = DEFAULT_SNAPSHOT_BUFFER_MS,
    maxSnapshots = DEFAULT_MAX_SNAPSHOTS,
  ) {
    if (!Number.isFinite(bufferMs)
      || bufferMs < SNAPSHOT_BUFFER_MIN_MS
      || bufferMs > SNAPSHOT_BUFFER_MAX_MS) {
      throw new RangeError(
        `Snapshot buffer must be ${SNAPSHOT_BUFFER_MIN_MS}-${SNAPSHOT_BUFFER_MAX_MS}ms.`,
      )
    }
    if (!Number.isSafeInteger(maxSnapshots) || maxSnapshots < 2) {
      throw new RangeError('maxSnapshots must be a safe integer of at least 2.')
    }
    this.bufferMs = bufferMs
    this.maxSnapshots = maxSnapshots
  }

  get size(): number {
    return this.#snapshots.length
  }

  get latest(): RemoteTransformSnapshot | null {
    const snapshot = this.#snapshots[this.#snapshots.length - 1]
    return snapshot ? copySnapshot(snapshot) : null
  }

  clear(): void {
    this.#snapshots.length = 0
  }

  add(snapshot: RemoteTransformSnapshot): boolean {
    validateSnapshot(snapshot)

    const duplicateIndex = this.#snapshots.findIndex(
      (entry) => entry.sequence === snapshot.sequence,
    )
    if (duplicateIndex >= 0) {
      if (snapshot.serverTime < this.#snapshots[duplicateIndex].serverTime) return false
      this.#snapshots[duplicateIndex] = copySnapshot(snapshot)
    } else {
      this.#snapshots.push(copySnapshot(snapshot))
    }

    this.#snapshots.sort(
      (a, b) => a.serverTime - b.serverTime || a.sequence - b.sequence,
    )
    if (this.#snapshots.length > this.maxSnapshots) {
      this.#snapshots.splice(0, this.#snapshots.length - this.maxSnapshots)
    }
    return true
  }

  /** Sample with local time already translated onto the server clock. */
  sample(serverNowMs: number): InterpolatedTransform | null {
    assertFinite(serverNowMs, 'serverNowMs')
    if (this.#snapshots.length === 0) return null

    const sampledAt = serverNowMs - this.bufferMs
    const oldest = this.#snapshots[0]
    if (sampledAt <= oldest.serverTime || this.#snapshots.length === 1) {
      return { ...copySnapshot(oldest), sampledAt }
    }

    const newest = this.#snapshots[this.#snapshots.length - 1]
    if (sampledAt >= newest.serverTime) {
      return { ...copySnapshot(newest), sampledAt }
    }

    for (let index = 1; index < this.#snapshots.length; index += 1) {
      const to = this.#snapshots[index]
      if (to.serverTime < sampledAt) continue
      return interpolateSnapshot(this.#snapshots[index - 1], to, sampledAt)
    }

    return { ...copySnapshot(newest), sampledAt }
  }
}
