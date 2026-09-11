import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { QualityLevel } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import {
  SKYLINE_DIALOGUES,
  SKYLINE_OBJECTIVE_ORDER,
  SKYLINE_PRIME_CORE_VALUES,
  SKYLINE_SENTINELS,
  type SkylinePrimeCoreValue,
} from './missionData'
import { getNextSkylineObjective } from './missionLogic'
import { PRIME_POWERS } from './primeCombat'
import {
  getObjectiveProgress,
  useSkylineRunnerStore,
} from './skylineRunnerStore'

export type TouchAction = 'jump' | 'grapple' | 'attack' | 'interact' | 'sprint'

interface SkylineRunnerHudProps {
  readonly quality: QualityLevel
  readonly onQualityChange: (quality: QualityLevel) => void
  readonly onCapture: () => void
  readonly onPause: () => void
  readonly onRestart: () => void
  readonly soundEnabled: boolean
  readonly onSoundToggle: () => void
  readonly selectedPrime: SkylinePrimeCoreValue
  readonly onPrimeSelect: (prime: SkylinePrimeCoreValue) => void
  readonly onTouchAction: (action: TouchAction, pressed: boolean) => void
  readonly onTouchMove: (x: number, z: number) => void
}

function RunnerMark(): JSX.Element {
  return <span className="skyline-mark" aria-hidden="true"><i /><b>∕∕</b></span>
}

function TouchControls({
  onAction,
  onMove,
}: {
  onAction: (action: TouchAction, pressed: boolean) => void
  onMove: (x: number, z: number) => void
}): JSX.Element {
  const [stick, setStick] = useState({ x: 0, y: 0 })

  const updateStick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width * .34)))
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / (rect.height * .34)))
    setStick({ x: x * 34, y: y * 34 })
    onMove(x, -y)
  }

  const releaseStick = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setStick({ x: 0, y: 0 })
    onMove(0, 0)
  }

  const bind = (action: TouchAction) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      onAction(action, true)
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      onAction(action, false)
    },
    onPointerCancel: () => onAction(action, false),
  })

  return (
    <div className="skyline-touch" aria-label="Controles de toque">
      <div
        className="skyline-touch__stick"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          updateStick(event)
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateStick(event)
        }}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
      >
        <i /><b style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} />
      </div>
      <div className="skyline-touch__actions">
        <button type="button" {...bind('attack')}>MAGIA</button>
        <button type="button" {...bind('jump')}>SALTO</button>
        <button type="button" className="hook" {...bind('grapple')}>GANCHO</button>
        <button type="button" {...bind('interact')}>AGIR</button>
      </div>
    </div>
  )
}

function PrimeSpellBar({
  selectedPrime,
  unlocked,
  cooldown,
  touchMode,
  onSelect,
}: {
  selectedPrime: SkylinePrimeCoreValue
  unlocked: boolean
  cooldown: number
  touchMode: boolean
  onSelect: (prime: SkylinePrimeCoreValue) => void
}): JSX.Element {
  const selectedPower = PRIME_POWERS[selectedPrime]
  const shortNames: Readonly<Record<SkylinePrimeCoreValue, string>> = {
    2: 'BINÁRIO',
    3: 'TRÍADE',
    5: 'PENTÁGONO',
  }

  return (
    <div
      className={`skyline-spells${unlocked ? ' unlocked' : ' locked'}`}
      role="group"
      aria-label="Poderes de números primos"
      style={{ '--spell-color': selectedPower.color } as React.CSSProperties}
    >
      <div className="skyline-spells__slots">
        {SKYLINE_PRIME_CORE_VALUES.map((prime) => {
          const power = PRIME_POWERS[prime]
          return (
            <button
              key={prime}
              type="button"
              className={prime === selectedPrime ? 'selected' : ''}
              onClick={() => onSelect(prime)}
              aria-pressed={prime === selectedPrime}
              title={`${power.label}: ${power.description}`}
              style={{ '--prime-color': power.color } as React.CSSProperties}
            >
              <kbd>{prime}</kbd>
              <strong>{prime}</strong>
              <small>{shortNames[prime]}</small>
            </button>
          )
        })}
      </div>
      <div className="skyline-spells__status" aria-live="polite">
        <span>{unlocked ? selectedPower.label : 'MAGIA SELADA // ENCONTRE NILO'}</span>
        <b>{unlocked
          ? cooldown > .02
            ? 'RECARGA'
            : touchMode ? 'TOQUE MAGIA PARA CONJURAR' : 'F / LMB PARA CONJURAR'
          : '2 · 3 · 5'}</b>
      </div>
      <div className="skyline-spells__cooldown" aria-hidden="true">
        <i style={{ transform: `scaleX(${unlocked ? 1 - cooldown : 0})` }} />
      </div>
    </div>
  )
}

