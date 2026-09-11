import { describe, expect, it } from 'vitest'

import {
  canChallengeCompositeSentinel,
  canEnterPrimeboundArea,
  getAvailableConnections,
  getConnectionDestination,
  getNextPrimeboundObjective,
  getPrimeboundArea,
  getPrimeboundDialogue,
  getPrimeboundProgressSummary,
  INITIAL_PRIMEBOUND_PROGRESS,
  isPrimeboundComplete,
  isPrimeboundObjectiveComplete,
  PRIMEBOUND_AREAS,
  PRIMEBOUND_CONNECTIONS,
  PRIMEBOUND_DIALOGUES,
  PRIMEBOUND_ENEMIES,
  PRIMEBOUND_NPCS,
  PRIMEBOUND_OBJECTIVES,
  PRIMEBOUND_OBJECTIVE_ORDER,
  PRIMEBOUND_RUNES,
  PRIMEBOUND_TILE_LEGEND,
  PRIMEBOUND_WORLD,
  type GridPosition,
  type PrimeboundArea,
  type PrimeboundObjectiveId,
  type PrimeboundProgress,
  type PrimeRuneValue,
} from './world'

const ALL_RUNES = [2, 3, 5, 7, 11, 13] as const
const SANCTUARY_GUARDIANS = [
  'twenty-one-idol',
  'sixty-three-mersenne-seer',
  'sixty-six-goldbach-herald',
] as const
const NEW_AREA_IDS = [
  'mobius-labyrinth',
  'fermat-bastion',
  'sieve-foundry',
  'elliptic-nexus',
] as const

function tileAt(area: PrimeboundArea, position: GridPosition): string | null {
  return area.tileMap[position.y]?.[position.x] ?? null
}

function expectWalkable(area: PrimeboundArea, position: GridPosition): void {
  const tile = tileAt(area, position)
  expect(tile).not.toBeNull()
  expect(
    PRIMEBOUND_TILE_LEGEND[tile as keyof typeof PRIMEBOUND_TILE_LEGEND]
      ?.walkable,
  ).toBe(true)
}

function expectWalkableClearance(
  area: PrimeboundArea,
  position: GridPosition,
): void {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      expectWalkable(area, {
        x: position.x + offsetX,
        y: position.y + offsetY,
      })
    }
  }
}

function reachableTileKeys(area: PrimeboundArea): ReadonlySet<string> {
  const key = ({ x, y }: GridPosition) => `${x}:${y}`
  const reached = new Set([key(area.playerSpawn)])
  const queue: GridPosition[] = [area.playerSpawn]

  while (queue.length > 0) {
    const current = queue.shift()!
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]

    for (const neighbor of neighbors) {
      const tile = tileAt(area, neighbor)
      const neighborKey = key(neighbor)
      if (
        tile &&
        PRIMEBOUND_TILE_LEGEND[tile as keyof typeof PRIMEBOUND_TILE_LEGEND]
          ?.walkable &&
        !reached.has(neighborKey)
      ) {
        reached.add(neighborKey)
        queue.push(neighbor)
      }
    }
  }

  return reached
}

function progress(
  overrides: Partial<PrimeboundProgress> = {},
): PrimeboundProgress {
  return { ...INITIAL_PRIMEBOUND_PROGRESS, ...overrides }
}

