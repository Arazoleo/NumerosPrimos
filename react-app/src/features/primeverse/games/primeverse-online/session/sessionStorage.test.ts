import { describe, expect, it } from 'vitest'

import {
  PRIMEVERSE_ACTIVE_SESSION_KEY,
  PRIMEVERSE_IDENTITY_KEY,
  PRIMEVERSE_RESUME_TOKEN_KEY,
  clearPrimeverseSessionStorage,
  markPrimeverseSessionActive,
  persistPrimeverseIdentity,
  persistPrimeverseResumeToken,
  readActivePrimeverseSession,
  readPrimeverseIdentity,
  readPrimeverseResumeToken,
} from './sessionStorage'

class MemoryStorage {
  private readonly entries = new Map<string, string>()

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value)
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }
}

const IDENTITY = {
  nickname: 'Léo 13',
  appearance: {
    bodyColor: '#172b3a' as const,
    accentColor: '#5ceee5' as const,
    visorColor: '#f0c35a' as const,
    visorStyle: 'slit' as const,
    auraStyle: 'orbit' as const,
    accentStyle: 'prime' as const,
  },
}

describe('Primeverse session storage', () => {
  it('keeps identity in local storage while active state lives in session storage', () => {
    const local = new MemoryStorage()
    const session = new MemoryStorage()

    persistPrimeverseIdentity(IDENTITY, local)
    markPrimeverseSessionActive(session)

    expect(readPrimeverseIdentity(local)).toEqual(IDENTITY)
    expect(readActivePrimeverseSession(local, session)).toEqual(IDENTITY)
    expect(local.getItem(PRIMEVERSE_IDENTITY_KEY)).not.toBeNull()
    expect(session.getItem(PRIMEVERSE_ACTIVE_SESSION_KEY)).toBe('true')
  })

  it('rejects malformed identities and refuses to revive an inactive session', () => {
    const local = new MemoryStorage()
    const session = new MemoryStorage()
    local.setItem(PRIMEVERSE_IDENTITY_KEY, JSON.stringify({
      nickname: '<script>',
      appearance: IDENTITY.appearance,
    }))

    expect(readPrimeverseIdentity(local).nickname).toBe('')
    expect(readActivePrimeverseSession(local, session)).toBeNull()
  })

  it('restores only bounded opaque resume tokens and clears them on explicit leave', () => {
    const session = new MemoryStorage()
    const token = 'resume_token_1234567890'

    persistPrimeverseResumeToken(token, session)
    markPrimeverseSessionActive(session)
    expect(readPrimeverseResumeToken(session)).toBe(token)

    session.setItem(PRIMEVERSE_RESUME_TOKEN_KEY, '../not-a-token')
    expect(readPrimeverseResumeToken(session)).toBeNull()

    persistPrimeverseResumeToken(token, session)
    clearPrimeverseSessionStorage(session)
    expect(session.getItem(PRIMEVERSE_ACTIVE_SESSION_KEY)).toBeNull()
    expect(session.getItem(PRIMEVERSE_RESUME_TOKEN_KEY)).toBeNull()
  })
})
