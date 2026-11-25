import { describe, expect, it } from 'vitest'

import {
  SKYLINE_DIALOGUES,
  SKYLINE_LOCATIONS,
  SKYLINE_MISSION,
  SKYLINE_MISSION_IDS,
  SKYLINE_MISSIONS,
  SKYLINE_NPCS,
  SKYLINE_OBJECTIVE_ORDER,
  SKYLINE_OBJECTIVES,
  SKYLINE_PRIME_CORES,
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINELS,
  SKYLINE_SENTINEL_IDS,
  createSkylineMissionsForWorld,
  type SkylinePosition3D,
  type SkylineWorldMissionPlacement,
} from './missionData'

// Bounds widened to FEAT-001's SKYLINE_WORLD_BOUNDS.extents
// (x in [-38, 38], z in [-116, 60]) so NPC/core/sentinel/location positions
// in the expanded open-world grid still validate.
function expectCityPosition(position: SkylinePosition3D): void {
  expect(position).toHaveLength(3)
  for (const coordinate of position) expect(Number.isFinite(coordinate)).toBe(true)
  expect(position[1]).toBeGreaterThanOrEqual(0)
  expect(position[0]).toBeGreaterThanOrEqual(-38)
  expect(position[0]).toBeLessThanOrEqual(38)
  expect(position[2]).toBeGreaterThanOrEqual(-116)
  expect(position[2]).toBeLessThanOrEqual(60)
}

