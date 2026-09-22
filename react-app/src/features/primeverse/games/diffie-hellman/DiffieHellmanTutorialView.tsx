import { useEffect, useId, useRef } from 'react'

import {
  DIFFIE_HELLMAN_TUTORIAL_STEPS,
  getDiffieHellmanTutorialCopy,
  type DiffieHellmanTutorialStep,
} from './diffieHellmanTutorialCopy'

export interface DiffieHellmanTutorialViewProps {
  readonly step: DiffieHellmanTutorialStep
  readonly onNext: () => void
  readonly onSkip: () => void
}

export default function DiffieHellmanTutorialView({
  step,
  onNext,
  onSkip,
}: DiffieHellmanTutorialViewProps): JSX.Element | null {
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const copy = getDiffieHellmanTutorialCopy(step)

  useEffect(() => { if (step !== 0) titleRef.current?.focus() }, [step])

  if (step === 0 || !copy) return null

  const stepIndex = DIFFIE_HELLMAN_TUTORIAL_STEPS.indexOf(step)
  const totalSteps = DIFFIE_HELLMAN_TUTORIAL_STEPS.length
  const isLastStep = stepIndex === totalSteps - 1

  return (
    <section className="dh-tutorial" aria-labelledby={titleId}>
      <div className="dh-tutorial__card">
        <p className="dh-tutorial__counter">TUTORIAL · PASSO {stepIndex + 1} DE {totalSteps}</p>
        <h2 id={titleId} ref={titleRef} tabIndex={-1}>{copy.title}</h2>
        <p className="dh-tutorial__body">{copy.body}</p>
        {copy.example ? <p className="dh-tutorial__example">{copy.example}</p> : null}
        {copy.hint ? <p className="dh-tutorial__hint">{copy.hint}</p> : null}
        <div className="dh-tutorial__actions">
          <button type="button" className="dh-tutorial__skip" onClick={onSkip}>
            Pular tutorial
          </button>
          <button type="button" className="dh-tutorial__next" onClick={onNext}>
            {isLastStep ? 'Começar' : 'Próximo'}
          </button>
        </div>
      </div>
    </section>
  )
}
