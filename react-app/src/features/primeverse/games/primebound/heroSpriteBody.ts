import type { HeroClassDefinition } from './heroClassSystem'
import type { Direction } from './types'

/**
 * Single source of truth for hero sprite geometry. The canvas renderer
 * (PrimeboundGame's drawHeroBody) and the SVG renderer (HeroSprite, used by
 * the origin films) both consume heroBodyRects, so an art upgrade here lands
 * everywhere at once.
 *
 * Art language: 1px contour behind every mass, two-tone shading lit from the
 * top-left, one specular glint per material, idle breathing, and one animated
 * signature detail per archetype.
 */

export interface SpriteRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly color: string
}

export interface HeroBodyPose {
  readonly time: number
  readonly moving: boolean
  readonly attacking: boolean
  readonly dashing: boolean
  readonly casting: boolean
  readonly ascended: boolean
}

/* ------------------------------------------------------------ color tools */

const shadeCache = new Map<string, string>()

/** Lightens (amount > 0) or darkens (amount < 0) a #rrggbb color. */
export function shade(hex: string, amount: number): string {
  const key = `${hex}:${amount}`
  const cached = shadeCache.get(key)
  if (cached) return cached
  const value = hex.startsWith('#') && hex.length === 7 ? hex : '#888888'
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16)
    const next = amount >= 0
      ? channel + (255 - channel) * (amount / 100)
      : channel * (1 + amount / 100)
    return Math.max(0, Math.min(255, Math.round(next)))
  })
  const result = `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
  shadeCache.set(key, result)
  return result
}

const OUTLINE = '#07060c'
const SOLE = '#04060a'

/* -------------------------------------------------------------- assembler */

interface BuildContext {
  readonly rects: SpriteRect[]
  /** Rects only drawn when the face is visible (not facing up). */
  readonly frontRects: SpriteRect[]
  push(x: number, y: number, w: number, h: number, color: string): void
  front(x: number, y: number, w: number, h: number, color: string): void
}

function createBuild(): BuildContext {
  const rects: SpriteRect[] = []
  const frontRects: SpriteRect[] = []
  return {
    rects,
    frontRects,
    push(x, y, w, h, color) {
      rects.push({ x, y, w, h, color })
    },
    front(x, y, w, h, color) {
      frontRects.push({ x, y, w, h, color })
    },
  }
}

/** Legs with contour, shaded back leg, boot soles and stride animation. */
function buildLegs(build: BuildContext, primary: string, shadow: string, stride: number): void {
  const backDrop = Math.max(0, stride)
  const frontDrop = Math.max(0, -stride)
  build.push(-8, 1 + backDrop, 7, 12, OUTLINE)
  build.push(1, 1 + frontDrop, 7, 12, OUTLINE)
  build.push(-7, 1 + backDrop, 5, 8, shade(primary, -30))
  build.push(2, 1 + frontDrop, 5, 8, primary)
  build.push(2, 1 + frontDrop, 2, 3, shade(primary, 18))
  build.push(-8, 8 + backDrop, 7, 4, shade(shadow, -12))
  build.push(1, 8 + frontDrop, 7, 4, shadow)
  build.push(1, 8 + frontDrop, 3, 1, shade(shadow, 30))
  build.push(-8, 11 + backDrop, 7, 2, SOLE)
  build.push(1, 11 + frontDrop, 7, 2, SOLE)
}

/** Arms with hands; reach pushes the leading arm forward on attacks. */
function buildArms(build: BuildContext, primary: string, skin: string, reach: number): void {
  build.push(-11, -8, 5, 12, OUTLINE)
  build.push(6 + reach, -8, 5, 12, OUTLINE)
  build.push(-10, -7, 4, 10, shade(primary, -24))
  build.push(6 + reach, -7, 4, 10, primary)
  build.push(6 + reach, -7, 2, 3, shade(primary, 16))
  build.push(-9, 2, 3, 3, shade(skin, -14))
  build.push(6 + reach, 2, 3, 3, skin)
}

/** Head base: contour, skin with cheek shading, brow line. Hair per hero. */
function buildHead(build: BuildContext, skin: string, breath: number): void {
  build.push(-7, -20 - breath, 14, 12, OUTLINE)
  build.push(-6, -18 - breath, 12, 10, skin)
  build.push(-6, -18 - breath, 12, 2, shade(skin, 14))
  build.push(-6, -10 - breath, 12, 2, shade(skin, -16))
}

function buildEyes(
  build: BuildContext,
  breath: number,
  color: string,
  glint = '#ffffff',
): void {
  build.front(-4, -15 - breath, 3, 2, color)
  build.front(2, -15 - breath, 3, 2, color)
  build.front(-3, -15 - breath, 1, 1, glint)
  build.front(3, -15 - breath, 1, 1, glint)
}

/* --------------------------------------------------------------- heroes */

type ArchetypeBuilder = (
  build: BuildContext,
  hero: HeroClassDefinition,
  pose: HeroBodyPose,
  breath: number,
  stride: number,
) => void

const buildWarrior: ArchetypeBuilder = (build, hero, pose, breath) => {
  const p = hero.palette
  const wave = Math.floor(pose.time / 260) % 2
  // Torn crimson scarf, waving behind him.
  build.push(-13 - wave, -10, 7, 4, shade(p.secondary, -10))
  build.push(-15 - wave * 2, -7, 6, 3, p.secondary)
  build.push(-16 - wave, -4 + wave, 4, 3, shade(p.secondary, -22))
  // The greatsword sheathed across his back.
  build.push(-12, -22, 3, 22, OUTLINE)
  build.push(-11, -21, 1, 19, '#9aa6b2')
  build.push(-11, -21, 1, 4, '#e8f0f6')
  build.push(-13, -1, 5, 3, shade(p.accent, -20))
  // Armored torso: plate over gambeson, lit from the left.
  build.push(-9, -10 - breath, 18, 15, OUTLINE)
  build.push(-8, -9 - breath, 16, 13, shade(p.primary, -26))
  build.push(-7, -9 - breath, 12, 13, p.primary)
  build.push(-7, -9 - breath, 4, 5, shade(p.primary, 20))
  build.push(-4, -7 - breath, 8, 10, p.accent)
  build.push(-4, -7 - breath, 8, 2, shade(p.accent, 22))
  build.front(-1, -5 - breath, 2, 2, p.energy)
  // Pauldrons with rivets.
  build.push(-11, -10 - breath, 6, 7, OUTLINE)
  build.push(5, -10 - breath, 6, 7, OUTLINE)
  build.push(-10, -9 - breath, 5, 5, '#aeb9c2')
  build.push(6, -9 - breath, 5, 5, '#8d99a5')
  build.push(-10, -9 - breath, 2, 2, '#dfe8ee')
  build.push(-8, -12 - breath, 9, 3, shade(p.secondary, -8))
  // Silver anime hair, spiked, with shine.
  buildHead(build, p.skin, breath)
  build.push(-8, -21 - breath, 15, 5, '#d7e0e4')
  build.push(-9, -19 - breath, 3, 5, '#eff8f5')
  build.push(-4, -24 - breath, 4, 6, '#eff8f5')
  build.push(1, -23 - breath, 3, 5, '#c3d0d6')
  build.push(5, -21 - breath, 4, 5, '#aebcc4')
  build.push(-4, -24 - breath, 2, 2, '#ffffff')
  buildEyes(build, breath, p.energy)
}

const buildCryptographer: ArchetypeBuilder = (build, hero, pose, breath) => {
  const p = hero.palette
  const keyPulse = pose.ascended ? 2 : Math.floor(pose.time / 180) % 2
  const scan = Math.floor(pose.time / 140) % 4
  // Long asymmetric coat with lit hem.
  build.push(-9, -10 - breath, 18, 16, OUTLINE)
  build.push(-8, -9 - breath, 16, 14, p.primary)
  build.push(-8, -9 - breath, 5, 6, shade(p.primary, 18))
  build.push(-8, 3, 7, 7, shade(p.primary, -18))
  build.push(2, 3, 7, 8, p.primary)
  build.push(-5, -8 - breath, 4, 13, p.secondary)
  build.push(1, -8 - breath, 5, 13, '#243669')
  build.push(-1, -7 - breath, 2, 11, p.accent)
  build.push(-1, -7 - breath, 2, 2, shade(p.accent, 30))
  // Hooded head with luminous visor; a scanline sweeps across it.
  buildHead(build, p.skin, breath)
  build.push(-8, -21 - breath, 16, 6, p.shadow)
  build.push(-8, -21 - breath, 16, 2, shade(p.shadow, 22))
  build.push(-8, -18 - breath, 4, 15, p.shadow)
  build.front(-5, -15 - breath, 11, 3, shade(p.energy, -35))
  build.front(-5 + scan * 3, -15 - breath, 3, 3, p.energy)
  build.front(-5 + scan * 3, -15 - breath, 1, 1, '#ffffff')
  // Twin RSA keys orbiting, one gold one cyan, with sparks.
  build.push(-14, -9 - keyPulse, 5, 5, p.energy)
  build.push(-13, -8 - keyPulse, 2, 2, '#ffffff')
  build.push(-13, -4 - keyPulse, 2, 6, p.energy)
  build.push(10, -4 + keyPulse, 5, 5, p.accent)
  build.push(11, -3 + keyPulse, 2, 2, '#fff3d2')
  build.push(11, 1 + keyPulse, 2, 6, p.accent)
}

const buildRanger: ArchetypeBuilder = (build, hero, pose, breath) => {
  const p = hero.palette
  const sway = Math.floor(pose.time / 240) % 3
  // Split cloak, wind-blown.
  build.push(-12, -10, 10, 17, OUTLINE)
  build.push(-11, -9, 9, 15, shade(p.secondary, -14))
  build.push(-11, -9, 4, 15, p.secondary)
  build.push(-13, 4 + sway, 6, 4, shade(p.secondary, -26))
  // Leather huntress torso with belt and buckle.
  build.push(-8, -10 - breath, 16, 15, OUTLINE)
  build.push(-7, -9 - breath, 14, 13, p.primary)
  build.push(-7, -9 - breath, 4, 5, shade(p.primary, 16))
  build.push(-3, -8 - breath, 6, 12, '#17423f')
  build.push(-7, 0, 14, 2, shade(p.shadow, -10))
  build.push(-1, 0, 3, 2, p.accent)
  // Quiver with three fletched arrows.
  build.push(-12, -20, 5, 14, OUTLINE)
  build.push(-11, -19, 3, 12, shade(p.primary, -32))
  build.push(-11, -21, 1, 3, p.accent)
  build.push(-10, -22, 1, 4, shade(p.accent, 22))
  build.push(-9, -21, 1, 3, p.accent)
  // High ponytail, swaying.
  buildHead(build, p.skin, breath)
  build.push(-8, -21 - breath, 16, 5, p.shadow)
  build.push(-7, -21 - breath, 4, 2, shade(p.shadow, 26))
  build.push(5, -20 - breath + sway, 4, 4, p.shadow)
  build.push(7, -16 - breath + sway, 4, 7, shade(p.shadow, -14))
  build.push(8, -9 - breath + sway, 3, 5, shade(p.shadow, -28))
  buildEyes(build, breath, p.energy)
  build.push(5, -8 - breath, 3, 11, p.accent)
  build.push(5, -8 - breath, 3, 2, shade(p.accent, 24))
}

const buildArcanist: ArchetypeBuilder = (build, hero, pose, breath) => {
  const p = hero.palette
  const twinkle = Math.floor(pose.time / 210) % 3
  // Star mantle: wide shoulders with blinking star pixels.
  build.push(-11, -10 - breath, 22, 18, OUTLINE)
  build.push(-10, -9 - breath, 20, 16, shade(p.secondary, -12))
  build.push(-8, -9 - breath, 16, 14, p.secondary)
  build.push(-8, -9 - breath, 6, 4, shade(p.secondary, 16))
  build.push(-6, -9 - breath, 12, 13, p.primary)
  build.push(-2, -7 - breath, 4, 11, '#30204f')
  build.push(-1, -6 - breath, 2, 5, p.energy)
  if (twinkle === 0) build.push(-8, -6 - breath, 1, 1, '#f4eaff')
  if (twinkle === 1) build.push(6, -3 - breath, 1, 1, '#f4eaff')
  if (twinkle === 2) build.push(-7, 1, 1, 1, '#f4eaff')
  // Split sorcerer coat.
  build.push(-8, 5, 7, 7, shade(p.secondary, -22))
  build.push(2, 5, 7, 7, shade(p.secondary, -10))
  // Floating grimoire, bobbing beside him.
  const bookBob = Math.floor(pose.time / 320) % 2
  build.push(10, -12 - bookBob, 6, 5, OUTLINE)
  build.push(11, -11 - bookBob, 4, 3, p.accent)
  build.push(11, -10 - bookBob, 4, 1, '#f4eaff')
  // Short hair with shine + shoulder orbs.
  buildHead(build, p.skin, breath)
  build.push(-7, -21 - breath, 14, 5, p.shadow)
  build.push(-6, -21 - breath, 4, 2, shade(p.shadow, 30))
  build.push(-8, -18 - breath, 3, 5, p.shadow)
  build.push(5, -19 - breath, 3, 4, p.shadow)
  build.push(-11, -11 - breath, 5, 5, p.accent)
  build.push(-10, -10 - breath, 2, 2, '#fff3d2')
  build.push(6, -11 - breath, 5, 5, p.energy)
  build.push(7, -10 - breath, 2, 2, '#ffffff')
  buildEyes(build, breath, '#e7c9ff')
}

const buildAssassin: ArchetypeBuilder = (build, hero, pose, breath) => {
  const p = hero.palette
  const trail = Math.floor(pose.time / 200) % 3
  // Twin Möbius scarf ribbons, trailing with opposite signs.
  build.push(-12 - trail, 2, 12, 4, OUTLINE)
  build.push(-11 - trail, 3, 10, 2, p.secondary)
  build.push(-16 - trail, 6 + trail, 9, 3, shade(p.primary, -8))
  build.front(-15 - trail, 6 + trail, 2, 2, p.energy)
  // Slim hooded silhouette.
  build.push(-7, -11 - breath, 14, 17, OUTLINE)
  build.push(-6, -10 - breath, 12, 15, p.primary)
  build.push(-6, -10 - breath, 4, 6, shade(p.primary, 14))
  build.push(-2, -9 - breath, 4, 13, p.secondary)
  build.push(-2, -9 - breath, 4, 2, shade(p.secondary, 18))
  // Hood with deep shadow and mask.
  buildHead(build, p.skin, breath)
  build.push(-9, -22 - breath, 18, 8, OUTLINE)
  build.push(-8, -21 - breath, 16, 7, p.shadow)
  build.push(-8, -21 - breath, 16, 2, shade(p.shadow, 18))
  build.push(-9, -18 - breath, 4, 10, p.shadow)
  build.push(5, -18 - breath, 4, 13, p.shadow)
  build.front(-5, -16 - breath, 10, 3, '#20122e')
  build.front(-4, -15 - breath, 3, 1, p.energy)
  build.front(2, -15 - breath, 3, 1, p.accent)
  // Opposite-sign daggers: +1 glow and −1 glow.
  build.push(-13, -5, 6, 3, OUTLINE)
  build.push(-12, -4, 5, 1, p.energy)
  build.push(8, -5, 6, 3, OUTLINE)
  build.push(9, -4, 5, 1, p.accent)
}

const buildBerserker: ArchetypeBuilder = (build, hero, pose, breath) => {
  const p = hero.palette
  const flame = Math.floor(pose.time / 160) % 2
  const steam = Math.floor(pose.time / 300) % 2
  // Massive frame: fur-lined shoulders, plated chest.
  build.push(-12, -11 - breath, 24, 18, OUTLINE)
  build.push(-11, -10 - breath, 22, 16, shade(p.shadow, -8))
  build.push(-9, -9 - breath, 18, 15, p.primary)
  build.push(-9, -9 - breath, 6, 5, shade(p.primary, 16))
  build.push(-5, -9 - breath, 10, 13, p.secondary)
  build.push(-5, -9 - breath, 10, 2, shade(p.secondary, 16))
  build.front(-2, -5 - breath, 4, 4, shade(p.accent, -8))
  build.front(-1, -4 - breath, 2, 2, '#ff3529')
  // Shoulder plates with spikes.
  build.push(-14, -10 - breath, 7, 9, OUTLINE)
  build.push(7, -10 - breath, 7, 9, OUTLINE)
  build.push(-13, -9 - breath, 6, 7, p.accent)
  build.push(8, -9 - breath, 6, 7, p.accent)
  build.push(-13, -9 - breath, 2, 2, shade(p.accent, 30))
  build.push(-12, -13 - breath, 2, 4, shade(p.accent, -14))
  build.push(11, -13 - breath, 2, 4, shade(p.accent, -14))
  // Goldbach crest: twin flames flickering over the brow.
  buildHead(build, p.skin, breath)
  build.push(-8, -22 - breath - flame, 4, 7, p.energy)
  build.push(-3, -25 - breath + flame, 5, 9, p.accent)
  build.push(-2, -24 - breath + flame, 2, 3, '#fff3d2')
  build.push(3, -22 - breath - flame, 5, 7, p.energy)
  build.front(-4, -15 - breath, 3, 2, '#ff3529')
  build.front(2, -15 - breath, 3, 2, '#ff3529')
  // Prime gauntlets venting steam.
  build.push(-15, -3, 7, 8, OUTLINE)
  build.push(9, -3, 7, 8, OUTLINE)
  build.push(-14, -2, 6, 7, p.accent)
  build.push(9, -2, 6, 7, p.energy)
  build.push(-14, -2, 2, 2, shade(p.accent, 28))
  build.push(9, -2, 2, 2, shade(p.energy, 28))
  if (steam === 0) build.push(-15, -6, 2, 2, '#c9d6de')
  if (steam === 1) build.push(13, -6, 2, 2, '#c9d6de')
}

const buildEngineer: ArchetypeBuilder = (build, hero, pose, breath) => {
  const p = hero.palette
  const glint = Math.floor(pose.time / 260) % 4
  const sieveSpin = Math.floor(pose.time / 240) % 2
  // Copper sieve backpack with rotating holes.
  build.push(-13, -12, 6, 16, OUTLINE)
  build.push(-12, -11, 4, 14, shade(p.secondary, -10))
  build.push(-12, -9 + sieveSpin * 4, 2, 2, shade(p.secondary, -40))
  build.push(-11, -4 + sieveSpin * 3, 2, 2, shade(p.secondary, -40))
  build.push(-12, 0, 4, 2, p.energy)
  // Overalls over work shirt, wrench at the belt.
  build.push(-9, -10 - breath, 18, 16, OUTLINE)
  build.push(-8, -9 - breath, 16, 15, p.primary)
  build.push(-8, -9 - breath, 5, 5, shade(p.primary, 16))
  build.push(-5, -8 - breath, 10, 13, '#29431d')
  build.push(-2, -8 - breath, 4, 13, p.accent)
  build.push(-2, -8 - breath, 4, 2, shade(p.accent, 20))
  build.push(-6, 1, 12, 2, shade(p.shadow, -12))
  build.push(4, 0, 3, 5, '#b8752e')
  build.push(4, 0, 3, 1, '#e8a35c')
  // Ponytail + goggles with a sweeping glint.
  buildHead(build, p.skin, breath)
  build.push(-7, -22 - breath, 14, 6, p.shadow)
  build.push(-6, -22 - breath, 4, 2, shade(p.shadow, 26))
  build.push(-9, -20 - breath, 4, 12, p.shadow)
  build.push(-10, -9 - breath, 4, 7, shade(p.shadow, -16))
  build.front(-6, -16 - breath, 5, 3, p.energy)
  build.front(2, -16 - breath, 5, 3, p.energy)
  build.front(-1, -15 - breath, 3, 1, p.accent)
  if (glint < 2) build.front(-5 + glint * 8, -16 - breath, 1, 1, '#ffffff')
  build.push(-7, -17 - breath, 14, 1, shade(p.shadow, -20))
}

const buildOracle: ArchetypeBuilder = (build, hero, pose, breath) => {
  const p = hero.palette
  const flow = Math.floor(pose.time / 280) % 3
  const orbit = Math.floor(pose.time / 240) % 4
  // Celestial robe: layered bands, split hem.
  build.push(-11, -10 - breath, 22, 17, OUTLINE)
  build.push(-10, -9 - breath, 20, 15, p.shadow)
  build.push(-8, -9 - breath, 16, 14, p.secondary)
  build.push(-8, -9 - breath, 5, 5, shade(p.secondary, 18))
  build.push(-5, -8 - breath, 10, 13, p.primary)
  build.push(-1, -8 - breath, 3, 11, p.energy)
  build.push(-1, -8 - breath, 3, 2, shade(p.energy, 30))
  build.push(-8, 4, 7, 8, shade(p.secondary, -12))
  build.push(2, 4, 7, 8, shade(p.primary, -10))
  // Long flowing hair, animated.
  buildHead(build, p.skin, breath)
  build.push(-9, -23 - breath, 18, 7, OUTLINE)
  build.push(-8, -22 - breath, 16, 6, p.shadow)
  build.push(-7, -22 - breath, 5, 2, shade(p.shadow, 24))
  build.push(-10, -18 - breath, 5, 17 + flow, shade(p.shadow, -8))
  build.push(5, -19 - breath, 5, 16 + (2 - flow), p.shadow)
  build.push(-11, -6 + flow, 3, 6, shade(p.shadow, -20))
  buildEyes(build, breath, p.accent, '#fff3d2')
  build.front(2, -15 - breath, 3, 2, p.energy)
  // The floating curve point, orbiting with a fading trail.
  const orbitX = [12, 14, 12, 10][orbit]
  const orbitY = [-10, -7, -4, -7][orbit]
  build.push(orbitX, orbitY, 4, 4, p.accent)
  build.push(orbitX + 1, orbitY + 1, 2, 2, '#fff3d2')
  const prevOrbit = (orbit + 3) % 4
  build.push([12, 14, 12, 10][prevOrbit] + 1, [-10, -7, -4, -7][prevOrbit] + 1, 2, 2, shade(p.accent, -30))
}

const BUILDERS: Readonly<Record<HeroClassDefinition['archetype'], ArchetypeBuilder>> = {
  warrior: buildWarrior,
  cryptographer: buildCryptographer,
  ranger: buildRanger,
  arcanist: buildArcanist,
  assassin: buildAssassin,
  berserker: buildBerserker,
  engineer: buildEngineer,
  oracle: buildOracle,
}

/* ------------------------------------------------------------------ main */

export function heroBodyRects(
  hero: HeroClassDefinition,
  direction: Direction,
  pose: HeroBodyPose,
): readonly SpriteRect[] {
  const facingLeft = direction === 'left'
  const facingBack = direction === 'up'
  const walkFrame = pose.moving ? Math.floor(pose.time / 88) % 4 : 0
  const stride = pose.moving ? [0, 2, 0, -2][walkFrame] : 0
  const bob = pose.casting ? -2 : pose.moving && walkFrame % 2 ? 1 : 0
  const lean = pose.dashing ? 3 : pose.attacking ? 1 : 0
  const breath = pose.moving || pose.casting ? 0 : Math.floor(pose.time / 640) % 2
  const reach = pose.attacking ? 3 : 0

  const build = createBuild()
  buildLegs(build, hero.palette.primary, hero.palette.shadow, stride)
  BUILDERS[hero.archetype](build, hero, pose, breath, stride)
  buildArms(build, hero.palette.primary, hero.palette.skin, reach)
  if (pose.ascended) {
    build.push(-11, -12, 3, 3, '#ffffff')
    build.push(8, -12, 3, 3, hero.palette.energy)
    build.push(-2, -26, 4, 2, hero.palette.accent)
  }

  const all = facingBack ? build.rects : [...build.rects, ...build.frontRects]
  return all.map((rect) => ({
    x: (facingLeft ? -rect.x - rect.w : rect.x) + (facingLeft ? -lean : lean),
    y: rect.y + bob,
    w: rect.w,
    h: rect.h,
    color: rect.color,
  }))
}
