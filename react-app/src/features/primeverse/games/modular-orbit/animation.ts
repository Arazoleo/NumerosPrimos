export const ORBIT_HOP_DURATION_MS = 320
export const ORBIT_LAUNCH_SETTLE_MS = 360
export const ORBIT_MAX_LAUNCH_MS = 5_200

export function getOrbitLaunchDuration(
  traceLength: number,
  reducedMotion = false,
): number {
  if (reducedMotion) return 240
  const hops = Math.max(1, traceLength - 1)
  return Math.min(
    hops * ORBIT_HOP_DURATION_MS + ORBIT_LAUNCH_SETTLE_MS,
    ORBIT_MAX_LAUNCH_MS,
  )
}

export function getOrbitTravelDuration(
  traceLength: number,
  reducedMotion = false,
): number {
  if (reducedMotion) return 1
  return Math.max(
    1,
    getOrbitLaunchDuration(traceLength) - ORBIT_LAUNCH_SETTLE_MS,
  )
}
