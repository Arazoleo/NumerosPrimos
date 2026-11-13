import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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
import {
  getRsaTutorialCopy,
  getRsaPracticeStep,
  isRsaTouchDevice,
  RSA_TOUCH_MEDIA_QUERY,
  type RsaTutorialTarget,
} from './rsaVaultTutorial'
import { useRsaVaultStore } from './rsaVaultStore'
import { getRsaTutorialPanelLayout } from './rsaVaultTutorialLayout'
import type { RsaLearningFeedback } from './rsaVaultLearningFeedback'
import { RSA_TUTORIAL_LAST_STEP, type RsaInputField, type RsaStage, type RsaVaultChallenge } from './types'

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

function useTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia(RSA_TOUCH_MEDIA_QUERY)
    const update = () => setIsTouchDevice(isRsaTouchDevice())
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return isTouchDevice
}

const PRACTICE_FOCUS_SELECTORS: Readonly<Record<RsaStage, string>> = {
  factor: '#rsa-factor-p',
  totient: '#rsa-totient',
  inverse: '#rsa-private-exponent',
  decrypt: '.rsa-workbench button',
}

function focusPracticeControl(stage: RsaStage): void {
  const control = document.querySelector<HTMLElement>(PRACTICE_FOCUS_SELECTORS[stage])
  control?.focus({ preventScroll: true })
  control?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function TutorialOverlay({ isTouchDevice }: { isTouchDevice: boolean }): JSX.Element | null {
  const isActive = useRsaVaultStore((state) => state.isTutorialActive)
  const tutorialStep = useRsaVaultStore((state) => state.tutorialStep)
  const reviewStep = useRsaVaultStore((state) => state.tutorialReviewStep)
  const nextTutorialStep = useRsaVaultStore((state) => state.nextTutorialStep)
  const prevTutorialStep = useRsaVaultStore((state) => state.prevTutorialStep)
  const resumeTutorial = useRsaVaultStore((state) => state.resumeTutorial)
  const skipTutorial = useRsaVaultStore((state) => state.skipTutorial)
  const stage = useRsaVaultStore((state) => state.stage)
  const panelRef = useRef<HTMLElement>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>()
  const step = reviewStep || tutorialStep
  const copy = getRsaTutorialCopy(step, isTouchDevice)
  const isPractice = getRsaTutorialCopy(tutorialStep)?.advance.kind === 'stage-correct'
  const isReviewing = reviewStep !== 0

  useLayoutEffect(() => {
    if (!isActive || isPractice) return undefined
    const panel = panelRef.current
    const hud = panel?.closest('.rsa-vault__hud')
    const target = hud?.querySelector('.tutorial-highlight')
    if (!panel || !hud || !target) return undefined
    const updateLayout = () => {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const bounds = hud.getBoundingClientRect()
      const rect = target.getBoundingClientRect()
      const layout = getRsaTutorialPanelLayout(
        { width: bounds.width, height: Math.min(bounds.height, window.innerHeight) },
        { left: rect.left - bounds.left, top: rect.top - bounds.top, right: rect.right - bounds.left, bottom: rect.bottom - bounds.top },
        { width: 470, height: panel.getBoundingClientRect().height },
      )
      setPanelStyle({ position: 'absolute', ...layout, transform: 'none' })
    }
    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [isActive, isPractice, step])

  useEffect(() => {
    if (!isActive) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPractice && event.key === 'Tab') {
        const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        if (!buttons?.length) return
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        const outsideActions = !Array.from(buttons).some((button) => button === document.activeElement)
        if (outsideActions || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault()
          const nextFocus = event.shiftKey ? last : first
          nextFocus.focus()
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        if (isReviewing) resumeTutorial()
        else skipTutorial()
        focusPracticeControl(stage)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, isPractice, isReviewing, resumeTutorial, skipTutorial, stage])

  useEffect(() => {
    if (!isActive) return
    if (isReviewing || !isPractice) {
      panelRef.current?.querySelector<HTMLHeadingElement>('h2')?.focus({ preventScroll: true })
      if (isPractice) panelRef.current?.scrollIntoView({ block: 'start', inline: 'nearest' })
      if (panelRef.current) panelRef.current.scrollTop = 0
    } else focusPracticeControl(stage)
  }, [isActive, isPractice, isReviewing, stage, step])

  if (!isActive || !copy) return null

  return (
    <div
      className={`rsa-tutorial${isPractice ? ' rsa-tutorial--practice' : ''}`}
      data-mode={isPractice ? 'practice' : 'presentation'}
      data-position={copy.position}
      data-step={step}
      data-reviewing={isReviewing || undefined}
      role={isPractice ? 'region' : 'dialog'}
      aria-modal={!isPractice || undefined}
      aria-labelledby="rsa-tutorial-title"
    >
      {!isPractice ? <div className="rsa-tutorial__veil" aria-hidden="true" /> : null}
      <section ref={panelRef} className="rsa-tutorial__panel" style={isPractice ? undefined : panelStyle}>
        <p className="rsa-tutorial__counter">{isReviewing ? 'REVISANDO PASSO' : 'PASSO'} {step} DE {RSA_TUTORIAL_LAST_STEP}</p>
        <h2 id="rsa-tutorial-title" tabIndex={-1}>{copy.title}</h2>
        {isReviewing ? (
          <p className="rsa-tutorial__review-note">
            Você está revendo uma explicação. Seu progresso foi mantido. Retome a etapa atual para continuar em {RSA_STAGE_LABELS[stage]}.
          </p>
        ) : null}
        <p id="rsa-tutorial-description" aria-live="polite">{copy.body}</p>
        {copy.hint ? <p className="rsa-tutorial__practice-hint">{copy.hint}</p> : null}
        <div className="rsa-tutorial__actions">
          <button className="rsa-tutorial__skip" type="button" onClick={() => { skipTutorial(); focusPracticeControl(stage) }}>
            Pular tutorial
          </button>
          <button className="rsa-tutorial__skip" type="button" disabled={step <= 1} onClick={prevTutorialStep}>
            Voltar
          </button>
          {isReviewing ? (
            <>
              {step + 1 < tutorialStep ? (
                <button className="rsa-tutorial__next" type="button" onClick={nextTutorialStep}>
                  Próxima explicação
                </button>
              ) : null}
              <button className="rsa-tutorial__next" type="button" onClick={resumeTutorial}>
                Retomar etapa atual
              </button>
            </>
          ) : !isPractice ? (
            <button className="rsa-tutorial__next" type="button" onClick={nextTutorialStep}>
              {step + 1 === getRsaPracticeStep('factor') ? 'Começar a praticar' : 'Próximo'}
            </button>
          ) : null}
        </div>
        <small className="rsa-tutorial__hint">
          {isReviewing
            ? isTouchDevice ? 'Toque em "Retomar etapa atual" para continuar' : 'Pressione Esc para retomar a etapa atual'
            : isTouchDevice ? 'Toque em "Pular tutorial" para sair' : 'Pressione Esc para pular'}
        </small>
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

function Topbar({ quality, onQualityChange }: RsaVaultHudProps): JSX.Element {
  const vaultIndex = useRsaVaultStore((state) => state.vaultIndex)
  const phase = useRsaVaultStore((state) => state.phase)
  const restart = useRsaVaultStore((state) => state.restart)
  const isTutorialActive = useRsaVaultStore((state) => state.isTutorialActive)
  const startTutorial = useRsaVaultStore((state) => state.startTutorial)

  return (
    <header className="rsa-topbar">
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
        {vaultIndex === 0 && phase === 'playing' && !isTutorialActive ? (
          <button className="rsa-help" type="button" onClick={startTutorial}>Ajuda</button>
        ) : null}
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
  autoFocus?: boolean
  tutorialTarget: RsaTutorialTarget | null
}

function NumericInput({ id, label, field, value, autoFocus = false, tutorialTarget }: NumericInputProps): JSX.Element {
  const setInput = useRsaVaultStore((state) => state.setInput)
  const tutorialStep = useRsaVaultStore((state) => state.tutorialStep)
  const isTutorialActive = useRsaVaultStore((state) => state.isTutorialActive)
  const isReviewing = useRsaVaultStore((state) => state.tutorialReviewStep !== 0)
  const feedback = useRsaVaultStore((state) => state.feedback)
  const isPresentation = isTutorialActive && getRsaTutorialCopy(tutorialStep)?.advance.kind === 'manual'
  const isReadOnly = isPresentation || isReviewing
  const isPractice = isTutorialActive && !isReadOnly
  const hasError = feedback?.kind === 'error'
  const targets: Partial<Record<RsaInputField, RsaTutorialTarget>> = {
    p: 'factor-p', q: 'factor-q', totient: 'totient', privateExponent: 'private-exponent',
  }
  const expectedTarget = targets[field] ?? null
  const isTutorialTarget = tutorialTarget === expectedTarget && expectedTarget !== null

  return (
    <label className={`rsa-field${isTutorialTarget ? ' tutorial-highlight' : ''}`} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck="false"
        pattern="[0-9]*"
        maxLength={RSA_INPUT_MAX_DIGITS}
        placeholder="?"
        value={value}
        autoFocus={autoFocus && !isTutorialActive}
        readOnly={isReadOnly}
        tabIndex={isReadOnly ? -1 : undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={[isPractice ? 'rsa-tutorial-description' : '', hasError ? 'rsa-feedback-detail' : ''].filter(Boolean).join(' ') || undefined}
        onPointerDown={(event) => {
          if (!isReadOnly && event.pointerType === 'touch') event.currentTarget.focus()
        }}
        onChange={(event) => {
          if (isReadOnly) return
          setInput(field, event.target.value)
        }}
      />
    </label>
  )
}

function FactorStage({ challenge, tutorialTarget }: { challenge: RsaVaultChallenge; tutorialTarget: RsaTutorialTarget | null }): JSX.Element {
  const inputs = useRsaVaultStore((state) => state.inputs)
  return (
    <>
      <div className="rsa-equation" aria-label={`p vezes q igual a ${challenge.modulus}`}>
        <strong>p</strong><i>×</i><strong>q</strong><i>=</i><span>{challenge.modulus.toString()}</span>
      </div>
      <p>Encontre os dois números primos cujo produto forma o módulo público.</p>
      <div className={tutorialClass('rsa-fields rsa-fields--pair', tutorialTarget, 'factor-pair')}>
        <NumericInput id="rsa-factor-p" label="PRIMO p" field="p" value={inputs.p} autoFocus tutorialTarget={tutorialTarget} />
        <NumericInput id="rsa-factor-q" label="PRIMO q" field="q" value={inputs.q} tutorialTarget={tutorialTarget} />
      </div>
      <small className="rsa-hint">Teste divisores primos apenas até √{challenge.modulus.toString()}.</small>
    </>
  )
}

function TotientStage({ challenge, tutorialTarget }: { challenge: RsaVaultChallenge; tutorialTarget: RsaTutorialTarget | null }): JSX.Element {
  const inputs = useRsaVaultStore((state) => state.inputs)
  return (
    <>
      <div className="rsa-equation" aria-label={`phi de ${challenge.modulus} igual a p menos um vezes q menos um`}>
        <strong>φ({challenge.modulus.toString()})</strong><i>=</i><span>(p−1)(q−1)</span>
      </div>
      <p>
        {tutorialTarget === 'totient'
          ? <>Registro do cofre: p = {inputs.p} e q = {inputs.q}. Esses fatores confirmados serão usados nesta conta.</>
          : 'Remova uma unidade de cada primo e multiplique para medir o ciclo da chave.'}
      </p>
      <div className="rsa-fields">
        <NumericInput id="rsa-totient" label="VALOR DE φ(N)" field="totient" value={inputs.totient} autoFocus tutorialTarget={tutorialTarget} />
      </div>
      <small className="rsa-hint">Se N = p × q com primos distintos, φ(N) = (p−1)(q−1).</small>
    </>
  )
}

function InverseStage({ challenge, tutorialTarget }: { challenge: RsaVaultChallenge; tutorialTarget: RsaTutorialTarget | null }): JSX.Element {
  const inputs = useRsaVaultStore((state) => state.inputs)
  return (
    <>
      <div className="rsa-equation" aria-label={`${challenge.publicExponent} vezes d congruente a um módulo ${challenge.totient}`}>
        <span>{challenge.publicExponent.toString()}</span><i>×</i><strong>d</strong><i>≡</i><span>1</span><small>mod {challenge.totient.toString()}</small>
      </div>
      <p>Encontre o expoente privado: ele desfaz a ação do expoente público e.</p>
      <div className="rsa-fields">
        <NumericInput id="rsa-private-exponent" label="EXPOENTE PRIVADO d" field="privateExponent" value={inputs.privateExponent} autoFocus tutorialTarget={tutorialTarget} />
      </div>
      <small className="rsa-hint">Encontre o menor d positivo tal que e·d = 1 + k·φ(N), ou use o algoritmo de Euclides.</small>
    </>
  )
}

function ModularWorkbench({ challenge, tutorialTarget }: { challenge: RsaVaultChallenge; tutorialTarget: RsaTutorialTarget | null }): JSX.Element {
  const isReviewing = useRsaVaultStore((state) => state.tutorialReviewStep !== 0)
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set())

  useEffect(() => setRevealed(new Set()), [challenge.id])

  return (
    <div className={tutorialClass('rsa-workbench', tutorialTarget, 'workbench')} aria-label="Bancada de exponenciação modular">
      <span>BANCADA Cᵈ mod N</span>
      <div>
        {challenge.encryptedBlocks.map((cipher, index) => {
          const isRevealed = revealed.has(index)
          const plaintext = modularPower(cipher, challenge.privateExponent, challenge.modulus)
          return (
            <button
              type="button"
              disabled={isReviewing}
              key={`${challenge.id}-${index}`}
              className={isRevealed ? 'is-revealed' : ''}
              aria-label={isRevealed
                ? `Bloco ${cipher} resulta em ${plaintext}`
                : `Processar bloco cifrado ${cipher}`}
              aria-describedby={tutorialTarget === 'workbench' ? 'rsa-tutorial-description' : undefined}
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

function DecryptStage({ challenge, tutorialTarget }: { challenge: RsaVaultChallenge; tutorialTarget: RsaTutorialTarget | null }): JSX.Element {
  const inputs = useRsaVaultStore((state) => state.inputs)
  const hasError = useRsaVaultStore((state) => state.feedback?.kind === 'error')
  const isReviewing = useRsaVaultStore((state) => state.tutorialReviewStep !== 0)
  return (
    <>
      <div className="rsa-cipher-row" aria-label={`Blocos cifrados: ${challenge.encryptedBlocks.join(', ')}`}>
        {challenge.encryptedBlocks.map((block, index) => <span key={`${block}-${index}`}>{block.toString()}</span>)}
      </div>
      <p>Eleve cada bloco C a d, reduza módulo N e converta os resultados por A=1…Z=26.</p>
      <ModularWorkbench challenge={challenge} tutorialTarget={tutorialTarget} />
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
          autoFocus={!tutorialTarget}
          readOnly={isReviewing}
          tabIndex={isReviewing ? -1 : undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={[tutorialTarget ? 'rsa-tutorial-description' : '', hasError ? 'rsa-feedback-detail' : ''].filter(Boolean).join(' ') || undefined}
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

function LearningFeedback({ learning }: { learning: RsaLearningFeedback }): JSX.Element {
  const feedbackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    feedbackRef.current?.focus({ preventScroll: true })
    feedbackRef.current?.scrollIntoView({ block: 'start', inline: 'nearest' })
  }, [learning])

  return (
    <div
      ref={feedbackRef}
      className={`rsa-guided-feedback rsa-guided-feedback--${learning.kind}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabIndex={-1}
    >
      <div className="rsa-guided-feedback__heading">
        <span className="rsa-guided-feedback__icon" aria-hidden="true">{learning.kind === 'success' ? '✓' : '!'}</span>
        <div>
          <span className="rsa-guided-feedback__state">
            {learning.kind === 'success' ? 'Etapa concluída' : 'Revise a resposta'} · {RSA_STAGE_LABELS[learning.stage]}
          </span>
          <strong>{learning.title}</strong>
        </div>
      </div>
      <div id="rsa-feedback-detail" className="rsa-guided-feedback__details">
        <p>{learning.detail}</p>
        <span className="rsa-guided-feedback__state">{learning.kind === 'error' ? 'Tentativa enviada' : 'Resultado confirmado'}</span>
        <code>{learning.equation}</code>
        <p>{learning.instruction}</p>
      </div>
    </div>
  )
}

function PuzzleConsole({ tutorialTarget, isTouchDevice }: { tutorialTarget: RsaTutorialTarget | null; isTouchDevice: boolean }): JSX.Element {
  const phase = useRsaVaultStore((state) => state.phase)
  const challenge = useRsaVaultStore((state) => state.challenge)
  const stage = useRsaVaultStore((state) => state.stage)
  const submitStage = useRsaVaultStore((state) => state.submitStage)
  const isTutorialActive = useRsaVaultStore((state) => state.isTutorialActive)
  const tutorialStep = useRsaVaultStore((state) => state.tutorialStep)
  const feedback = useRsaVaultStore((state) => state.feedback)
  const isReviewing = useRsaVaultStore((state) => state.tutorialReviewStep !== 0)
  const advance = getRsaTutorialCopy(tutorialStep)?.advance
  const isPractice = isTutorialActive && advance?.kind === 'stage-correct' && phase === 'playing'

  return (
    <section className={tutorialClass("rsa-console", tutorialTarget, 'console')} aria-labelledby="rsa-console-title">
      <div className="rsa-console__label"> COFRE {challenge.level} // {challenge.codename}</div>
      <h2 id="rsa-console-title">{RSA_STAGE_LABELS[stage]}</h2>
      <StageRail tutorialTarget={tutorialTarget} />
      {isPractice ? <TutorialOverlay isTouchDevice={isTouchDevice} /> : null}
      <form
        key={`${challenge.id}-${stage}`}
        onSubmit={(event) => {
          event.preventDefault()
          if (isReviewing || (isTutorialActive && advance?.kind === 'manual')) {
            return
          }
          submitStage()
        }}
      >
        {feedback?.learning ? <LearningFeedback learning={feedback.learning} /> : null}
        {stage === 'factor' ? <FactorStage challenge={challenge} tutorialTarget={tutorialTarget} /> : null}
        {stage === 'totient' ? <TotientStage challenge={challenge} tutorialTarget={tutorialTarget} /> : null}
        {stage === 'inverse' ? <InverseStage challenge={challenge} tutorialTarget={tutorialTarget} /> : null}
        {stage === 'decrypt' ? <DecryptStage challenge={challenge} tutorialTarget={tutorialTarget} /> : null}
        <button
          className={tutorialClass('rsa-submit', tutorialTarget, 'submit')}
          type="submit"
          disabled={phase !== 'playing' || isReviewing || (isTutorialActive && advance?.kind === 'manual')}
        >
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
  const hasLearningFeedback = Boolean(feedback?.learning)

  useEffect(() => {
    if (!feedback || hasLearningFeedback) return undefined
    const timer = window.setTimeout(() => clearFeedback(feedback.id), 5_200)
    return () => window.clearTimeout(timer)
  }, [clearFeedback, feedback, hasLearningFeedback])

  if (!feedback || hasLearningFeedback) return null
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
  const isTouchDevice = useTouchDevice()
  const phase = useRsaVaultStore((state) => state.phase)
  const isTutorialActive = useRsaVaultStore((state) => state.isTutorialActive)
  const tutorialStep = useRsaVaultStore((state) => state.tutorialStep)
  const reviewStep = useRsaVaultStore((state) => state.tutorialReviewStep)
  const tutorialCopy = getRsaTutorialCopy(reviewStep || tutorialStep, isTouchDevice)
  const tutorialMode = isTutorialActive && phase === 'playing'
    ? getRsaTutorialCopy(tutorialStep)?.advance.kind === 'manual' ? 'presentation' : 'practice'
    : undefined
  const tutorialTarget = tutorialMode && !(tutorialMode === 'practice' && reviewStep !== 0) ? tutorialCopy?.target ?? null : null
  const missionVisible = phase === 'playing' || phase === 'unlocking'

  return (
    <div className="rsa-vault__hud" data-tutorial-mode={tutorialMode}>
      {phase === 'intro' ? <IntroPanel {...props} /> : null}
      {missionVisible ? (
        <>
          <Topbar {...props}/>
          <PuzzleConsole tutorialTarget={tutorialTarget} isTouchDevice={isTouchDevice} />
          <Telemetry tutorialTarget={tutorialTarget} />
          <FeedbackToast />
          {phase === 'unlocking' ? <UnlockingOverlay /> : null}
        </>
      ) : null}
      {phase === 'vault-open' ? <VaultOpenPanel /> : null}
      {phase === 'complete' ? <ResultPanel /> : null}
      {tutorialMode === 'presentation' ? <TutorialOverlay isTouchDevice={isTouchDevice} /> : null}
    </div>
  )
}
