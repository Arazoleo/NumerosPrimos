import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link } from 'react-router-dom'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import GameIntro from '../../ui/GameIntro'
import { useBackroomsRuntime } from './backrooms'
import { CAESAR_PUZZLE, decodeCaesar } from './caesarLogic'
import {
  CAESAR_POSITION,
  ESCAPE_EXIT_POSITION,
  LENS_POSITION,
  MODULAR_POSITION,
  PRIME_BOX_POSITION,
  RSA_VAULT_POSITION,
  SPECTRAL_PLAQUE_POSITION,
} from './components'
import {
  ESCAPE_CHARACTERS,
  ESCAPE_DIALOGUES,
  getDialogueLine,
} from './dialogue'
import {
  ESCAPE_INTERACTABLES,
  evaluateModularLock,
  MODULAR_LOCK,
  parseIntegerInput,
  RSA_VAULT,
} from './escapeLogic'
import {
  addEscapeLookDelta,
  resetEscapeInput,
  setEscapeMove,
  type EscapeMoveCommand,
} from './explorationInput'
import { useEscapeStore } from './escapeStore'
import type {
  EscapeInteractableId,
  EscapePhase,
  EscapeResult,
  PrimeBoxStep,
} from './types'

interface EscapeRoomHudProps {
  quality: QualityLevel
  onQualityChange: (quality: QualityLevel) => void
}

interface StageCopy {
  readonly number: number
  readonly eyebrow: string
  readonly title: string
  readonly detail: string
}

const STAGE_COPY: Readonly<Record<EscapePhase, StageCopy>> = {
  intro: {
    number: 0,
    eyebrow: 'ARQUIVO LIMINAL EM ESPERA',
    title: 'Entre no andar que não existe',
    detail: 'O elevador abriu onde não deveria. Encontre uma saída.',
  },
  searching: {
    number: 1,
    eyebrow: 'SETOR 01 · RECEPÇÃO AUSENTE',
    title: 'Siga o telefone sem fio',
    detail: 'O toque vem de uma sala sem tomadas. Procure a lente junto ao aparelho.',
  },
  'prime-box': {
    number: 2,
    eyebrow: 'SETOR 01 · BALCÃO SEM ATENDENTE',
    title: 'Alinhe os quatro anéis',
    detail: 'Volte ao balcão e revele a sequência gravada na caixa mecânica.',
  },
  'caesar-lock': {
    number: 3,
    eyebrow: 'SETOR 02 · ESCRITÓRIOS VAZIOS',
    title: 'Decifre a transmissão',
    detail: 'A janela impossível esconde um console. Instale o rotor e alinhe os alfabetos.',
  },
  'modular-lock': {
    number: 4,
    eyebrow: 'SETOR 03 · JUNÇÃO ÚMIDA',
    title: 'Quebre o corredor cíclico',
    detail: 'Siga a mancha em espiral e encontre o menor número de pulsos do console.',
  },
  'spectral-clue': {
    number: 5,
    eyebrow: 'SETOR 04 · ARQUIVO SEM ÍNDICE',
    title: 'Procure a mensagem espectral',
    detail: 'Entre as estantes repetidas, uma parede vazia reage à lente espectral.',
  },
  'rsa-vault': {
    number: 6,
    eyebrow: 'SETOR 05 · ALA DE SERVIÇO',
    title: 'Abra a porta vermelha',
    detail: 'Fatore o módulo, encontre o inverso modular e atravesse a única porta colorida.',
  },
  escaped: {
    number: 6,
    eyebrow: 'PROTOCOLO CONCLUÍDO',
    title: 'Saída localizada',
    detail: 'A rota criptográfica dobrou o espaço e abriu um limiar.',
  },
}

const PRIME_STEP_COPY: Readonly<Record<PrimeBoxStep, Pick<StageCopy, 'title' | 'detail'>>> = {
  rings: {
    title: 'Alinhe os quatro anéis',
    detail: 'Use a lente e ajuste os discos na sequência de primos indicada.',
  },
  latches: {
    title: 'Libere as duas travas',
    detail: 'Os anéis expuseram uma trava em cada lateral da caixa.',
  },
  lid: {
    title: 'Levante a tampa',
    detail: 'As travas cederam. Abra a tampa articulada para alcançar o núcleo.',
  },
  drawer: {
    title: 'Puxe a gaveta secreta',
    detail: 'O núcleo revelou uma placa móvel escondida na frente da caixa.',
  },
  rotor: {
    title: 'Recolha o rotor',
    detail: 'Pegue o disco de alfabetos que apareceu dentro do compartimento.',
  },
  complete: {
    title: 'Encontre a janela impossível',
    detail: 'O rotor está no inventário. Atravesse os escritórios até o falso horizonte.',
  },
}

function formatTime(milliseconds: number): string {
  const safe = Math.max(0, milliseconds)
  const minutes = Math.floor(safe / 60_000)
  const seconds = Math.floor((safe % 60_000) / 1_000)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function useMissionClock(): number {
  const phase = useEscapeStore((state) => state.phase)
  const startedAt = useEscapeStore((state) => state.startedAt)
  const completedAt = useEscapeStore((state) => state.completedAt)
  const dialogueStartedAt = useEscapeStore((state) => state.dialogueStartedAt)
  const dialoguePausedMs = useEscapeStore((state) => state.dialoguePausedMs)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt || phase === 'intro' || phase === 'escaped') return undefined
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [phase, startedAt])

  if (!startedAt) return 0
  const activeDialogueMs = dialogueStartedAt === null
    ? 0
    : Math.max(0, now - dialogueStartedAt)
  return Math.max(
    0,
    (completedAt ?? now) - startedAt - dialoguePausedMs - activeDialogueMs,
  )
}

