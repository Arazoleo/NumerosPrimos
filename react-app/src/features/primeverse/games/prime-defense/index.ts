export { default } from './PrimeDefensePage'
export { PrimeDefenseHud } from './PrimeDefenseHud'
export { PrimeDefenseScene, type PrimeDefenseSceneProps } from './PrimeDefenseScene'
export {
  createPrimeDefenseStore,
  usePrimeDefenseStore,
  type PrimeDefenseState,
  type PrimeDefenseStore,
  type PrimeDefenseStoreOptions,
} from './defenseStore'
export {
  analyzeDefensePlan,
  calculateDefenseXp,
  calculateWaveBonus,
  createWaveEnemies,
  DEFENSE_DIVISORS,
  DEFENSE_LANES,
  DEFENSE_SLOTS,
  DEFENSE_STARTING_LIVES,
  DEFENSE_WAVE_COUNT,
  DEFENSE_WAVES,
  evaluateDefenseEnemy,
  formatDefenseFactorization,
  getCoveringDivisors,
  getPlacementEnergy,
  scoreDefenseOutcome,
  TOWER_COSTS,
  towerId,
} from './defenseLogic'
export { getDefenseTravelDuration } from './animation'
export { recordPrimeDefenseProgress } from './progressionAdapter'
export type {
  DefenseDivisor,
  DefenseEnemy,
  DefenseFeedback,
  DefenseLane,
  DefenseOutcome,
  DefenseOutcomeKind,
  DefensePhase,
  DefensePlanAnalysis,
  DefenseProgressInput,
  DefenseResult,
  DefenseSlot,
  DefenseSoundEvent,
  DefenseWave,
  DefenseWaveSummary,
  TowerPlacement,
} from './types'

