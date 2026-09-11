export const DISCOVERY_IDS = [
  'secret-997',
  'secret-mersenne',
  'secret-constellation',
] as const

export type DiscoveryId = (typeof DISCOVERY_IDS)[number]

export interface DiscoveryRecord {
  readonly id: DiscoveryId
  readonly title: string
  readonly location: string
  readonly fact: string
  readonly clue: string
}

export const DISCOVERY_RECORDS: Readonly<Record<DiscoveryId, DiscoveryRecord>> = {
  'secret-997': {
    id: 'secret-997',
    title: 'Relíquia 997',
    location: 'Jardim Primo',
    fact: 'O maior primo de três algarismos.',
    clue: 'Procure um brilho dourado entre as estruturas do Jardim Primo.',
  },
  'secret-mersenne': {
    id: 'secret-mersenne',
    title: 'Selo de Mersenne',
    location: 'Arco Criptográfico',
    fact: '2³¹−1 também é primo: 2.147.483.647.',
    clue: 'Atravesse o Arco Criptográfico e investigue suas bordas.',
  },
  'secret-constellation': {
    id: 'secret-constellation',
    title: 'Carta Irredutível',
    location: 'Observatório',
    fact: 'As estrelas primas formam uma constelação irredutível.',
    clue: 'Siga para o ponto mais distante do Observatório.',
  },
}

export interface DiscoveryProgress {
  readonly discovered: readonly DiscoveryId[]
  readonly completedAt: number | null
}

export type DiscoveryOutcome = 'new' | 'repeated' | 'completed' | 'ignored'

export interface DiscoveryResult {
  readonly state: DiscoveryProgress
  readonly outcome: DiscoveryOutcome
  readonly record: DiscoveryRecord | null
  readonly next: DiscoveryRecord | null
}

interface StoredDiscoveryProgress {
  readonly version: 1
  readonly discovered: readonly DiscoveryId[]
  readonly completedAt: number | null
}

export const DISCOVERY_STORAGE_KEY = 'primeverse-online:discoveries:v1'

export function createDiscoveryProgress(): DiscoveryProgress {
  return { discovered: [], completedAt: null }
}

export function isDiscoveryId(value: unknown): value is DiscoveryId {
  return typeof value === 'string' && DISCOVERY_IDS.some((id) => id === value)
}

export function nextDiscovery(progress: DiscoveryProgress): DiscoveryRecord | null {
  const nextId = DISCOVERY_IDS.find((id) => !progress.discovered.includes(id))
  return nextId ? DISCOVERY_RECORDS[nextId] : null
}

export function isDiscoveryComplete(progress: DiscoveryProgress): boolean {
  return DISCOVERY_IDS.every((id) => progress.discovered.includes(id))
}

export function recordDiscovery(
  progress: DiscoveryProgress,
  candidate: string,
  discoveredAt = Date.now(),
): DiscoveryResult {
  if (!isDiscoveryId(candidate)) {
    return { state: progress, outcome: 'ignored', record: null, next: nextDiscovery(progress) }
  }

  const record = DISCOVERY_RECORDS[candidate]
  if (progress.discovered.includes(candidate)) {
    return { state: progress, outcome: 'repeated', record, next: nextDiscovery(progress) }
  }

  const discovered = DISCOVERY_IDS.filter((id) => id === candidate || progress.discovered.includes(id))
  const completed = discovered.length === DISCOVERY_IDS.length
  const state: DiscoveryProgress = {
    discovered,
    completedAt: completed && progress.completedAt === null ? discoveredAt : progress.completedAt,
  }

  return {
    state,
    outcome: completed ? 'completed' : 'new',
    record,
    next: nextDiscovery(state),
  }
}

export function describeDiscovery(result: DiscoveryResult): string {
  if (result.outcome === 'ignored' || !result.record) return 'Sinal desconhecido ignorado.'
  const count = result.state.discovered.length
  if (result.outcome === 'completed') {
    return `ARQUIVO PRIMO COMPLETO ✦ ${result.record.title}: ${result.record.fact} EMBLEMA IRREDUTÍVEL desbloqueado.`
  }
  if (result.outcome === 'repeated') {
    return `${result.record.title} já está no arquivo · ${count}/${DISCOVERY_IDS.length}.`
  }
  return `${result.record.title} registrada · ${count}/${DISCOVERY_IDS.length}. ${result.record.fact} Próximo sinal: ${result.next?.location ?? 'arquivo completo'}.`
}

export function serializeDiscoveryProgress(progress: DiscoveryProgress): string {
  const payload: StoredDiscoveryProgress = {
    version: 1,
    discovered: DISCOVERY_IDS.filter((id) => progress.discovered.includes(id)),
    completedAt: Number.isFinite(progress.completedAt) && (progress.completedAt ?? -1) >= 0
      ? progress.completedAt
      : null,
  }
  return JSON.stringify(payload)
}

export function restoreDiscoveryProgress(raw: string | null): DiscoveryProgress {
  if (!raw) return createDiscoveryProgress()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1) {
      return createDiscoveryProgress()
    }
    const values = 'discovered' in parsed && Array.isArray(parsed.discovered)
      ? parsed.discovered
      : []
    const discovered = DISCOVERY_IDS.filter((id) => values.includes(id))
    const completedAt = 'completedAt' in parsed
      && typeof parsed.completedAt === 'number'
      && Number.isFinite(parsed.completedAt)
      && parsed.completedAt >= 0
      ? parsed.completedAt
      : null
    return { discovered, completedAt: discovered.length === DISCOVERY_IDS.length ? completedAt : null }
  } catch {
    return createDiscoveryProgress()
  }
}
