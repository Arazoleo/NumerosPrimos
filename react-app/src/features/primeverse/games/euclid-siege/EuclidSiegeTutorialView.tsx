import {
  getEuclidTutorialCopy,
  type EuclidTutorialStep,
} from './euclidSiegeTutorialCopy'
import { useLayoutEffect, useState } from 'react'

export interface EuclidSiegeTutorialProps {
  readonly step: EuclidTutorialStep
  readonly onNext: () => void
  readonly onSkip: () => void
}

export const EUCLID_TUTORIAL_STEPS: readonly Exclude<EuclidTutorialStep, 0>[] = [1, 2, 3, 4, 5, 6, 7, 8]

export default function EuclidSiegeTutorial({
  step,
  onNext,
  onSkip,
}: EuclidSiegeTutorialProps): JSX.Element | null {
  const copy = getEuclidTutorialCopy(step)
  const selector = copy?.selector

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!selector) return

    const updateTargetRect = () => {
      const target = document.querySelector<HTMLElement>(selector)
      setTargetRect(target?.getBoundingClientRect() ?? null)
    }

    updateTargetRect()
    window.addEventListener('resize', updateTargetRect)
    window.addEventListener('scroll', updateTargetRect, true)
    return () => {
      window.removeEventListener('resize', updateTargetRect)
      window.removeEventListener('scroll', updateTargetRect, true)
    }
  }, [selector])

  if (step === 0 || !copy) return null

  const stepIndex = EUCLID_TUTORIAL_STEPS.indexOf(step)
  const isLastStep = stepIndex === EUCLID_TUTORIAL_STEPS.length - 1

  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
      }
    : undefined
  return (
    <section
      className="euclid-tutorial"
      role="dialog"
      aria-modal="true"
      aria-labelledby="euclid-tutorial-title"
      data-tutorial-target={copy.target}
    >
      <div className="euclid-tutorial__backdrop" aria-hidden="true" />
      {spotlightStyle && (
        <div
          className="euclid-tutorial__spotlight"
          style={spotlightStyle}
          aria-hidden="true"
        />
      )}

      <div
        className="euclid-tutorial__card"
        style={
          targetRect
            ? ({
                '--tutorial-target-bottom': `${targetRect.bottom}px`,
                /*
                 * Mantem o card acima de alvos posicionados na metade
                 * inferior da tela, com uma margem minima no topo.
                 */
                '--tutorial-card-top': targetRect.top > window.innerHeight * 0.4
                  ? `${Math.max(180, targetRect.top / 2)}px`
                  : '50%',
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="euclid-tutorial__eyebrow">
          <span>TUTORIAL</span>
          <strong>{String(stepIndex + 1).padStart(2, '0')} / {String(EUCLID_TUTORIAL_STEPS.length).padStart(2, '0')}</strong>
        </div>

        <div className="euclid-tutorial__target" aria-hidden="true">
          <span>{copy.target.replace('-', ' ')}</span>
          <i />
        </div>

        <h2 id="euclid-tutorial-title">{copy.title}</h2>
        <p>{copy.body}</p>
        <small className="euclid-tutorial__hint">{copy.hint}</small>

        <div className="euclid-tutorial__progress" aria-hidden="true">
          {EUCLID_TUTORIAL_STEPS.map((tutorialStep) => (
            <i
              key={tutorialStep}
              className={tutorialStep <= step ? 'is-active' : undefined}
            />
          ))}
        </div>

        <div className="euclid-tutorial__actions">
          <button type="button" className="euclid-tutorial__skip" onClick={onSkip}>
            Pular tutorial
          </button>
          <button type="button" className="euclid-tutorial__next" onClick={onNext}>
            {isLastStep ? 'Começar cerco' : 'Próximo'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  )
}
