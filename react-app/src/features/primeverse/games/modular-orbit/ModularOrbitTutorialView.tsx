/**
 * Tela do tutorial da Órbita Modular.
 *
 * Abre numa tela de boas-vindas com o contexto do jogo e um botão para começar.
 * Em seguida, mostra um passo por vez, sempre com a mesma estrutura:
 *   progresso → título → texto → contas/rastros/prática → botões.
 * Os textos vêm de `modularOrbitTutorial.ts`; aqui fica só a apresentação.
 */
import { useEffect, useMemo, useRef, useState } from 'react'

import { evaluateOrbitGuess } from './modularOrbitLogic'
import {
  getTutorialTrace,
  MODULAR_ORBIT_TUTORIAL_INTRO,
  MODULAR_ORBIT_TUTORIAL_STEPS,
  TUTORIAL_ORBIT,
  type TutorialBoard,
  type TutorialQuiz,
  type TutorialTrace,
} from './modularOrbitTutorial'

export interface ModularOrbitTutorialViewProps {
  /** Chamado ao terminar o último passo. */
  readonly onFinish: () => void
  /** Chamado ao clicar em "Pular tutorial": fecha o tutorial e começa a missão. */
  readonly onSkip: () => void
  /** Chamado ao fechar (X): volta para a tela inicial do jogo, sem iniciar a missão. */
  readonly onClose: () => void
}

