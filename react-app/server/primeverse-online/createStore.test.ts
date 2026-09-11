import { describe, expect, it } from 'vitest'
import { deriveRedisKeyPrefix } from './createStore.js'

describe('Primeverse Redis namespace', () => {
  it('separates production from preview branches by default', () => {
    const base = { VERCEL_PROJECT_ID: 'prj_primeverse' }
    expect(deriveRedisKeyPrefix({ ...base, VERCEL_ENV: 'production' }))
      .toBe('primeverse:v1:prj_primeverse:production')
    expect(deriveRedisKeyPrefix({
      ...base,
      VERCEL_ENV: 'preview',
      VERCEL_GIT_COMMIT_REF: 'feature/online-world',
    })).toBe('primeverse:v1:prj_primeverse:preview:feature-online-world')
  })

  it('honors an explicit namespace', () => {
    expect(deriveRedisKeyPrefix({ PRIMEVERSE_REDIS_PREFIX: 'my-game:staging' }))
      .toBe('my-game:staging')
  })
})
