import type { Position2D } from './gameLogic'

export type DrawerContent = 'fragment' | 'battery' | 'empty' | 'noise' | 'tool' | 'medkit'

export interface CabinetDrawer {
  readonly id: string
  readonly content: DrawerContent
  /** Flavour text shown when the drawer is pulled open. */
  readonly text: string
  /** Item id granted by a 'tool' drawer, e.g. the Caesar cipher disc. */
  readonly tool?: string
}

export interface CabinetDefinition {
  readonly id: string
  readonly position: Position2D
  /** Facing, in radians: the drawers slide towards +Z rotated by this angle. */
  readonly rotation: number
  readonly drawers: readonly CabinetDrawer[]
}

export interface DrawerOpenResult {
  readonly drawer: CabinetDrawer | null
  readonly openedDrawers: readonly string[]
  readonly message: string
  /** Pulling a drawer is loud: entities investigate this position. */
  readonly noise: number
}

export const CABINET_INTERACTION_DISTANCE = 2.4
/** How far a drawer can be heard, in world units. */
export const DRAWER_NOISE_RADIUS = 22

export function cabinetAt(
  cabinets: readonly CabinetDefinition[],
  player: Position2D,
  maximumDistance = CABINET_INTERACTION_DISTANCE,
): CabinetDefinition | null {
  let closest: CabinetDefinition | null = null
  let closestDistance = maximumDistance
  for (const cabinet of cabinets) {
    const distance = Math.hypot(cabinet.position.x - player.x, cabinet.position.z - player.z)
    if (distance <= closestDistance) {
      closest = cabinet
      closestDistance = distance
    }
  }
  return closest
}

export function nextClosedDrawer(
  cabinet: CabinetDefinition,
  openedDrawers: readonly string[],
): CabinetDrawer | null {
  return cabinet.drawers.find((drawer) => !openedDrawers.includes(drawer.id)) ?? null
}

export function drawerPrompt(
  cabinet: CabinetDefinition,
  openedDrawers: readonly string[],
): string | null {
  const opened = cabinet.drawers.filter((drawer) => openedDrawers.includes(drawer.id)).length
  if (opened >= cabinet.drawers.length) return null
  return `E  PUXAR GAVETA ${opened + 1}/${cabinet.drawers.length}`
}

/**
 * Opens the next closed drawer of a cabinet. Drawers are pulled in order, one
 * interaction each, so searching a cabinet is a deliberate, noisy act.
 */
export function openNextDrawer(
  cabinet: CabinetDefinition,
  openedDrawers: readonly string[],
): DrawerOpenResult {
  const drawer = nextClosedDrawer(cabinet, openedDrawers)
  if (!drawer) {
    return {
      drawer: null,
      openedDrawers,
      message: 'Todas as gavetas deste armário já foram reviradas.',
      noise: 0,
    }
  }
  return {
    drawer,
    openedDrawers: [...openedDrawers, drawer.id],
    message: drawer.text,
    noise: drawer.content === 'noise' ? 1 : 0.55,
  }
}

export function toolsInDrawers(
  cabinets: readonly CabinetDefinition[],
  openedDrawers: readonly string[],
): readonly string[] {
  return cabinets.flatMap((cabinet) => cabinet.drawers
    .filter((drawer) => drawer.content === 'tool' && drawer.tool && openedDrawers.includes(drawer.id))
    .map((drawer) => drawer.tool as string))
}

export function countFragments(
  cabinets: readonly CabinetDefinition[],
  openedDrawers: readonly string[],
): number {
  return cabinets.reduce((total, cabinet) => total + cabinet.drawers.filter(
    (drawer) => drawer.content === 'fragment' && openedDrawers.includes(drawer.id),
  ).length, 0)
}