const DIALOG_FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'

function useModalFocus(
  panelRef: React.RefObject<HTMLElement>,
  onEscape?: () => void,
  trapFocus = true,
): void {
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current
      const preferred = panel?.querySelector<HTMLElement>(
        '[data-dialog-focus], [data-inspection-focus]',
      )
      ;(preferred ?? panel)?.focus()
    })

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault()
        onEscape()
        return
      }
      if (!trapFocus || event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE),
      ).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const handleFocusIn = (event: FocusEvent) => {
      const panel = panelRef.current
      if (!trapFocus || !panel || panel.contains(event.target as Node)) return
      const preferred = panel.querySelector<HTMLElement>(
        '[data-dialog-focus], [data-inspection-focus]',
      )
      ;(preferred ?? panel)?.focus()
    }

    window.addEventListener('keydown', handleDialogKeys)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleDialogKeys)
      document.removeEventListener('focusin', handleFocusIn)
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus()
      else document.querySelector<HTMLElement>('.escape-room__canvas canvas')?.focus()
    }
  }, [onEscape, panelRef, trapFocus])
}

function EscapeBrand({ compact = false }: { compact?: boolean }): JSX.Element {
  return (
    <Link className={`escape-brand${compact ? ' escape-brand--compact' : ''}`} to="/jogos">
      <span className="escape-brand__mark" aria-hidden="true">⌁</span>
      <span>
        <strong>CRYPTO ESCAPE</strong>
        {!compact ? <small>PRIMEVERSE // ARQUIVO LIMINAL 13</small> : null}
      </span>
    </Link>
  )
}

/**
 * Tells the player the view is mouse-locked, and disappears the moment it is —
 * the same contract the Cripta uses, so the two horror games control alike.
 */
function PointerLockHint(): JSX.Element | null {
  const [locked, setLocked] = useState(() => document.pointerLockElement !== null)

  useEffect(() => {
    const update = () => setLocked(document.pointerLockElement !== null)
    document.addEventListener('pointerlockchange', update)
    return () => document.removeEventListener('pointerlockchange', update)
  }, [])

  if (locked) return null
  return (
    <div className="escape-lock-hint" aria-hidden="true">
      <span>+</span>
      <strong>CLIQUE NO CENÁRIO</strong>
      <small>para travar o mouse e olhar em volta</small>
    </div>
  )
}

function IntroPanel({
  quality,
  onQualityChange,
}: EscapeRoomHudProps): JSX.Element {
  const start = useEscapeStore((state) => state.start)
  const panelRef = useRef<HTMLElement>(null)
  useModalFocus(panelRef)

  return (
    <GameIntro
      title="Crypto Liminal"
      emphasis="Liminal"
      instruction="Você acordou num labirinto que não consta na planta. Ache a lente, abra a caixa prima e reconstrua a chave RSA antes que a presença te encontre."
      actionLabel="Acender a lanterna"
      accent="#55ebdf"
      mark="13"
      keys="WASD mover · Shift correr · F lanterna · E interagir"
      onStart={start}
    >
      <QualityControl value={quality} onChange={onQualityChange} />
    </GameIntro>
  )
}

function MissionTopbar({
  quality,
  onQualityChange,
}: EscapeRoomHudProps): JSX.Element {
  const phase = useEscapeStore((state) => state.phase)
  const restart = useEscapeStore((state) => state.restart)
  const flashlightOn = useEscapeStore((state) => state.flashlightOn)
  const toggleFlashlight = useEscapeStore((state) => state.toggleFlashlight)
  const stage = STAGE_COPY[phase]

  return (
    <header className="escape-topbar">
      <EscapeBrand compact />
      <div className="escape-phases" aria-label={`Fase ${stage.number} de 6`}>
        {Array.from({ length: 6 }, (_, index) => (
          <i
            key={index}
            className={index + 1 < stage.number ? 'is-complete' : index + 1 === stage.number ? 'is-current' : ''}
          />
        ))}
        <span>{String(stage.number).padStart(2, '0')} / 06</span>
      </div>
      <div className="escape-topbar__actions">
        <span className="escape-signal"><i /> SINAL LIMINAL</span>
        <button
          type="button"
          className={`escape-flashlight${flashlightOn ? ' is-on' : ''}`}
          aria-pressed={flashlightOn}
          aria-label={`${flashlightOn ? 'Apagar' : 'Acender'} lanterna`}
          onClick={toggleFlashlight}
        >
          <span className="escape-flashlight__icon" aria-hidden="true">◉</span>
          <span className="escape-flashlight__label">Luz {flashlightOn ? 'on' : 'off'}</span>
          <kbd>F</kbd>
        </button>
        <QualityControl value={quality} onChange={onQualityChange} />
        <button type="button" className="escape-restart" aria-label="Reiniciar missão" onClick={restart}>
          <span aria-hidden="true">↻</span><span className="escape-restart__label">Reiniciar</span>
        </button>
      </div>
    </header>
  )
}

function MissionObjective(): JSX.Element {
  const phase = useEscapeStore((state) => state.phase)
  const score = useEscapeStore((state) => state.score)
  const mistakes = useEscapeStore((state) => state.mistakes)
  const lensCollected = useEscapeStore((state) => state.lensCollected)
  const caesarRotorCollected = useEscapeStore((state) => state.caesarRotorCollected)
  const primeBoxStep = useEscapeStore((state) => state.primeBoxStep)
  const rsaSolved = useEscapeStore((state) => state.rsaSolved)
  const elapsed = useMissionClock()
  const copy = STAGE_COPY[phase]
  const { title: objectiveTitle, detail: objectiveDetail } = getMissionObjectiveCopy(
    phase,
    primeBoxStep,
    rsaSolved,
  )

  return (
    <aside className="escape-objective" aria-labelledby="escape-objective-title">
      <div className="escape-objective__scan"><i /><span>{copy.eyebrow}</span></div>
      <h2 id="escape-objective-title">{objectiveTitle}</h2>
      <p>{objectiveDetail}</p>
      <div className="escape-objective__stats">
        <div><span>SCORE</span><strong>{score.toLocaleString('pt-BR')}</strong></div>
        <div><span>TEMPO</span><strong>{formatTime(elapsed)}</strong></div>
        <div><span>ERROS</span><strong>{String(mistakes).padStart(2, '0')}</strong></div>
      </div>
      <div className={`escape-inventory${lensCollected ? ' is-collected' : ''}`}>
        <span aria-hidden="true">{caesarRotorCollected ? '◎' : '◉'}</span>
        <div>
          <small>INVENTÁRIO</small>
          <strong>
            {caesarRotorCollected ? 'Lente + Rotor de César' : lensCollected ? 'Lente espectral' : 'Espaço vazio'}
          </strong>
        </div>
      </div>
    </aside>
  )
}

type ObjectiveWorldPosition = readonly [number, number, number]

function getObjectiveWorldPosition(
  phase: EscapePhase,
  lensCollected: boolean,
  rsaSolved: boolean,
): ObjectiveWorldPosition | null {
  switch (phase) {
    case 'searching': return lensCollected ? PRIME_BOX_POSITION : LENS_POSITION
    case 'prime-box': return PRIME_BOX_POSITION
    case 'caesar-lock': return CAESAR_POSITION
    case 'modular-lock': return MODULAR_POSITION
    case 'spectral-clue': return SPECTRAL_PLAQUE_POSITION
    case 'rsa-vault': return rsaSolved ? ESCAPE_EXIT_POSITION : RSA_VAULT_POSITION
    default: return null
  }
}

const THREAT_COPY = {
  quiet: 'ZUMBIDO ESTÁVEL',
  listening: 'ALGO OUVIU VOCÊ',
  chase: 'CORRA · QUEBRE A VISÃO',
  stunned: 'INTERFERÊNCIA ATIVA',
} as const

function LiminalTelemetry(): JSX.Element | null {
  const phase = useEscapeStore((state) => state.phase)
  const lensCollected = useEscapeStore((state) => state.lensCollected)
  const rsaSolved = useEscapeStore((state) => state.rsaSolved)
  const player = useBackroomsRuntime((state) => state.player)
  const sectorName = useBackroomsRuntime((state) => state.sectorName)
  const threat = useBackroomsRuntime((state) => state.threat)
  const threatDistance = useBackroomsRuntime((state) => state.threatDistance)
  const composure = useBackroomsRuntime((state) => state.composure)
  const hitSerial = useBackroomsRuntime((state) => state.hitSerial)
  const captureSerial = useBackroomsRuntime((state) => state.captureSerial)
  const target = getObjectiveWorldPosition(phase, lensCollected, rsaSolved)
  if (!target) return null

  const deltaX = target[0] - player.x
  const deltaZ = target[2] - player.z
  const distance = Math.hypot(deltaX, deltaZ)
  const targetYaw = Math.atan2(deltaX, -deltaZ)
  const bearing = Math.atan2(
    Math.sin(targetYaw - player.yaw),
    Math.cos(targetYaw - player.yaw),
  )
  const style = { '--escape-bearing': `${bearing}rad` } as CSSProperties

  return (
    <>
      <div className="escape-threat-vignette" data-threat={threat} aria-hidden="true" />
      <aside className="escape-liminal" data-threat={threat} style={style} aria-label="Navegação e estado">
        <div className="escape-liminal__sector">
          <span>SETOR ATUAL</span>
          <strong>{sectorName}</strong>
        </div>
        <div className="escape-liminal__bearing" aria-label={`Objetivo a ${Math.ceil(distance)} metros`}>
          <i aria-hidden="true">↑</i>
          <span><small>SINAL DO OBJETIVO</small><b>{Math.ceil(distance)} m</b></span>
        </div>
        <div className="escape-liminal__pulse">
          <span><small>PULSO</small><b>{Math.round(composure)}%</b></span>
          <i><b style={{ width: `${composure}%` }} /></i>
        </div>
        <div className="escape-liminal__threat">
          <i />
          <span>{THREAT_COPY[threat]}</span>
          {threat === 'chase' && threatDistance !== null ? <b>{Math.ceil(threatDistance)} m</b> : null}
        </div>
      </aside>
      {hitSerial > 0 ? <div key={`hit-${hitSerial}`} className="escape-hit-flash" aria-hidden="true" /> : null}
      {captureSerial > 0 ? <div key={`capture-${captureSerial}`} className="escape-capture-flash" role="status">VOCÊ ACORDOU EM OUTRO CORREDOR</div> : null}
    </>
  )
}

function getMissionObjectiveCopy(
  phase: EscapePhase,
  primeBoxStep: PrimeBoxStep,
  rsaSolved: boolean,
): Pick<StageCopy, 'title' | 'detail'> {
  if (rsaSolved && phase === 'rsa-vault') {
    return {
      title: 'Atravesse a saída aberta',
      detail: 'Aproxime-se do cofre aberto e atravesse o último limiar.',
    }
  }
  return phase === 'prime-box' ? PRIME_STEP_COPY[primeBoxStep] : STAGE_COPY[phase]
}

function MissionObjectiveAnnouncement(): JSX.Element {
  const phase = useEscapeStore((state) => state.phase)
  const primeBoxStep = useEscapeStore((state) => state.primeBoxStep)
  const rsaSolved = useEscapeStore((state) => state.rsaSolved)
  const activeDialogue = useEscapeStore((state) => state.activeDialogue)
  const objective = getMissionObjectiveCopy(phase, primeBoxStep, rsaSolved)

  return (
    <span className="escape-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {activeDialogue ? '' : `Objetivo atual: ${objective.title}. ${objective.detail}`}
    </span>
  )
}

function InteractionPrompt(): JSX.Element | null {
  const nearby = useEscapeStore((state) => state.nearby)
  const inspection = useEscapeStore((state) => state.inspection)
  const activeDialogue = useEscapeStore((state) => state.activeDialogue)
  const interact = useEscapeStore((state) => state.interact)

  if (!nearby || inspection || activeDialogue) return null
  const definition = ESCAPE_INTERACTABLES[nearby]

  return (
    <button type="button" className="escape-interact" onClick={() => interact()}>
      <kbd>E</kbd>
      <span><small>{definition.label}</small>{definition.prompt}</span>
    </button>
  )
}

function getAssistedTarget(phase: EscapePhase, lensCollected: boolean, rsaSolved: boolean): EscapeInteractableId | null {
  switch (phase) {
    case 'searching': return lensCollected ? 'prime-box' : 'lens'
    case 'prime-box': return 'prime-box'
    case 'caesar-lock': return 'caesar-console'
    case 'modular-lock': return 'modular-console'
    case 'spectral-clue': return 'hidden-plaque'
    case 'rsa-vault': return rsaSolved ? 'exit-door' : 'rsa-vault'
    default: return null
  }
}

function AssistedMode(): JSX.Element | null {
  const phase = useEscapeStore((state) => state.phase)
  const lensCollected = useEscapeStore((state) => state.lensCollected)
  const rsaSolved = useEscapeStore((state) => state.rsaSolved)
  const inspection = useEscapeStore((state) => state.inspection)
  const activeDialogue = useEscapeStore((state) => state.activeDialogue)
  const interact = useEscapeStore((state) => state.interact)
  const target = getAssistedTarget(phase, lensCollected, rsaSolved)

  if (!target || inspection || activeDialogue) return null

  return (
    <details className="escape-assisted">
      <summary>Acessibilidade</summary>
      <p>Se a navegação 3D não funcionar, abra diretamente o objetivo atual.</p>
      <button type="button" onClick={() => interact(target)}>
        Abrir {ESCAPE_INTERACTABLES[target].label}
      </button>
    </details>
  )
}

function bindMove(command: EscapeMoveCommand) {
  const activate = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setEscapeMove(command, true)
  }
  const deactivate = () => setEscapeMove(command, false)
  const activateFromKeyboard = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return
    setEscapeMove(command, true)
    window.setTimeout(() => setEscapeMove(command, false), 180)
  }

  return {
    onPointerDown: activate,
    onPointerUp: deactivate,
    onPointerCancel: deactivate,
    onLostPointerCapture: deactivate,
    onClick: activateFromKeyboard,
  }
}

