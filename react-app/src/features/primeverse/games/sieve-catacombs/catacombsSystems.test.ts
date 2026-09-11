import { describe, expect, it } from 'vitest'

import { CATACOMBS_LEVELS } from './campaignLogic'
import {
  ELEVATOR_PUZZLES,
  getElevatorPuzzle,
  isElevatorAnswerCorrect,
  normalizeElevatorAnswer,
  visibleFragments,
} from './elevatorPuzzle'
import {
  cabinetAt,
  countFragments,
  drawerPrompt,
  openNextDrawer,
  toolsInDrawers,
  type CabinetDefinition,
} from './cabinets'
import { CAESAR_DISC_ID, decodeWithDisc } from './caesarDisc'
import { findTilePath, nextPathPoint } from './pathfinding'
import {
  CATACOMBS_LEVEL_WORLDS,
  chooseEnemySpawn,
  createLevelEnemies,
  getCatacombsLevelWorld,
  hasLevelClearPath,
} from './levelWorld'

describe('Cripta do Crivo elevator ciphers', () => {
  it('defines one solvable cipher per floor', () => {
    expect(ELEVATOR_PUZZLES.map((puzzle) => puzzle.levelId)).toEqual(
      CATACOMBS_LEVELS.map((level) => level.id),
    )
    for (const puzzle of ELEVATOR_PUZZLES) {
      expect(puzzle.fragments.length).toBeGreaterThanOrEqual(2)
      expect(isElevatorAnswerCorrect(puzzle, puzzle.answer)).toBe(true)
      expect(isElevatorAnswerCorrect(puzzle, '')).toBe(false)
      expect(isElevatorAnswerCorrect(puzzle, 'resposta errada')).toBe(false)
    }
  })

  it('accepts the answer regardless of case, accents, spaces and hex prefix', () => {
    const offices = getElevatorPuzzle('yellow-offices')
    expect(isElevatorAnswerCorrect(offices, ' elevador ')).toBe(true)
    expect(isElevatorAnswerCorrect(offices, 'Elevadór')).toBe(true)

    const servers = getElevatorPuzzle('server-farm-11')
    expect(isElevatorAnswerCorrect(servers, '0x6b')).toBe(true)
    expect(normalizeElevatorAnswer('0x6B')).toBe('6B')
  })

  it('reveals clue fragments only as drawers give them up', () => {
    const puzzle = getElevatorPuzzle('crypt-49')
    expect(visibleFragments(puzzle, 0)).toEqual([])
    expect(visibleFragments(puzzle, 1)).toEqual([puzzle.fragments[0]])
    expect(visibleFragments(puzzle, 99)).toEqual(puzzle.fragments)
    expect(visibleFragments(puzzle, Number.NaN)).toEqual([])
  })
})

describe('Cripta do Crivo cabinets', () => {
  const cabinet: CabinetDefinition = {
    id: 'test-cabinet',
    position: { x: 0, z: 0 },
    rotation: 0,
    drawers: [
      { id: 'd1', content: 'fragment', text: 'pista' },
      { id: 'd2', content: 'battery', text: 'bateria' },
    ],
  }

  it('opens one drawer per interaction and then reports the cabinet as emptied', () => {
    expect(drawerPrompt(cabinet, [])).toBe('E  PUXAR GAVETA 1/2')
    const first = openNextDrawer(cabinet, [])
    expect(first.drawer?.id).toBe('d1')
    expect(first.openedDrawers).toEqual(['d1'])
    expect(first.noise).toBeGreaterThan(0)

    const second = openNextDrawer(cabinet, first.openedDrawers)
    expect(second.drawer?.id).toBe('d2')
    expect(drawerPrompt(cabinet, second.openedDrawers)).toBeNull()

    const exhausted = openNextDrawer(cabinet, second.openedDrawers)
    expect(exhausted.drawer).toBeNull()
    expect(exhausted.noise).toBe(0)
    expect(countFragments([cabinet], second.openedDrawers)).toBe(1)
  })

  it('only offers the cabinet the player is actually standing at', () => {
    expect(cabinetAt([cabinet], { x: 0, z: 1 })?.id).toBe('test-cabinet')
    expect(cabinetAt([cabinet], { x: 0, z: 9 })).toBeNull()
  })
})

describe('Cripta do Crivo pathfinding and spawns', () => {
  it('walks around a corner instead of into the wall between the two rooms', () => {
    const offices = getCatacombsLevelWorld('yellow-offices')
    const path = findTilePath(offices, { x: -28, z: 10 }, { x: 0, z: -20 })
    expect(path.length).toBeGreaterThan(3)
    for (const point of path) {
      expect(offices.tiles.some((tile) => tile.x === point.x && tile.z === point.z)).toBe(true)
    }

    // String pulling: the chosen waypoint may be far, but it must be reachable in a
    // straight line — that is what stops the zigzag that used to cripple the chase.
    const from = { x: -28, z: 10 }
    const step = nextPathPoint(offices, from, { x: 0, z: -20 })
    expect(step).not.toBeNull()
    expect(hasLevelClearPath(offices, from, step!, 0.38)).toBe(true)
  })

  it('keeps stalkers away from the player when a floor starts', () => {
    for (const world of CATACOMBS_LEVEL_WORLDS) {
      for (const enemy of createLevelEnemies(world)) {
        expect(Math.hypot(enemy.x - world.playerStart.x, enemy.z - world.playerStart.z))
          .toBeGreaterThan(8)
      }
      for (const blueprint of world.enemies) {
        const spawn = chooseEnemySpawn(world, blueprint, world.playerStart)
        expect(spawn.waypoint).toBeGreaterThanOrEqual(0)
        expect(spawn.waypoint).toBeLessThan(blueprint.patrol.length)
      }
    }
  })

  it('hides the Caesar disc in a first-floor drawer and keeps it once found', () => {
    const offices = getCatacombsLevelWorld('yellow-offices')
    const discDrawer = offices.cabinets
      .flatMap((cabinet) => cabinet.drawers)
      .find((drawer) => drawer.tool === CAESAR_DISC_ID)
    expect(discDrawer).toBeDefined()
    expect(discDrawer?.content).toBe('tool')

    expect(toolsInDrawers(offices.cabinets, [])).toEqual([])
    expect(toolsInDrawers(offices.cabinets, [discDrawer?.id ?? ''])).toEqual([CAESAR_DISC_ID])
  })

  it('decodes the first elevator cipher with the disc itself', () => {
    const puzzle = getElevatorPuzzle('yellow-offices')
    const readings = Array.from({ length: 26 }, (_, shift) => decodeWithDisc(puzzle.challenge, shift))
    expect(readings).toContain('ELEVADOR')
    expect(isElevatorAnswerCorrect(puzzle, decodeWithDisc(puzzle.challenge, 3))).toBe(true)
  })
})