export default function SkylineRunnerHud({
  quality,
  onQualityChange,
  onCapture,
  onPause,
  onRestart,
  soundEnabled,
  onSoundToggle,
  selectedPrime,
  onPrimeSelect,
  onTouchAction,
  onTouchMove,
}: SkylineRunnerHudProps): JSX.Element {
  const mission = useSkylineRunnerStore((state) => state.mission)
  const health = useSkylineRunnerStore((state) => state.health)
  const telemetry = useSkylineRunnerStore((state) => state.telemetry)
  const nearby = useSkylineRunnerStore((state) => state.nearby)
  const activeDialogue = useSkylineRunnerStore((state) => state.activeDialogue)
  const controlsCaptured = useSkylineRunnerStore((state) => state.controlsCaptured)
  const toast = useSkylineRunnerStore((state) => state.toast)
  const damagePulse = useSkylineRunnerStore((state) => state.damagePulse)
  const advanceDialogue = useSkylineRunnerStore((state) => state.advanceDialogue)
  const clearToast = useSkylineRunnerStore((state) => state.clearToast)
  const objective = getNextSkylineObjective(mission)
  const progress = getObjectiveProgress(useSkylineRunnerStore.getState())
  const objectiveIndex = objective.id === 'mission-complete'
    ? SKYLINE_OBJECTIVE_ORDER.length
    : SKYLINE_OBJECTIVE_ORDER.indexOf(objective.id)
  const [damageVisible, setDamageVisible] = useState(false)
  const isCoarse = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
    [],
  )

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => clearToast(toast.id), 4_200)
    return () => window.clearTimeout(timer)
  }, [clearToast, toast])

  useEffect(() => {
    if (damagePulse === 0) return undefined
    setDamageVisible(true)
    const timer = window.setTimeout(() => setDamageVisible(false), 180)
    return () => window.clearTimeout(timer)
  }, [damagePulse])

  const line = activeDialogue
    ? SKYLINE_DIALOGUES[activeDialogue.id].lines[activeDialogue.lineIndex]
    : null
  const speaker = line?.speaker === 'lia' ? 'LIA' : line?.speaker === 'nilo' ? 'NILO' : 'RUNNER 07'
  const prompt = nearby === 'npc:lia'
    ? 'FALAR COM LIA'
    : nearby === 'npc:nilo'
      ? mission.coresDeliveredToNilo ? 'REVER PROTOCOLO COM NILO' : 'ENTREGAR A NILO'
      : nearby === 'beacon'
        ? 'ATIVAR FAROL'
        : null
  const enemy = telemetry.enemyTarget ? SKYLINE_SENTINELS[telemetry.enemyTarget] : null
  const remainingEnemyFactors = useSkylineRunnerStore((state) => state.enemyFactors)
  const enemyFactors = enemy ? remainingEnemyFactors[enemy.id] : []
  const magicUnlocked = mission.coresDeliveredToNilo
  const primeMatchesTarget = magicUnlocked && enemy ? enemyFactors.includes(selectedPrime) : false
  const selectedPower = PRIME_POWERS[selectedPrime]
  const aimingAtSurface = telemetry.grappleTarget?.startsWith('surface:') ?? false

  return (
    <div className="skyline-hud">
      <header className="skyline-topbar">
        <Link className="skyline-brand" to="/jogos" aria-label="Voltar ao Primeverse">
          <RunnerMark /><span><strong>PRIME RUNNER</strong><small>SKYLINE PROTOCOL</small></span>
        </Link>
        <div className="skyline-sector"><span>LOCALIZAÇÃO</span><strong>{telemetry.sector}</strong></div>
        <div className="skyline-topbar__right">
          <QualityControl value={quality} onChange={onQualityChange} />
          <button type="button" onClick={onSoundToggle} aria-pressed={soundEnabled}>{soundEnabled ? 'SOM ON' : 'SOM OFF'}</button>
          <button type="button" onClick={onRestart}>REINICIAR</button>
          <button type="button" onClick={onPause} aria-label="Pausar jogo">II</button>
        </div>
      </header>

      <aside className="skyline-objective" aria-live="polite">
        <span>OBJETIVO {String(Math.min(objectiveIndex + 1, 6)).padStart(2, '0')} // 06</span>
        <h2>{objective.title}</h2>
        <p>{objective.detail}{progress.required > 1 ? ` · ${progress.current}/${progress.required}` : ''}</p>
        <div className="skyline-objective__progress"><i style={{ width: `${progress.percent}%` }} /></div>
      </aside>

      <aside className="skyline-vitals">
        <div className="skyline-meter skyline-meter--health"><span>SINAL</span><div><i style={{ width: `${health}%` }} /></div><b>{health}</b></div>
        <div className="skyline-meter"><span>FÔLEGO</span><div><i style={{ width: `${telemetry.stamina}%` }} /></div><b>{Math.round(telemetry.stamina)}</b></div>
        <div className="skyline-meter skyline-meter--flow"><span>FLOW</span><div><i style={{ width: `${telemetry.flow}%` }} /></div><b>{Math.round(telemetry.flow)}</b></div>
        <div className="skyline-cores" aria-label={`Núcleos coletados: ${mission.collectedPrimeCores.join(', ') || 'nenhum'}`}>
          {SKYLINE_PRIME_CORE_VALUES.map((value) => <span key={value} className={mission.collectedPrimeCores.includes(value) ? 'found' : ''}><b>{value}</b></span>)}
        </div>
      </aside>

      <div
        className={`skyline-reticle${enemy ? ` enemy${!magicUnlocked ? ' locked' : primeMatchesTarget ? ' compatible' : ' resisted'}` : telemetry.grappleTarget ? ' hook' : ''}`}
        style={{ '--spell-color': selectedPower.color } as React.CSSProperties}
        aria-hidden="true"
      ><i /></div>

      {(telemetry.grappleTarget || telemetry.grappleAttached) && !enemy && (
        <div className="skyline-hook-readout">
          <strong>{telemetry.grappleAttached ? 'CABO TENSIONADO' : aimingAtSurface ? 'SUPERFÍCIE AO ALCANCE' : 'ÂNCORA ADQUIRIDA'}</strong>
          <span>{telemetry.grappleDistance?.toFixed(1)} M · <kbd>Q</kbd> {telemetry.grappleAttached ? 'SOLTAR' : 'ENGATAR'}</span>
        </div>
      )}
      {enemy && (
        <div
          className={`skyline-hook-readout skyline-enemy-readout${!magicUnlocked ? ' locked' : primeMatchesTarget ? ' compatible' : ' resisted'}`}
          style={{ '--spell-color': selectedPower.color } as React.CSSProperties}
        >
          <strong>{enemy.label.toUpperCase()} // RESTA {enemyFactors.join(' × ') || '0'}</strong>
          <span>
            <kbd>{isCoarse ? 'MAGIA' : 'F'}</kbd>{!magicUnlocked
              ? ' BLINDAGEM SELADA · ENCONTRE NILO'
              : ` CONJURAR ${selectedPrime} · ${primeMatchesTarget ? 'FATOR COMPATÍVEL' : 'TROQUE O PRIMO'}`}
          </span>
        </div>
      )}

      {!activeDialogue && (
        <PrimeSpellBar
          selectedPrime={selectedPrime}
          unlocked={magicUnlocked}
          cooldown={telemetry.spellCooldown}
          touchMode={isCoarse}
          onSelect={onPrimeSelect}
        />
      )}

      <div className="skyline-motion-state"><span>{telemetry.movement}</span><div><strong>{Math.round(telemetry.speed * 3.6)}</strong><small>KM/H</small></div></div>
      <div className="skyline-mission-track" aria-hidden="true">
        {SKYLINE_OBJECTIVE_ORDER.map((id, index) => <span key={id} className={index < objectiveIndex ? 'done' : index === objectiveIndex ? 'active' : ''} />)}
      </div>

      {prompt && !activeDialogue && <div className="skyline-prompt"><kbd>E</kbd>{prompt}</div>}

      {toast && !activeDialogue && (
        <div className={`skyline-toast skyline-toast--${toast.tone}`} role="status">
          <strong>{toast.title}</strong><span>{toast.detail}</span>
        </div>
      )}

      {line && activeDialogue && (
        <div className="skyline-dialogue" role="dialog" aria-live="polite" aria-label={`Diálogo com ${speaker}`}>
          <div className={`skyline-portrait skyline-portrait--${line.speaker}`} aria-hidden="true" />
          <div className="skyline-dialogue__copy"><span>{speaker} // COMMS</span><p>{line.text}</p></div>
          <button type="button" autoFocus onClick={advanceDialogue}>CONTINUAR →</button>
        </div>
      )}

      {!controlsCaptured && !activeDialogue && !isCoarse && (
        <button type="button" className="skyline-capture" onClick={onCapture}>
          <i /><strong>CLIQUE PARA ASSUMIR O CONTROLE</strong><span>WASD move · Q engancha · 2/3/5 equipa · F dispara</span>
        </button>
      )}

      <div className={`skyline-damage${damageVisible ? ' active' : ''}`} aria-hidden="true" />
      <div className={`skyline-speed-lines${telemetry.speed > 10 ? ' active' : ''}`} aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => <i key={index} style={{ top: `${9 + index * 10}%`, animationDelay: `${index * -0.07}s` }} />)}
      </div>

      {isCoarse && !activeDialogue && <TouchControls onAction={onTouchAction} onMove={onTouchMove} />}
      <div className="skyline-orientation" role="note"><i /><strong>Gire o dispositivo</strong><span>O Skyline Protocol foi desenhado para o modo paisagem.</span></div>
    </div>
  )
}
