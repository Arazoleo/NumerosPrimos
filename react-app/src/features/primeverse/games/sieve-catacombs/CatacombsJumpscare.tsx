import type { CatacombsEnemyArchetype } from './campaignLogic'
import type { CatacombsJumpscare } from './types'

interface JumpscareFace {
  readonly eyes: number
  readonly accent: string
  readonly glyphs: string
  readonly caption: string
}

const FACES: Readonly<Record<CatacombsEnemyArchetype, JumpscareFace>> = {
  'keylogger-wraith': {
    eyes: 6,
    accent: '#ffe98a',
    glyphs: '01001011 01000101 01011001',
    caption: 'KEYSTROKE CAPTURADO',
  },
  'hash-collider': {
    eyes: 4,
    accent: '#7cfff0',
    glyphs: 'a3f9 · c07e · a3f9 · c07e',
    caption: 'COLISÃO ENCONTRADA',
  },
  'man-in-the-middle': {
    eyes: 2,
    accent: '#ffb27a',
    glyphs: '>>> canal interceptado <<<',
    caption: 'CHAVE SUBSTITUÍDA',
  },
  'factoring-warden': {
    eyes: 7,
    accent: '#8dffb4',
    glyphs: 'n = 49 = 7 × 7',
    caption: 'CHAVE FATORADA',
  },
  'brute-forcer': {
    eyes: 5,
    accent: '#ff8f6a',
    glyphs: '0000 · 0001 · 0002 · 0003 · 0004',
    caption: 'TENTATIVA 1.048.576',
  },
  'cold-key-keeper': {
    eyes: 3,
    accent: '#bfe6ff',
    glyphs: '−196 °C · chave em repouso',
    caption: 'CHAVE CONFISCADA',
  },
}

/**
 * Mini jumpscare: a few frames of the creature filling the screen. It is purely
 * decorative (aria-hidden) and stays short so it never blocks the player's input.
 */
export default function CatacombsJumpscareOverlay({
  scare,
}: {
  readonly scare: CatacombsJumpscare
}): JSX.Element {
  const face = FACES[scare.archetype]
  const eyeRow = Array.from({ length: face.eyes }, (_, index) => index)
  const columns = Math.min(4, face.eyes)

  return (
    <div
      className={`scc-jumpscare scc-jumpscare--${scare.archetype}${scare.lethal ? ' is-lethal' : ''}`}
      style={{ '--scc-scare-accent': face.accent } as React.CSSProperties}
      aria-hidden="true"
    >
      <svg className="scc-jumpscare__face" viewBox="0 0 200 220" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="scc-scare-skull" cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#1a1a1a" />
            <stop offset="62%" stopColor="#070707" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
        </defs>
        <path
          d="M100 4c34 0 56 26 56 66 0 26-6 42-10 60-5 22-16 44-46 86-30-42-41-64-46-86-4-18-10-34-10-60C44 30 66 4 100 4z"
          fill="url(#scc-scare-skull)"
        />
        {eyeRow.map((index) => {
          const row = Math.floor(index / columns)
          const column = index % columns
          const cx = 100 + (column - (columns - 1) / 2) * (face.eyes <= 2 ? 34 : 24)
          const cy = 74 + row * 24
          return (
            <g key={index}>
              <ellipse cx={cx} cy={cy} rx={face.eyes <= 2 ? 12 : 7} ry={face.eyes <= 2 ? 8 : 5} fill={face.accent} />
              <ellipse cx={cx} cy={cy} rx={face.eyes <= 2 ? 4 : 2.4} ry={face.eyes <= 2 ? 6 : 3.6} fill="#160002" />
            </g>
          )
        })}
        <path d="M74 128h52l-8 62c-6 14-30 14-36 0z" fill="#050505" />
        {[0, 1, 2, 3, 4, 5].map((tooth) => (
          <polygon
            key={tooth}
            points={`${78 + tooth * 8},128 ${86 + tooth * 8},128 ${82 + tooth * 8},${142 + (tooth % 2) * 5}`}
            fill="#e6ece6"
            opacity="0.86"
          />
        ))}
        {[0, 1, 2, 3, 4, 5].map((tooth) => (
          <polygon
            key={`lower-${tooth}`}
            points={`${80 + tooth * 7},186 ${87 + tooth * 7},186 ${83 + tooth * 7},${172 - (tooth % 2) * 4}`}
            fill="#cfd8cf"
            opacity="0.7"
          />
        ))}
      </svg>
      <span className="scc-jumpscare__glyphs">{face.glyphs}</span>
      <strong className="scc-jumpscare__name">{scare.name}</strong>
      <small className="scc-jumpscare__caption">{face.caption}</small>
    </div>
  )
}
