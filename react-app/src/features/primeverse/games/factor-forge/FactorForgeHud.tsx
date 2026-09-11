import { useEffect, useMemo, useState } from 'react'
import { isPrime } from '../../../../lib/math/primes'
import GameIntro from '../../ui/GameIntro'

import { getDivisorOptions, getLeafNodes } from './factorLogic'
import { useFactorForgeStore } from './factorForgeStore'
import type { ForgeQuality, ForgeSoundEvent } from './types'

interface FactorForgeHudProps {
  quality: ForgeQuality
  onQualityChange: (quality: ForgeQuality) => void
  onBack?: () => void
  onSoundEvent?: (event: ForgeSoundEvent) => void
}

function formatTime(milliseconds: number): string {
  const safeMilliseconds = Math.max(0, milliseconds)
  const minutes = Math.floor(safeMilliseconds / 60_000)
  const seconds = Math.floor((safeMilliseconds % 60_000) / 1_000)
  const tenths = Math.floor((safeMilliseconds % 1_000) / 100)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
}

function useForgeClock(): number {
  const phase = useFactorForgeStore((state) => state.phase)
  const startedAt = useFactorForgeStore((state) => state.startedAt)
  const completedAt = useFactorForgeStore((state) => state.completedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (phase !== 'playing') return undefined
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(interval)
  }, [phase, startedAt])

  if (!startedAt) return 0
  return (completedAt ?? now) - startedAt
}

function BackLink({ onBack, compact = false }: { onBack?: () => void; compact?: boolean }): JSX.Element {
  return (
    <a
      className={`factor-forge__back${compact ? ' factor-forge__back--compact' : ''}`}
      href="/jogos"
      onClick={onBack ? (event) => {
        event.preventDefault()
        onBack()
      } : undefined}
    >
      <span aria-hidden="true">←</span>
      <span>{compact ? 'Primeverse' : 'Voltar ao Primeverse'}</span>
    </a>
  )
}

function QualityPicker({
  quality,
  onQualityChange,
}: {
  quality: ForgeQuality
  onQualityChange: (quality: ForgeQuality) => void
}): JSX.Element {
  return (
    <label className="factor-forge__quality">
      <span>Qualidade</span>
      <select
        aria-label="Qualidade gráfica"
        value={quality}
        onChange={(event) => onQualityChange(event.target.value as ForgeQuality)}
      >
        <option value="low">Baixa</option>
        <option value="medium">Média</option>
        <option value="high">Alta</option>
      </select>
    </label>
  )
}

function IntroPanel({
  quality,
  onQualityChange,
  onBack,
}: Omit<FactorForgeHudProps, 'onSoundEvent'>): JSX.Element {
  const targetNumber = useFactorForgeStore((state) => state.targetNumber)
  const start = useFactorForgeStore((state) => state.start)
  const selectedChallenge = targetNumber

  return (
    <GameIntro
      title="Factor Forge"
      emphasis="Forge"
      instruction="Quebre um núcleo composto até restarem apenas cristais primos. Qualquer divisor válido serve; todo caminho leva à mesma assinatura."
      actionLabel="Ativar forja"
      accent="#ffb347"
      mark="12"
      onBack={onBack}
      onStart={() => start(selectedChallenge)}
    >
      <QualityPicker quality={quality} onQualityChange={onQualityChange} />
    </GameIntro>
  )
}

