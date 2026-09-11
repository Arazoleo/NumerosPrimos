import {
  SnapshotBuffer,
  type RemoteTransformSnapshot,
} from '../shared/interpolation'
import type { PlayerAnimation, PlayerSnapshot } from '../shared/protocol'

/** Tuple-shaped facade kept for the render layer; interpolation lives in shared/. */
export interface TransformSample {
  readonly position: readonly [number, number, number]
  readonly yaw: number
  readonly animation: PlayerAnimation
  readonly serverTime: number
  readonly sequence: number
}

export interface InterpolatedTransform {
  readonly position: [number, number, number]
  readonly yaw: number
  readonly animation: PlayerAnimation
  /** Server timeline represented by this interpolated pose. */
  readonly serverTime: number
  /** Nearest authoritative movement sequence selected by interpolation. */
  readonly sequence: number
}

function toSharedSample(sample: TransformSample): RemoteTransformSnapshot {
  return {
    position: { x: sample.position[0], y: sample.position[1], z: sample.position[2] },
    yaw: sample.yaw,
    animation: sample.animation,
    serverTime: sample.serverTime,
    sequence: sample.sequence,
  }
}

function fromPlayer(player: PlayerSnapshot): RemoteTransformSnapshot {
  return {
    position: { ...player.position },
    yaw: player.yaw,
    animation: player.animation,
    serverTime: player.updatedAt,
    sequence: player.sequence,
  }
}

export class RemoteInterpolationBuffer {
  private readonly buffer = new SnapshotBuffer(90)
  private lastPosition: readonly [number, number, number] | null = null

  constructor(initial?: PlayerSnapshot) {
    if (initial) {
      this.buffer.add(fromPlayer(initial))
      this.lastPosition = [initial.position.x, initial.position.y, initial.position.z]
    }
  }

  push(sample: TransformSample): void {
    if (this.lastPosition && Math.hypot(
      sample.position[0] - this.lastPosition[0],
      sample.position[1] - this.lastPosition[1],
      sample.position[2] - this.lastPosition[2],
    ) > 18) {
      // Portal travel is an authoritative discontinuity, not movement through the void.
      this.buffer.clear()
    }
    this.buffer.add(toSharedSample(sample))
    this.lastPosition = sample.position
  }

  clear(): void {
    this.buffer.clear()
    this.lastPosition = null
  }

  sample(serverNowMs: number): InterpolatedTransform | null {
    const sampled = this.buffer.sample(serverNowMs)
    if (!sampled) return null
    return {
      position: [sampled.position.x, sampled.position.y, sampled.position.z],
      yaw: sampled.yaw,
      animation: sampled.animation,
      serverTime: sampled.serverTime,
      sequence: sampled.sequence,
    }
  }
}
