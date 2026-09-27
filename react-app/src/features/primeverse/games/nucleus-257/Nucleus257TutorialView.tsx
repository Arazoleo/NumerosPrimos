import { useLayoutEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import {
  getNucleusTutorialCopy,
  NUCLEUS_TUTORIAL_STEPS,
  type NucleusTutorialStep,
} from './nucleusTutorialCopy'

export interface Nucleus257TutorialProps {
  readonly step: NucleusTutorialStep
  readonly onManualNext: () => void
  readonly onSkip: () => void
}

export default function Nucleus257Tutorial({
  step,
  onManualNext,
  onSkip,
}: Nucleus257TutorialProps): JSX.Element | null {
  const copy = getNucleusTutorialCopy(step)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!copy) {
      setTargetRect(null)
      return undefined
    }
    const updateTargetRect = () => {
      const target = document.querySelector<HTMLElement>(copy.selector)
      setTargetRect(target?.getBoundingClientRect() ?? null)
    }
    updateTargetRect()
    const frame = window.requestAnimationFrame(updateTargetRect)
    window.addEventListener('resize', updateTargetRect)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateTargetRect)
    }
  }, [copy])

  if (step === 0 || !copy) return null

  const stepIndex = NUCLEUS_TUTORIAL_STEPS.indexOf(step)
  const isLastStep = step === NUCLEUS_TUTORIAL_STEPS[NUCLEUS_TUTORIAL_STEPS.length - 1]
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
      className="n257-tutorial"
      role="dialog"
      aria-modal="true"
      aria-labelledby="n257-tutorial-title"
      data-tutorial-target={copy.target}
    >
      <div className="n257-tutorial__backdrop" aria-hidden="true" />
      {spotlightStyle && (
        <div className="n257-tutorial__spotlight" style={spotlightStyle} aria-hidden="true" />
      )}

      <div
        className="n257-tutorial__card"
        style={
          targetRect
            ? ({
                '--tutorial-card-top': targetRect.top > window.innerHeight * 0.5 ? '28%' : '72%',
              } as CSSProperties)
            : undefined
        }
      >
        <div className="n257-tutorial__eyebrow">
          <span>TUTORIAL</span>
          <strong>{String(stepIndex + 1).padStart(2, '0')} / {String(NUCLEUS_TUTORIAL_STEPS.length).padStart(2, '0')}</strong>
        </div>

        <h2 id="n257-tutorial-title">{copy.title}</h2>
        <p>{copy.body}</p>
        {copy.hint && <small className="n257-tutorial__hint">{copy.hint}</small>}

        <div className="n257-tutorial__progress" aria-hidden="true">
          {NUCLEUS_TUTORIAL_STEPS.map((tutorialStep) => (
            <i key={tutorialStep} className={tutorialStep <= step ? 'is-active' : undefined} />
          ))}
        </div>

        <div className="n257-tutorial__actions">
          <button type="button" className="n257-tutorial__skip" onClick={onSkip}>
            Pular tutorial
          </button>
          <button type="button" className="n257-tutorial__next" onClick={onManualNext}>
            {isLastStep ? 'Entrar em combate' : 'Próximo'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  )
}