function completeObjective(
  state: PrimeboundProgress,
  objectiveId: PrimeboundObjectiveId,
): PrimeboundProgress {
  const objective = PRIMEBOUND_OBJECTIVES[objectiveId]
  if (objective.kind === 'boss') {
    return {
      ...state,
      defeatedEnemyIds: [...state.defeatedEnemyIds, 'composite-sentinel'],
    }
  }
  if (objective.kind === 'complete') return state
  if (!objective.areaId) throw new Error(`Objetivo sem região: ${objectiveId}`)

  const area = PRIMEBOUND_AREAS[objective.areaId]
  if (objective.kind === 'travel') {
    return {
      ...state,
      currentAreaId: area.id,
      visitedAreaIds: [...state.visitedAreaIds, area.id],
    }
  }
  if (objective.kind === 'talk') {
    return {
      ...state,
      spokenNpcIds: [...state.spokenNpcIds, area.npcIds[0]!],
    }
  }
  if (objective.kind === 'battle') {
    const guardians = area.enemyIds.filter(
      (enemyId) => !PRIMEBOUND_ENEMIES[enemyId].isBoss,
    )
    return {
      ...state,
      defeatedEnemyIds: [...state.defeatedEnemyIds, ...guardians],
      completedStageIds: [...state.completedStageIds, area.id],
    }
  }

  return {
    ...state,
    collectedRunes: [...state.collectedRunes, area.runeValues[0]!],
  }
}

