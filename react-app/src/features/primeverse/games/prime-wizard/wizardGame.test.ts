import { describe, expect, it } from 'vitest'
import { advanceWizard, castSpell, createWizardGame, MAX_HEARTS, TOTAL_ROUNDS, WRONG_PENALTY } from './wizardGame'

const fixed = () => 0.42

describe('partida do Grimório Primo', () => {
  it('começa com três vidas e um enigma de primos de um algarismo', () => {
    const game = createWizardGame(fixed)
    expect(game.hearts).toBe(MAX_HEARTS)
    expect(game.riddle.tier).toBe(0)
    expect(game.progress).toBe(0)
  })

  it('um feitiço certo derrota o golem e traz o próximo', () => {
    const game = createWizardGame(fixed)
    const [next, event] = castSpell(game, game.riddle.answers[0], fixed)
    expect(event.type).toBe('hit')
    expect(next.defeated).toBe(1)
    expect(next.round).toBe(1)
    expect(next.score).toBeGreaterThan(100)
    expect(next.progress).toBe(0)
  })

  it('um feitiço errado empurra o golem para frente e zera a sequência', () => {
    const game = { ...createWizardGame(fixed), streak: 3 }
    const [next, event] = castSpell(game, 4, fixed)
    expect(event.type).toBe('miss')
    expect(next.progress).toBeCloseTo(WRONG_PENALTY)
    expect(next.streak).toBe(0)
  })

  it('o golem que chega ao mago tira uma vida', () => {
    const game = createWizardGame(fixed)
    const [next, event] = advanceWizard(game, game.duration + 1, fixed)
    expect(event?.type).toBe('breach')
    expect(next.hearts).toBe(MAX_HEARTS - 1)
    expect(next.round).toBe(1)
  })

  it('perde ao ficar sem vidas', () => {
    let game = createWizardGame(fixed)
    for (let i = 0; i < MAX_HEARTS; i += 1) [game] = advanceWizard(game, 999, fixed)
    expect(game.outcome).toBe('defeat')
  })

  it('vence depois de passar por todas as rodadas', () => {
    let game = createWizardGame(fixed)
    for (let i = 0; i < TOTAL_ROUNDS; i += 1) [game] = castSpell(game, game.riddle.answers[0], fixed)
    expect(game.outcome).toBe('victory')
    expect(game.defeated).toBe(TOTAL_ROUNDS)
  })
})
