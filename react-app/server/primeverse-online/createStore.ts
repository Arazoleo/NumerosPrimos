import { MemoryPrimeverseStore } from './memoryStore.js'
import { RedisPrimeverseStore } from './redisStore.js'
import type { PrimeverseStore } from './store.js'
import { UnavailablePrimeverseStore } from './unavailableStore.js'

export interface StoreEnvironment {
  NODE_ENV?: string
  VERCEL?: string
  VERCEL_ENV?: string
  VERCEL_TARGET_ENV?: string
  VERCEL_PROJECT_ID?: string
  VERCEL_GIT_COMMIT_REF?: string
  REDIS_URL?: string
  PRIMEVERSE_REDIS_PREFIX?: string
  PRIMEVERSE_MAX_ROOMS?: string
  PRIMEVERSE_PLAYER_TIMEOUT_MS?: string
}

export function createStoreFromEnvironment(environment: StoreEnvironment = process.env): PrimeverseStore {
  const redisUrl = environment.REDIS_URL?.trim()
  const maxRooms = positiveInteger(environment.PRIMEVERSE_MAX_ROOMS, 100, 1, 1_000)
  const playerTimeoutMs = positiveInteger(environment.PRIMEVERSE_PLAYER_TIMEOUT_MS, 45_000, 15_000, 180_000)
  if (redisUrl) {
    return new RedisPrimeverseStore({
      url: redisUrl,
      roomCapacity: 20,
      maxRooms,
      playerTimeoutMs,
      keyPrefix: deriveRedisKeyPrefix(environment),
    })
  }

  const production = environment.NODE_ENV === 'production' || environment.VERCEL === '1'
  if (!production) return new MemoryPrimeverseStore({ roomCapacity: 20, maxRooms, playerTimeoutMs })

  return new UnavailablePrimeverseStore(
    'REDIS_URL é obrigatório em produção para presença, salas e eventos multi-instância.',
  )
}

/** Keeps local, preview branches and production from sharing presence channels by default. */
export function deriveRedisKeyPrefix(environment: StoreEnvironment): string {
  const explicit = environment.PRIMEVERSE_REDIS_PREFIX?.trim()
  if (explicit) return explicit

  const project = namespacePart(environment.VERCEL_PROJECT_ID, 'numeros-primos')
  const target = namespacePart(
    environment.VERCEL_TARGET_ENV ?? environment.VERCEL_ENV ?? environment.NODE_ENV,
    'development',
  )
  const branch = (environment.VERCEL_ENV === 'preview' || target === 'preview')
    ? namespacePart(environment.VERCEL_GIT_COMMIT_REF, 'preview')
    : null
  return ['primeverse', 'v1', project, target, branch].filter(Boolean).join(':')
}

function positiveInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

function namespacePart(raw: string | undefined, fallback: string): string {
  const normalized = raw
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}
