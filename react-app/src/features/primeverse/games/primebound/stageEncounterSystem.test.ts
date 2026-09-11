import { describe, expect, it } from 'vitest'

import {
  PRIMEBOUND_STAGE_CHECKPOINT_RESPAWNS,
  PRIMEBOUND_STAGE_REINFORCEMENT_ACTIVE_THRESHOLD,
  PRIMEBOUND_STAGE_REINFORCEMENT_BASE_DELAY_MS,
  PRIMEBOUND_STAGE_REINFORCEMENT_JITTER_MS,
  PRIMEBOUND_STAGE_REINFORCEMENT_QUOTAS,
  canAwakenStageGuardian,
  cancelStageReinforcement,
  completeStageEncounter,
  consumeStageCheckpointRespawn,
  deployStageReinforcement,
  getStageEncounterSnapshot,
  getStageReinforcementDelayMs,
  isStageReinforcementReady,
  recordStageMinionDefeat,
  scheduleStageReinforcement,
  shouldScheduleStageReinforcement,
  startStageEncounter,
  type StageEncounterState,
} from './stageEncounterSystem'
import type { PrimeboundAreaId } from './world'

const CAMPAIGN_ORDER: readonly PrimeboundAreaId[] = [
  'echo-woods',
  'composite-crypt',
  'twin-peaks',
  'residue-forge',
  'eratosthenes-garden',
  'goldbach-citadel',
  'wilson-observatory',
  'mobius-labyrinth',
  'fermat-bastion',
  'sieve-foundry',
  'elliptic-nexus',
  'prime-sanctuary',
]

function deployAllReinforcements(
  initial: StageEncounterState,
): StageEncounterState {
  let stage = initial
  let nowMs = stage.startedAtMs
  while (stage.reinforcementsDeployed < stage.reinforcementQuota) {
    stage = scheduleStageReinforcement(stage, nowMs, 0)
    expect(stage.nextReinforcementAtMs).not.toBeNull()
    nowMs = stage.nextReinforcementAtMs ?? nowMs
    expect(isStageReinforcementReady(stage, nowMs)).toBe(true)
    stage = deployStageReinforcement(stage)
  }
  return stage
}