describe('Prime Runner mission data', () => {
  it('organizes the objectives into an open-world contract registry', () => {
    expect(SKYLINE_MISSION.title).toBe('Prime Runner: Skyline Protocol')

    // The objective order remains a valid, exported array (HUD iterates it).
    for (const objectiveId of SKYLINE_OBJECTIVE_ORDER) {
      const objective = SKYLINE_OBJECTIVES[objectiveId]
      expect(objective.id).toBe(objectiveId)
      expect(objective.title.trim()).not.toBe('')
      expect(objective.detail.trim()).not.toBe('')
      expect(objective.targetPositions).toHaveLength(objective.requiredCount)
      objective.targetPositions.forEach(expectCityPosition)
    }

    // The four contracts exist with the expected ids.
    expect(SKYLINE_MISSION_IDS).toEqual([
      'lia-tutorial',
      'prime-cores',
      'composite-sentinels',
      'apex-extraction',
    ])

    // Only the LIA tutorial auto-activates at spawn.
    expect(SKYLINE_MISSIONS['lia-tutorial'].autoActivate).toBe(true)
    for (const missionId of SKYLINE_MISSION_IDS) {
      if (missionId === 'lia-tutorial') continue
      expect(SKYLINE_MISSIONS[missionId].autoActivate).toBe(false)
    }

    // Every contract reuses valid SKYLINE_OBJECTIVES members, has copy and a
    // well-formed activation anchor inside the city grid.
    const coveredObjectives = new Set<string>()
    for (const missionId of SKYLINE_MISSION_IDS) {
      const mission = SKYLINE_MISSIONS[missionId]
      expect(mission.id).toBe(missionId)
      expect(mission.title.trim()).not.toBe('')
      expect(mission.detail.trim()).not.toBe('')
      expect(mission.objectiveIds.length).toBeGreaterThan(0)
      for (const objectiveId of mission.objectiveIds) {
        expect(SKYLINE_OBJECTIVES[objectiveId].id).toBe(objectiveId)
        coveredObjectives.add(objectiveId)
      }
      expectCityPosition(mission.activationAnchor)
    }

    // Together the contracts cover exactly the campaign objectives.
    expect(coveredObjectives).toEqual(new Set(SKYLINE_OBJECTIVE_ORDER))
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

  it('createSkylineMissionsForWorld re-anchors the 3 contracts without mutating the static tutorial data', () => {
    // Snapshot the static tutorial exports to prove the factory never mutates them.
    const staticCoreSnapshot = SKYLINE_PRIME_CORE_VALUES.map((value) => ({
      value,
      label: SKYLINE_PRIME_CORES[value].label,
      clue: SKYLINE_PRIME_CORES[value].clue,
      position: SKYLINE_PRIME_CORES[value].position,
    }))
    const staticSentinelSnapshot = SKYLINE_SENTINEL_IDS.map((id) => ({
      id,
      label: SKYLINE_SENTINELS[id].label,
      compositeNumber: SKYLINE_SENTINELS[id].compositeNumber,
      primeFactors: SKYLINE_SENTINELS[id].primeFactors,
      position: SKYLINE_SENTINELS[id].position,
    }))
    const staticApexSpire = SKYLINE_LOCATIONS.apexSpire

    // A synthetic placement that moves every element off its static position.
    const placement: SkylineWorldMissionPlacement = {
      cores: [
        { value: 2, roofId: 'roof-core-2', position: [10, 5.1, -10] },
        { value: 3, roofId: 'roof-core-3', position: [12, 6.1, -14] },
        { value: 5, roofId: 'roof-core-5', position: [14, 7.1, -18] },
      ],
      sentinels: [
        { id: 'sentinel-four', roofId: 'roof-s4', position: [20, 5.1, -20] },
        { id: 'sentinel-six', roofId: 'roof-s6', position: [22, 6.1, -24] },
        { id: 'sentinel-nine', roofId: 'roof-s9', position: [24, 7.1, -28] },
        { id: 'sentinel-ten', roofId: 'roof-s10', position: [26, 8.1, -32] },
      ],
      apexSpire: { roofId: 'roof-apex', position: [30, 18.1, -40] },
      apexBeacon: { roofId: 'roof-apex', position: [30, 19.1, -40] },
      activation: {
        primeCores: { roofId: 'roof-core-2', position: [10, 5.1, -10] },
        compositeSentinels: { roofId: 'roof-s4', position: [20, 5.1, -20] },
        apexExtraction: { roofId: 'roof-apex', position: [30, 18.1, -40] },
      },
    }

    const content = createSkylineMissionsForWorld(placement)

    // Positions come from the placement; labels/clues/factors reused.
    for (const core of placement.cores) {
      expect(content.primeCores[core.value].position).toEqual(core.position)
      expect(content.primeCores[core.value].label).toBe(
        SKYLINE_PRIME_CORES[core.value].label,
      )
      expect(content.primeCores[core.value].clue).toBe(
        SKYLINE_PRIME_CORES[core.value].clue,
      )
    }
    for (const sentinel of placement.sentinels) {
      const mapped = content.sentinels[sentinel.id]
      expect(mapped.position).toEqual(sentinel.position)
      expect(mapped.label).toBe(SKYLINE_SENTINELS[sentinel.id].label)
      expect(mapped.primeFactors).toEqual(SKYLINE_SENTINELS[sentinel.id].primeFactors)
      expect(
        mapped.primeFactors.reduce((product, factor) => product * factor, 1),
      ).toBe(mapped.compositeNumber)
    }
    expect(content.locations.apexSpire).toEqual(placement.apexSpire.position)
    expect(content.missions['prime-cores'].objectiveIds).toEqual(
      SKYLINE_MISSIONS['prime-cores'].objectiveIds,
    )
    expect(content.missions['apex-extraction'].activationAnchor).toEqual(
      placement.apexSpire.position,
    )

    // The static tutorial exports are byte-for-byte unchanged after the call.
    for (const snap of staticCoreSnapshot) {
      expect(SKYLINE_PRIME_CORES[snap.value].label).toBe(snap.label)
      expect(SKYLINE_PRIME_CORES[snap.value].clue).toBe(snap.clue)
      expect(SKYLINE_PRIME_CORES[snap.value].position).toEqual(snap.position)
    }
    for (const snap of staticSentinelSnapshot) {
      expect(SKYLINE_SENTINELS[snap.id].label).toBe(snap.label)
      expect(SKYLINE_SENTINELS[snap.id].compositeNumber).toBe(snap.compositeNumber)
      expect(SKYLINE_SENTINELS[snap.id].primeFactors).toEqual(snap.primeFactors)
      expect(SKYLINE_SENTINELS[snap.id].position).toEqual(snap.position)
    }
    expect(SKYLINE_LOCATIONS.apexSpire).toEqual(staticApexSpire)
    // lia-tutorial contract is untouched (still auto-active at the NPC).
    expect(SKYLINE_MISSIONS['lia-tutorial'].autoActivate).toBe(true)
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
