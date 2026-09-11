import { PORTAL_ROUTES, REALMS, realmForPosition } from './shared/realms'

export type Vec3Tuple = readonly [number, number, number]

export interface CircleCollider {
  readonly x: number
  readonly z: number
  readonly radius: number
}

export interface BoxCollider {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export interface OnlineLandmark {
  readonly id: string
  readonly name: string
  readonly shortName: string
  readonly position: Vec3Tuple
  readonly accent: string
}

export const ONLINE_SPAWN: Vec3Tuple = REALMS[0].spawn
export const WORLD_RADIUS = 44
export const VOID_LEVEL = -8

export const ONLINE_LANDMARKS: readonly OnlineLandmark[] = [
  { id: 'spawn', name: 'Praça de Spawn', shortName: 'SPAWN', position: [0, 0, 13], accent: '#6cf6ff' },
  { id: 'core', name: 'Núcleo Primo', shortName: 'CORE', position: [0, 0, 0], accent: '#a97cff' },
  { id: 'garden', name: 'Jardim Primo', shortName: 'GARDEN', position: [-21, 0, -5], accent: '#70ffb1' },
  { id: 'temple', name: 'Templo dos Fatores', shortName: 'FACTOR', position: [21, 0, -5], accent: '#ffba6c' },
  { id: 'tower', name: 'Torre de Ulam', shortName: 'ULAM', position: [-18, 0, -24], accent: '#ff6ec7' },
  { id: 'arch', name: 'Arco Criptográfico', shortName: 'CRYPTO', position: [18, 0, -24], accent: '#69a9ff' },
  { id: 'observatory', name: 'Observatório', shortName: 'OBS.', position: [0, 0, -35], accent: '#c2d2ff' },
  { id: 'void', name: 'Plataforma do Vazio', shortName: 'VOID', position: [0, 0, 31], accent: '#ff557f' },
] as const

export const PEDESTALS = [
  { value: 12, position: [-3.45, 0, 17.5] as Vec3Tuple },
  { value: 13, position: [-1.15, 0, 19.2] as Vec3Tuple },
  { value: 15, position: [1.15, 0, 19.2] as Vec3Tuple },
  { value: 17, position: [3.45, 0, 17.5] as Vec3Tuple },
] as const

export const SECRET_POINTS = [
  { id: 'secret-997', label: '997', position: [-23.6, 1.2, -9.3] as Vec3Tuple },
  { id: 'secret-mersenne', label: '2³¹−1', position: [20.6, 1.5, -28.1] as Vec3Tuple },
  { id: 'secret-constellation', label: 'constelação prima', position: [0, 1, -39] as Vec3Tuple },
] as const

export const CIRCLE_COLLIDERS: readonly CircleCollider[] = [
  { x: 0, z: 0, radius: 3.35 },
  { x: -21, z: -5, radius: 2.5 },
  { x: -18, z: -24, radius: 3.2 },
  { x: 0, z: -35, radius: 3.4 },
] as const

export const BOX_COLLIDERS: readonly BoxCollider[] = [
  { minX: 17.2, maxX: 24.8, minZ: -8.2, maxZ: -1.9 },
  { minX: 14.6, maxX: 21.5, minZ: -26.7, maxZ: -21.1 },
] as const

function collidesCircle(x: number, z: number, playerRadius: number, collider: CircleCollider): boolean {
  const dx = x - collider.x
  const dz = z - collider.z
  const radius = playerRadius + collider.radius
  return dx * dx + dz * dz < radius * radius
}

function collidesBox(x: number, z: number, playerRadius: number, collider: BoxCollider): boolean {
  const closestX = Math.max(collider.minX, Math.min(x, collider.maxX))
  const closestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ))
  const dx = x - closestX
  const dz = z - closestZ
  return dx * dx + dz * dz < playerRadius * playerRadius
}

export function resolveOnlineCollision(
  previous: Vec3Tuple,
  requested: Vec3Tuple,
  playerRadius = 0.42,
): [number, number, number] {
  let x = requested[0]
  let z = requested[2]
  const y = requested[1]

  const collides = (testX: number, testZ: number) => (
    CIRCLE_COLLIDERS.some((collider) => collidesCircle(testX, testZ, playerRadius, collider))
    || BOX_COLLIDERS.some((collider) => collidesBox(testX, testZ, playerRadius, collider))
  )

  if (collides(x, previous[2])) x = previous[0]
  if (collides(x, z)) z = previous[2]
  return [x, y, z]
}

export function nearestInteraction(position: Vec3Tuple): { id: string; label: string; distance: number } | null {
  let best: { id: string; label: string; distance: number } | null = null
  const add = (id: string, label: string, point: Vec3Tuple, reach: number) => {
    const distance = Math.hypot(position[0] - point[0], position[1] - point[1], position[2] - point[2])
    if (distance <= reach && (!best || distance < best.distance)) best = { id, label, distance }
  }

  for (const pedestal of PEDESTALS) {
    add(`pedestal-${pedestal.value}`, `votar em ${pedestal.value}`, pedestal.position, 2.35)
  }
  for (const secret of SECRET_POINTS) add(secret.id, `decifrar ${secret.label}`, secret.position, 2.2)
  for (const portal of Object.values(PORTAL_ROUTES)) {
    if (portal.fromRealm === 'nexus') {
      const destination = portal.displayName ?? REALMS.find((realm) => realm.id === portal.toRealm)?.name ?? portal.label
      add(portal.id, `abrir ${destination} · jogo independente`, portal.source, 2.6)
    }
  }
  add('prime-core', 'sincronizar com o Núcleo Primo', [0, 1.6, 0], 5.2)
  return best
}

export function isInsideOnlineWorld(position: Vec3Tuple, margin = 0): boolean {
  if (!Number.isFinite(margin)) return false
  const nexus = REALMS[0]
  return Math.hypot(position[0] - nexus.center[0], position[2] - nexus.center[2])
    <= Math.max(0, nexus.radius - margin)
}

export function onlineLocationName(position: Vec3Tuple): string {
  const realm = realmForPosition(position)
  if (!realm || realm.id !== 'nexus') return 'Fora do Nexus'

  let closest = ONLINE_LANDMARKS[0]
  let closestDistance = Number.POSITIVE_INFINITY
  for (const landmark of ONLINE_LANDMARKS) {
    const distance = Math.hypot(position[0] - landmark.position[0], position[2] - landmark.position[2])
    if (distance < closestDistance) {
      closest = landmark
      closestDistance = distance
    }
  }
  return closest.name
}

export function isPrime(value: number): boolean {
  if (value < 2 || !Number.isInteger(value)) return false
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) {
    if (value % divisor === 0) return false
  }
  return true
}
