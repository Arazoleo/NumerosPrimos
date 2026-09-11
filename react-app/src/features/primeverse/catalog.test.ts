import { describe, expect, it } from 'vitest'
import { AVAILABLE_GAMES, PRIMEVERSE_GAMES } from './catalog'

const ONLINE_EXPEDITION_IDS = ['ulam-rift', 'euclid-siege', 'sieve-catacombs']

describe('Primeverse hub catalog', () => {
  it('uses Primeverse Online as the only hub entry for its standalone expeditions', () => {
    const hubIds = PRIMEVERSE_GAMES.map((game) => game.id)

    expect(hubIds).toContain('primeverse-online')
    expect(hubIds).not.toEqual(expect.arrayContaining(ONLINE_EXPEDITION_IDS))
  })

  it('does not expose the standalone expeditions through the available-games list', () => {
    const availableIds = AVAILABLE_GAMES.map((game) => game.id)

    expect(availableIds).not.toEqual(expect.arrayContaining(ONLINE_EXPEDITION_IDS))
  })

  it('exposes Núcleo 257 as an available game with its canonical route', () => {
    const game = PRIMEVERSE_GAMES.find((candidate) => candidate.id === 'nucleus-257')

    expect(game).toMatchObject({
      title: 'Núcleo 257',
      path: '/jogos/nucleo-257',
      status: 'available',
    })
    expect(AVAILABLE_GAMES).toContain(game)
  })
})