function TouchControls(): JSX.Element {
  const interact = useEscapeStore((state) => state.interact)
  const flashlightOn = useEscapeStore((state) => state.flashlightOn)
  const toggleFlashlight = useEscapeStore((state) => state.toggleFlashlight)

  useEffect(() => resetEscapeInput, [])

  return (
    <div className="escape-touch-controls" aria-label="Controles de exploração por toque">
      <div className="escape-dpad">
        <button type="button" aria-label="Andar para frente" {...bindMove('forward')}>↑</button>
        <button type="button" aria-label="Andar para a esquerda" {...bindMove('left')}>←</button>
        <button type="button" aria-label="Andar para trás" {...bindMove('backward')}>↓</button>
        <button type="button" aria-label="Andar para a direita" {...bindMove('right')}>→</button>
      </div>
      <div className="escape-touch-actions">
        <div>
          <button
            type="button"
            className={`escape-touch-flashlight${flashlightOn ? ' is-on' : ''}`}
            aria-label={`${flashlightOn ? 'Apagar' : 'Acender'} lanterna`}
            aria-pressed={flashlightOn}
            onClick={toggleFlashlight}
          >☼</button>
          <button type="button" aria-label="Correr" {...bindMove('sprint')}>⇧</button>
          <button type="button" aria-label="Olhar à esquerda" {...bindMove('turn-left')}>↶</button>
          <button type="button" aria-label="Olhar à direita" {...bindMove('turn-right')}>↷</button>
        </div>
        <button type="button" className="escape-touch-interact" onClick={() => interact()}>AÇÃO</button>
      </div>
    </div>
  )
}

