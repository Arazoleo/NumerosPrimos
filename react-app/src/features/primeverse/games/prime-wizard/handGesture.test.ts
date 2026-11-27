import { describe, expect, it } from 'vitest'
import { OneEuroFilter, PenLatch, readHandPose, type Landmark } from './handGesture'

/** Monta uma mão vertical: punho embaixo, cada dedo esticado ou dobrado sobre a palma. */
function hand(extended: [boolean, boolean, boolean, boolean]): Landmark[] {
  const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }))
  points[0] = { x: 0.5, y: 0.9 }
  const columns = [0.44, 0.49, 0.54, 0.59]
  columns.forEach((x, finger) => {
    const base = 5 + finger * 4
    points[base] = { x, y: 0.7 }
    points[base + 1] = { x, y: 0.6 }
    if (extended[finger]) {
      points[base + 2] = { x, y: 0.52 }
      points[base + 3] = { x, y: 0.45 }
    } else {
      points[base + 2] = { x, y: 0.66 }
      points[base + 3] = { x, y: 0.72 }
    }
  })
  return points
}

describe('readHandPose', () => {
  it('reconhece o indicador apontando como caneta encostada', () => {
    const pose = readHandPose(hand([true, false, false, false]))
    expect(pose?.pointing).toBe(true)
    expect(pose?.openPalm).toBe(false)
    expect(pose?.tip).toEqual({ x: 0.44, y: 0.45 })
  })

  it('mão aberta não escreve', () => {
    const pose = readHandPose(hand([true, true, true, true]))
    expect(pose?.pointing).toBe(false)
    expect(pose?.openPalm).toBe(true)
  })

  it('sinal de paz e punho fechado levantam a caneta', () => {
    expect(readHandPose(hand([true, true, false, false]))?.pointing).toBe(false)
    expect(readHandPose(hand([false, false, false, false]))?.pointing).toBe(false)
  })

  it('ignora mãos incompletas', () => {
    expect(readHandPose([{ x: 0, y: 0 }])).toBeNull()
  })
})

describe('PenLatch', () => {
  it('não pisca com um quadro isolado', () => {
    const latch = new PenLatch(2, 3)
    expect(latch.update(true)).toBe(false)
    expect(latch.update(true)).toBe(true)
    expect(latch.update(false)).toBe(true)
    expect(latch.update(true)).toBe(true)
    expect(latch.update(false)).toBe(true)
    expect(latch.update(false)).toBe(true)
    expect(latch.update(false)).toBe(false)
  })
})

describe('OneEuroFilter', () => {
  it('suaviza tremor em torno de um ponto parado', () => {
    const filter = new OneEuroFilter()
    let output = 0
    for (let frame = 0; frame < 60; frame += 1) output = filter.filter(0.5 + (frame % 2 ? 0.02 : -0.02), frame * 16)
    expect(Math.abs(output - 0.5)).toBeLessThan(0.012)
  })
})
