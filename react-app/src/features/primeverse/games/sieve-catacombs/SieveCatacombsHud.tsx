import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { MAX_PLAYER_HITS, hitsRemaining } from './gameLogic'
import GameIntro from '../../ui/GameIntro'
import { CATACOMBS_SEAL_ORDER } from './campaignLogic'
import { CAESAR_DISC_ID, decodeWithDisc, discPairs } from './caesarDisc'
import type { CatacombsSnapshot, HeldControl, PulseControl } from './types'

interface SieveCatacombsHudProps {
  readonly onSubmitElevatorAnswer: (answer: string) => void
  readonly onCloseElevatorPanel: () => void
  readonly active: boolean
  readonly snapshot: CatacombsSnapshot
  readonly objective: string
  readonly soundEnabled: boolean
  readonly onStart: () => void
  readonly onRestart: () => void
  readonly onToggleSound: () => void
  readonly onHeldControl: (control: HeldControl, pressed: boolean) => void
  readonly onPulseControl: (control: PulseControl) => void
}

function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function HeldButton({
  label,
  control,
  onHeldControl,
  className = '',
}: {
  readonly label: string
  readonly control: HeldControl
  readonly onHeldControl: (control: HeldControl, pressed: boolean) => void
  readonly className?: string
}): JSX.Element {
  const release = () => onHeldControl(control, false)
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        onHeldControl(control, true)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {label}
    </button>
  )
}

function CaesarDiscTool({
  cipher,
  onUse,
}: {
  readonly cipher: string
  readonly onUse: (reading: string) => void
}): JSX.Element {
  const [shift, setShift] = useState(0)
  const reading = decodeWithDisc(cipher, shift)
  const pairs = discPairs(shift)

  return (
    <div className="scc-disc" aria-label="Disco cifrante de César">
      <div className="scc-disc__head">
        <span><i /> DISCO DE CÉSAR · ENCONTRADO NA GAVETA</span>
        <b>DESLOCAMENTO {String(shift).padStart(2, '0')}</b>
      </div>

      <div className="scc-disc__wheel" role="group" aria-label="Girar o disco">
        <button type="button" aria-label="Girar o disco para trás" onClick={() => setShift((current) => (current + 25) % 26)}>◀</button>
        <ol aria-hidden="true">
          {pairs.map(([outer, inner]) => (
            <li key={outer}>
              <span>{outer}</span>
              <em>{inner}</em>
            </li>
          ))}
        </ol>
        <button type="button" aria-label="Girar o disco para a frente" onClick={() => setShift((current) => (current + 1) % 26)}>▶</button>
      </div>

      <div className="scc-disc__reading">
        <small>LEITURA ATUAL</small>
        <strong aria-live="polite">{reading}</strong>
      </div>
      <button type="button" className="scc-disc__use" onClick={() => onUse(reading)}>
        USAR ESTA LEITURA NO TECLADO
      </button>
    </div>
  )
}

/**
 * The vision overlay: the floor's own number swallowing the screen, one line of
 * narration at a time. Purely presentational — the scene decides when it plays.
 */
function HallucinationCutscene({
  state,
}: {
  readonly state: NonNullable<CatacombsSnapshot['hallucination']>
}): JSX.Element {
  const { vision, frame } = state
  return (
    <section
      className={`scc-vision${frame.progress > 0.82 ? ' is-leaving' : ''}`}
      style={{
        '--vision-weight': frame.envelope,
        '--vision-severity': vision.severity,
      } as React.CSSProperties}
      role="status"
      aria-live="polite"
    >
      {frame.line?.glyph && (
        // The glyph is repeated in data-glyph so CSS can smear two more copies of it
        // out of register — the number itself refusing to hold still.
        <span className="scc-vision__glyph" data-glyph={frame.line.glyph} aria-hidden="true">
          {frame.line.glyph}
        </span>
      )}
      <p className="scc-vision__line">{frame.line?.text}</p>
      <span className="scc-vision__meter" aria-hidden="true">
        <i style={{ width: `${frame.progress * 100}%` }} />
      </span>
    </section>
  )
}