function DivisorConsole({ onSoundEvent }: Pick<FactorForgeHudProps, 'onSoundEvent'>): JSX.Element {
  const nodes = useFactorForgeStore((state) => state.nodes)
  const selectedNodeId = useFactorForgeStore((state) => state.selectedNodeId)
  const submitDivisor = useFactorForgeStore((state) => state.submitDivisor)
  const selectNode = useFactorForgeStore((state) => state.selectNode)
  const [input, setInput] = useState('')
  const selected = nodes.find((node) => node.id === selectedNodeId) ?? null
  const leaves = useMemo(() => getLeafNodes(nodes), [nodes])
  const compositeLeaves = leaves.filter((node) => !isPrime(node.value))
  const primeLeaves = leaves.filter((node) => isPrime(node.value))
  const options = selected ? getDivisorOptions(selected.value) : []

  useEffect(() => setInput(''), [selectedNodeId])

  const forge = (divisor: number) => {
    const valid = submitDivisor(divisor)
    onSoundEvent?.(valid ? 'split' : 'invalid')
    if (valid) setInput('')
  }

  return (
    <aside className="factor-forge__console" aria-label="Console da forja">
      <div className="factor-forge__console-head">
        <div>
          <span>CRISTAL ATIVO</span>
          <strong>{selected?.value ?? '—'}</strong>
        </div>
        <div className="factor-forge__stability">
          <span>ESTABILIDADE</span>
          <strong>{primeLeaves.length}/{leaves.length}</strong>
        </div>
      </div>

      {selected ? (
        <>
          <p className="factor-forge__console-prompt">
            Qual divisor deve partir <strong>{selected.value}</strong>?
          </p>
          <form
            className="factor-forge__divisor-form"
            onSubmit={(event) => {
              event.preventDefault()
              forge(Number(input))
            }}
          >
            <label htmlFor="forge-divisor">Divisor</label>
            <div>
              <input
                id="forge-divisor"
                type="number"
                min="2"
                max={selected.value - 1}
                step="1"
                inputMode="numeric"
                placeholder="ex: 7"
                autoComplete="off"
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
              <button type="submit" disabled={input.trim() === ''}>
                Dividir
              </button>
            </div>
          </form>

          <div className="factor-forge__suggestions">
            <span>SUGESTÕES DE CALIBRAÇÃO</span>
            <div>
              {options.map((divisor) => (
                <button key={divisor} type="button" onClick={() => forge(divisor)}>
                  {divisor} <small>× {selected.value / divisor}</small>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="factor-forge__console-empty">Selecione um cristal azul na árvore.</p>
      )}

      {compositeLeaves.length > 1 ? (
        <div className="factor-forge__pending-nodes">
          <span>NÚCLEOS PENDENTES</span>
          <div>
            {compositeLeaves.map((node) => (
              <button
                key={node.id}
                type="button"
                className={node.id === selectedNodeId ? 'is-active' : ''}
                onClick={() => selectNode(node.id)}
              >
                {node.value}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function PlayingHud(props: FactorForgeHudProps): JSX.Element {
  const targetNumber = useFactorForgeStore((state) => state.targetNumber)
  const nodes = useFactorForgeStore((state) => state.nodes)
  const steps = useFactorForgeStore((state) => state.steps)
  const invalidAttempts = useFactorForgeStore((state) => state.invalidAttempts)
  const restart = useFactorForgeStore((state) => state.restart)
  const elapsed = useForgeClock()
  const leaves = getLeafNodes(nodes)
  const expression = leaves.map((node) => node.value).sort((a, b) => a - b).join(' × ')
  const precision = steps + invalidAttempts === 0
    ? 100
    : Math.round((steps / (steps + invalidAttempts)) * 100)

  return (
    <>
      <header className="factor-forge__topbar">
        <BackLink onBack={props.onBack} compact />
        <div className="factor-forge__brand">
          <span>FACTOR</span> FORGE <small>// {targetNumber}</small>
        </div>
        <div className="factor-forge__top-actions">
          <QualityPicker quality={props.quality} onQualityChange={props.onQualityChange} />
          <button type="button" onClick={restart}>Reiniciar</button>
        </div>
      </header>

      <div className="factor-forge__metrics" aria-label="Status da missão">
        <div><span>TEMPO</span><strong>{formatTime(elapsed)}</strong></div>
        <div><span>PASSOS</span><strong>{String(steps).padStart(2, '0')}</strong></div>
        <div><span>PRECISÃO</span><strong>{precision}%</strong></div>
      </div>

      <DivisorConsole onSoundEvent={props.onSoundEvent} />

      <div className="factor-forge__equation" aria-label={`Decomposição atual: ${targetNumber} igual a ${expression}`}>
        <span>DECOMPOSIÇÃO ATUAL</span>
        <strong>{targetNumber} = {expression}</strong>
      </div>
    </>
  )
}

function ResultPanel({ onBack }: Pick<FactorForgeHudProps, 'onBack'>): JSX.Element | null {
  const result = useFactorForgeStore((state) => state.result)
  const bestRecords = useFactorForgeStore((state) => state.bestRecords)
  const restart = useFactorForgeStore((state) => state.restart)
  const nextChallenge = useFactorForgeStore((state) => state.nextChallenge)

  if (!result) return null
  const best = bestRecords[result.value]

  return (
    <div className="factor-forge__modal-wrap factor-forge__modal-wrap--result">
      <section className="factor-forge__result" aria-labelledby="factor-forge-result-title">
        <div className="factor-forge__completion-mark" aria-hidden="true">✓</div>
        <div className="factor-forge__eyebrow">NÚCLEO ESTABILIZADO</div>
        <h2 id="factor-forge-result-title">Assinatura <em>fundamental</em></h2>
        <div className="factor-forge__result-equation">{result.equation}</div>
        <p>
          Independentemente do caminho escolhido, os fatores primos convergiram para uma única
          decomposição.
        </p>

        <div className="factor-forge__result-grid">
          <div><span>SCORE</span><strong>{result.score.toLocaleString('pt-BR')}</strong></div>
          <div><span>TEMPO</span><strong>{formatTime(result.elapsedMs)}</strong></div>
          <div><span>PASSOS</span><strong>{result.steps}<small> / {result.optimalSteps} ideal</small></strong></div>
          <div><span>MELHOR</span><strong>{best?.score.toLocaleString('pt-BR') ?? result.score}</strong></div>
        </div>

        <div className="factor-forge__xp-award">
          <span>XP RECEBIDO</span>
          <strong>+{result.xp} XP</strong>
          {result.isNewBest ? <small>NOVO RECORDE</small> : null}
        </div>

        <div className="factor-forge__result-actions">
          <button className="factor-forge__primary-action" type="button" onClick={nextChallenge}>
            Próximo núcleo <span aria-hidden="true">→</span>
          </button>
          <button className="factor-forge__secondary-action" type="button" onClick={restart}>
            Tentar novamente
          </button>
          <BackLink onBack={onBack} />
        </div>
      </section>
    </div>
  )
}

export function FactorForgeHud(props: FactorForgeHudProps): JSX.Element {
  const phase = useFactorForgeStore((state) => state.phase)
  const feedback = useFactorForgeStore((state) => state.feedback)
  const clearFeedback = useFactorForgeStore((state) => state.clearFeedback)
  const onSoundEvent = props.onSoundEvent
  const [resultVisible, setResultVisible] = useState(false)

  useEffect(() => {
    if (phase !== 'complete') {
      setResultVisible(false)
      return undefined
    }

    const timeout = window.setTimeout(() => setResultVisible(true), 650)
    return () => window.clearTimeout(timeout)
  }, [phase])

  useEffect(() => {
    if (!feedback) return undefined
    if (phase === 'complete') onSoundEvent?.('complete')
    const timeout = window.setTimeout(() => clearFeedback(feedback.id), 3_200)
    return () => window.clearTimeout(timeout)
  }, [clearFeedback, feedback, onSoundEvent, phase])

  return (
    <div className="factor-forge__hud">
      {phase === 'intro' ? <IntroPanel {...props} /> : null}
      {phase === 'playing' ? <PlayingHud {...props} /> : null}
      {phase === 'complete' && resultVisible ? <ResultPanel onBack={props.onBack} /> : null}

      {feedback && phase !== 'intro' ? (
        <div
          className={`factor-forge__feedback factor-forge__feedback--${feedback.kind}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">{feedback.kind === 'error' ? '!' : '◆'}</span>
          {feedback.message}
        </div>
      ) : null}
    </div>
  )
}
