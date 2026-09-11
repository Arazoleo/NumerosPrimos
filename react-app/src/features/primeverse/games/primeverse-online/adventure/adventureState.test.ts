import { describe, expect, it } from 'vitest'

import {
  HORROR_REALM_ID,
  PRIME_PULSE_COOLDOWN_MS,
  canActivateHorrorAltar,
  createPrimeverseAdventureState,
  defeatedHorrorStalkers,
  isPrimeverseAdventureComplete,
  primeverseAdventureReducer,
  pulseCooldownRemaining,
  selectAdventureObjective,
  type PrimeverseAdventureAction,
  type PrimeverseAdventureState,
} from './adventureState'

function reduce(
  state: PrimeverseAdventureState,
  ...actions: readonly PrimeverseAdventureAction[]
): PrimeverseAdventureState {
  return actions.reduce(primeverseAdventureReducer, state)
}

describe('Primeverse adventure progression', () => {
  it('registers each realm once and gives the Nexus a clear exploration objective', () => {
    const state = reduce(
      createPrimeverseAdventureState(),
      { type: 'set-realm', realm: 'ulam-run' },
      { type: 'set-realm', realm: 'nexus' },
      { type: 'set-realm', realm: 'ulam-run' },
    )

    expect(state.visitedRealms).toEqual(['nexus', 'ulam-run'])
    expect(selectAdventureObjective(reduce(state, { type: 'set-realm', realm: 'nexus' }))).toMatchObject({
      id: 'nexus',
      current: 1,
      total: 3,
      completed: false,
    })
  })

  it('tracks the two realm minigames without duplicating victories', () => {
    const state = reduce(
      createPrimeverseAdventureState('ulam-run'),
      { type: 'mark-minigame-win', game: 'ulam-prime-run' },
      { type: 'mark-minigame-win', game: 'ulam-prime-run' },
    )

    expect(state.completedMinigames).toEqual(['ulam-prime-run'])
    expect(selectAdventureObjective(state)).toMatchObject({ current: 1, total: 4, completed: false })
    const cleared = reduce(
      state,
      { type: 'defeat-mob', mobId: 'ulam-composite-4' },
      { type: 'defeat-mob', mobId: 'ulam-composite-6' },
      { type: 'defeat-mob', mobId: 'ulam-composite-9' },
    )
    expect(selectAdventureObjective(cleared)).toMatchObject({ current: 4, completed: true })
  })

  it('only collects canonical seals while the player is in the Catacombs', () => {
    const nexus = primeverseAdventureReducer(createPrimeverseAdventureState(), {
      type: 'collect-seal', sealId: 'seal-23',
    })
    expect(nexus.sealsCollected).toEqual([])

    const horror = reduce(
      createPrimeverseAdventureState(HORROR_REALM_ID),
      { type: 'collect-seal', sealId: 'seal-31' },
      { type: 'collect-seal', sealId: 'seal-23' },
      { type: 'collect-seal', sealId: 'seal-31' },
    )
    expect(horror.sealsCollected).toEqual(['seal-23', 'seal-31'])
  })

  it('requires three seals and two unique Catacomb stalkers before activating the altar', () => {
    const prepared = reduce(
      createPrimeverseAdventureState(HORROR_REALM_ID),
      { type: 'collect-seal', sealId: 'seal-23' },
      { type: 'collect-seal', sealId: 'seal-29' },
      { type: 'collect-seal', sealId: 'seal-31' },
      { type: 'defeat-mob', mobId: 'ulam-composite-4' },
      { type: 'defeat-mob', mobId: 'catacomb-null-alpha' },
      { type: 'defeat-mob', mobId: 'catacomb-null-alpha' },
    )
    expect(defeatedHorrorStalkers(prepared)).toBe(1)
    expect(canActivateHorrorAltar(prepared)).toBe(false)
    expect(primeverseAdventureReducer(prepared, { type: 'activate-altar' }).altarActivated).toBe(false)

    const escaped = reduce(
      prepared,
      { type: 'defeat-mob', mobId: 'catacomb-null-beta' },
      { type: 'activate-altar' },
    )
    expect(canActivateHorrorAltar(escaped)).toBe(true)
    expect(escaped.altarActivated).toBe(true)
    expect(selectAdventureObjective(escaped)).toMatchObject({ current: 6, total: 6, completed: true })
  })

  it('clamps damage and exposes the fallen objective at zero integrity', () => {
    const damaged = reduce(
      createPrimeverseAdventureState(HORROR_REALM_ID),
      { type: 'take-damage', mobId: 'catacomb-null-alpha', amount: 17.2, nowMs: 100 },
      { type: 'take-damage', mobId: 'catacomb-null-beta', amount: 200, nowMs: 200 },
    )
    expect(damaged.integrity).toBe(0)
    expect(selectAdventureObjective(damaged).id).toBe('sieve-fallen')
    expect(primeverseAdventureReducer(damaged, { type: 'toggle-lantern' }).lanternOn).toBe(false)
  })

  it('gates prime pulses behind a deterministic two-second cooldown', () => {
    const initial = createPrimeverseAdventureState(HORROR_REALM_ID)
    const first = primeverseAdventureReducer(initial, { type: 'cast-pulse', nowMs: 1_000 })
    expect(first.pulseSerial).toBe(1)
    expect(first.pulseReadyAtMs).toBe(1_000 + PRIME_PULSE_COOLDOWN_MS)
    expect(pulseCooldownRemaining(first, 1_750)).toBe(1_250)

    const blocked = primeverseAdventureReducer(first, { type: 'cast-pulse', nowMs: 2_999 })
    expect(blocked.pulseSerial).toBe(1)
    expect(blocked.feedback?.kind).toBe('warning')

    const ready = primeverseAdventureReducer(blocked, { type: 'cast-pulse', nowMs: 3_000 })
    expect(ready.pulseSerial).toBe(2)
  })

  it('keeps the lantern exclusive to the horror realm and can recover combat integrity', () => {
    const ulam = createPrimeverseAdventureState('ulam-run')
    expect(primeverseAdventureReducer(ulam, { type: 'toggle-lantern' }).lanternOn).toBe(false)
    expect(primeverseAdventureReducer(ulam, { type: 'cast-pulse', nowMs: 100 }).pulseSerial).toBe(1)
    expect(primeverseAdventureReducer(createPrimeverseAdventureState(), { type: 'cast-pulse', nowMs: 100 }).pulseSerial).toBe(0)

    const broken = primeverseAdventureReducer(ulam, { type: 'take-damage', mobId: 'drone', amount: 100, nowMs: 1 })
    expect(primeverseAdventureReducer(broken, { type: 'recover' }).integrity).toBe(100)
  })

  it('resets only the horror run while preserving exploration and other victories', () => {
    const state = reduce(
      createPrimeverseAdventureState(HORROR_REALM_ID),
      { type: 'mark-minigame-win', game: 'ulam-prime-run' },
      { type: 'collect-seal', sealId: 'seal-23' },
      { type: 'defeat-mob', mobId: 'ulam-composite-4' },
      { type: 'defeat-mob', mobId: 'catacomb-null-alpha' },
      { type: 'take-damage', mobId: 'catacomb-null-alpha', amount: 80, nowMs: 100 },
      { type: 'toggle-lantern' },
      { type: 'reset-horror' },
    )

    expect(state).toMatchObject({ integrity: 100, lanternOn: false, sealsCollected: [], altarActivated: false })
    expect(state.completedMinigames).toEqual(['ulam-prime-run'])
    expect(state.defeatedMobIds).toEqual(['ulam-composite-4'])
  })

  it('recognizes completion only after every world challenge is resolved', () => {
    const state = reduce(
      createPrimeverseAdventureState(),
      { type: 'set-realm', realm: 'ulam-run' },
      { type: 'set-realm', realm: 'factor-forge' },
      { type: 'set-realm', realm: HORROR_REALM_ID },
      { type: 'mark-minigame-win', game: 'ulam-prime-run' },
      { type: 'mark-minigame-win', game: 'factor-reactor' },
      { type: 'defeat-mob', mobId: 'ulam-composite-4' },
      { type: 'defeat-mob', mobId: 'ulam-composite-6' },
      { type: 'defeat-mob', mobId: 'ulam-composite-9' },
      { type: 'defeat-mob', mobId: 'forge-warden-2' },
      { type: 'defeat-mob', mobId: 'forge-warden-3' },
      { type: 'defeat-mob', mobId: 'forge-warden-5' },
      { type: 'collect-seal', sealId: 'seal-23' },
      { type: 'collect-seal', sealId: 'seal-29' },
      { type: 'collect-seal', sealId: 'seal-31' },
      { type: 'defeat-mob', mobId: 'catacomb-null-alpha' },
      { type: 'defeat-mob', mobId: 'catacomb-null-beta' },
      { type: 'activate-altar' },
    )
    expect(isPrimeverseAdventureComplete(state)).toBe(true)
  })
})
