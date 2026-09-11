import { describe, expect, it } from 'vitest'

import {
  SKYLINE_DIALOGUES,
  SKYLINE_MISSION,
  SKYLINE_NPCS,
  SKYLINE_OBJECTIVE_ORDER,
  SKYLINE_OBJECTIVES,
  SKYLINE_PRIME_CORES,
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINELS,
  SKYLINE_SENTINEL_IDS,
  type SkylinePosition3D,
} from './missionData'

function expectCityPosition(position: SkylinePosition3D): void {
  expect(position).toHaveLength(3)
  for (const coordinate of position) expect(Number.isFinite(coordinate)).toBe(true)
  expect(position[1]).toBeGreaterThanOrEqual(0)
  expect(position[2]).toBeGreaterThanOrEqual(-90)
  expect(position[2]).toBeLessThanOrEqual(25)
}

describe('Prime Runner mission data', () => {
  it('defines the requested linear Skyline Protocol campaign', () => {
    expect(SKYLINE_MISSION.title).toBe('Prime Runner: Skyline Protocol')
    expect(SKYLINE_OBJECTIVE_ORDER).toEqual([
      'talk-to-lia',
      'collect-prime-cores',
      'deliver-cores-to-nilo',
      'defeat-composite-sentinels',
      'reach-apex-spire',
      'activate-apex-beacon',
    ])
    expect(SKYLINE_MISSION.finalObjectiveId).toBe('activate-apex-beacon')

    for (const objectiveId of SKYLINE_OBJECTIVE_ORDER) {
      const objective = SKYLINE_OBJECTIVES[objectiveId]
      expect(objective.id).toBe(objectiveId)
      expect(objective.title.trim()).not.toBe('')
      expect(objective.detail.trim()).not.toBe('')
      expect(objective.targetPositions).toHaveLength(objective.requiredCount)
      objective.targetPositions.forEach(expectCityPosition)
    }
  })

  it('places LIA on the opening roof and NILO farther along an elevated tower', () => {
    expect(Object.keys(SKYLINE_NPCS)).toEqual(['lia', 'nilo'])
    expect(SKYLINE_NPCS.lia).toMatchObject({
      name: 'LIA',
      role: 'Operadora e corredora de telhados',
    })
    expect(SKYLINE_NPCS.nilo).toMatchObject({
      name: 'NILO',
      role: 'Engenheiro da torre intermediária',
    })
    expect(SKYLINE_NPCS.nilo.position[1]).toBeGreaterThan(
      SKYLINE_NPCS.lia.position[1],
    )
    expect(SKYLINE_NPCS.nilo.position[2]).toBeLessThan(
      SKYLINE_NPCS.lia.position[2],
    )
    expectCityPosition(SKYLINE_NPCS.lia.position)
    expectCityPosition(SKYLINE_NPCS.nilo.position)
  })

  it('uses the unique prime cores 2, 3 and 5 along an ascending route', () => {
    expect(SKYLINE_PRIME_CORE_VALUES).toEqual([2, 3, 5])
    const cores = SKYLINE_PRIME_CORE_VALUES.map(
      (value) => SKYLINE_PRIME_CORES[value],
    )
    expect(new Set(cores.map((core) => core.value)).size).toBe(3)

    for (const core of cores) {
      const divisors = Array.from(
        { length: core.value },
        (_, index) => index + 1,
      ).filter((candidate) => core.value % candidate === 0)
      expect(divisors).toEqual([1, core.value])
      expectCityPosition(core.position)
    }

    expect(cores.map((core) => core.position[1])).toEqual(
      [...cores].map((core) => core.position[1]).sort((a, b) => a - b),
    )
  })

  it('defines four distinct composite sentinels with correct factors', () => {
    expect(SKYLINE_SENTINEL_IDS).toHaveLength(4)
    expect(new Set(SKYLINE_SENTINEL_IDS).size).toBe(4)

    for (const sentinelId of SKYLINE_SENTINEL_IDS) {
      const sentinel = SKYLINE_SENTINELS[sentinelId]
      expect(sentinel.id).toBe(sentinelId)
      expect(
        sentinel.primeFactors.reduce((product, factor) => product * factor, 1),
      ).toBe(sentinel.compositeNumber)
      expect(sentinel.primeFactors.length).toBeGreaterThan(1)
      expectCityPosition(sentinel.position)
    }
  })

  it('keeps dialogue concise, identified and tied to known speakers', () => {
    const knownSpeakers = new Set(['lia', 'nilo', 'runner'])
    const lines = Object.values(SKYLINE_DIALOGUES).flatMap(
      (dialogue) => dialogue.lines,
    )
    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length)

    for (const dialogue of Object.values(SKYLINE_DIALOGUES)) {
      expect(dialogue.lines.length).toBeGreaterThanOrEqual(2)
      for (const line of dialogue.lines) {
        expect(knownSpeakers.has(line.speaker)).toBe(true)
        expect(line.text).toBe(line.text.trim())
        expect(line.text.length).toBeLessThanOrEqual(110)
      }
    }
  })
})