function DialoguePanel(): JSX.Element | null {
  const activeDialogue = useEscapeStore((state) => state.activeDialogue)
  const advanceDialogue = useEscapeStore((state) => state.advanceDialogue)
  const skipDialogue = useEscapeStore((state) => state.skipDialogue)
  const panelRef = useRef<HTMLElement>(null)

  if (!activeDialogue) return null

  return (
    <div className="escape-dialogue-wrap">
      <ActiveDialoguePanel
        sceneId={activeDialogue.sceneId}
        lineIndex={activeDialogue.lineIndex}
        advanceDialogue={advanceDialogue}
        skipDialogue={skipDialogue}
        panelRef={panelRef}
      />
    </div>
  )
}

function ActiveDialoguePanel({
  sceneId,
  lineIndex,
  advanceDialogue,
  skipDialogue,
  panelRef,
}: {
  sceneId: keyof typeof ESCAPE_DIALOGUES
  lineIndex: number
  advanceDialogue: () => void
  skipDialogue: () => void
  panelRef: React.RefObject<HTMLElement>
}): JSX.Element | null {
  useModalFocus(panelRef, skipDialogue)
  const scene = ESCAPE_DIALOGUES[sceneId]
  const line = getDialogueLine(sceneId, lineIndex)
  if (!line) return null
  const character = ESCAPE_CHARACTERS[line.speaker]
  const isLastLine = lineIndex === scene.lines.length - 1

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      className={`escape-dialogue escape-dialogue--${line.speaker.toLowerCase()} escape-dialogue--${line.tone}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="escape-dialogue-speaker"
      aria-describedby="escape-dialogue-line"
    >
      <div className="escape-dialogue__portrait" aria-hidden="true">
        <span>{line.speaker.slice(0, 1)}</span><i />
      </div>
      <div className="escape-dialogue__content">
        <div className="escape-dialogue__meta">
          <span>{scene.title}</span>
          <button type="button" onClick={skipDialogue}>Pular diálogo</button>
        </div>
        <div className="escape-dialogue__transcript" role="status" aria-live="polite" aria-atomic="true">
          <div className="escape-dialogue__speaker">
            <strong id="escape-dialogue-speaker">{character.name}</strong>
            <span>{character.role}</span>
          </div>
          <p id="escape-dialogue-line">{line.text}</p>
        </div>
        <div className="escape-dialogue__footer">
          <div aria-hidden="true">
            {scene.lines.map((dialogueLine, index) => (
              <i key={dialogueLine.id} className={index === lineIndex ? 'is-current' : index < lineIndex ? 'is-complete' : ''} />
            ))}
          </div>
          <span className="escape-sr-only">Fala {lineIndex + 1} de {scene.lines.length}.</span>
          <button type="button" className="escape-dialogue__continue" data-dialog-focus onClick={advanceDialogue}>
            {isLastLine ? 'Voltar à missão' : 'Continuar'} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function PrimeBoxPuzzle(): JSX.Element {
  const rings = useEscapeStore((state) => state.primeBoxRings)
  const step = useEscapeStore((state) => state.primeBoxStep)
  const latches = useEscapeStore((state) => state.primeBoxLatches)
  const rotateRing = useEscapeStore((state) => state.rotateRing)
  const submit = useEscapeStore((state) => state.submitPrimeBox)
  const releaseLatch = useEscapeStore((state) => state.releasePrimeLatch)
  const openLid = useEscapeStore((state) => state.openPrimeLid)
  const openDrawer = useEscapeStore((state) => state.openPrimeDrawer)
  const collectRotor = useEscapeStore((state) => state.collectCaesarRotor)
  const puzzleRef = useRef<HTMLFormElement>(null)
  const stages = ['rings', 'latches', 'lid', 'drawer', 'rotor'] as const
  const stageLabels = ['Anéis', 'Travas', 'Tampa', 'Gaveta', 'Rotor'] as const
  const currentStage = Math.max(0, stages.indexOf(step === 'complete' ? 'rotor' : step))

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      puzzleRef.current?.querySelector<HTMLElement>('[data-prime-step-focus]')?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [latches, step])

  return (
    <form
      ref={puzzleRef}
      className="escape-puzzle escape-puzzle--prime-box"
      onSubmit={(event) => {
        event.preventDefault()
        if (step === 'rings') submit()
      }}
    >
      <div className="escape-puzzle__clue">
        <span>INSCRIÇÃO REVELADA PELA LENTE</span>
        <strong>“Quatro sentinelas: os primos de um algarismo, do menor ao maior.”</strong>
      </div>
      <ol className="escape-mechanism-steps" aria-label="Camadas da Caixa Prima">
        {stageLabels.map((label, index) => (
          <li
            key={label}
            className={index < currentStage ? 'is-complete' : index === currentStage ? 'is-current' : ''}
            aria-current={index === currentStage ? 'step' : undefined}
          >
            <span>{index < currentStage ? '✓' : index + 1}</span>{label}
          </li>
        ))}
      </ol>

      {step === 'rings' ? (
        <>
          <div className="escape-rings" role="group" aria-label="Quatro anéis numéricos">
            {rings.map((value, index) => (
              <div key={index}>
                <button
                  type="button"
                  data-inspection-focus={index === 0 ? '' : undefined}
                  data-prime-step-focus={index === 0 ? '' : undefined}
                  aria-label={`Diminuir anel ${index + 1}`}
                  onClick={() => rotateRing(index, -1)}
                >−</button>
                <output aria-label={`Valor do anel ${index + 1}`}>{value}</output>
                <button type="button" aria-label={`Aumentar anel ${index + 1}`} onClick={() => rotateRing(index, 1)}>+</button>
                <small>ANEL 0{index + 1}</small>
              </div>
            ))}
          </div>
          <button type="submit" className="escape-primary">Liberar pinos <span aria-hidden="true">⌁</span></button>
        </>
      ) : null}

      {step === 'latches' ? (
        <div className="escape-layer-action">
          <p>Os anéis revelaram duas travas nas laterais da caixa. Empurre as duas alavancas na cena, em qualquer ordem.</p>
          <div className="escape-latch-controls" role="group" aria-label="Travas laterais da caixa">
            {(['ESQUERDA', 'DIREITA'] as const).map((label, index) => (
              <button
                key={label}
                type="button"
                className={latches[index] ? 'is-done' : ''}
                disabled={latches[index]}
                aria-label={`Trava ${label.toLocaleLowerCase('pt-BR')} — ${latches[index] ? 'liberada' : 'bloqueada'}`}
                data-inspection-focus={!latches[index] && (index === 0 || latches[0]) ? '' : undefined}
                data-prime-step-focus={!latches[index] && (index === 0 || latches[0]) ? '' : undefined}
                onClick={() => releaseLatch(index as 0 | 1)}
              >
                <span aria-hidden="true">{latches[index] ? '✓' : '↧'}</span>
                TRAVA {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 'lid' ? (
        <div className="escape-layer-action escape-layer-action--direct">
          <p>As dobradiças estão livres. Puxe a alça da tampa na própria caixa — ou use o botão abaixo.</p>
          <button type="button" className="escape-primary" data-inspection-focus data-prime-step-focus onClick={openLid}>
            Abrir tampa <span aria-hidden="true">↥</span>
          </button>
        </div>
      ) : null}

      {step === 'drawer' ? (
        <div className="escape-layer-action escape-layer-action--direct">
          <p>Uma placa frontal se projetou alguns milímetros. Puxe a gaveta na caixa — ou use o botão abaixo.</p>
          <button type="button" className="escape-primary" data-inspection-focus data-prime-step-focus onClick={openDrawer}>
            Puxar gaveta <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}

      {step === 'rotor' ? (
        <div className="escape-layer-action escape-layer-action--rotor">
          <div className="escape-rotor-glyph" aria-hidden="true">A↔D</div>
          <p>O compartimento guarda um disco com dois alfabetos concêntricos e três marcas de deslocamento.</p>
          <button type="button" className="escape-primary" data-inspection-focus data-prime-step-focus onClick={collectRotor}>
            Coletar Rotor de César <span aria-hidden="true">◎</span>
          </button>
        </div>
      ) : null}

      <p className="escape-direct-hint">No desktop, você também pode tocar diretamente nas peças do mecanismo 3D.</p>
      <p className="escape-sr-only" role="status" aria-live="polite">Camada atual: {stageLabels[currentStage]}.</p>
    </form>
  )
}

function CaesarPuzzle(): JSX.Element {
  const shift = useEscapeStore((state) => state.caesarShift)
  const rotate = useEscapeStore((state) => state.rotateCaesarWheel)
  const submit = useEscapeStore((state) => state.submitCaesar)
  const decoded = decodeCaesar(CAESAR_PUZZLE.ciphertext, shift)

  return (
    <form
      className="escape-puzzle escape-puzzle--caesar"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="escape-caesar-transmission">
        <span>TRANSMISSÃO INTERCEPTADA</span>
        <strong>{CAESAR_PUZZLE.ciphertext}</strong>
      </div>
      <p className="escape-puzzle__instruction">
        César deslocava cada letra pelo mesmo número de casas. Gire o rotor até a transmissão formar uma palavra ligada à missão.
      </p>
      <div className="escape-caesar-wheel" role="group" aria-label="Rotor da Cifra de César">
        <button
          type="button"
          autoFocus
          data-inspection-focus
          aria-label="Diminuir deslocamento"
          onClick={() => rotate(-1)}
        >−</button>
        <div aria-live="polite" aria-atomic="true">
          <span>DESLOCAMENTO</span>
          <strong>+{shift}</strong>
          <output aria-label={`Texto decodificado: ${decoded}`}>{decoded}</output>
        </div>
        <button type="button" aria-label="Aumentar deslocamento" onClick={() => rotate(1)}>+</button>
      </div>
      <div className="escape-caesar-alignment" aria-hidden="true">
        <span>ABCDEFGHIJKLMNOPQRSTUVWXYZ</span>
        <span style={{ '--caesar-offset': `${shift * -1.31}em` } as CSSProperties}>ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ</span>
      </div>
      <button type="submit" className="escape-primary">
        Transmitir palavra <span aria-hidden="true">⌁</span>
      </button>
      <p className="escape-direct-hint">No desktop, os controles do disco também podem ser acionados diretamente no 3D.</p>
    </form>
  )
}

function ModularPuzzle(): JSX.Element {
  const guess = useEscapeStore((state) => state.modularGuess)
  const setGuess = useEscapeStore((state) => state.setModularGuess)
  const submit = useEscapeStore((state) => state.submitModularGuess)
  const parsed = parseIntegerInput(guess)
  const evaluation = parsed === null ? null : evaluateModularLock(parsed)

  const adjust = (delta: number) => {
    const current = parsed ?? 0
    setGuess(String(Math.max(0, current + delta)))
  }

  return (
    <form
      className="escape-puzzle"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="escape-equation" aria-label="7 mais 5 vezes k é congruente a 3 módulo 12">
        <span>{MODULAR_LOCK.start}</span><i>+</i><strong>{MODULAR_LOCK.step}k</strong><i>≡</i>
        <span className="is-target">{MODULAR_LOCK.target}</span><small>(mod {MODULAR_LOCK.modulus})</small>
      </div>
      <p className="escape-puzzle__instruction">
        Encontre o menor inteiro <b>k ≥ 0</b>. Cada pulso soma 5 e, depois do 11, a órbita volta ao 0.
      </p>
      <label className="escape-number-control" htmlFor="escape-modular-k">
        <span>PULSOS k</span>
        <div>
          <button type="button" onClick={() => adjust(-1)} aria-label="Diminuir k">−</button>
          <input
            id="escape-modular-k"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            data-inspection-focus
            value={guess}
            placeholder="?"
            onChange={(event) => setGuess(event.target.value)}
          />
          <button type="button" onClick={() => adjust(1)} aria-label="Aumentar k">+</button>
        </div>
      </label>
      <div className="escape-residue-readout" aria-live="polite">
        <span>RESÍDUO SIMULADO</span>
        <strong>{evaluation ? evaluation.residue : '—'}</strong>
      </div>
      <button type="submit" className="escape-primary">Enviar pulsos <span aria-hidden="true">→</span></button>
    </form>
  )
}

function RsaPuzzle(): JSX.Element {
  const fields = useEscapeStore((state) => state.rsaFields)
  const setField = useEscapeStore((state) => state.setRsaField)
  const submit = useEscapeStore((state) => state.submitRsa)

  return (
    <form
      className="escape-puzzle escape-puzzle--rsa"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="escape-rsa-register">
        <div><span>MÓDULO</span><strong>N = {RSA_VAULT.modulus}</strong></div>
        <div><span>CHAVE PÚBLICA</span><strong>e = {RSA_VAULT.publicExponent}</strong></div>
        <div><span>PLACA ESPECTRAL</span><strong>φ(N) = {RSA_VAULT.totient}</strong></div>
      </div>
      <p className="escape-puzzle__instruction">
        Descubra os primos <b>p × q = 187</b>. Depois encontre <b>d</b> tal que 7d deixe resto 1 ao dividir por 160.
      </p>
      <div className="escape-rsa-fields">
        {(['p', 'q', 'd'] as const).map((field, index) => (
          <label key={field} htmlFor={`escape-rsa-${field}`}>
            <span>{field === 'd' ? 'CHAVE d' : `FATOR ${field}`}</span>
            <input
              id={`escape-rsa-${field}`}
              type="number"
              inputMode="numeric"
              step="1"
              autoComplete="off"
              autoFocus={index === 0}
              data-inspection-focus={index === 0 ? '' : undefined}
              value={fields[field]}
              placeholder="?"
              onChange={(event) => setField(field, event.target.value)}
            />
          </label>
        ))}
      </div>
      <button type="submit" className="escape-primary">Girar chave privada <span aria-hidden="true">↻</span></button>
    </form>
  )
}

function InspectionViewerControl(): JSX.Element {
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null)

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      className="escape-inspection__viewer"
      onPointerDown={(event) => {
        if (event.target instanceof Element && event.target.closest('button')) return
        event.preventDefault()
        dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const previous = dragRef.current
        if (!previous || previous.id !== event.pointerId) return
        event.preventDefault()
        addEscapeLookDelta(event.clientX - previous.x, event.clientY - previous.y)
        dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={() => {
        dragRef.current = null
      }}
    >
      <span><i /> ARRASTE NA CENA OU AQUI PARA ORBITAR</span>
      <div>
        <button type="button" aria-label="Observar mecanismo pela esquerda" onClick={() => addEscapeLookDelta(-70, 0)}>↶</button>
        <button type="button" aria-label="Observar mecanismo pela direita" onClick={() => addEscapeLookDelta(70, 0)}>↷</button>
      </div>
    </div>
  )
}

function InspectionPanel(): JSX.Element | null {
  const inspection = useEscapeStore((state) => state.inspection)
  const closeInspection = useEscapeStore((state) => state.closeInspection)
  const panelRef = useRef<HTMLElement>(null)

  if (!inspection) return null
  return <ActiveInspectionPanel panelRef={panelRef} closeInspection={closeInspection} />
}

function ActiveInspectionPanel({
  panelRef,
  closeInspection,
}: {
  panelRef: React.RefObject<HTMLElement>
  closeInspection: () => void
}): JSX.Element {
  const inspection = useEscapeStore((state) => state.inspection)
  useModalFocus(panelRef, closeInspection)

  if (!inspection) return <></>
  const isPuzzle = inspection.status === 'puzzle'

  return (
    <div className="escape-modal-wrap escape-modal-wrap--inspection">
      <section
        ref={panelRef}
        tabIndex={-1}
        className={`escape-panel escape-inspection escape-inspection--${inspection.interactable}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="escape-inspection-title"
      >
        <button type="button" className="escape-inspection__close" aria-label="Voltar à sala" onClick={closeInspection}>×</button>
        <div className="escape-eyebrow">
          <i /> {isPuzzle ? 'MECANISMO EM INSPEÇÃO' : inspection.status === 'locked' ? 'ACESSO NEGADO' : 'EVIDÊNCIA ENCONTRADA'}
        </div>
        <h2 id="escape-inspection-title">{inspection.title}</h2>
        <p className="escape-inspection__description">{inspection.description}</p>
        {isPuzzle ? (
          <p className="escape-inspection__hint">
            <b>Clique direto na peça</b> · arraste na cena para girar o mecanismo
          </p>
        ) : null}
        <InspectionViewerControl />

        {isPuzzle && inspection.interactable === 'prime-box' ? <PrimeBoxPuzzle /> : null}
        {isPuzzle && inspection.interactable === 'caesar-console' ? <CaesarPuzzle /> : null}
        {isPuzzle && inspection.interactable === 'modular-console' ? <ModularPuzzle /> : null}
        {isPuzzle && inspection.interactable === 'rsa-vault' ? <RsaPuzzle /> : null}

        {!isPuzzle ? (
          <div className="escape-evidence">
            {inspection.interactable === 'hidden-plaque' ? (
              <div className="escape-evidence__formula"><span>N = 187</span><span>φ(N) = 160</span></div>
            ) : (
              <span className="escape-evidence__glyph" aria-hidden="true">
                {inspection.status === 'locked' ? '⊘' : inspection.interactable === 'lens' ? '◉' : '✓'}
              </span>
            )}
            <button type="button" className="escape-primary" autoFocus data-inspection-focus onClick={closeInspection}>
              {inspection.status === 'locked' ? 'Continuar procurando' : 'Guardar e continuar'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}
        <button type="button" className="escape-text-button" onClick={closeInspection}>ESC · Voltar à sala</button>
      </section>
    </div>
  )
}

function FeedbackToast(): JSX.Element | null {
  const feedback = useEscapeStore((state) => state.feedback)
  const clearFeedback = useEscapeStore((state) => state.clearFeedback)

  useEffect(() => {
    if (!feedback) return undefined
    const timer = window.setTimeout(() => clearFeedback(feedback.id), 5_000)
    return () => window.clearTimeout(timer)
  }, [clearFeedback, feedback])

  if (!feedback) return null
  const isError = feedback.kind === 'error'
  return (
    <div
      className={`escape-feedback escape-feedback--${feedback.kind}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <i />
      <div><strong>{feedback.title}</strong><span>{feedback.detail}</span></div>
      <button type="button" aria-label="Fechar mensagem" onClick={() => clearFeedback(feedback.id)}>×</button>
    </div>
  )
}

function ResultPanel(): JSX.Element | null {
  const result = useEscapeStore((state) => state.result)
  const start = useEscapeStore((state) => state.start)
  const panelRef = useRef<HTMLElement>(null)
  if (!result) return null
  return <ActiveResultPanel result={result} start={start} panelRef={panelRef} />
}

function ActiveResultPanel({
  result,
  start,
  panelRef,
}: {
  result: EscapeResult
  start: () => void
  panelRef: React.RefObject<HTMLElement>
}): JSX.Element {
  useModalFocus(panelRef)

  return (
    <div className="escape-modal-wrap escape-modal-wrap--result">
      <section ref={panelRef} tabIndex={-1} className="escape-panel escape-result" role="dialog" aria-modal="true" aria-labelledby="escape-result-title">
        <div className="escape-result__seal" aria-hidden="true"><span>RSA</span></div>
        <div className="escape-eyebrow">ROTA CRIPTOGRÁFICA RESTAURADA</div>
        <h2 id="escape-result-title">Você <em>escapou.</em></h2>
        <p>Cinco setores atravessados, quatro mecanismos abertos e uma presença que continuou do outro lado.</p>
        <div className="escape-result__stats">
          <div><span>SCORE</span><strong>{result.score.toLocaleString('pt-BR')}</strong></div>
          <div><span>TEMPO</span><strong>{formatTime(result.elapsedMs)}</strong></div>
          <div><span>ERROS</span><strong>{result.mistakes}</strong></div>
          <div><span>ENIGMAS</span><strong>{result.solvedPuzzles.length}/4</strong></div>
        </div>
        <div className="escape-xp">
          <span>XP RECEBIDO</span><strong>+{result.xp} XP</strong>
          {result.isNewBest ? <small>NOVO RECORDE</small> : null}
        </div>
        <div className="escape-result__actions">
          <button type="button" className="escape-primary" autoFocus data-dialog-focus onClick={start}>Escapar novamente <span aria-hidden="true">↻</span></button>
          <Link className="escape-secondary" to="/jogos">Escolher outro jogo</Link>
        </div>
      </section>
    </div>
  )
}

export function EscapeRoomHud({ quality, onQualityChange }: EscapeRoomHudProps): JSX.Element {
  const phase = useEscapeStore((state) => state.phase)
  const inspection = useEscapeStore((state) => state.inspection)
  const activeDialogue = useEscapeStore((state) => state.activeDialogue)

  if (phase === 'intro') {
    return (
      <div className="escape-room__hud">
        <IntroPanel quality={quality} onQualityChange={onQualityChange} />
      </div>
    )
  }

  return (
    <div className="escape-room__hud">
      {phase !== 'escaped' ? (
        <>
          <MissionObjectiveAnnouncement />
          {!activeDialogue && !inspection ? <MissionTopbar quality={quality} onQualityChange={onQualityChange} /> : null}
          {!activeDialogue && !inspection ? <MissionObjective /> : null}
          {!activeDialogue && !inspection ? <LiminalTelemetry /> : null}
          {!inspection && !activeDialogue ? <div className="escape-reticle" aria-hidden="true"><i /><i /><i /><i /></div> : null}
          {!inspection && !activeDialogue ? <PointerLockHint /> : null}
          <InteractionPrompt />
          <AssistedMode />
          {!inspection && !activeDialogue ? <TouchControls /> : null}
          {!activeDialogue ? <div className="escape-look-hint"><span>ARRASTE PARA OLHAR</span><i /></div> : null}
        </>
      ) : null}
      {!activeDialogue ? <FeedbackToast /> : null}
      <InspectionPanel />
      <DialoguePanel />
      <ResultPanel />
    </div>
  )
}
