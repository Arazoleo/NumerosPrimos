import { useEffect, useId, useRef } from 'react'

import {
  getSkylineTutorialCopy,
  type SkylineTutorialStep,
} from './skylineRunnerTutorial'

export interface SkylineRunnerTutorialViewProps {
  readonly step: SkylineTutorialStep
  readonly onNext: () => void
  readonly onSkip: () => void
}

export const SKYLINE_TUTORIAL_STEPS: readonly Exclude<SkylineTutorialStep, 0>[] = [1, 2, 3, 4, 5]

export default function SkylineRunnerTutorialView({
  step,
  onNext,
  onSkip,
}: SkylineRunnerTutorialViewProps): JSX.Element | null {
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const copy = getSkylineTutorialCopy(step)

  useEffect(() => {
    if (step !== 0) {
      titleRef.current?.focus()
    }
  }, [step])

  if (step === 0 || !copy) return null

  const stepIndex = SKYLINE_TUTORIAL_STEPS.indexOf(step)
  const totalSteps = SKYLINE_TUTORIAL_STEPS.length
  const isLastStep = stepIndex === totalSteps - 1

  return (
    <section className="skyline-tutorial" aria-labelledby={titleId}>
      <div className="skyline-tutorial__card">
        <p className="skyline-tutorial__counter">
          TUTORIAL · PASSO {stepIndex + 1} DE {totalSteps}
        </p>

        <h2 id={titleId} ref={titleRef} tabIndex={-1}>
          {copy.title}
        </h2>

        <p className="skyline-tutorial__body">{copy.body}</p>

        {copy.hint ? <p className="skyline-tutorial__hint">{copy.hint}</p> : null}

        <div className="skyline-tutorial__actions">
          <button type="button" className="skyline-tutorial__skip" onClick={onSkip}>
            Pular tutorial
          </button>
          <button type="button" className="skyline-tutorial__next" onClick={onNext}>
            {isLastStep ? 'Começar corrida' : 'Próximo'}
          </button>
        </div>
      </div>
    </section>
  )
}