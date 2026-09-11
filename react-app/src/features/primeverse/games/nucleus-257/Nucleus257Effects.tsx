/**
 * Barrel for the arena's visual language. The implementation lives in `effects/`:
 * one file per effect family plus the shared palette, quality tuning and timeline
 * helpers, instead of the single 2.4k-line module this used to be.
 */
export {
  CIPHER_TEAM_COLOR,
  FRACTURE_TEAM_COLOR,
  powerEffectPalette,
  type ArenaPowerEffect,
  type CastSignal,
  type FirstPersonHandsProps,
  type PowerEffectProps,
} from './effects/effectCore'
export { PowerEffect } from './effects/PowerEffect'
export { FirstPersonHands } from './effects/FirstPersonHands'
