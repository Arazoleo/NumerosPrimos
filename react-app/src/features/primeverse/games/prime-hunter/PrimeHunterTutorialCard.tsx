import { TUTORIAL_STEPS, type TutorialState } from './primeHunterTutorial'

interface PrimeHunterTutorialProps {
  readonly state: TutorialState
  readonly onNext: () => void
  readonly onRetry: () => void
  readonly onSkip: () => void
  readonly onFinish: () => void
  /** Índice do destaque do HUD ativo (passos com `highlights`). */
  readonly highlightIndex: number
  readonly onHighlight: (index: number) => void
}

const pad = (value: number) => String(value).padStart(2, '0')

export default function PrimeHunterTutorial({
  state, onNext, onRetry, onSkip, onFinish, highlightIndex, onHighlight,
}: PrimeHunterTutorialProps) {
  const step = TUTORIAL_STEPS[state.stepIndex]
  const interactive = step.wave.length > 0
  const feedbackClass = state.feedback ? (state.feedback.correct ? 'is-correct' : 'is-wrong') : ''

  return (
    <section className={`ph-tutorial is-${state.phase}`} aria-labelledby="ph-tutorial-title">
      <header className="ph-tutorial__eyebrow">
        <span>// TUTORIAL · {step.kicker}</span>
        <strong>{pad(state.stepIndex + 1)} / {pad(TUTORIAL_STEPS.length)}</strong>
      </header>

      <h2 id="ph-tutorial-title">{step.title}</h2>
      <p className="ph-tutorial__body">{step.body}</p>

      {step.highlights && (
        <ol className="ph-tutorial__beats">
          {step.highlights.map((highlight, index) => (
            <li key={highlight.target}>
              <button
                type="button"
                className={index === highlightIndex ? 'is-active' : undefined}
                aria-current={index === highlightIndex ? 'step' : undefined}
                onClick={() => onHighlight(index)}
              >
                {highlight.text}
              </button>
            </li>
          ))}
        </ol>
      )}

      {interactive && state.phase === 'running' && (
        <div className="ph-tutorial__goal">
          <i aria-hidden="true" />
          <span>OBJETIVO</span>
          <strong>{step.goal}</strong>
          {step.wave.length > 1 && <small>{state.resolved}/{step.wave.length}</small>}
        </div>
      )}

      <p className={`ph-tutorial__feedback ${feedbackClass}`} aria-live="polite">
        {state.phase === 'success' && step.success}
        {state.phase === 'retry' && `${state.feedback?.text ?? ''} Tente de novo.`}
        {state.phase === 'running' && state.feedback?.text}
      </p>

      <div className="ph-tutorial__progress" aria-hidden="true">
        {TUTORIAL_STEPS.map((item, index) => (
          <i key={item.id} className={index <= state.stepIndex ? 'is-active' : undefined} />
        ))}
      </div>

      <div className="ph-tutorial__actions">
        <button type="button" className="ph-tutorial__skip" onClick={onSkip}>Pular tutorial</button>
        {state.phase === 'success' && (
          <button type="button" className="ph-primary" onClick={onNext}><span>CONTINUAR</span><strong>→</strong></button>
        )}
        {state.phase === 'retry' && (
          <button type="button" className="ph-primary" onClick={onRetry}><span>TENTAR DE NOVO</span><strong>↻</strong></button>
        )}
        {!interactive && (
          <button type="button" className="ph-primary" onClick={onFinish}><span>COMEÇAR MISSÃO</span><strong>▶</strong></button>
        )}
      </div>
    </section>
  )
}
