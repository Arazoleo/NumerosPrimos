import { beforeEach, describe, expect, it } from 'vitest'

import { BACKROOMS_START } from './backroomsLayout'
import { useBackroomsRuntime } from './backroomsRuntime'

describe('Backrooms runtime HUD state', () => {
  beforeEach(() => useBackroomsRuntime.getState().reset())

  it('tracks a run, sector and fair threat distance', () => {
    useBackroomsRuntime.getState().startRun({ ...BACKROOMS_START, yaw: 1.2 })
    useBackroomsRuntime.getState().reportThreat('listening', 8.25)

    expect(useBackroomsRuntime.getState()).toMatchObject({
      sectorName: 'Recepção Ausente',
      threat: 'listening',
      threatDistance: 8.25,
      composure: 100,
    })
  })

  it('restores composure and increments the capture signal after enough hits', () => {
    expect(useBackroomsRuntime.getState().takeHit(40)).toBe(false)
    expect(useBackroomsRuntime.getState().takeHit(40)).toBe(false)
    expect(useBackroomsRuntime.getState().takeHit(40)).toBe(true)
    expect(useBackroomsRuntime.getState()).toMatchObject({
      composure: 100,
      hitSerial: 3,
      captureSerial: 1,
      threat: 'quiet',
    })
  })
})