/** Desenha um rastro como "1 → 3 → 0", destacando cada pouso no alvo. */
function OrbitTrace({ trace }: { trace: TutorialTrace }): JSX.Element {
  const stations = getTutorialTrace(trace.pulses)
  // Ícone + texto, para o resultado não depender só da cor.
  const icon = trace.accepted === undefined ? null : trace.accepted ? '✓' : '✗'
  const status = trace.accepted === false ? 'is-rejected' : 'is-accepted'

  return (
    <div className={`orbit-tutorial__trace ${status}`}>
      <span className="orbit-tutorial__trace-label">
        {icon ? <b aria-hidden="true">{icon} </b> : null}
        {trace.label}
      </span>
      <ol aria-label={`Rastro com ${trace.label}: ${stations.join(', ')}`}>
        {stations.map((station, index) => (
          <li key={index}>
            {index > 0 ? <i aria-hidden="true">→</i> : null}
            {/* Destaca toda vez que a sonda pousa no alvo (exceto na saída). */}
            <span className={station === TUTORIAL_ORBIT.target && index > 0 ? 'is-target' : ''}>
              {station}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Prática guiada: o jogador escolhe uma resposta e recebe retorno na hora. */
function TutorialPractice({
  quiz,
  answer,
  onAnswer,
}: {
  quiz: TutorialQuiz
  answer: number | null
  onAnswer: (value: number) => void
}): JSX.Element {
  const isRight = answer === quiz.correct

  return (
    <fieldset className="orbit-tutorial__quiz">
      <legend>{quiz.question}</legend>
      <div className="orbit-tutorial__options">
        {quiz.options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={answer === option}
            onClick={() => onAnswer(option)}
          >
            {option} pulsos
          </button>
        ))}
      </div>
      {answer !== null ? (
        <p className={`orbit-tutorial__feedback ${isRight ? 'is-right' : 'is-wrong'}`} role="status">
          <b aria-hidden="true">{isRight ? '✓ ' : '✗ '}</b>
          {isRight ? quiz.success : quiz.retry}
        </p>
      ) : null}
    </fieldset>
  )
}

// Medidas do quadro SVG (viewBox 0..100). Ajuste aqui para mudar o tamanho.
const BOARD_RADIUS = 38 // raio do anel de estações
const STATION_R = 4.4 // raio de uma estação comum
const TARGET_R = 5.4 // raio da estação-alvo (um pouco maior)
const PROBE_R = 2.2 // raio da sonda
const REVEAL_MS = 520 // intervalo entre pousos ao preencher a órbita

/** Posição (x, y) de uma estação na circunferência: 0 no topo, horário, como no jogo. */
function stationPoint(residue: number, modulus: number): { x: number; y: number } {
  const angle = Math.PI / 2 - (residue / modulus) * Math.PI * 2
  return { x: 50 + Math.cos(angle) * BOARD_RADIUS, y: 50 - Math.sin(angle) * BOARD_RADIUS }
}

/** Classe de cor de uma estação, pela cor do jogo: alvo, saída ou já visitada. */
function stationKind(residue: number, visited: ReadonlySet<number>): string {
  const { start, target } = TUTORIAL_ORBIT
  if (residue === target) return 'is-target'
  if (residue === start) return 'is-start'
  return visited.has(residue) ? 'is-visited' : ''
}

/** Frase que explica o resultado do lançamento, com o rastro por extenso. */
function boardOutcomeText(pulses: number, trace: readonly number[], reaches: boolean, correct: boolean, landing: number): string {
  const { target } = TUTORIAL_ORBIT
  const path = trace.join(' → ')
  if (correct) return `Certo! Com ${pulses} pulsos a sonda vai ${path} e pousa no ${target}.`
  if (reaches) return `Chega ao ${target} (${path}), mas dá uma volta a mais. O jogo só aceita a MENOR rota.`
  return `Com ${pulses} pulsos a sonda para no ${landing} (${path}), não no ${target}.`
}

/**
 * Quadro interativo da órbita, em SVG, com a mesma linguagem visual do jogo:
 * anel com as estações numeradas, saída em amarelo, alvo em ciano, estações
 * visitadas em violeta e o rastro da sonda ligando os pousos.
 *
 * Fluxo: o jogador escolhe os pulsos → "Lançar" revela o rastro pulso a pulso
 * → ao terminar, a resposta certa é sempre explicada (tenha acertado ou não).
 * O cálculo vem de `evaluateOrbitGuess`, o mesmo do jogo.
 */
function OrbitBoard({ board }: { board: TutorialBoard }): JSX.Element {
  const { modulus, start, target, step, solution } = TUTORIAL_ORBIT

  // Pulsos escolhidos (null = ainda não escolheu); se já lançou; e quantos
  // pousos do rastro já apareceram na tela (anima o preenchimento da órbita).
  const [pulses, setPulses] = useState<number | null>(null)
  const [launched, setLaunched] = useState(false)
  const [revealed, setRevealed] = useState(0)

  // Resultado da escolha atual (inclui o rastro completo com a estação de saída).
  const result = useMemo(
    () => (pulses === null ? null : evaluateOrbitGuess(TUTORIAL_ORBIT, pulses)),
    [pulses],
  )
  // Rastro completo; memoizado para o useEffect de animação não reexecutar à toa.
  const fullTrace = useMemo(() => result?.trace ?? [start], [result, start])

  // Depois de lançar, revela um pouso a cada REVEAL_MS até completar o rastro.
  useEffect(() => {
    if (!launched) return
    const timers = fullTrace.map((_, index) =>
      window.setTimeout(() => setRevealed(index + 1), index * REVEAL_MS),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [launched, fullTrace])

  const choose = (value: number) => {
    setPulses(value)
    setLaunched(false)
    setRevealed(0)
  }

  const reset = () => {
    setPulses(null)
    setLaunched(false)
    setRevealed(0)
  }

  // Parte do rastro já visível: antes de lançar, só a saída.
  const shownTrace = launched ? fullTrace.slice(0, revealed) : [start]
  const visited = new Set(shownTrace)
  const points = shownTrace.map((residue) => stationPoint(residue, modulus))
  const probe = points[points.length - 1]
  const finished = launched && revealed >= fullTrace.length

  return (
    <div className="orbit-tutorial__board">
      <figure className="orbit-tutorial__board-figure">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label={`Órbita mod ${modulus} com saída em ${start} e alvo em ${target}`}
        >
          <circle className="orbit-board__ring" cx="50" cy="50" r={BOARD_RADIUS} />

          {/* Rastro da sonda ligando os pousos já revelados. */}
          {points.length > 1 ? (
            <polyline
              className="orbit-board__trail"
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          ) : null}

          {/* Uma estação por resíduo, colorida conforme seu papel. */}
          {Array.from({ length: modulus }, (_, residue) => {
            const p = stationPoint(residue, modulus)
            return (
              <g key={residue} className={`orbit-board__station ${stationKind(residue, visited)}`}>
                <circle cx={p.x} cy={p.y} r={residue === target ? TARGET_R : STATION_R} />
                <text x={p.x} y={p.y} dominantBaseline="central" textAnchor="middle">{residue}</text>
              </g>
            )
          })}

          {/* Sonda no último pouso revelado. */}
          <circle className="orbit-board__probe" cx={probe.x} cy={probe.y} r={PROBE_R} />
        </svg>
        <figcaption className="orbit-tutorial__board-legend">
          <span className="is-start">● saída {start}</span>
          <span className="is-target">● alvo {target}</span>
          <span className="is-visited">● visitada</span>
        </figcaption>
      </figure>

      <div className="orbit-tutorial__board-controls">
        <p className="orbit-tutorial__board-prompt">Quantos pulsos levam a sonda ao {target}?</p>
        <div className="orbit-tutorial__options">
          {board.options.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={pulses === option}
              disabled={launched}
              onClick={() => choose(option)}
            >
              {option} pulsos
            </button>
          ))}
        </div>

        {launched ? (
          <button type="button" className="orbit-secondary orbit-tutorial__launch" onClick={reset}>
            Tentar outra
          </button>
        ) : (
          <button
            type="button"
            className="orbit-primary orbit-tutorial__launch"
            disabled={pulses === null}
            onClick={() => setLaunched(true)}
          >
            Lançar
          </button>
        )}

        {/* Antes de terminar, mostra a dica; ao terminar, explica o resultado. */}
        {finished && result ? (
          <div
            className={`orbit-tutorial__feedback ${result.isCorrect ? 'is-right' : 'is-wrong'}`}
            role="status"
          >
            <p>
              <b aria-hidden="true">{result.isCorrect ? '✓ ' : '✗ '}</b>
              {boardOutcomeText(result.pulses, fullTrace, result.reachesTarget, result.isCorrect, result.landing)}
            </p>
            {!result.isCorrect ? (
              <p className="orbit-tutorial__board-answer">
                Resposta certa: <b>{solution} pulsos</b> — {start} + {solution} × {step} = {start + solution * step},
                e {start + solution * step} mod {modulus} = {target}.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="orbit-tutorial__hint">{board.hint}</p>
        )}
      </div>
    </div>
  )
}

/** Botão "X" no canto do painel: fecha o tutorial e volta à tela inicial do jogo. */
function TutorialCloseButton({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="orbit-tutorial__close"
      aria-label="Fechar tutorial"
      onClick={onClose}
    >
      ×
    </button>
  )
}

/** Tela de boas-vindas: contexto do jogo e o botão que inicia o passo a passo. */
function TutorialWelcome({
  onStart,
  onClose,
}: {
  onStart: () => void
  onClose: () => void
}): JSX.Element {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  return (
    <div className="orbit-modal-wrap orbit-tutorial-wrap">
      <section
        className="orbit-panel orbit-tutorial orbit-tutorial--welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orbit-tutorial-title"
      >
        <TutorialCloseButton onClose={onClose} />

        <p className="orbit-tutorial__progress">COMO JOGAR</p>

        <h2 id="orbit-tutorial-title" ref={titleRef} tabIndex={-1}>
          {MODULAR_ORBIT_TUTORIAL_INTRO.title}
        </h2>
        <p className="orbit-tutorial__body">{MODULAR_ORBIT_TUTORIAL_INTRO.body}</p>
        <p className="orbit-tutorial__hint">{MODULAR_ORBIT_TUTORIAL_INTRO.hint}</p>

        <div className="orbit-tutorial__actions orbit-tutorial__actions--center">
          <button type="button" className="orbit-primary" onClick={onStart}>
            Começar tutorial
          </button>
        </div>
      </section>
    </div>
  )
}

export default function ModularOrbitTutorialView({
  onFinish,
  onSkip,
  onClose,
}: ModularOrbitTutorialViewProps): JSX.Element {
  // Começa na tela de boas-vindas; os passos só aparecem depois de "Começar".
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  // Resposta escolhida na prática do passo atual (null = ainda não respondeu).
  const [answer, setAnswer] = useState<number | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  const step = MODULAR_ORBIT_TUTORIAL_STEPS[index]
  const total = MODULAR_ORBIT_TUTORIAL_STEPS.length
  const isFirst = index === 0
  const isLast = index === total - 1
  // Passos com prática só liberam o "Próximo" depois da resposta certa.
  const canAdvance = !step.quiz || answer === step.quiz.correct

  // A cada troca de passo, leva o foco ao título (ajuda leitores de tela).
  useEffect(() => { if (started) titleRef.current?.focus() }, [index, started])

  const goTo = (next: number) => {
    setIndex(next)
    setAnswer(null)
  }

  if (!started) {
    return <TutorialWelcome onStart={() => setStarted(true)} onClose={onClose} />
  }

  return (
    <div className="orbit-modal-wrap orbit-tutorial-wrap">
      <section
        className="orbit-panel orbit-tutorial"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orbit-tutorial-title"
      >
        <TutorialCloseButton onClose={onClose} />

        <p className="orbit-tutorial__progress">
          TUTORIAL · PASSO {index + 1} DE {total}
        </p>
        <div className="orbit-tutorial__dots" aria-hidden="true">
          {MODULAR_ORBIT_TUTORIAL_STEPS.map((_, dot) => (
            <i key={dot} className={dot <= index ? 'is-done' : ''} />
          ))}
        </div>

        <h2 id="orbit-tutorial-title" ref={titleRef} tabIndex={-1}>{step.title}</h2>
        <p className="orbit-tutorial__body">{step.body}</p>

        {step.math ? (
          <div className="orbit-tutorial__math">
            {step.math.map((line) => <code key={line}>{line}</code>)}
          </div>
        ) : null}

        {step.traces?.map((trace) => <OrbitTrace key={trace.pulses} trace={trace} />)}

        {step.quiz ? (
          <TutorialPractice quiz={step.quiz} answer={answer} onAnswer={setAnswer} />
        ) : null}

        {step.board ? <OrbitBoard key={index} board={step.board} /> : null}

        {step.hint ? <p className="orbit-tutorial__hint">{step.hint}</p> : null}

        <div className="orbit-tutorial__actions">
          <button type="button" className="orbit-tutorial__skip" onClick={onSkip}>
            Pular tutorial
          </button>
          <button
            type="button"
            className="orbit-secondary"
            onClick={() => (isFirst ? setStarted(false) : goTo(index - 1))}
          >
            Voltar
          </button>
          <button
            type="button"
            className="orbit-primary"
            onClick={() => (isLast ? onFinish() : goTo(index + 1))}
            disabled={!canAdvance}
          >
            {isLast ? 'Começar missão' : 'Próximo'}
          </button>
        </div>
      </section>
    </div>
  )
}
