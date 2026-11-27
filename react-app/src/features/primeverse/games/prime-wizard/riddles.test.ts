import { describe, expect, it } from 'vitest'
import { isPrime } from '../../../../lib/math'
import { digitsToNumber, generateRiddle, shouldCastImmediately, tierForRound, type Riddle, type RiddleTier } from './riddles'

function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

describe('enigmas do Grimório', () => {
  it('sempre têm ao menos uma resposta, e toda resposta é um primo de até dois algarismos', () => {
    const random = seeded(7)
    for (const tier of [0, 1, 2] as RiddleTier[]) {
      for (let round = 0; round < 300; round += 1) {
        const riddle = generateRiddle(tier, random)
        expect(riddle.answers.length, riddle.text).toBeGreaterThan(0)
        for (const answer of riddle.answers) {
          expect(isPrime(answer), `${riddle.text} → ${answer}`).toBe(true)
          expect(answer).toBeLessThan(100)
        }
      }
    }
  })

  it('o primeiro nível só pede primos de um algarismo', () => {
    const random = seeded(11)
    for (let round = 0; round < 200; round += 1) {
      for (const answer of generateRiddle(0, random).answers) expect(answer).toBeLessThan(10)
    }
  })

  it('evita repetir o mesmo enigma em sequência', () => {
    const random = seeded(3)
    const first = generateRiddle(1, random)
    for (let round = 0; round < 50; round += 1) {
      expect(generateRiddle(1, random, [first.key]).key).not.toBe(first.key)
    }
  })

  it('sobe de nível conforme a partida avança', () => {
    expect(tierForRound(0)).toBe(0)
    expect(tierForRound(5)).toBe(1)
    expect(tierForRound(11)).toBe(2)
  })

  it('lança na hora quando o prefixo não pode crescer até uma resposta', () => {
    const teens: Riddle = { key: 't', text: '', answers: [11, 13, 17, 19], tier: 1 }
    const small: Riddle = { key: 's', text: '', answers: [2, 3, 5, 7], tier: 0 }
    expect(shouldCastImmediately(small, [7])).toBe(true)
    expect(shouldCastImmediately(teens, [1])).toBe(false)
    expect(shouldCastImmediately(teens, [4])).toBe(true)
    expect(shouldCastImmediately(teens, [1, 3])).toBe(true)
    expect(shouldCastImmediately(teens, [])).toBe(false)
    expect(digitsToNumber([1, 7])).toBe(17)
  })
})