describe('Primebound world', () => {
  it('defines twelve regions connected in narrative order', () => {
    expect(PRIMEBOUND_WORLD.title).toBe('Primebound — O Último Primo')
    expect(PRIMEBOUND_WORLD.areaOrder).toEqual([
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
    ])
    expect(
      PRIMEBOUND_WORLD.areaOrder.map((areaId) =>
        PRIMEBOUND_AREAS[areaId].name,
      ),
    ).toEqual([
      'Bosque dos Ecos',
      'Cripta Composta',
      'Penhascos Gêmeos',
      'Forja dos Resíduos',
      'Jardim de Eratóstenes',
      'Cidadela de Goldbach',
      'Observatório de Wilson',
      'Labirinto de Möbius',
      'Bastião de Fermat',
      'Fundição do Crivo',
      'Nexo Elíptico',
      'Santuário Primo',
    ])
    expect(Object.keys(PRIMEBOUND_CONNECTIONS)).toHaveLength(11)

    PRIMEBOUND_WORLD.areaOrder.slice(0, -1).forEach((areaId, index) => {
      const nextAreaId = PRIMEBOUND_WORLD.areaOrder[index + 1]!
      const connection = Object.values(PRIMEBOUND_CONNECTIONS).find(
        ({ a, b }) =>
          (a.areaId === areaId && b.areaId === nextAreaId) ||
          (b.areaId === areaId && a.areaId === nextAreaId),
      )
      expect(connection).toBeDefined()
      expect(getConnectionDestination(connection!.id, areaId)?.areaId).toBe(
        nextAreaId,
      )
      expect(
        getConnectionDestination(connection!.id, nextAreaId)?.areaId,
      ).toBe(areaId)
    })
  })

  it('keeps every map rectangular, playable and connected to its entities', () => {
    for (const area of Object.values(PRIMEBOUND_AREAS)) {
      const width = area.tileMap[0]!.length
      expect(width).toBeGreaterThan(0)
      expect(area.tileMap.every((row) => row.length === width)).toBe(true)
      expectWalkable(area, area.playerSpawn)

      for (const row of area.tileMap) {
        for (const tile of row) {
          expect(PRIMEBOUND_TILE_LEGEND).toHaveProperty(tile)
        }
      }

      const points = [
        ...area.npcIds.map((npcId) => PRIMEBOUND_NPCS[npcId].position),
        ...area.runeValues.map((value) => PRIMEBOUND_RUNES[value].position),
        ...area.enemyIds.map((enemyId) => PRIMEBOUND_ENEMIES[enemyId].position),
        ...area.connectionIds.map((connectionId) => {
          const connection = PRIMEBOUND_CONNECTIONS[connectionId]
          return connection.a.areaId === area.id
            ? connection.a.portal
            : connection.b.portal
        }),
      ]
      const reached = reachableTileKeys(area)
      for (const point of points) {
        expectWalkable(area, point)
        expect(reached.has(`${point.x}:${point.y}`)).toBe(true)
      }

      const reservedPositionKeys = new Set([
        `${area.playerSpawn.x}:${area.playerSpawn.y}`,
        ...area.npcIds.map((npcId) => {
          const position = PRIMEBOUND_NPCS[npcId].position
          return `${position.x}:${position.y}`
        }),
        ...area.runeValues.map((value) => {
          const position = PRIMEBOUND_RUNES[value].position
          return `${position.x}:${position.y}`
        }),
        ...area.connectionIds.flatMap((connectionId) => {
          const connection = PRIMEBOUND_CONNECTIONS[connectionId]
          const endpoint = connection.a.areaId === area.id
            ? connection.a.portal
            : connection.b.portal
          const arrival = connection.a.areaId === area.id
            ? connection.a.arrival
            : connection.b.arrival
          return [
            `${endpoint.x}:${endpoint.y}`,
            `${arrival.x}:${arrival.y}`,
          ]
        }),
      ])
      const enemyPositionKeys = area.enemyIds.map((enemyId) => {
        const position = PRIMEBOUND_ENEMIES[enemyId].position
        return `${position.x}:${position.y}`
      })
      expect(new Set(enemyPositionKeys).size).toBe(enemyPositionKeys.length)
      for (const positionKey of enemyPositionKeys) {
        expect(reservedPositionKeys.has(positionKey)).toBe(false)
      }

      for (const npcId of area.npcIds) {
        expect(PRIMEBOUND_NPCS[npcId].areaId).toBe(area.id)
      }
      for (const runeValue of area.runeValues) {
        expect(PRIMEBOUND_RUNES[runeValue].areaId).toBe(area.id)
      }
      for (const enemyId of area.enemyIds) {
        expect(PRIMEBOUND_ENEMIES[enemyId].areaId).toBe(area.id)
      }
    }

    for (const connection of Object.values(PRIMEBOUND_CONNECTIONS)) {
      for (const endpoint of [connection.a, connection.b]) {
        const area = PRIMEBOUND_AREAS[endpoint.areaId]
        expect(area.connectionIds).toContain(connection.id)
        expect(tileAt(area, endpoint.portal)).toBe('D')
        expectWalkable(area, endpoint.arrival)
      }
    }
  })

  it('awards every rune before its gates and adds no runes to the final gauntlet', () => {
    const earnedRunes = new Set<PrimeRuneValue>()

    for (const areaId of PRIMEBOUND_WORLD.areaOrder) {
      const area = PRIMEBOUND_AREAS[areaId]
      expect(
        area.requiredRunesToEnter.every((value) => earnedRunes.has(value)),
      ).toBe(true)
      for (const value of area.runeValues) earnedRunes.add(value)
    }

    expect(PRIMEBOUND_AREAS['eratosthenes-garden'].runeValues).toEqual([7])
    expect(PRIMEBOUND_AREAS['goldbach-citadel'].runeValues).toEqual([11])
    expect(PRIMEBOUND_AREAS['wilson-observatory'].runeValues).toEqual([13])
    for (const areaId of NEW_AREA_IDS) {
      expect(PRIMEBOUND_AREAS[areaId].runeValues).toEqual([])
      expect(PRIMEBOUND_AREAS[areaId].npcIds).toEqual([])
      expect(PRIMEBOUND_AREAS[areaId].requiredRunesToEnter).toEqual(ALL_RUNES)
    }
    expect(PRIMEBOUND_AREAS['prime-sanctuary'].runeValues).toEqual([])
    expect(PRIMEBOUND_AREAS['prime-sanctuary'].requiredRunesToEnter).toEqual(
      ALL_RUNES,
    )
  })

  it('teaches Crivo, Goldbach and congruências de Wilson through new guides', () => {
    expect(Object.keys(PRIMEBOUND_NPCS)).toEqual([
      'seris',
      'orun',
      'lyra',
      'sophia',
      'theon',
      'aurea',
      'wilson',
    ])

    for (const npc of Object.values(PRIMEBOUND_NPCS)) {
      expect(npc.dialogueIds.length).toBeGreaterThan(0)
      for (const dialogueId of npc.dialogueIds) {
        const dialogue = PRIMEBOUND_DIALOGUES[dialogueId]
        expect(dialogue.lines.length).toBeGreaterThan(0)
        expect(dialogue.lines.some((line) => line.speaker === npc.id)).toBe(
          true,
        )
        for (const line of dialogue.lines) {
          expect(line.text).toBe(line.text.trim())
          expect(line.text.length).toBeLessThanOrEqual(90)
        }
      }
    }

    const dialogueScript = Object.values(PRIMEBOUND_DIALOGUES)
      .flatMap(({ lines }) => lines.map(({ text }) => text))
      .join(' ')
    expect(dialogueScript).toContain('Crivo de Eratóstenes')
    expect(dialogueScript).toContain('eliminando múltiplos')
    expect(dialogueScript).toContain('todo inteiro par maior que 2')
    expect(dialogueScript).toContain('mesmo resto')
    expect(dialogueScript).toContain('fatorial de p menos 1')
    expect(dialogueScript).toContain('Lâminas Gêmeas!')
    expect(dialogueScript).toContain('Ruptura de Mersenne!')
  })

  it('defines the six ordered runes as unique prime values', () => {
    const runes = Object.values(PRIMEBOUND_RUNES)
    const values = runes.map(({ value }) => value)
    expect(values).toEqual(ALL_RUNES)
    expect(new Set(values).size).toBe(values.length)
    expect(new Set(runes.map(({ areaId }) => areaId)).size).toBe(runes.length)

    for (const value of values) {
      const divisors = Array.from(
        { length: value },
        (_, index) => index + 1,
      ).filter((candidate) => value % candidate === 0)
      expect(divisors).toEqual([1, value])
    }
  })

  it('models forty-eight composite enemies with prime-family powers', () => {
    const enemies = Object.values(PRIMEBOUND_ENEMIES)
    const finalBosses = enemies.filter((enemy) => enemy.isBoss)
    const representedFamilies = new Set(
      enemies.map(({ primeFamily }) => primeFamily),
    )

    expect(enemies).toHaveLength(48)
    expect(finalBosses).toHaveLength(1)
    expect(finalBosses[0]).toMatchObject({
      id: 'composite-sentinel',
      name: 'Sentinela Composta',
      number: 35,
      areaId: 'prime-sanctuary',
      maxHealth: 420,
      encounterRank: 'final-boss',
      primeFamily: 'prime-powers',
    })
    expect([...representedFamilies].sort()).toEqual(
      [
        'eratosthenes-sieve',
        'goldbach',
        'mersenne',
        'prime-powers',
        'sophie-germain',
        'twin-primes',
        'wilson',
      ].sort(),
    )

    for (const enemy of enemies) {
      expect(enemy.primeFactors.reduce((product, factor) => product * factor, 1))
        .toBe(enemy.number)
      expect(enemy.primeFactors.length).toBeGreaterThan(1)
      expect(enemy.maxHealth).toBeGreaterThan(0)
      expect(enemy.damage).toBeGreaterThan(0)
      expect(enemy.primeFamily.length).toBeGreaterThan(0)
      expect(enemy.signaturePower.name.length).toBeGreaterThan(0)
      expect(enemy.signaturePower.formula.length).toBeGreaterThan(0)
      expect(enemy.signaturePower.description.length).toBeGreaterThan(0)
    }

    const difficultyTiers = PRIMEBOUND_WORLD.areaOrder.map((areaId) => {
      const areaEnemies = PRIMEBOUND_AREAS[areaId].enemyIds.map(
        (enemyId) => PRIMEBOUND_ENEMIES[enemyId],
      )
      return {
        health: Math.min(...areaEnemies.map(({ maxHealth }) => maxHealth)),
        damage: Math.min(...areaEnemies.map(({ damage }) => damage)),
      }
    })
    expect(difficultyTiers.map(({ health }) => health)).toEqual([
      20, 30, 52, 78, 104, 128, 154, 160, 168, 176, 184, 190,
    ])
    expect(difficultyTiers.map(({ damage }) => damage)).toEqual([
      4, 6, 8, 11, 14, 16, 18, 18, 19, 20, 21, 22,
    ])
  })

  it('reinforces the established late regions with varied prime families and no new final bosses', () => {
    const expectedReinforcements = {
      'goldbach-citadel': {
        ids: ['thirty-three-twin-lancer', 'sixty-five-sophie-weaver'],
        families: ['goldbach', 'sophie-germain', 'twin-primes'],
      },
      'wilson-observatory': {
        ids: ['ninety-one-sieve-orbit', 'one-twenty-one-power-oracle'],
        families: ['eratosthenes-sieve', 'prime-powers', 'wilson'],
      },
      'prime-sanctuary': {
        ids: ['sixty-three-mersenne-seer', 'sixty-six-goldbach-herald'],
        families: ['goldbach', 'mersenne', 'prime-powers'],
      },
    } as const

    for (const [areaId, expectation] of Object.entries(expectedReinforcements)) {
      const area = PRIMEBOUND_AREAS[areaId as keyof typeof expectedReinforcements]
      const enemies = area.enemyIds.map((enemyId) => PRIMEBOUND_ENEMIES[enemyId])
      expect(area.enemyIds).toHaveLength(4)
      expect(area.enemyIds).toEqual(expect.arrayContaining([...expectation.ids]))
      expect(enemies.filter(({ encounterRank }) => encounterRank === 'minion'))
        .toHaveLength(3)
      expect(
        [...new Set(enemies.map(({ primeFamily }) => primeFamily))].sort(),
      ).toEqual([...expectation.families].sort())
      for (const enemyId of expectation.ids) {
        const reinforcement = PRIMEBOUND_ENEMIES[enemyId]
        expect(reinforcement).toMatchObject({
          areaId,
          encounterRank: 'minion',
          isBoss: false,
        })
        expectWalkableClearance(area, reinforcement.position)
      }
    }

    expect(Object.values(PRIMEBOUND_ENEMIES).filter(({ isBoss }) => isBoss))
      .toHaveLength(1)
  })

  it('builds four 18 by 11 gauntlets with unique safe encounters', () => {
    const enemyIds = new Set<string>()
    const bossHealth: number[] = []

    for (const areaId of NEW_AREA_IDS) {
      const area = PRIMEBOUND_AREAS[areaId]
      const enemies = area.enemyIds.map((enemyId) => PRIMEBOUND_ENEMIES[enemyId])
      const minions = enemies.filter(
        ({ encounterRank }) => encounterRank === 'minion',
      )
      const areaBosses = enemies.filter(
        ({ encounterRank }) => encounterRank === 'area-boss',
      )

      expect(area.tileMap).toHaveLength(11)
      expect(area.tileMap.every((row) => row.length === 18)).toBe(true)
      expect(area.npcIds).toEqual([])
      expect(area.runeValues).toEqual([])
      expect(enemies).toHaveLength(4)
      expect(minions).toHaveLength(3)
      expect(areaBosses).toHaveLength(1)
      expect(new Set(enemies.map(({ primeFamily }) => primeFamily)).size)
        .toBeGreaterThanOrEqual(3)

      for (const enemy of enemies) {
        expect(enemyIds.has(enemy.id)).toBe(false)
        enemyIds.add(enemy.id)
        expect(enemy.areaId).toBe(areaId)
        expectWalkableClearance(area, enemy.position)
      }
      bossHealth.push(areaBosses[0]!.maxHealth)
    }

    expect(enemyIds.size).toBe(16)
    expect(bossHealth).toEqual([270, 300, 335, 370])
  })

  it('places one distinct area boss before every rune-gated frontier', () => {
    for (const areaId of PRIMEBOUND_WORLD.areaOrder.slice(0, -1)) {
      const area = PRIMEBOUND_AREAS[areaId]
      const enemies = area.enemyIds.map(
        (enemyId) => PRIMEBOUND_ENEMIES[enemyId],
      )
      const minions = enemies.filter(
        ({ encounterRank }) => encounterRank === 'minion',
      )
      const areaBosses = enemies.filter(
        ({ encounterRank }) => encounterRank === 'area-boss',
      )

      expect(minions.length).toBeGreaterThanOrEqual(3)
      expect(areaBosses).toHaveLength(1)
      expect(area.enemyIds.indexOf(areaBosses[0]!.id)).toBeGreaterThan(
        Math.max(...minions.map(({ id }) => area.enemyIds.indexOf(id))),
      )
      expect(areaBosses[0]!.isBoss).toBe(false)
      expect(areaBosses[0]!.maxHealth).toBeGreaterThan(
        Math.max(...minions.map(({ maxHealth }) => maxHealth)),
      )
      expect(areaBosses[0]!.name).not.toBe(minions[0]!.name)
    }

    const sanctuaryEnemies = PRIMEBOUND_AREAS[
      'prime-sanctuary'
    ].enemyIds.map((enemyId) => PRIMEBOUND_ENEMIES[enemyId])
    expect(
      sanctuaryEnemies.filter(
        ({ encounterRank }) => encounterRank === 'final-boss',
      ),
    ).toHaveLength(1)
    expect(
      sanctuaryEnemies.filter(
        ({ encounterRank }) => encounterRank === 'area-boss',
      ),
    ).toHaveLength(0)
  })

  it('ties regional bosses to the prime family taught by their lands', () => {
    const expectedBossFamilies = {
      'echo-woods': 'prime-powers',
      'composite-crypt': 'sophie-germain',
      'twin-peaks': 'twin-primes',
      'residue-forge': 'mersenne',
      'eratosthenes-garden': 'eratosthenes-sieve',
      'goldbach-citadel': 'goldbach',
      'wilson-observatory': 'wilson',
      'mobius-labyrinth': 'wilson',
      'fermat-bastion': 'prime-powers',
      'sieve-foundry': 'eratosthenes-sieve',
      'elliptic-nexus': 'wilson',
    } as const

    for (const [areaId, primeFamily] of Object.entries(
      expectedBossFamilies,
    )) {
      const boss = PRIMEBOUND_AREAS[
        areaId as keyof typeof expectedBossFamilies
      ].enemyIds
        .map((enemyId) => PRIMEBOUND_ENEMIES[enemyId])
        .find(({ encounterRank }) => encounterRank === 'area-boss')

      expect(boss?.primeFamily).toBe(primeFamily)
    }
  })

  it('locks the campaign and boss behind all six runes', () => {
    expect(canEnterPrimeboundArea('echo-woods', progress())).toBe(true)
    expect(canEnterPrimeboundArea('composite-crypt', progress())).toBe(false)
    expect(canEnterPrimeboundArea('prime-sanctuary', progress())).toBe(false)

    const beforeSeven = progress({ collectedRunes: [2, 3, 5] })
    expect(canEnterPrimeboundArea('eratosthenes-garden', beforeSeven)).toBe(
      true,
    )
    expect(canEnterPrimeboundArea('goldbach-citadel', beforeSeven)).toBe(false)
    expect(
      getAvailableConnections('residue-forge', beforeSeven).map(({ id }) => id),
    ).toEqual([
      'twin-peaks-to-residue-forge',
      'residue-forge-to-eratosthenes',
    ])

    const allRunes = progress({ collectedRunes: ALL_RUNES })
    expect(canEnterPrimeboundArea('prime-sanctuary', allRunes)).toBe(true)
    expect(canChallengeCompositeSentinel(allRunes)).toBe(false)
    const defeatedSanctuaryGuardians = progress({
      collectedRunes: ALL_RUNES,
      defeatedEnemyIds: SANCTUARY_GUARDIANS,
    })
    expect(canChallengeCompositeSentinel(defeatedSanctuaryGuardians)).toBe(
      false,
    )
    expect(
      canChallengeCompositeSentinel({
        ...defeatedSanctuaryGuardians,
        completedStageIds: ['prime-sanctuary'],
      }),
    ).toBe(true)

    for (const missingGuardian of SANCTUARY_GUARDIANS) {
      expect(
        canChallengeCompositeSentinel(
          progress({
            collectedRunes: ALL_RUNES,
            defeatedEnemyIds: SANCTUARY_GUARDIANS.filter(
              (enemyId) => enemyId !== missingGuardian,
            ),
            completedStageIds: ['prime-sanctuary'],
          }),
        ),
      ).toBe(false)
    }

    for (const missingRune of ALL_RUNES) {
      const collectedRunes = ALL_RUNES.filter(
        (value) => value !== missingRune,
      )
      expect(
        canChallengeCompositeSentinel(
          progress({
            collectedRunes,
            defeatedEnemyIds: SANCTUARY_GUARDIANS,
            completedStageIds: ['prime-sanctuary'],
          }),
        ),
      ).toBe(false)
    }
  })

  it('requires both a finished stage and defeated guardians for every clear objective', () => {
    const clearObjectives = PRIMEBOUND_OBJECTIVE_ORDER.map(
      (objectiveId) => PRIMEBOUND_OBJECTIVES[objectiveId],
    ).filter(({ kind }) => kind === 'battle')

    for (const objective of clearObjectives) {
      if (!objective.areaId) {
        throw new Error(`Objetivo de combate sem região: ${objective.id}`)
      }
      const area = PRIMEBOUND_AREAS[objective.areaId]
      const guardians = area.enemyIds.filter(
        (enemyId) => !PRIMEBOUND_ENEMIES[enemyId].isBoss,
      )

      expect(
        isPrimeboundObjectiveComplete(
          objective.id,
          progress({ defeatedEnemyIds: guardians }),
        ),
      ).toBe(false)
      expect(
        isPrimeboundObjectiveComplete(
          objective.id,
          progress({ completedStageIds: [area.id] }),
        ),
      ).toBe(false)
      expect(
        isPrimeboundObjectiveComplete(
          objective.id,
          progress({
            completedStageIds: [area.id],
            defeatedEnemyIds: guardians,
          }),
        ),
      ).toBe(true)

      for (const missingGuardian of guardians) {
        expect(
          isPrimeboundObjectiveComplete(
            objective.id,
            progress({
              completedStageIds: [area.id],
              defeatedEnemyIds: guardians.filter(
                (enemyId) => enemyId !== missingGuardian,
              ),
            }),
          ),
        ).toBe(false)
      }
    }
  })

  it('returns every objective across the expanded campaign', () => {
    let state = progress()
    for (const objectiveId of PRIMEBOUND_OBJECTIVE_ORDER) {
      expect(getNextPrimeboundObjective(state).id).toBe(objectiveId)
      state = completeObjective(state, objectiveId)
    }
    expect(getNextPrimeboundObjective(state).id).toBe('victory')
    expect(isPrimeboundComplete(state)).toBe(true)
  })

  it('reports linear progress without mutation and handles safe lookups', () => {
    const initialSnapshot = JSON.stringify(INITIAL_PRIMEBOUND_PROGRESS)
    expect(getPrimeboundProgressSummary(INITIAL_PRIMEBOUND_PROGRESS)).toEqual({
      completedObjectives: 0,
      totalObjectives: PRIMEBOUND_OBJECTIVE_ORDER.length,
      percentage: 0,
      isComplete: false,
    })
    expect(JSON.stringify(INITIAL_PRIMEBOUND_PROGRESS)).toBe(initialSnapshot)

    const finished = progress({
      defeatedEnemyIds: ['composite-sentinel'],
    })
    expect(getPrimeboundProgressSummary(finished)).toEqual({
      completedObjectives: PRIMEBOUND_OBJECTIVE_ORDER.length,
      totalObjectives: PRIMEBOUND_OBJECTIVE_ORDER.length,
      percentage: 100,
      isComplete: true,
    })

    expect(getPrimeboundArea('missing')).toBeNull()
    expect(getPrimeboundDialogue('missing')).toBeNull()
    expect(getConnectionDestination('missing', 'echo-woods')).toBeNull()
    expect(getConnectionDestination('woods-to-crypt', 'prime-sanctuary'))
      .toBeNull()
  })
})
