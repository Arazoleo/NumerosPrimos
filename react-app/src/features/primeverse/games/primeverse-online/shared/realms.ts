export type RealmId = 'nexus' | 'ulam-run' | 'factor-forge' | 'sieve-catacombs'

export type RealmPosition = readonly [number, number, number]

export interface RealmDefinition {
  readonly id: RealmId
  readonly name: string
  readonly subtitle: string
  readonly center: RealmPosition
  readonly spawn: RealmPosition
  readonly radius: number
  readonly accent: string
}

export const REALMS: readonly RealmDefinition[] = Object.freeze([
  {
    id: 'nexus',
    name: 'Nexus Primo',
    subtitle: 'MUNDO CENTRAL',
    center: [0, 0, 0],
    spawn: [0, 0.04, 13],
    radius: 44,
    accent: '#65efff',
  },
  {
    id: 'ulam-run',
    name: 'Fenda de Ulam',
    subtitle: 'CORRIDA DOS IRREDUTÍVEIS',
    center: [72, 0, 0],
    spawn: [72, 0.04, 10],
    radius: 19,
    accent: '#ff6ec7',
  },
  {
    id: 'factor-forge',
    name: 'Forja de Euclides',
    subtitle: 'REATOR DE FATORAÇÃO',
    center: [-72, 0, 0],
    spawn: [-72, 0.04, 10],
    radius: 19,
    accent: '#ffba6c',
  },
  {
    id: 'sieve-catacombs',
    name: 'Cripta do Crivo',
    subtitle: 'EXPEDIÇÃO DE TERROR',
    center: [0, 0, -104],
    spawn: [0, 0.04, -93.5],
    radius: 22,
    accent: '#9bf0bd',
  },
])

export const PORTAL_IDS = [
  'portal-ulam',
  'portal-forge',
  'portal-nexus-ulam',
  'portal-nexus-forge',
  'portal-catacombs',
  'portal-nucleus',
  'portal-nexus-catacombs',
  'portal-primebound',
] as const

export type PortalId = (typeof PORTAL_IDS)[number]

export interface PortalRoute {
  readonly id: PortalId
  readonly fromRealm: RealmId
  readonly toRealm: RealmId
  readonly source: RealmPosition
  readonly destination: RealmPosition
  readonly label: string
  readonly displayName?: string
  readonly accent: string
}

export const PORTAL_ROUTES: Readonly<Record<PortalId, PortalRoute>> = Object.freeze({
  'portal-ulam': {
    id: 'portal-ulam',
    fromRealm: 'nexus',
    toRealm: 'ulam-run',
    source: [-18, 0.04, -19.4],
    destination: [72, 0.04, 10],
    label: 'viajar para a Fenda de Ulam',
    accent: '#ff6ec7',
  },
  'portal-forge': {
    id: 'portal-forge',
    fromRealm: 'nexus',
    toRealm: 'factor-forge',
    source: [15.1, 0.04, -5],
    destination: [-72, 0.04, 10],
    label: 'viajar para a Forja de Euclides',
    accent: '#ffba6c',
  },
  'portal-nexus-ulam': {
    id: 'portal-nexus-ulam',
    fromRealm: 'ulam-run',
    toRealm: 'nexus',
    source: [72, 0.04, 15.2],
    destination: [-18, 0.04, -18.2],
    label: 'retornar ao Nexus Primo',
    accent: '#65efff',
  },
  'portal-nexus-forge': {
    id: 'portal-nexus-forge',
    fromRealm: 'factor-forge',
    toRealm: 'nexus',
    source: [-72, 0.04, 15.2],
    destination: [14, 0.04, -5],
    label: 'retornar ao Nexus Primo',
    accent: '#65efff',
  },
  'portal-catacombs': {
    id: 'portal-catacombs',
    fromRealm: 'nexus',
    toRealm: 'sieve-catacombs',
    source: [0, 0.04, -30.5],
    destination: [0, 0.04, -93.5],
    label: 'descer à Cripta do Crivo',
    accent: '#9bf0bd',
  },
  'portal-nucleus': {
    id: 'portal-nucleus',
    fromRealm: 'nexus',
    toRealm: 'nexus',
    source: [18, 0.04, -19.4],
    destination: [17, 0.04, -18.2],
    label: 'entrar no Núcleo 257',
    displayName: 'Núcleo 257',
    accent: '#58f5b5',
  },
  'portal-primebound': {
    id: 'portal-primebound',
    fromRealm: 'nexus',
    toRealm: 'nexus',
    source: [18, 0.04, -19.4],
    destination: [0, 0.04, 13],
    label: 'viajar para Primebound: O Último Primo',
    accent: '#f2c15c',
  },
  'portal-nexus-catacombs': {
    id: 'portal-nexus-catacombs',
    fromRealm: 'sieve-catacombs',
    toRealm: 'nexus',
    source: [0, 0.04, -87],
    destination: [0, 0.04, -29],
    label: 'escapar para o Nexus Primo',
    accent: '#65efff',
  },
})

export function realmForPosition(position: RealmPosition): RealmDefinition | null {
  let closest: RealmDefinition | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const realm of REALMS) {
    const distance = Math.hypot(position[0] - realm.center[0], position[2] - realm.center[2])
    if (distance <= realm.radius && distance < closestDistance) {
      closest = realm
      closestDistance = distance
    }
  }
  return closest
}

export function isInsideRealm(position: RealmPosition, margin = 0): boolean {
  if (!Number.isFinite(margin)) return false
  return REALMS.some((realm) => (
    Math.hypot(position[0] - realm.center[0], position[2] - realm.center[2])
      <= Math.max(0, realm.radius - margin)
  ))
}
