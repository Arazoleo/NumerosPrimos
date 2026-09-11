import { getHeroClass, type HeroClassId } from './heroClassSystem'
import { heroBodyRects } from './heroSpriteBody'

/**
 * The in-game hero, rendered as SVG for the origin films. Geometry comes from
 * heroSpriteBody — the same rect generator the canvas renderer uses — so the
 * person in the film is pixel-for-pixel the person you play, upgrades included.
 */

const IDLE_POSE = Object.freeze({
  time: 0,
  moving: false,
  attacking: false,
  dashing: false,
  casting: false,
  ascended: false,
})

export default function HeroSprite({
  heroClassId,
  x,
  y,
  px,
  facing = 'right',
  opacity,
  bob = true,
}: {
  readonly heroClassId: HeroClassId
  readonly x: number
  readonly y: number
  /** Size of one sprite pixel in scene units. */
  readonly px: number
  readonly facing?: 'left' | 'right'
  readonly opacity?: number
  readonly bob?: boolean
}): JSX.Element {
  const hero = getHeroClass(heroClassId)
  const rects = heroBodyRects(hero, 'down', IDLE_POSE)
  return (
    <g
      transform={`translate(${x} ${y}) scale(${facing === 'left' ? -px : px} ${px})`}
      opacity={opacity}
      shapeRendering="crispEdges"
    >
      <g className={bob ? 'pbo-hero-bob' : undefined}>
        {rects.map((rect, index) => (
          <rect key={index} x={rect.x} y={rect.y} width={rect.w} height={rect.h}
            fill={rect.color} />
        ))}
      </g>
    </g>
  )
}
