import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import {
  modularPower,
  RSA_INPUT_MAX_DIGITS,
  RSA_STAGE_LABELS,
  RSA_STAGES,
  RSA_VAULT_COUNT,
} from './rsaVaultLogic'
import GameIntro from '../../ui/GameIntro'
import { getRsaTutorialCopy, type RsaTutorialTarget } from './rsaVaultTutorial'
import { useRsaVaultStore } from './rsaVaultStore'
import type { RsaInputField, RsaStage, RsaVaultChallenge } from './types'

interface RsaVaultHudProps {
  quality: QualityLevel
  onQualityChange: (quality: QualityLevel) => void
}

function tutorialClass(
  base: string,
  target: RsaTutorialTarget | null,
  expected: RsaTutorialTarget,
): string {
  return `${base}${target === expected ? ' tutorial-highlight' : ''}`
}

function formatTime(milliseconds: number): string {
  const safe = Math.max(0, milliseconds)
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  const tenths = Math.floor((safe % 1_000) / 100)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
}

function useMissionClock(): number {
  const phase = useRsaVaultStore((state) => state.phase)
  const startedAt = useRsaVaultStore((state) => state.startedAt)
  const completedAt = useRsaVaultStore((state) => state.completedAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt || phase === 'intro' || phase === 'complete') return undefined
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(interval)
  }, [phase, startedAt])

  if (!startedAt) return 0
  return (completedAt ?? now) - startedAt
}

function TutorialOverlay(): JSX.Element | null {
  const isActive = useRsaVaultStore((state) => state.isTutorialActive)
  const step = useRsaVaultStore((state) => state.tutorialStep)
  const nextTutorialStep = useRsaVaultStore((state) => state.nextTutorialStep)
  const skipTutorial = useRsaVaultStore((state) => state.skipTutorial)
  const actionRef = useRef<HTMLButtonElement>(null)
  const copy = getRsaTutorialCopy(step)

  useEffect(() => {
    if (!isActive) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        skipTutorial()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, skipTutorial])

  useEffect(() => {
    if (isActive) actionRef.current?.focus()
  }, [isActive, step])

  if (!isActive || !copy) return null

  const isLastStep = step === 7
  return (
    <div className="rsa-tutorial" role="region" aria-labelledby="rsa-tutorial-title">
      <div className="rsa-tutorial__veil" aria-hidden="true" />
      <section className="rsa-tutorial__panel">
        <p className="rsa-tutorial__counter">PASSO {step} DE 7</p>
        <h2 id="rsa-tutorial-title">{copy.title}</h2>
        <p id="rsa-tutorial-description" aria-live="polite">{copy.body}</p>
        <div className="rsa-tutorial__actions">
          <button className="rsa-tutorial__skip" type="button" onClick={skipTutorial}>
            Pular tutorial
          </button>
          <button ref={actionRef} className="rsa-tutorial__next" type="button" onClick={nextTutorialStep}>
            {isLastStep ? 'Começar a jogar' : 'Próximo'}
          </button>
        </div>
        <small className="rsa-tutorial__hint">Pressione Esc para pular</small>
      </section>
    </div>
  )
}

