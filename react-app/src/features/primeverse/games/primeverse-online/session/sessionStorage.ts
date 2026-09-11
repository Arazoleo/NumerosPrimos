import {
  AVATAR_ACCENT_COLORS,
  AVATAR_BODY_COLORS,
  isAvatarAppearance,
  isResumeToken,
  sanitizeNickname,
  type AvatarAppearance,
} from '../shared/protocol'

export interface SessionIdentity {
  readonly nickname: string
  readonly appearance: AvatarAppearance
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const PRIMEVERSE_IDENTITY_KEY = 'primeverse:online-identity'
export const PRIMEVERSE_ACTIVE_SESSION_KEY = 'primeverse:online-active-session'
export const PRIMEVERSE_RESUME_TOKEN_KEY = 'primeverse:online-resume-token'

export function createDefaultSessionIdentity(): SessionIdentity {
  return {
    nickname: '',
    appearance: {
      bodyColor: AVATAR_BODY_COLORS[0],
      accentColor: AVATAR_ACCENT_COLORS[0],
      visorColor: AVATAR_ACCENT_COLORS[2],
      visorStyle: 'slit',
      auraStyle: 'orbit',
      accentStyle: 'prime',
    },
  }
}

function localStorageOrNull(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function sessionStorageOrNull(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function readPrimeverseIdentity(
  storage: StorageLike | null = localStorageOrNull(),
): SessionIdentity {
  const fallback = createDefaultSessionIdentity()
  if (!storage) return fallback
  try {
    const value: unknown = JSON.parse(storage.getItem(PRIMEVERSE_IDENTITY_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return fallback
    const candidate = value as Partial<SessionIdentity>
    const nickname = sanitizeNickname(candidate.nickname)
    if (!nickname.ok || !isAvatarAppearance(candidate.appearance)) return fallback
    return { nickname: nickname.value, appearance: candidate.appearance }
  } catch {
    return fallback
  }
}

export function persistPrimeverseIdentity(
  identity: SessionIdentity,
  storage: StorageLike | null = localStorageOrNull(),
): void {
  if (!storage) return
  try {
    storage.setItem(PRIMEVERSE_IDENTITY_KEY, JSON.stringify(identity))
  } catch {
    // Browsers may expose Storage while denying writes in private contexts.
  }
}

export function readActivePrimeverseSession(
  identityStorage: StorageLike | null = localStorageOrNull(),
  activeStorage: StorageLike | null = sessionStorageOrNull(),
): SessionIdentity | null {
  if (!activeStorage) return null
  try {
    if (activeStorage.getItem(PRIMEVERSE_ACTIVE_SESSION_KEY) !== 'true') return null
  } catch {
    return null
  }
  const identity = readPrimeverseIdentity(identityStorage)
  return identity.nickname ? identity : null
}

export function markPrimeverseSessionActive(
  storage: StorageLike | null = sessionStorageOrNull(),
): void {
  if (!storage) return
  try {
    storage.setItem(PRIMEVERSE_ACTIVE_SESSION_KEY, 'true')
  } catch {
    // Session persistence is an enhancement; the live session still works.
  }
}

export function clearPrimeverseSessionStorage(
  storage: StorageLike | null = sessionStorageOrNull(),
): void {
  if (!storage) return
  try {
    storage.removeItem(PRIMEVERSE_ACTIVE_SESSION_KEY)
    storage.removeItem(PRIMEVERSE_RESUME_TOKEN_KEY)
  } catch {
    // Explicit leave still tears down the in-memory client below the Provider.
  }
}

export function isPrimeverseResumeToken(value: unknown): value is string {
  return isResumeToken(value)
}

export function readPrimeverseResumeToken(
  storage: StorageLike | null = sessionStorageOrNull(),
): string | null {
  if (!storage) return null
  try {
    const token = storage.getItem(PRIMEVERSE_RESUME_TOKEN_KEY)
    return isPrimeverseResumeToken(token) ? token : null
  } catch {
    return null
  }
}

export function persistPrimeverseResumeToken(
  token: string | null,
  storage: StorageLike | null = sessionStorageOrNull(),
): void {
  if (!storage) return
  try {
    if (isPrimeverseResumeToken(token)) storage.setItem(PRIMEVERSE_RESUME_TOKEN_KEY, token)
    else storage.removeItem(PRIMEVERSE_RESUME_TOKEN_KEY)
  } catch {
    // Reconnect remains available for the lifetime of the in-memory client.
  }
}
