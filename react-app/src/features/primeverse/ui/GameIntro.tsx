import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import './GameIntro.css'

export interface GameIntroProps {
  /** The name, and nothing else on this line. */
  readonly title: string
  /** Word or words set in italic serif inside the title. */
  readonly emphasis?: string
  /** One sentence. What the player does here — not the whole manual. */
  readonly instruction: string
  readonly actionLabel?: string
  readonly onStart: () => void
  /** Hue of this game, used sparingly: rule, mark and focus ring. */
  readonly accent?: string
  /** The number or glyph that stands behind everything, very quietly. */
  readonly mark?: string
  /** Optional single line of keys, shown small under the action. */
  readonly keys?: string
  readonly backTo?: string
  readonly backLabel?: string
  /** Games that own their navigation pass a handler instead of a route. */
  readonly onBack?: () => void
  /** Rare extra: a slot for something only this game needs. */
  readonly children?: ReactNode
}

/**
 * The one menu every game shows before it starts.
 *
 * Deliberately austere: a name, a single instruction, one way in. Everything the
 * old briefings carried — mission routes, tip grids, lore paragraphs — belonged in
 * the game itself, not in front of it. The mark behind the type carries the
 * identity so the copy does not have to.
 */
export function GameIntro({
  title,
  emphasis,
  instruction,
  actionLabel = 'Começar',
  onStart,
  accent = '#7cf5c8',
  mark,
  keys,
  backTo = '/jogos',
  backLabel = 'Primeverse',
  onBack,
  children,
}: GameIntroProps): JSX.Element {
  const [before, after] = emphasis && title.includes(emphasis)
    ? [title.slice(0, title.indexOf(emphasis)), title.slice(title.indexOf(emphasis) + emphasis.length)]
    : [title, '']

  return (
    <section
      className="game-intro"
      style={{ '--intro-accent': accent } as CSSProperties}
      aria-labelledby="game-intro-title"
    >
      {mark && <span className="game-intro__mark" aria-hidden="true">{mark}</span>}

      <div className="game-intro__body">
        <h1 className="game-intro__title" id="game-intro-title">
          {before}
          {emphasis && <em>{emphasis}</em>}
          {after}
        </h1>

        <p className="game-intro__instruction">{instruction}</p>

        <button className="game-intro__action" type="button" onClick={onStart}>
          <span>{actionLabel}</span>
          <i aria-hidden="true" />
        </button>

        {keys && <p className="game-intro__keys">{keys}</p>}
        {children && <div className="game-intro__extra">{children}</div>}
      </div>

      {onBack
        ? (
          <button className="game-intro__back" type="button" onClick={onBack}>← {backLabel}</button>
        )
        : <Link className="game-intro__back" to={backTo}>← {backLabel}</Link>}
    </section>
  )
}

export default GameIntro
