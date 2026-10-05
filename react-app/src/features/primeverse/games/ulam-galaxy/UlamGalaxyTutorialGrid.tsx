import './ulam-galaxy.css'

type UlamTutorialGridMode = 'spiral' | 'diagonal'

interface UlamTutorialGridProps {
  readonly mode: UlamTutorialGridMode
}

interface GridCell {
  readonly value: number
  readonly diagonal: boolean
}

const GRID: readonly GridCell[] = [
  { value: 17, diagonal: false },
  { value: 16, diagonal: false },
  { value: 15, diagonal: false },
  { value: 14, diagonal: false },
  { value: 13, diagonal: true },

  { value: 18, diagonal: false },
  { value: 5, diagonal: false },
  { value: 4, diagonal: false },
  { value: 3, diagonal: true },
  { value: 12, diagonal: false },

  { value: 19, diagonal: false },
  { value: 6, diagonal: false },
  { value: 1, diagonal: true },
  { value: 2, diagonal: false },
  { value: 11, diagonal: false },

  { value: 20, diagonal: false },
  { value: 7, diagonal: true },
  { value: 8, diagonal: false },
  { value: 9, diagonal: false },
  { value: 10, diagonal: false },

  { value: 21, diagonal: true },
  { value: 22, diagonal: false },
  { value: 23, diagonal: false },
  { value: 24, diagonal: false },
  { value: 25, diagonal: false },
]

const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23])

export default function UlamTutorialGrid({
  mode,
}: UlamTutorialGridProps): JSX.Element {
  return (
    <div
      className={`ulam-tutorial-grid ulam-tutorial-grid--${mode}`}
      role="img"
      aria-label={
        mode === 'diagonal'
          ? 'Recorte da espiral de Ulam com uma diagonal de números destacados'
          : 'Recorte de uma espiral de Ulam com números inteiros'
      }
    >
      {GRID.map((cell) => {
        const isPrime = PRIMES.has(cell.value)
        const isHighlighted = mode === 'diagonal' && cell.diagonal

        return (
          <span
            key={cell.value}
            className={[
              'ulam-tutorial-grid__cell',
              isPrime ? 'is-prime' : '',
              isHighlighted ? 'is-diagonal' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={`${cell.value}${isPrime ? ', primo' : ', composto'}`}
          >
            {cell.value}
          </span>
        )
      })}
    </div>
  )
}