function VaultBrand({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <Link className={`rsa-brand${compact ? ' rsa-brand--compact' : ''}`} to="/jogos">
      <span className="rsa-brand__mark" aria-hidden="true">R</span>
      <span>
        <strong>RSA VAULT</strong>
        {!compact ? <small>PRIMEVERSE // ARQUIVO 05</small> : null}
      </span>
    </Link>
  )
}

function IntroPanel({ quality, onQualityChange }: RsaVaultHudProps): JSX.Element {

  const start = useRsaVaultStore((state) => state.start)

  return (
    <GameIntro
      title="RSA Vault"
      emphasis="Vault"
      instruction="Um cofre guardado por n = p × q. Fatore o módulo, calcule o expoente privado e gire a chave."
      actionLabel="Abrir o cofre"
      accent="#ffc857"
      mark="n"
      onStart={() => start()}
    >
      <QualityControl value={quality} onChange={onQualityChange} />
    </GameIntro>
  )
}

function Topbar({ quality, onQualityChange, tutorialTarget }: RsaVaultHudProps & { tutorialTarget: RsaTutorialTarget | null }): JSX.Element {
  const vaultIndex = useRsaVaultStore((state) => state.vaultIndex)
  const phase = useRsaVaultStore((state) => state.phase)
  const restart = useRsaVaultStore((state) => state.restart)

  return (
    <header className={tutorialClass("rsa-topbar", tutorialTarget, 'stage-rail')}>
      <VaultBrand compact />
      <div className="rsa-vault-progress" aria-label={`Cofre ${vaultIndex + 1} de ${RSA_VAULT_COUNT}`}>
        {Array.from({ length: RSA_VAULT_COUNT }, (_, index) => (
          <i key={index} className={index < vaultIndex ? 'is-complete' : index === vaultIndex ? 'is-current' : ''} />
        ))}
        <span>{String(vaultIndex + 1).padStart(2, '0')} / 0{RSA_VAULT_COUNT}</span>
      </div>
      <div className="rsa-topbar__actions">
        <span className={`rsa-signal${phase === 'unlocking' ? ' is-unlocking' : ''}`}>
          <i /> {phase === 'unlocking' ? 'FERROLHOS EM MOVIMENTO' : 'CANAL SEGURO'}
        </span>
        <QualityControl value={quality} onChange={onQualityChange} />
        <button className="rsa-restart" type="button" onClick={restart}>Reiniciar</button>
      </div>
    </header>
  )
}

function StageRail({ tutorialTarget }: { tutorialTarget: RsaTutorialTarget | null }): JSX.Element {
  const stage = useRsaVaultStore((state) => state.stage)
  const completedStages = useRsaVaultStore((state) => state.completedStages)

  return (
    <ol className={tutorialClass("rsa-stage-rail", tutorialTarget, 'stage-rail')} aria-label="Etapas do cofre">
      {RSA_STAGES.map((item, index) => {
        const complete = completedStages.includes(item)
        const current = item === stage && !complete
        return (
          <li key={item} className={complete ? 'is-complete' : current ? 'is-current' : ''} aria-current={current ? 'step' : undefined}>
            <span>{complete ? '✓' : String(index + 1).padStart(2, '0')}</span>
            <small>{RSA_STAGE_LABELS[item]}</small>
          </li>
        )
      })}
    </ol>
  )
}

interface NumericInputProps {
  id: string
  label: string
  field: RsaInputField
  value: string
  placeholder?: string
  autoFocus?: boolean
}

function NumericInput({ id, label, field, value, placeholder = '?', autoFocus }: NumericInputProps): JSX.Element {
  const setInput = useRsaVaultStore((state) => state.setInput)
  const hasError = useRsaVaultStore((state) => state.feedback?.kind === 'error')
  return (
    <label className="rsa-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck="false"
        pattern="[0-9]*"
        maxLength={RSA_INPUT_MAX_DIGITS}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? 'rsa-feedback-detail' : undefined}
        onChange={(event) => setInput(field, event.target.value)}
      />
    </label>
  )
}

function FactorStage({ challenge }: { challenge: RsaVaultChallenge }): JSX.Element {
  const inputs = useRsaVaultStore((state) => state.inputs)
  return (
    <>
      <div className="rsa-equation" aria-label={`p vezes q igual a ${challenge.modulus}`}>
        <strong>p</strong><i>×</i><strong>q</strong><i>=</i><span>{challenge.modulus.toString()}</span>
      </div>
      <p>Encontre os dois números primos cujo produto forma o módulo público.</p>
      <div className="rsa-fields rsa-fields--pair">
        <NumericInput id="rsa-factor-p" label="PRIMO p" field="p" value={inputs.p} autoFocus />
        <NumericInput id="rsa-factor-q" label="PRIMO q" field="q" value={inputs.q} />
      </div>
      <small className="rsa-hint">Teste divisores primos apenas até √{challenge.modulus.toString()}.</small>
    </>
  )
}

function TotientStage({ challenge }: { challenge: RsaVaultChallenge }): JSX.Element {
  const inputs = useRsaVaultStore((state) => state.inputs)
  return (
    <>
      <div className="rsa-equation" aria-label={`phi de ${challenge.modulus} igual a p menos um vezes q menos um`}>
        <strong>φ({challenge.modulus.toString()})</strong><i>=</i><span>(p−1)(q−1)</span>
      </div>
      <p>Remova uma unidade de cada primo e multiplique para medir o ciclo da chave.</p>
      <div className="rsa-fields">
        <NumericInput id="rsa-totient" label="VALOR DE φ(N)" field="totient" value={inputs.totient} autoFocus />
      </div>
      <small className="rsa-hint">Se N = p × q com primos distintos, φ(N) = (p−1)(q−1).</small>
    </>
  )
}