function ElevatorKeypad({
  elevator,
  tools,
  onSubmit,
  onClose,
}: {
  readonly elevator: NonNullable<CatacombsSnapshot['elevator']>
  readonly tools: readonly string[]
  readonly onSubmit: (answer: string) => void
  readonly onClose: () => void
}): JSX.Element {
  const [answer, setAnswer] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { puzzle } = elevator

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])

  return (
    <section className="scc-keypad" role="dialog" aria-modal="true" aria-labelledby="scc-keypad-title">
      <div className="scc-panel-label"><i /> {puzzle.title.toUpperCase()}</div>
      <h2 id="scc-keypad-title">{puzzle.challenge}</h2>
      <p className="scc-keypad__prompt">{puzzle.prompt}</p>
      <p className="scc-keypad__hint">{puzzle.hint}</p>

      {puzzle.kind === 'caesar' && (
        tools.includes(CAESAR_DISC_ID) ? (
          <CaesarDiscTool cipher={puzzle.challenge} onUse={setAnswer} />
        ) : (
          <p className="scc-keypad__missing-tool">
            Dá para resolver de cabeça — ou procurar o <b>disco cifrante</b> que sumiu nas gavetas deste andar.
          </p>
        )
      )}

      <ul className="scc-keypad__fragments" aria-label="Pistas encontradas nas gavetas">
        {elevator.fragments.length === 0 ? (
          <li className="is-empty">Nenhuma pista ainda. Revire as gavetas dos armários deste andar.</li>
        ) : elevator.fragments.map((fragment) => <li key={fragment}>{fragment}</li>)}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (answer.trim().length === 0) return
          onSubmit(answer)
          setAnswer('')
        }}
      >
        <input
          ref={inputRef}
          className="scc-keypad__input"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={24}
          aria-label={puzzle.prompt}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
        <button type="submit" className="scc-keypad__submit">CONFIRMAR</button>
      </form>

      {elevator.feedback && (
        <p className={`scc-keypad__feedback${elevator.solved ? ' is-solved' : ' is-wrong'}`} role="status">
          {elevator.feedback}
        </p>
      )}
      {elevator.attempts > 0 && !elevator.solved && (
        <p className="scc-keypad__attempts">{elevator.attempts} tentativa(s) errada(s) — cada erro faz barulho.</p>
      )}

      <button type="button" className="scc-keypad__close" onClick={onClose}>ESC · AFASTAR-SE DO PAINEL</button>
    </section>
  )
}

