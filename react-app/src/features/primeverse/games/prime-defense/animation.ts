export const DEFENSE_TRAVEL_DURATION_MS = 920
export const DEFENSE_REDUCED_TRAVEL_DURATION_MS = 220

export function getDefenseTravelDuration(reducedMotion: boolean): number {
  return reducedMotion
    ? DEFENSE_REDUCED_TRAVEL_DURATION_MS
    : DEFENSE_TRAVEL_DURATION_MS
}