function InverseStage({ challenge }: { challenge: RsaVaultChallenge }): JSX.Element {
  const inputs = useRsaVaultStore((state) => state.inputs)
  return (
    <>
      <div className="rsa-equation" aria-label={`${challenge.publicExponent} vezes d congruente a um módulo ${challenge.totient}`}>
        <span>{challenge.publicExponent.toString()}</span><i>×</i><strong>d</strong><i>≡</i><span>1</span><small>mod {challenge.totient.toString()}</small>
      </div>
      <p>Encontre o expoente privado: ele desfaz a ação do expoente público e.</p>
      <div className="rsa-fields">
        <NumericInput id="rsa-private-exponent" label="EXPOENTE PRIVADO d" field="privateExponent" value={inputs.privateExponent} autoFocus />
      </div>
      <small className="rsa-hint">Encontre o menor d positivo tal que e·d = 1 + k·φ(N), ou use o algoritmo de Euclides.</small>
    </>
  )
}

function ModularWorkbench({ challenge }: { challenge: RsaVaultChallenge }): JSX.Element {
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set())

  useEffect(() => setRevealed(new Set()), [challenge.id])

  return (
    <div className="rsa-workbench" aria-label="Bancada de exponenciação modular">
      <span>BANCADA Cᵈ mod N</span>
      <div>
        {challenge.encryptedBlocks.map((cipher, index) => {
          const isRevealed = revealed.has(index)
          const plaintext = modularPower(cipher, challenge.privateExponent, challenge.modulus)
          return (
            <button
              type="button"
              key={`${challenge.id}-${index}`}
              className={isRevealed ? 'is-revealed' : ''}
              aria-label={isRevealed
                ? `Bloco ${cipher} resulta em ${plaintext}`
                : `Processar bloco cifrado ${cipher}`}
              onClick={() => setRevealed((current) => new Set([...current, index]))}
            >
              <small>C {cipher.toString()}</small>
              <i aria-hidden="true">{isRevealed ? '→' : '⋮'}</i>
              <strong>{isRevealed ? plaintext.toString() : '?'}</strong>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DecryptStage({ challenge }: { challenge: RsaVaultChallenge }): JSX.Element {
  const inputs = useRsaVaultStore((state) => state.inputs)
  const hasError = useRsaVaultStore((state) => state.feedback?.kind === 'error')
  return (
    <>
      <div className="rsa-cipher-row" aria-label={`Blocos cifrados: ${challenge.encryptedBlocks.join(', ')}`}>
        {challenge.encryptedBlocks.map((block, index) => <span key={`${block}-${index}`}>{block.toString()}</span>)}
      </div>
      <p>Eleve cada bloco C a d, reduza módulo N e converta os resultados por A=1…Z=26.</p>
      <ModularWorkbench challenge={challenge} />
      <label className="rsa-field rsa-field--message" htmlFor="rsa-message">
        <span>MENSAGEM DECIFRADA</span>
        <input
          id="rsa-message"
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
          placeholder="PALAVRA"
          maxLength={24}
          value={inputs.message}
          autoFocus
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? 'rsa-feedback-detail' : undefined}
          onChange={(event) => useRsaVaultStore.getState().setInput('message', event.target.value)}
        />
      </label>
    </>
  )
}

const STAGE_BUTTON_LABEL: Readonly<Record<RsaStage, string>> = {
  factor: 'ACOPLAR PRIMOS',
  totient: 'CALIBRAR TOTIENTE',
  inverse: 'SINTETIZAR CHAVE',
  decrypt: 'ABRIR COFRE',
}

function PuzzleConsole({ tutorialTarget }: { tutorialTarget: RsaTutorialTarget | null }): JSX.Element {
  const phase = useRsaVaultStore((state) => state.phase)
  const challenge = useRsaVaultStore((state) => state.challenge)
  const stage = useRsaVaultStore((state) => state.stage)
  const submitStage = useRsaVaultStore((state) => state.submitStage)

  return (
    <section className={tutorialClass("rsa-console", tutorialTarget, 'console')} aria-labelledby="rsa-console-title">
      <div className={tutorialClass("rsa-stage-rail", tutorialTarget, 'stage-rail')}>COFRE {challenge.level} // {challenge.codename}</div>
      <h2 id="rsa-console-title">{RSA_STAGE_LABELS[stage]}</h2>
      <StageRail tutorialTarget={tutorialTarget} />
      <form
        key={`${challenge.id}-${stage}`}
        onSubmit={(event) => {
          event.preventDefault()
          submitStage()
        }}
      >
        {stage === 'factor' ? <FactorStage challenge={challenge} /> : null}
        {stage === 'totient' ? <TotientStage challenge={challenge} /> : null}
        {stage === 'inverse' ? <InverseStage challenge={challenge} /> : null}
        {stage === 'decrypt' ? <DecryptStage challenge={challenge} /> : null}
        <button className="rsa-submit" type="submit" disabled={phase !== 'playing'}>
          {phase === 'unlocking' ? 'DESTRAVANDO…' : STAGE_BUTTON_LABEL[stage]}
          <span aria-hidden="true">⌁</span>
        </button>
      </form>
    </section>
  )
}

function Telemetry({ tutorialTarget }: { tutorialTarget: RsaTutorialTarget | null }): JSX.Element {
  const challenge = useRsaVaultStore((state) => state.challenge)
  const completedStages = useRsaVaultStore((state) => state.completedStages)
  const score = useRsaVaultStore((state) => state.score)
  const attempts = useRsaVaultStore((state) => state.attempts)
  const mistakes = useRsaVaultStore((state) => state.mistakes)
  const elapsed = useMissionClock()
  const accuracy = attempts === 0 ? 100 : Math.round(((attempts - mistakes) / attempts) * 100)

  return (
    <aside className="rsa-telemetry" aria-label="Telemetria criptográfica">
      <div className="rsa-telemetry__stats">
        <div><span>SCORE</span><strong>{score.toLocaleString('pt-BR')}</strong></div>
        <div><span>TEMPO</span><strong>{formatTime(elapsed)}</strong></div>
        <div><span>PRECISÃO</span><strong>{accuracy}%</strong></div>
      </div>
      <div className={tutorialClass("rsa-public-key", tutorialTarget, 'public-key')}>
        <span>CHAVE PÚBLICA</span>
        <strong>({challenge.modulus.toString()}, {challenge.publicExponent.toString()})</strong>
        <small>N = módulo · e = expoente público</small>
      </div>
      <div className={tutorialClass("rsa-proof-stack", tutorialTarget, 'proof-stack')}>
        <span>REGISTRO DO MECANISMO</span>
        <p className={completedStages.includes('factor') ? 'is-live' : ''}>
          <i /> {completedStages.includes('factor') ? `${challenge.primeP} × ${challenge.primeQ} = ${challenge.modulus}` : 'p × q = N'}
        </p>
        <p className={completedStages.includes('totient') ? 'is-live' : ''}>
          <i /> {completedStages.includes('totient') ? `φ(N) = ${challenge.totient}` : 'φ(N) aguardando'}
        </p>
        <p className={completedStages.includes('inverse') ? 'is-live' : ''}>
          <i /> {completedStages.includes('inverse') ? `d = ${challenge.privateExponent}` : 'd aguardando'}
        </p>
      </div>
    </aside>
  )
}

function FeedbackToast(): JSX.Element | null {
  const feedback = useRsaVaultStore((state) => state.feedback)
  const clearFeedback = useRsaVaultStore((state) => state.clearFeedback)

  useEffect(() => {
    if (!feedback) return undefined
    const timer = window.setTimeout(() => clearFeedback(feedback.id), 5_200)
    return () => window.clearTimeout(timer)
  }, [clearFeedback, feedback])

  if (!feedback) return null
  return (
    <div className={`rsa-feedback rsa-feedback--${feedback.kind}`} role="status" aria-live="polite">
      <i />
      <div><strong>{feedback.title}</strong><span id="rsa-feedback-detail">{feedback.detail}</span></div>
      <button type="button" aria-label="Fechar mensagem" onClick={() => clearFeedback(feedback.id)}>×</button>
    </div>
  )
}

function UnlockingOverlay(): JSX.Element {
  const challenge = useRsaVaultStore((state) => state.challenge)
  return (
    <div className="rsa-unlocking" role="status" aria-live="polite">
      <span><i /><i /><i /></span>
      <strong>VALIDANDO {challenge.message}</strong>
      <small>RETRAINDO FERROLHOS RSA</small>
    </div>
  )
}

function VaultOpenPanel(): JSX.Element {
  const challenge = useRsaVaultStore((state) => state.challenge)
  const vaultIndex = useRsaVaultStore((state) => state.vaultIndex)
  const roundResults = useRsaVaultStore((state) => state.roundResults)
  const nextVault = useRsaVaultStore((state) => state.nextVault)
  const round = roundResults[roundResults.length - 1]

  return (
    <div className="rsa-modal-wrap rsa-modal-wrap--open">
      <section className="rsa-panel rsa-open-panel" role="dialog" aria-modal="true" aria-labelledby="rsa-open-title">
        <div className="rsa-open-mark" aria-hidden="true"><span>✓</span></div>
        <div className="rsa-eyebrow">COFRE {challenge.codename} DESLACRADO</div>
        <h2 id="rsa-open-title">Mensagem <em>{challenge.message}</em></h2>
        <div className="rsa-complete-proof">
          <span>{challenge.primeP.toString()} × {challenge.primeQ.toString()} = {challenge.modulus.toString()}</span>
          <span>φ = {challenge.totient.toString()}</span>
          <span>{challenge.publicExponent.toString()} × {challenge.privateExponent.toString()} ≡ 1</span>
        </div>
        <p>
          {challenge.encryptedBlocks.map(String).join(' · ')} atravessou a chave privada e revelou
          os blocos {challenge.plaintextBlocks.map(String).join(' · ')}.
        </p>
        <div className="rsa-open-stats">
          <span>SCORE DO COFRE <strong>+{round?.score.toLocaleString('pt-BR') ?? 0}</strong></span>
          <span>ERROS <strong>{round?.mistakes ?? 0}</strong></span>
        </div>
        <button className="rsa-primary" type="button" autoFocus onClick={nextVault}>
          Acessar cofre {vaultIndex + 2} <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  )
}

function ResultPanel(): JSX.Element | null {
  const result = useRsaVaultStore((state) => state.result)
  const start = useRsaVaultStore((state) => state.start)
  if (!result) return null
  const accuracy = result.attempts === 0 ? 100 : Math.round(((result.attempts - result.mistakes) / result.attempts) * 100)

  return (
    <div className="rsa-modal-wrap rsa-modal-wrap--result">
      <section className="rsa-panel rsa-result" role="dialog" aria-modal="true" aria-labelledby="rsa-result-title">
        <div className="rsa-result__seal" aria-hidden="true"><span>RSA</span></div>
        <div className="rsa-eyebrow">ARQUIVO CRIPTOGRÁFICO RECUPERADO</div>
        <h2 id="rsa-result-title">A chave privada é <em>sua.</em></h2>
        <p>GEM · PRIME · EULER · VAULT — quatro mensagens reconstruídas sem expor um único segredo no canal público.</p>
        <div className="rsa-result__stats">
          <div><span>SCORE</span><strong>{result.score.toLocaleString('pt-BR')}</strong></div>
          <div><span>PRECISÃO</span><strong>{accuracy}%</strong></div>
          <div><span>TEMPO</span><strong>{formatTime(result.elapsedMs)}</strong></div>
          <div><span>TENTATIVAS</span><strong>{result.attempts}</strong></div>
        </div>
        <div className="rsa-result__xp">
          <span>XP RECEBIDO</span><strong>+{result.xp} XP</strong>
          {result.isNewBest ? <small>NOVO RECORDE</small> : null}
        </div>
        <div className="rsa-result__actions">
          <button className="rsa-primary" type="button" autoFocus onClick={start}>Nova incursão <span aria-hidden="true">↻</span></button>
          <Link className="rsa-secondary" to="/jogos">Voltar ao Primeverse</Link>
        </div>
      </section>
    </div>
  )
}

export function RsaVaultHud(props: RsaVaultHudProps): JSX.Element {
  const phase = useRsaVaultStore((state) => state.phase)
  const isTutorialActive = useRsaVaultStore((state) => state.isTutorialActive)
  const tutorialStep = useRsaVaultStore((state) => state.tutorialStep)
  const tutorialCopy = getRsaTutorialCopy(tutorialStep)
  const tutorialTarget = isTutorialActive ? tutorialCopy?.target ?? null : null
  const missionVisible = phase === 'playing' || phase === 'unlocking'

  return (
    <div className="rsa-vault__hud">
      {phase === 'intro' ? <IntroPanel {...props} /> : null}
      {missionVisible ? (
        <>
          <Topbar {...props} tutorialTarget={tutorialTarget} />
          <PuzzleConsole tutorialTarget={tutorialTarget} />
          <Telemetry tutorialTarget={tutorialTarget} />
          <FeedbackToast />
          {phase === 'unlocking' ? <UnlockingOverlay /> : null}
        </>
      ) : null}
      {phase === 'vault-open' ? <VaultOpenPanel /> : null}
      {phase === 'complete' ? <ResultPanel /> : null}
      {phase === 'playing' ? <TutorialOverlay /> : null}
    </div>
  )
}
