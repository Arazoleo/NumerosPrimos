import { describe, expect, it } from 'vitest'
import { digitTemplates, recognizeDigit, type Point, type Stroke } from './digitRecognizer'

function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

/** Distorce um modelo como faria uma mão: rotação, escala anisotrópica, tremor e densidade irregular. */
function wobble(strokes: readonly Stroke[], random: () => number): Stroke[] {
  const angle = (random() - 0.5) * 0.36
  const scaleX = 0.8 + random() * 0.4
  const scaleY = 0.85 + random() * 0.3
  const scale = 1.5 + random() * 3
  const shear = (random() - 0.5) * 0.25
  return strokes.map((stroke) => stroke
    .filter(() => random() > 0.18)
    .map((point): Point => {
      const x = (point.x - 50) * scaleX + (point.y - 50) * shear
      const y = (point.y - 50) * scaleY
      return {
        x: (x * Math.cos(angle) - y * Math.sin(angle)) * scale + 400 + (random() - 0.5) * 6 * scale,
        y: (x * Math.sin(angle) + y * Math.cos(angle)) * scale + 300 + (random() - 0.5) * 6 * scale,
      }
    }))
}

describe('recognizeDigit', () => {
  it('reconhece cada modelo sem distorção', () => {
    for (const [digit, strokes] of digitTemplates()) {
      expect(recognizeDigit(strokes)?.digit).toBe(digit)
    }
  })

  it('reconhece desenhos tremidos e tortos com alta taxa de acerto', () => {
    const random = seeded(257)
    const misses: string[] = []
    let total = 0
    for (let round = 0; round < 6; round += 1) {
      for (const [digit, strokes] of digitTemplates()) {
        total += 1
        const result = recognizeDigit(wobble(strokes, random))
        if (result?.digit !== digit) misses.push(`${digit}→${result?.digit ?? '∅'}`)
      }
    }
    expect(misses.length / total, misses.join(' ')).toBeLessThan(0.06)
  }, 20_000)

  it('reconhece um 4 aberto desenhado com dois traços separados', () => {
    const four: Stroke[] = [
      [{ x: 10, y: 10 }, { x: 8, y: 40 }, { x: 10, y: 70 }, { x: 40, y: 72 }, { x: 70, y: 70 }],
      [{ x: 55, y: 5 }, { x: 56, y: 60 }, { x: 57, y: 120 }],
    ]
    expect(recognizeDigit(four)?.digit).toBe(4)
  })

  it('trata um traço vertical torto como 1', () => {
    const one: Stroke[] = [[{ x: 100, y: 10 }, { x: 104, y: 60 }, { x: 98, y: 110 }, { x: 103, y: 170 }]]
    expect(recognizeDigit(one)?.digit).toBe(1)
  })

  it('rejeita rabiscos minúsculos e traços horizontais', () => {
    expect(recognizeDigit([[{ x: 0, y: 0 }, { x: 2, y: 3 }, { x: 4, y: 1 }, { x: 3, y: 2 }]])).toBeNull()
    expect(recognizeDigit([[{ x: 0, y: 50 }, { x: 100, y: 52 }, { x: 200, y: 50 }, { x: 300, y: 51 }]])).toBeNull()
  })
})