export default function SieveCatacombsHud({
  active,
  snapshot,
  objective,
  soundEnabled,
  onStart,
  onRestart,
  onToggleSound,
  onHeldControl,
  onPulseControl,
  onSubmitElevatorAnswer,
  onCloseElevatorPanel,
}: SieveCatacombsHudProps): JSX.Element {
  const { game } = snapshot
  const remainingHits = hitsRemaining(game.health)
  const threat = snapshot.nearestEnemyDistance < 4.5
    ? 'CONTATO IMINENTE'
    : snapshot.nearestEnemyDistance < 10
      ? 'PASSOS PRÓXIMOS'
      : 'NENHUM SINAL'
  const messageVisible = game.message && snapshot.nowMs <= game.messageUntil

  return (
    <div className="scc-hud">
      <header className="scc-topbar">
        <Link className="scc-brand" to="/jogos/primeverse-online" aria-label="Voltar ao Primeverse Online">
          <span className="scc-brand__mark">÷</span>
          <span>CRIPTA DO CRIVO<small>6 NÍVEIS // LIMINAL HORROR</small></span>
        </Link>
        {active && (
          <div className="scc-location" aria-live="polite">
            <small>{snapshot.level.overline}</small>
            <strong>{snapshot.sector}</strong>
          </div>
        )}
        <div className="scc-topbar__actions">
          <button
            className="scc-sound"
            type="button"
            aria-pressed={soundEnabled}
            onClick={onToggleSound}
          >
            {soundEnabled ? 'SOM ATIVO' : 'SOM MUDO'}
          </button>
          <Link className="scc-back" to="/jogos/primeverse-online">ABANDONAR EXPEDIÇÃO <span>↗</span></Link>
        </div>
      </header>

      {active && game.phase === 'playing' && (
        <>
          <aside className="scc-objective" aria-label="Objetivo atual">
            <div className="scc-panel-label"><i /> OBJETIVO ATUAL</div>
            <strong>{objective}</strong>
            <div className="scc-bearing">
              <span className="scc-bearing__arrow" style={{ transform: `rotate(${-snapshot.objectiveBearing}rad)` }}>↑</span>
              <span><b>{Math.ceil(snapshot.objectiveDistance)} m</b><small>SIGA O SINAL</small></span>
            </div>
            <div
              className="scc-level-track"
              aria-label={`Nível ${snapshot.campaign.levelIndex + 1} de ${CATACOMBS_SEAL_ORDER.length}`}
            >
              {snapshot.campaign.completedLevels.map((completed) => (
                <i key={completed.levelId} className="is-complete">✓</i>
              ))}
              <i className="is-current">{String(snapshot.campaign.levelIndex + 1).padStart(2, '0')}</i>
              {Array.from(
                { length: Math.max(0, CATACOMBS_SEAL_ORDER.length - 1 - snapshot.campaign.levelIndex) },
                (_, index) => <i key={`future-${index}`}>·</i>,
              )}
            </div>
            <div className="scc-fragments" aria-label={`${snapshot.fragmentsFound} de ${snapshot.fragmentsTotal} pistas encontradas`}>
              <span>PISTAS DO ANDAR</span>
              <b>{snapshot.fragmentsFound}/{snapshot.fragmentsTotal}</b>
            </div>
            <div className="scc-seals" aria-label={`${game.collectedPrimes.length} de ${CATACOMBS_SEAL_ORDER.length} selos da campanha`}>
              {CATACOMBS_SEAL_ORDER.map((prime) => (
                <span key={prime} className={game.collectedPrimes.includes(prime) ? 'is-found' : ''}>
                  <i>{game.collectedPrimes.includes(prime) ? '✓' : prime}</i>
                  <small>SELO {prime}</small>
                </span>
              ))}
            </div>
          </aside>

          <aside className="scc-vitals" aria-label="Estado do explorador">
            <div className={`scc-vitals__row scc-vitals__row--hits${remainingHits <= 1 ? ' is-critical' : ''}`}>
              <span>INTEGRIDADE</span><b>{remainingHits}/{MAX_PLAYER_HITS} GOLPES</b>
              <i><em style={{ width: `${game.health}%` }} /></i>
              <div
                className="scc-hits"
                aria-label={`${remainingHits} de ${MAX_PLAYER_HITS} golpes restantes`}
              >
                {Array.from({ length: MAX_PLAYER_HITS }, (_, index) => (
                  <span key={index} className={index < remainingHits ? 'is-live' : 'is-lost'} />
                ))}
              </div>
            </div>
            <div className="scc-vitals__row scc-vitals__row--battery">
              <span>LANTERNA {game.flashlightOn ? 'ATIVA' : 'DESLIGADA'}</span><b>{Math.ceil(game.battery)}%</b>
              <i><em style={{ width: `${game.battery}%` }} /></i>
            </div>
            <div className="scc-vitals__row scc-vitals__row--fear">
              <span>CONTAMINAÇÃO LIMINAL</span><b>{Math.ceil(snapshot.fear)}%</b>
              <i><em style={{ width: `${snapshot.fear}%` }} /></i>
            </div>
            <div className={`scc-threat ${snapshot.nearestEnemyDistance < 10 ? 'is-active' : ''}`}>
              <i /> <span>{threat}</span>
            </div>
          </aside>

          {snapshot.hallucination && <HallucinationCutscene state={snapshot.hallucination} />}

          {snapshot.elevator && (
            <ElevatorKeypad
              elevator={snapshot.elevator}
              tools={snapshot.tools}
              onSubmit={onSubmitElevatorAnswer}
              onClose={onCloseElevatorPanel}
            />
          )}

          {!snapshot.pointerLocked && !snapshot.elevator && (
            <div className="scc-mouse-hint">
              <span>+</span>
              <strong>CLIQUE NO CENÁRIO</strong>
              <small>para controlar a visão</small>
            </div>
          )}

          {snapshot.interactionPrompt && (
            <div className="scc-interaction" role="status">
              <span>{snapshot.interactionPrompt.slice(0, 1)}</span>
              <strong>{snapshot.interactionPrompt.slice(3)}</strong>
            </div>
          )}

          {messageVisible && <div className="scc-message" role="status">{game.message}</div>}

          {snapshot.activeEventUntil > snapshot.nowMs && snapshot.activeEvent && (
            <div className="scc-anomaly" aria-hidden="true">
              <i /><i /><span>{snapshot.activeEvent.replace(/-/g, ' ')}</span>
            </div>
          )}

          {snapshot.levelTransitionUntil > snapshot.nowMs && (
            <section className="scc-level-transition" aria-live="assertive">
              <small>{snapshot.level.overline}</small>
              <strong>{snapshot.level.title}</strong>
              <span>{snapshot.level.mechanic}</span>
            </section>
          )}

          <div className="scc-crosshair" aria-hidden="true"><i /><i /></div>
          <div className="scc-controls-legend" aria-label="Controles">
            <span><b>WASD</b> MOVER</span>
            <span><b>SHIFT</b> CORRER</span>
            <span><b>F</b> LANTERNA</span>
            <span><b>E</b> INTERAGIR</span>
            <span><b>E</b> GAVETAS</span>
            <span><b>ESC</b> SOLTAR MOUSE</span>
          </div>

          <div className="scc-mobile-controls" aria-label="Controles de toque">
            <div className="scc-dpad">
              <HeldButton label="↑" control="forward" onHeldControl={onHeldControl} className="up" />
              <HeldButton label="←" control="left" onHeldControl={onHeldControl} className="left" />
              <HeldButton label="↓" control="backward" onHeldControl={onHeldControl} className="down" />
              <HeldButton label="→" control="right" onHeldControl={onHeldControl} className="right" />
            </div>
            <div className="scc-mobile-actions">
              <button type="button" onClick={() => onPulseControl('flashlight')}><b>F</b><small>LUZ</small></button>
              <button type="button" onClick={() => onPulseControl('interact')}><b>E</b><small>USAR</small></button>
              <HeldButton label="CORRER" control="sprint" onHeldControl={onHeldControl} className="sprint" />
            </div>
          </div>
        </>
      )}

      {!active && (
        <GameIntro
          title="Cripta do Crivo"
          emphasis="do Crivo"
          instruction="Seis andares, seis selos primos. Encontre o selo do andar, decifre o teclado do elevador e desça. Três golpes encerram a expedição."
          actionLabel="Chamar o elevador"
          accent="#4df589"
          mark="7"
          keys="WASD mover · Shift correr · F lanterna · E interagir"
          onStart={onStart}
        />
      )}

      {active && game.phase !== 'playing' && (
        <section className={`scc-ending scc-ending--${game.phase}`} aria-live="assertive">
          <div className="scc-ending__sigil">{game.phase === 'won' ? '2·3·5·7' : '49'}</div>
          <p>{game.phase === 'won' ? 'EXPEDIÇÃO CONCLUÍDA' : 'REGISTRO ENCERRADO'}</p>
          <h2>{game.phase === 'won' ? 'Você sobreviveu ao Crivo.' : 'Seu nome foi riscado.'}</h2>
          <span>
            {game.phase === 'won'
              ? `Os quatro níveis responderam em ${formatTime(game.elapsedMs)}.`
              : `Três golpes bastaram. Você alcançou o nível ${snapshot.campaign.levelIndex + 1} e recuperou ${game.collectedPrimes.length} de ${CATACOMBS_SEAL_ORDER.length} selos.`}
          </span>
          <div>
            <button type="button" onClick={onRestart}>TENTAR NOVAMENTE <i>↻</i></button>
            <Link to="/jogos/primeverse-online">VOLTAR AO PRIMEVERSE</Link>
          </div>
        </section>
      )}

      {active && game.phase === 'playing' && (
        <div className="scc-timer" aria-label={`Tempo ${formatTime(game.elapsedMs)}`}>
          <small>TEMPO NA CRIPTA</small><b>{formatTime(game.elapsedMs)}</b>
        </div>
      )}
    </div>
  )
}
