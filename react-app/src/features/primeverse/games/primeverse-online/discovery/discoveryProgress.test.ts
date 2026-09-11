import { describe, expect, it } from 'vitest'

import {
  DISCOVERY_IDS,
  createDiscoveryProgress,
  describeDiscovery,
  isDiscoveryComplete,
  nextDiscovery,
  recordDiscovery,
  restoreDiscoveryProgress,
  serializeDiscoveryProgress,
} from './discoveryProgress'

describe('Primeverse exploration discoveries', () => {
  it('starts at the 997 trail and advances through unique discoveries', () => {
    const initial = createDiscoveryProgress()
    expect(nextDiscovery(initial)?.id).toBe('secret-997')

    const first = recordDiscovery(initial, 'secret-997', 10)
    expect(first.outcome).toBe('new')
    expect(first.state.discovered).toEqual(['secret-997'])
    expect(first.next?.id).toBe('secret-mersenne')
    expect(describeDiscovery(first)).toContain('1/3')

    const second = recordDiscovery(first.state, 'secret-mersenne', 20)
    expect(second.state.discovered).toEqual(['secret-997', 'secret-mersenne'])
    expect(second.next?.id).toBe('secret-constellation')
  })

  it('accepts secrets in any exploration order but presents them canonically', () => {
    const constellation = recordDiscovery(createDiscoveryProgress(), 'secret-constellation', 10)
    const mersenne = recordDiscovery(constellation.state, 'secret-mersenne', 20)

    expect(mersenne.state.discovered).toEqual(['secret-mersenne', 'secret-constellation'])
    expect(mersenne.next?.id).toBe('secret-997')
  })

  it('does not count repeated or unknown interactions twice', () => {
    const first = recordDiscovery(createDiscoveryProgress(), 'secret-997', 10)
    const repeated = recordDiscovery(first.state, 'secret-997', 20)
    const ignored = recordDiscovery(repeated.state, 'prime-core', 30)

    expect(repeated.outcome).toBe('repeated')
    expect(repeated.state).toBe(first.state)
    expect(describeDiscovery(repeated)).toContain('já está no arquivo')
    expect(ignored.outcome).toBe('ignored')
    expect(ignored.state).toBe(first.state)
  })

  it('completes exactly when the third unique signal is registered', () => {
    const first = recordDiscovery(createDiscoveryProgress(), 'secret-997', 10)
    const second = recordDiscovery(first.state, 'secret-mersenne', 20)
    const completed = recordDiscovery(second.state, 'secret-constellation', 30)

    expect(completed.outcome).toBe('completed')
    expect(completed.state.completedAt).toBe(30)
    expect(completed.next).toBeNull()
    expect(isDiscoveryComplete(completed.state)).toBe(true)
    expect(describeDiscovery(completed)).toContain('EMBLEMA IRREDUTÍVEL')
  })

  it('round-trips safe session data and discards malformed values', () => {
    const progress = DISCOVERY_IDS.reduce(
      (state, id, index) => recordDiscovery(state, id, index + 100).state,
      createDiscoveryProgress(),
    )
    expect(restoreDiscoveryProgress(serializeDiscoveryProgress(progress))).toEqual(progress)
    expect(restoreDiscoveryProgress('{broken')).toEqual(createDiscoveryProgress())
    expect(restoreDiscoveryProgress(JSON.stringify({
      version: 1,
      discovered: ['secret-997', 'secret-997', 'not-a-secret'],
      completedAt: 999,
    }))).toEqual({ discovered: ['secret-997'], completedAt: null })
    expect(restoreDiscoveryProgress(JSON.stringify({ version: 2, discovered: DISCOVERY_IDS }))).toEqual(createDiscoveryProgress())
  })
})
