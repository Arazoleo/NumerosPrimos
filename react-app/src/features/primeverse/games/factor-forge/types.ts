export type ForgePhase = 'intro' | 'playing' | 'complete'

export type ForgeQuality = 'low' | 'medium' | 'high'

export type ForgeFeedbackKind = 'success' | 'error' | 'info'

export interface ForgeNode {
  id: string
  value: number
  parentId: string | null
  children: readonly [string, string] | null
  depth: number
  createdAt: number
  splitAt: number | null
}

export interface ForgeFeedback {
  id: number
  kind: ForgeFeedbackKind
  message: string
  nodeId?: string
}

export interface ForgeBestRecord {
  score: number
  elapsedMs: number
  steps: number
  recordedAt: number
}

export interface ForgeResult {
  value: number
  factors: number[]
  equation: string
  score: number
  elapsedMs: number
  steps: number
  optimalSteps: number
  invalidAttempts: number
  xp: number
  isNewBest: boolean
}

export interface FactorNodeLayout {
  id: string
  position: readonly [number, number, number]
}

export type ForgeSoundEvent =
  | 'select'
  | 'split'
  | 'invalid'
  | 'prime'
  | 'complete'

