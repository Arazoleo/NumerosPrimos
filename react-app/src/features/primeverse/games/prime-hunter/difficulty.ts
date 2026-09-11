import type { ChallengeDifficulty } from '../../../../lib/math'

export interface HunterDifficulty {
  stage: number
  label: string
  challenge: ChallengeDifficulty
  speed: number
  spawnInterval: number
}

const LABELS = ['ÓRBITA BAIXA', 'CINTURÃO 30–100', 'ESPAÇO PROFUNDO', 'FRONTEIRA EXPERT'] as const

export function getHunterDifficulty(score: number, elapsedSeconds: number): HunterDifficulty {
  const scoreStage = Math.floor(Math.max(0, score) / 850)
  const timeStage = Math.floor(Math.max(0, elapsedSeconds) / 32)
  const stage = Math.min(3, Math.max(scoreStage, timeStage))

  return {
    stage,
    label: LABELS[stage],
    challenge: stage,
    speed: 2.75 + stage * 0.72,
    spawnInterval: 1.22 - stage * 0.16,
  }
}
