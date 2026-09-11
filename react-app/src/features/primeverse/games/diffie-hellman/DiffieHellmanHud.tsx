import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import {
  calculatePublicValue,
  calculateSharedSecret,
  createPowerTrace,
  DIFFIE_HELLMAN_ROUNDS,
} from './diffieHellmanLogic'
import GameIntro from '../../ui/GameIntro'
import { useDiffieHellmanStore } from './diffieHellmanStore'
import type { DiffieHellmanPhase } from './types'

interface DiffieHellmanHudProps {
  readonly quality: QualityLevel
  readonly onQualityChange: (quality: QualityLevel) => void
}

function formatTime(milliseconds: number): string {
  const safe = Math.max(0, milliseconds)
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function useRelayClock(): number {
  const phase = useDiffieHellmanStore((state) => state.phase)
  const startedAt = useDiffieHellmanStore((state) => state.startedAt)
  const completedAt = useDiffieHellmanStore((state) => state.completedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt || phase === 'intro' || phase === 'complete') return undefined
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(interval)
  }, [phase, startedAt])

  if (!startedAt) return 0
  return (completedAt ?? now) - startedAt
}

function RelayBrand({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <Link className={`dh-brand${compact ? ' dh-brand--compact' : ''}`} to="/jogos">
      <span className="dh-brand__mark" aria-hidden="true">⇄</span>
      <span>
        <strong>DH RELAY</strong>
        {!compact ? <small>PRIMEVERSE // CANAL 06</small> : null}
      </span>
    </Link>
  )
}

function IntroPanel({
  quality,
  onQualityChange,
}: DiffieHellmanHudProps): JSX.Element {

  const start = useDiffieHellmanStore((state) => state.start)

  return (
    <GameIntro
      title="Diffie–Hellman Relay"
      emphasis="Relay"
      instruction="Troque um segredo em canal aberto. Escolha seu expoente privado, envie só a potência pública e chegue à mesma chave do outro lado."
      actionLabel="Abrir canal"
      accent="#54e0ff"
      mark="g"
      onStart={() => start()}
    >
      <QualityControl value={quality} onChange={onQualityChange} />
    </GameIntro>
  )
}

function MissionTopbar({
  quality,
  onQualityChange,
}: DiffieHellmanHudProps): JSX.Element {
  const phase = useDiffieHellmanStore((state) => state.phase)
  const roundIndex = useDiffieHellmanStore((state) => state.roundIndex)
  const score = useDiffieHellmanStore((state) => state.score)
  const mistakes = useDiffieHellmanStore((state) => state.mistakes)
  const restart = useDiffieHellmanStore((state) => state.restart)
  const elapsed = useRelayClock()
  const transit = phase === 'public-transit' || phase === 'secret-transit'

  return (
    <header className="dh-topbar">
      <RelayBrand compact />
      <div className="dh-rounds" aria-label={`Transmissão ${roundIndex + 1} de ${DIFFIE_HELLMAN_ROUNDS}`}>
        {Array.from({ length: DIFFIE_HELLMAN_ROUNDS }, (_, index) => (
          <i key={index} className={index < roundIndex ? 'is-complete' : index === roundIndex ? 'is-current' : ''} />
        ))}
        <span>{String(roundIndex + 1).padStart(2, '0')} / 04</span>
      </div>
      <div className="dh-topbar__stats">
        <span><small>SCORE</small>{score.toLocaleString('pt-BR')}</span>
        <span><small>TEMPO</small>{formatTime(elapsed)}</span>
        <span><small>ERROS</small>{mistakes}</span>
      </div>
      <div className="dh-topbar__actions">
        <span className={`dh-signal${transit ? ' is-transit' : ''}`}><i />{transit ? 'PACOTE EM TRÂNSITO' : 'CANAL ATIVO'}</span>
        <QualityControl value={quality} onChange={onQualityChange} />
        <button type="button" className="dh-restart" onClick={restart}>Reiniciar</button>
      </div>
    </header>
  )
}

function PrivacyLedger(): JSX.Element {
  const challenge = useDiffieHellmanStore((state) => state.challenge)
  const privateExponent = useDiffieHellmanStore((state) => state.privateExponent)
  const publicValue = useDiffieHellmanStore((state) => state.publicValue)
  const sharedSecret = useDiffieHellmanStore((state) => state.sharedSecret)

  return (
    <aside className="dh-ledger" aria-label="Mapa de visibilidade dos valores">
      <div className="dh-ledger__header"><i /> VISIBILIDADE DO PROTOCOLO</div>
      <div className="dh-ledger__public">
        <span>PÚBLICO · EVE VÊ</span>
        <dl>
          <div><dt>Primo p</dt><dd>{challenge.prime}</dd></div>
          <div><dt>Gerador g</dt><dd>{challenge.generator}</dd></div>
          <div><dt>Chave A</dt><dd>{publicValue ?? '—'}</dd></div>
          <div><dt>Chave B</dt><dd>{challenge.bobPublic}</dd></div>
        </dl>
      </div>
      <div className="dh-ledger__private">
        <span>PRIVADO · EVE NÃO VÊ</span>
        <dl>
          <div><dt>Expoente a</dt><dd>{privateExponent ?? '🔒'}</dd></div>
          <div><dt>Expoente b</dt><dd>🔒</dd></div>
          <div><dt>Segredo K</dt><dd>{sharedSecret ?? '🔒'}</dd></div>
        </dl>
      </div>
      <p><strong>EVE // ESCUTA:</strong> p, g, A e B. <strong>COFRE DE EVE:</strong> K = ?</p>
    </aside>
  )
}

function FormulaHint({ base, exponent, modulus }: { base: number; exponent: number; modulus: number }): JSX.Element {
  return (
    <div className="dh-formula-hint">
      <span>Como calcular</span>
      <p>Multiplique {base} por ele mesmo {exponent} vezes e reduza o resto por {modulus} a cada passo.</p>
    </div>
  )
}

function CompletedProof({ kind }: { kind: 'public' | 'secret' }): JSX.Element | null {
  const challenge = useDiffieHellmanStore((state) => state.challenge)
  const privateExponent = useDiffieHellmanStore((state) => state.privateExponent)
  if (privateExponent === null) return null
  const base = kind === 'public' ? challenge.generator : challenge.bobPublic
  const answer = kind === 'public'
    ? calculatePublicValue(challenge, privateExponent)
    : calculateSharedSecret(challenge, privateExponent)
  const trace = createPowerTrace(base, privateExponent, challenge.prime)

  return (
    <details className="dh-proof">
      <summary>Ver cálculo confirmado</summary>
      <div aria-label={`Resíduos do cálculo: ${trace.map((step) => step.residue).join(', ')}`}>
        {trace.map((step) => <span key={step.multiplication}>{step.residue}</span>)}
        <strong>= {answer}</strong>
      </div>
    </details>
  )
}

function PrivateSelection(): JSX.Element {
  const challenge = useDiffieHellmanStore((state) => state.challenge)
  const selectPrivateExponent = useDiffieHellmanStore((state) => state.selectPrivateExponent)

  return (
    <div className="dh-task">
      <div className="dh-task__label">ETAPA 1 // COFRE DE ALICE</div>
      <h2>Escolha <em>a</em> em privado</h2>
      <p>As opções exibidas evitam chaves triviais. Sua escolha muda A e K, mas não será enviada ao relay.</p>
      <div className="dh-private-options" role="group" aria-label="Escolher expoente privado de Alice">
        {challenge.privateOptions.map((value) => (
          <button key={value} type="button" onClick={() => selectPrivateExponent(value)}>
            <small>EXPOENTE</small><strong>a = {value}</strong><span>Guardar 🔒</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PublicCalculation(): JSX.Element | null {
  const challenge = useDiffieHellmanStore((state) => state.challenge)
  const privateExponent = useDiffieHellmanStore((state) => state.privateExponent)
  const guess = useDiffieHellmanStore((state) => state.publicGuess)
  const setGuess = useDiffieHellmanStore((state) => state.setPublicGuess)
  const submit = useDiffieHellmanStore((state) => state.submitPublicValue)
  if (privateExponent === null) return null

  return (
    <div className="dh-task">
      <div className="dh-task__label">ETAPA 2 // VALOR PÚBLICO</div>
      <h2>Derive a chave <em>A</em></h2>
      <div className="dh-equation" aria-label={`${challenge.generator} elevado a ${privateExponent}, módulo ${challenge.prime}`}>
        <span>A</span><i>=</i><strong>{challenge.generator}<sup>{privateExponent}</sup></strong><small>mod {challenge.prime}</small>
      </div>
      <FormulaHint base={challenge.generator} exponent={privateExponent} modulus={challenge.prime} />
      <AnswerForm
        id="dh-public-answer"
        label="Resíduo público A"
        value={guess}
        max={challenge.prime - 1}
        button="Transmitir A"
        onChange={setGuess}
        onSubmit={submit}
      />
    </div>
  )
}

function SecretCalculation(): JSX.Element | null {
  const challenge = useDiffieHellmanStore((state) => state.challenge)
  const privateExponent = useDiffieHellmanStore((state) => state.privateExponent)
  const guess = useDiffieHellmanStore((state) => state.secretGuess)
  const setGuess = useDiffieHellmanStore((state) => state.setSecretGuess)
  const submit = useDiffieHellmanStore((state) => state.submitSharedSecret)
  if (privateExponent === null) return null

  return (
    <div className="dh-task">
      <div className="dh-task__label">ETAPA 3 // SEGREDO LOCAL</div>
      <h2>Sincronize <em>K</em></h2>
      <div className="dh-equation dh-equation--secret" aria-label={`${challenge.bobPublic} elevado a ${privateExponent}, módulo ${challenge.prime}`}>
        <span>K</span><i>=</i><strong>{challenge.bobPublic}<sup>{privateExponent}</sup></strong><small>mod {challenge.prime}</small>
      </div>
      <p className="dh-warning">🔒 B é público, mas este resultado deve permanecer no terminal de Alice.</p>
      <FormulaHint base={challenge.bobPublic} exponent={privateExponent} modulus={challenge.prime} />
      <AnswerForm
        id="dh-secret-answer"
        label="Segredo compartilhado K"
        value={guess}
        max={challenge.prime - 1}
        button="Confirmar segredo"
        onChange={setGuess}
        onSubmit={submit}
      />
      <CompletedProof kind="public" />
    </div>
  )
}

interface AnswerFormProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly max: number
  readonly button: string
  readonly onChange: (value: string) => void
  readonly onSubmit: () => boolean
}

function AnswerForm({ id, label, value, max, button, onChange, onSubmit }: AnswerFormProps): JSX.Element {
  const hasError = useDiffieHellmanStore((state) => state.feedback?.kind === 'error')
  return (
    <form className="dh-answer" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
      <label htmlFor={id}>{label}</label>
      <div>
        <input
          id={id}
          type="number"
          min="0"
          max={max}
          step="1"
          inputMode="numeric"
          autoComplete="off"
          placeholder="?"
          value={value}
          autoFocus
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? 'dh-feedback-detail' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="submit" disabled={value.trim() === ''}>{button}<span aria-hidden="true">↗</span></button>
      </div>
      <small>Resposta única: um inteiro entre 0 e {max}.</small>
    </form>
  )
}

function TransitState({ phase }: { phase: 'public-transit' | 'secret-transit' }): JSX.Element {
  const publicTransit = phase === 'public-transit'
  return (
    <div className="dh-task dh-task--transit" role="status" aria-live="polite">
      <div className="dh-transit-icon"><i /><i /><i /></div>
      <div className="dh-task__label">RELAY // PACOTE EM MOVIMENTO</div>
      <h2>{publicTransit ? 'Eve vê A passar.' : 'Eve vê só a confirmação.'}</h2>
      <p>{publicTransit
        ? 'Isso é esperado: A foi criado para ser público. O expoente a continua trancado em Alice.'
        : 'Diffie–Hellman termina ao estabelecer K. Uma cifra autenticada poderá usar essa chave depois, sem colocá-la no relay.'}</p>
    </div>
  )
}

function MissionConsole(): JSX.Element {
  const phase = useDiffieHellmanStore((state) => state.phase)
  const challenge = useDiffieHellmanStore((state) => state.challenge)

  return (
    <section className="dh-console" aria-labelledby="dh-mission-title">
      <p className="dh-sr-only" role="status" aria-live="polite">
        {phase === 'select-private' ? 'Escolha o expoente privado de Alice.' :
          phase === 'calculate-public' ? 'Calcule o valor público A.' :
            phase === 'public-transit' ? 'Valor público em trânsito.' :
              phase === 'calculate-secret' ? 'Calcule o segredo compartilhado K.' :
                'Confirmação do canal em trânsito.'}
      </p>
      <div className="dh-console__heading">
        <div><span>TRANSMISSÃO {challenge.round}</span><h3 id="dh-mission-title">{challenge.title}</h3></div>
        <code>PAYLOAD // {challenge.payload}</code>
      </div>
      {phase === 'select-private' ? <PrivateSelection /> : null}
      {phase === 'calculate-public' ? <PublicCalculation /> : null}
      {phase === 'public-transit' ? <TransitState phase="public-transit" /> : null}
      {phase === 'calculate-secret' ? <SecretCalculation /> : null}
      {phase === 'secret-transit' ? <TransitState phase="secret-transit" /> : null}
    </section>
  )
}

function FeedbackToast(): JSX.Element | null {
  const feedback = useDiffieHellmanStore((state) => state.feedback)
  const clearFeedback = useDiffieHellmanStore((state) => state.clearFeedback)

  useEffect(() => {
    if (!feedback) return undefined
    const timer = window.setTimeout(() => clearFeedback(feedback.id), 5_500)
    return () => window.clearTimeout(timer)
  }, [clearFeedback, feedback])

  if (!feedback) return null
  return (
    <div className={`dh-feedback dh-feedback--${feedback.kind}`} role="status" aria-live="polite">
      <i /><div><strong>{feedback.title}</strong><span id="dh-feedback-detail">{feedback.detail}</span></div>
      <button type="button" aria-label="Fechar mensagem" onClick={() => clearFeedback(feedback.id)}>×</button>
    </div>
  )
}

function RoundCompletePanel(): JSX.Element {
  const challenge = useDiffieHellmanStore((state) => state.challenge)
  const privateExponent = useDiffieHellmanStore((state) => state.privateExponent)
  const publicValue = useDiffieHellmanStore((state) => state.publicValue)
  const sharedSecret = useDiffieHellmanStore((state) => state.sharedSecret)
  const roundIndex = useDiffieHellmanStore((state) => state.roundIndex)
  const nextRound = useDiffieHellmanStore((state) => state.nextRound)

  return (
    <div className="dh-modal-wrap">
      <section className="dh-panel dh-round-complete" role="dialog" aria-modal="true" aria-labelledby="dh-round-title">
        <div className="dh-lock-mark">✓</div>
        <div className="dh-eyebrow">CANAL ESTABELECIDO</div>
        <h2 id="dh-round-title">Segredo <em>em comum.</em></h2>
        <p>Alice e Bob chegaram a <strong>K = {sharedSecret}</strong>. Eve viu os valores públicos e a confirmação, mas seu cofre continua mostrando K = ?.</p>
        <div className="dh-round-proof">
          <div><span>PÚBLICO</span><strong>{challenge.generator}<sup>{privateExponent}</sup> mod {challenge.prime} = A = {publicValue}</strong></div>
          <div><span>PRIVADO EM ALICE</span><strong>{challenge.bobPublic}<sup>{privateExponent}</sup> mod {challenge.prime} = K = {sharedSecret}</strong></div>
          <div><span>PRIVADO EM BOB</span><strong>terminal confirma o mesmo K</strong></div>
        </div>
        <CompletedProof kind="secret" />
        <button type="button" className="dh-primary" autoFocus onClick={nextRound}>
          Preparar transmissão {roundIndex + 2}<span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  )
}

function ResultPanel(): JSX.Element | null {
  const result = useDiffieHellmanStore((state) => state.result)
  const start = useDiffieHellmanStore((state) => state.start)
  if (!result) return null
  const accuracy = result.attempts === 0 ? 100 : Math.round(((result.attempts - result.mistakes) / result.attempts) * 100)

  return (
    <div className="dh-modal-wrap dh-modal-wrap--result">
      <section className="dh-panel dh-result" role="dialog" aria-modal="true" aria-labelledby="dh-result-title">
        <div className="dh-result__symbol">⇄<i>🔒</i></div>
        <div className="dh-eyebrow">QUATRO CANAIS SINCRONIZADOS</div>
        <h2 id="dh-result-title">Segredo trocado. <em>Segredo não enviado.</em></h2>
        <p>p, g, A e B atravessaram o relay. Os expoentes e as quatro chaves permaneceram nos terminais privados.</p>
        <div className="dh-result__stats">
          <div><span>SCORE</span><strong>{result.score.toLocaleString('pt-BR')}</strong></div>
          <div><span>PRECISÃO</span><strong>{accuracy}%</strong></div>
          <div><span>TEMPO</span><strong>{formatTime(result.elapsedMs)}</strong></div>
          <div><span>ERROS</span><strong>{result.mistakes}</strong></div>
        </div>
        <div className="dh-xp"><span>XP RECEBIDO</span><strong>+{result.xp} XP</strong>{result.isNewBest ? <small>NOVO RECORDE</small> : null}</div>
        <div className="dh-result__actions">
          <button type="button" className="dh-primary" autoFocus onClick={start}>Nova conexão <span aria-hidden="true">↻</span></button>
          <Link className="dh-secondary" to="/jogos">Escolher outro jogo</Link>
        </div>
      </section>
    </div>
  )
}

function phaseIsMission(phase: DiffieHellmanPhase): boolean {
  return phase !== 'intro' && phase !== 'round-complete' && phase !== 'complete'
}

export function DiffieHellmanHud(props: DiffieHellmanHudProps): JSX.Element {
  const phase = useDiffieHellmanStore((state) => state.phase)

  return (
    <div className="dh-hud">
      {phase === 'intro' ? <IntroPanel {...props} /> : null}
      {phaseIsMission(phase) ? <MissionTopbar {...props} /> : null}
      {phaseIsMission(phase) ? <MissionConsole /> : null}
      {phaseIsMission(phase) ? <PrivacyLedger /> : null}
      {phase === 'round-complete' ? <RoundCompletePanel /> : null}
      {phase === 'complete' ? <ResultPanel /> : null}
      {phaseIsMission(phase) ? <FeedbackToast /> : null}
    </div>
  )
}