describe('Primebound organic stage reinforcements', () => {
  it('uses a strictly increasing reinforcement quota across the campaign', () => {
    const quotas = CAMPAIGN_ORDER.map(
      (areaId) => PRIMEBOUND_STAGE_REINFORCEMENT_QUOTAS[areaId],
    )

    expect(quotas).toHaveLength(12)
    expect(quotas.every((quota, index) => (
      Number.isInteger(quota) && quota > 0 && (index === 0 || quota > quotas[index - 1])
    ))).toBe(true)
    expect(Object.isFrozen(PRIMEBOUND_STAGE_REINFORCEMENT_QUOTAS)).toBe(true)

    const sanctuary = startStageEncounter('prime-sanctuary', 1_000)
    expect(sanctuary).toMatchObject({
      reinforcementQuota: 15,
      reinforcementsDeployed: 0,
      nextReinforcementAtMs: null,
      minionsDefeated: 0,
      checkpointRespawnsRemaining: PRIMEBOUND_STAGE_CHECKPOINT_RESPAWNS,
    })
  })

  it('schedules exactly one reinforcement when pressure falls below three', () => {
    const stage = startStageEncounter('echo-woods', 0)

    expect(PRIMEBOUND_STAGE_REINFORCEMENT_ACTIVE_THRESHOLD).toBe(3)
    expect(shouldScheduleStageReinforcement(stage, 3)).toBe(false)
    expect(shouldScheduleStageReinforcement(stage, 2)).toBe(true)

    const waiting = scheduleStageReinforcement(stage, 20_000, 2)
    expect(waiting.nextReinforcementAtMs).not.toBeNull()
    expect(scheduleStageReinforcement(waiting, 20_100, 0)).toBe(waiting)
    expect(shouldScheduleStageReinforcement(waiting, 0)).toBe(false)
  })

  it('uses a short deterministic delay and deploys only one enemy per entry', () => {
    const stage = startStageEncounter('echo-woods', 0)
    const delay = getStageReinforcementDelayMs(stage)

    expect(getStageReinforcementDelayMs(stage)).toBe(delay)
    expect(delay).toBeGreaterThanOrEqual(PRIMEBOUND_STAGE_REINFORCEMENT_BASE_DELAY_MS)
    expect(delay).toBeLessThanOrEqual(
      PRIMEBOUND_STAGE_REINFORCEMENT_BASE_DELAY_MS
        + PRIMEBOUND_STAGE_REINFORCEMENT_JITTER_MS,
    )

    const waiting = scheduleStageReinforcement(stage, 7_000, 0)
    expect(isStageReinforcementReady(waiting, 7_000 + delay - 1)).toBe(false)
    expect(isStageReinforcementReady(waiting, 7_000 + delay)).toBe(true)

    const deployed = deployStageReinforcement(waiting)
    expect(deployed.reinforcementsDeployed).toBe(1)
    expect(deployed.nextReinforcementAtMs).toBeNull()
    expect(getStageReinforcementDelayMs(deployed)).toBeGreaterThanOrEqual(
      PRIMEBOUND_STAGE_REINFORCEMENT_BASE_DELAY_MS,
    )
  })

  it('records defeats independently from reinforcement deployment', () => {
    const stage = startStageEncounter('echo-woods', 0)
    const defeated = recordStageMinionDefeat(stage, 2)

    expect(defeated.minionsDefeated).toBe(2)
    expect(defeated.reinforcementsDeployed).toBe(0)
    expect(recordStageMinionDefeat(defeated, 0)).toBe(defeated)
    expect(() => recordStageMinionDefeat(stage, -1)).toThrow(RangeError)
  })

  it('never unlocks the guardian from elapsed time alone', () => {
    const stage = startStageEncounter('echo-woods', 0)
    const afterOneDay = 24 * 60 * 60_000

    expect(canAwakenStageGuardian(stage, 0)).toBe(false)
    expect(getStageEncounterSnapshot(stage, afterOneDay, 0)).toMatchObject({
      status: 'engaged',
      progress: 0,
      reinforcementsDeployed: 0,
      reinforcementsRemaining: stage.reinforcementQuota,
    })
  })

  it('unlocks the guardian only after quota exhaustion and arena clearance', () => {
    const exhausted = deployAllReinforcements(startStageEncounter('echo-woods', 0))

    expect(canAwakenStageGuardian(exhausted, 1)).toBe(false)
    expect(canAwakenStageGuardian(exhausted, 0)).toBe(true)
    expect(shouldScheduleStageReinforcement(exhausted, 0)).toBe(false)
    expect(scheduleStageReinforcement(exhausted, 90_000, 0)).toBe(exhausted)
    expect(getStageEncounterSnapshot(exhausted, 90_000, 0)).toMatchObject({
      status: 'guardian-ready',
      progress: 1,
      reinforcementsDeployed: 3,
      reinforcementsRemaining: 0,
    })

    expect(canAwakenStageGuardian({
      ...exhausted,
      nextReinforcementAtMs: 90_001,
    }, 0)).toBe(false)
  })

  it('reports combat progress rather than clock progress', () => {
    const first = startStageEncounter('echo-woods', 0)
    const afterDefeat = recordStageMinionDefeat(first)

    expect(getStageEncounterSnapshot(first, 250_000, 2)).toMatchObject({
      status: 'engaged',
      progress: 0,
    })
    expect(getStageEncounterSnapshot(afterDefeat, 300_000, 1).progress).toBe(1 / 5)

    const waiting = scheduleStageReinforcement(afterDefeat, 300_000, 1)
    expect(getStageEncounterSnapshot(waiting, 300_100, 1).status).toBe(
      'reinforcement-inbound',
    )
  })

  it('can cancel an inbound reinforcement without consuming its quota', () => {
    const stage = startStageEncounter('echo-woods', 0)
    const waiting = scheduleStageReinforcement(stage, 2_000, 0)
    const cancelled = cancelStageReinforcement(waiting)

    expect(cancelled.reinforcementsDeployed).toBe(0)
    expect(cancelled.nextReinforcementAtMs).toBeNull()
  })

  it('provides two stage checkpoint respawns before defeat becomes final', () => {
    const stage = startStageEncounter('echo-woods', 0)
    const first = consumeStageCheckpointRespawn(stage)
    const second = consumeStageCheckpointRespawn(first)
    const exhausted = consumeStageCheckpointRespawn(second)

    expect(first.checkpointRespawnsRemaining).toBe(1)
    expect(second.checkpointRespawnsRemaining).toBe(0)
    expect(exhausted).toBe(second)
  })

  it('freezes completion telemetry and stops pending reinforcements', () => {
    const waiting = scheduleStageReinforcement(
      startStageEncounter('echo-woods', 0),
      80_000,
      0,
    )
    const completed = completeStageEncounter(waiting, 84_000)
    const snapshot = getStageEncounterSnapshot(completed, 90_000, 0)

    expect(snapshot).toMatchObject({
      completed: true,
      status: 'complete',
      elapsedMs: 84_000,
      progress: 1,
      nextReinforcementInMs: 0,
    })
    expect(completed.nextReinforcementAtMs).toBeNull()
    expect(scheduleStageReinforcement(completed, 90_000, 0)).toBe(completed)
  })

  it('keeps unused checkpoint returns available for the final guardian duel', () => {
    const completed = completeStageEncounter(startStageEncounter('echo-woods', 0), 85_000)
    expect(consumeStageCheckpointRespawn(completed).checkpointRespawnsRemaining).toBe(1)
  })
})
