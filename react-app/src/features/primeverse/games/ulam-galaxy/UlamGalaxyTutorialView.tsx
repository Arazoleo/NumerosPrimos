import { useEffect, useId, useRef } from 'react'

import UlamTutorialGrid from './UlamGalaxyTutorialGrid'
import {
  getUlamGalaxyTutorialCopy,
  ULAM_GALAXY_TUTORIAL_STEPS,
  type UlamGalaxyTutorialStep,
} from './ulamGalaxyTutorialCopy'

interface UlamGalaxyTutorialViewProps {
  readonly step: UlamGalaxyTutorialStep
  readonly onNext: () => void
  readonly onPrevious: () => void
  readonly onSkip: () => void
}

export default function UlamGalaxyTutorialView({
  step,
  onNext,
  onPrevious,
  onSkip,
}: UlamGalaxyTutorialViewProps): JSX.Element | null {
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const copy = getUlamGalaxyTutorialCopy(step)

  useEffect(() => {
    if (step !== 0) titleRef.current?.focus()
  }, [step])

  if (step === 0 || !copy) return null

  const stepIndex = ULAM_GALAXY_TUTORIAL_STEPS.indexOf(step)
  const isLastStep = stepIndex === ULAM_GALAXY_TUTORIAL_STEPS.length - 1

  return (
    <section
      className={`ulam-tutorial ulam-tutorial--step-${step}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="ulam-tutorial__card">
        <p className="ulam-tutorial__counter">
          TUTORIAL · PASSO {stepIndex + 1} DE {ULAM_GALAXY_TUTORIAL_STEPS.length}
        </p>
        <h2 id={titleId} ref={titleRef} tabIndex={-1}>{copy.title}</h2>
        <p className="ulam-tutorial__body">{copy.body}</p>
        {copy.example ? <p className="ulam-tutorial__example">{copy.example}</p> : null}
        {copy.visual === 'spiral' || copy.visual === 'diagonal' ? (
          <UlamTutorialGrid mode={copy.visual} />
        ) : null}
        {copy.hint ? <p className="ulam-tutorial__hint">{copy.hint}</p> : null}
        <div className="ulam-tutorial__progress" aria-hidden="true">
          {ULAM_GALAXY_TUTORIAL_STEPS.map((tutorialStep) => (
            <i key={tutorialStep} className={tutorialStep <= step ? 'is-active' : undefined} />
          ))}
        </div>
        <div className="ulam-tutorial__actions">
          <button type="button" className="ulam-tutorial__skip" onClick={onSkip}>
            Pular tutorial
          </button>
          <div>
            <button
              type="button"
              className="ulam-tutorial__back"
              onClick={onPrevious}
              disabled={stepIndex === 0}
            >
              ← Voltar
            </button>
            <button type="button" className="ulam-tutorial__next" onClick={onNext}>
              {isLastStep ? 'Começar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
