import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import HeroSprite from './HeroSprite'
import { HERO_ORIGIN_FILMS } from './heroOriginFilms'
import {
  HERO_ACTION_SLOTS,
  HERO_CLASS_LIST,
  getHeroClass,
  type HeroClassDefinition,
  type HeroClassId,
} from './heroClassSystem'
import { resolveHeroTransformationDefinition } from './heroTransformationSystem'
import { originQuoteAudioPath } from './originVoice'
import './primebound-class-select.css'

export interface PrimeboundClassSelectProps {
  readonly selectedClassId: HeroClassId
  readonly onSelect: (classId: HeroClassId) => void
  readonly onStart: () => void
  readonly onBack: () => void
}

interface SwipeStart {
  readonly pointerId: number
  readonly x: number
  readonly y: number
}

const HERO_COUNT = HERO_CLASS_LIST.length

const STAT_MAXIMA = Object.freeze({
  maxHealth: Math.max(...HERO_CLASS_LIST.map((heroClass) => heroClass.stats.maxHealth)),
  maxStamina: Math.max(...HERO_CLASS_LIST.map((heroClass) => heroClass.stats.maxStamina)),
  movementSpeed: Math.max(...HERO_CLASS_LIST.map((heroClass) => heroClass.stats.movementSpeed)),
  damage: Math.max(...HERO_CLASS_LIST.map((heroClass) => heroClass.modifiers.damageMultiplier)),
  defense: Math.max(...HERO_CLASS_LIST.map((heroClass) => 1 / heroClass.modifiers.damageTakenMultiplier)),
  range: Math.max(...HERO_CLASS_LIST.map((heroClass) => heroClass.modifiers.rangeMultiplier)),
})

function classStyle(heroClass: HeroClassDefinition): CSSProperties {
  return {
    '--pb-class-accent': heroClass.palette.accent,
    '--pb-class-energy': heroClass.palette.energy,
    '--pb-class-primary': heroClass.palette.primary,
    '--pb-class-secondary': heroClass.palette.secondary,
    '--pb-class-shadow': heroClass.palette.shadow,
    '--pb-class-skin': heroClass.palette.skin,
  } as CSSProperties
}

function affinityKindLabel(heroClass: HeroClassDefinition): string {
  return heroClass.affinity.kind === 'cryptography'
    ? 'Criptografia'
    : 'Teoria dos números'
}

export function carouselHeroClassId(currentClassId: HeroClassId, step: number): HeroClassId {
  const currentIndex = HERO_CLASS_LIST.findIndex((heroClass) => heroClass.id === currentClassId)
  const wrappedIndex = (currentIndex + step % HERO_COUNT + HERO_COUNT) % HERO_COUNT
  return HERO_CLASS_LIST[wrappedIndex].id
}

interface HeroPortraitProps {
  readonly heroClass: HeroClassDefinition
  readonly eager?: boolean
}

function HeroPortrait({ heroClass, eager = false }: HeroPortraitProps): JSX.Element {
  return (
    <span className="primebound-class-select__portrait" aria-hidden="true">
      <span className="primebound-class-select__portrait-aura" />
      <img
        src={`/games/primebound/portraits/${heroClass.id}.webp`}
        alt=""
        width="640"
        height="800"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
      />
      <span className="primebound-class-select__portrait-scan" />
    </span>
  )
}

function PixelSkin({ heroClass }: { readonly heroClass: HeroClassDefinition }): JSX.Element {
  return (
    <section className="primebound-class-select__pixel" aria-label={`Skin pixelizada de ${heroClass.characterName}`}>
      <header>
        <span><i /> SKIN NO JOGO</span>
        <small>MODELO BASE</small>
      </header>
      <div className="primebound-class-select__pixel-stage" aria-hidden="true">
        <span className="primebound-class-select__pixel-ring" />
        <svg viewBox="-31 -40 62 74" role="presentation">
          <HeroSprite heroClassId={heroClass.id} x={0} y={2} px={1.25} />
        </svg>
        <span className="primebound-class-select__pixel-floor" />
      </div>
      <footer>
        <strong>{heroClass.characterName}</strong>
        <span>{heroClass.title}</span>
      </footer>
    </section>
  )
}

interface StatMeterProps {
  readonly label: string
  readonly value: number
  readonly maximum: number
  readonly displayValue: string
}

function StatMeter({ label, value, maximum, displayValue }: StatMeterProps): JSX.Element {
  const percentage = Math.max(8, Math.min(100, Math.round(value / maximum * 100)))

  return (
    <div className="primebound-class-select__stat" aria-label={`${label}: ${displayValue}`}>
      <span><small>{label}</small><strong>{displayValue}</strong></span>
      <i aria-hidden="true"><b style={{ width: `${percentage}%` }} /></i>
    </div>
  )
}

export default function PrimeboundClassSelect({
  selectedClassId,
  onSelect,
  onStart,
  onBack,
}: PrimeboundClassSelectProps): JSX.Element {
  const selectedClass = getHeroClass(selectedClassId)
  const selectedFilm = HERO_ORIGIN_FILMS[selectedClassId]
  const selectedTransformation = resolveHeroTransformationDefinition(selectedClassId)
  const previousClass = getHeroClass(carouselHeroClassId(selectedClassId, -1))
  const nextClass = getHeroClass(carouselHeroClassId(selectedClassId, 1))
  const selectedIndex = HERO_CLASS_LIST.findIndex((heroClass) => heroClass.id === selectedClassId)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const voiceRef = useRef<HTMLAudioElement | null>(null)
  const voiceGenerationRef = useRef(0)
  const swipeStartRef = useRef<SwipeStart | null>(null)
  const rosterRef = useRef<HTMLDivElement>(null)
  const rosterButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [speakingClassId, setSpeakingClassId] = useState<HeroClassId | null>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => () => {
    voiceGenerationRef.current += 1
    voiceRef.current?.pause()
    voiceRef.current = null
  }, [])

  useEffect(() => {
    const roster = rosterRef.current
    const selectedButton = rosterButtonRefs.current[selectedIndex]
    if (!roster || !selectedButton) return
    const centeredLeft = selectedButton.offsetLeft
      + selectedButton.offsetWidth / 2
      - roster.clientWidth / 2
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    roster.scrollTo({
      left: Math.max(0, centeredLeft),
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [selectedIndex])

  const stopCatchphrase = useCallback(() => {
    voiceGenerationRef.current += 1
    voiceRef.current?.pause()
    voiceRef.current = null
    setSpeakingClassId(null)
  }, [])

  const playCatchphrase = useCallback((classId: HeroClassId) => {
    if (typeof Audio === 'undefined') return

    voiceGenerationRef.current += 1
    const generation = voiceGenerationRef.current
    voiceRef.current?.pause()

    const audio = new Audio(originQuoteAudioPath(classId))
    audio.preload = 'auto'
    audio.volume = 0.92
    voiceRef.current = audio
    setSpeakingClassId(classId)

    const finish = () => {
      if (generation !== voiceGenerationRef.current) return
      voiceRef.current = null
      setSpeakingClassId(null)
    }

    audio.addEventListener('ended', finish, { once: true })
    audio.addEventListener('error', finish, { once: true })
    void audio.play().catch(finish)
  }, [])

  useEffect(() => {
    playCatchphrase(selectedClassId)
  }, [playCatchphrase, selectedClassId])

  const selectClass = useCallback((classId: HeroClassId) => {
    if (classId === selectedClassId) {
      playCatchphrase(classId)
      return
    }
    onSelect(classId)
  }, [onSelect, playCatchphrase, selectedClassId])

  const moveCarousel = useCallback((step: number) => {
    selectClass(carouselHeroClassId(selectedClassId, step))
  }, [selectClass, selectedClassId])

  const handleCarouselKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'a') {
      event.preventDefault()
      const targetIndex = (selectedIndex - 1 + HERO_COUNT) % HERO_COUNT
      moveCarousel(-1)
      window.requestAnimationFrame(() => rosterButtonRefs.current[targetIndex]?.focus())
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key.toLowerCase() === 'd') {
      event.preventDefault()
      const targetIndex = (selectedIndex + 1) % HERO_COUNT
      moveCarousel(1)
      window.requestAnimationFrame(() => rosterButtonRefs.current[targetIndex]?.focus())
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectClass(HERO_CLASS_LIST[0].id)
      window.requestAnimationFrame(() => rosterButtonRefs.current[0]?.focus())
    } else if (event.key === 'End') {
      event.preventDefault()
      selectClass(HERO_CLASS_LIST[HERO_COUNT - 1].id)
      window.requestAnimationFrame(() => rosterButtonRefs.current[HERO_COUNT - 1]?.focus())
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    if ((event.target as HTMLElement).closest('button, a, input')) return
    swipeStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current
    swipeStartRef.current = null
    if (!start || start.pointerId !== event.pointerId) return
    const distanceX = event.clientX - start.x
    const distanceY = event.clientY - start.y
    if (Math.abs(distanceX) >= 46 && Math.abs(distanceX) > Math.abs(distanceY) * 1.25) {
      moveCarousel(distanceX > 0 ? -1 : 1)
    }
  }

  const defenseValue = 1 / selectedClass.modifiers.damageTakenMultiplier

  return (
    <section
      className="primebound-class-select"
      style={classStyle(selectedClass)}
      aria-labelledby="primebound-class-select-title"
    >
      <div className="primebound-class-select__backdrop" aria-hidden="true" />

      <div className="primebound-class-select__shell">
        <header className="primebound-class-select__nav">
          <span className="primebound-class-select__brand">
            <span className="primebound-class-select__mark" aria-hidden="true">
              <i /><b>◆</b>
            </span>
            <span><strong>PRIMEBOUND</strong><small>ARQUIVO DE CAMPEÕES</small></span>
          </span>
          <button type="button" className="primebound-class-select__back" onClick={onBack}>
            <span aria-hidden="true">←</span> VOLTAR
          </button>
        </header>

        <div className="primebound-class-select__heading">
          <p>SELEÇÃO DE CAMPEÃO <i /> {String(selectedIndex + 1).padStart(2, '0')} DE {String(HERO_COUNT).padStart(2, '0')}</p>
          <h1 ref={headingRef} id="primebound-class-select-title" tabIndex={-1}>
            Escolha quem carrega o último primo
          </h1>
          <span>Use as setas, A/D ou arraste para conhecer cada disciplina.</span>
        </div>

        <div className="primebound-class-select__showcase">
          <p className="primebound-class-select__sr-only" role="status" aria-live="polite" aria-atomic="true">
            {selectedClass.characterName}, {selectedClass.name}, {selectedIndex + 1} de {HERO_COUNT}
          </p>

          <section
            className="primebound-class-select__carousel"
            role="region"
            aria-roledescription="carrossel"
            aria-label="Campeões jogáveis"
          >
            <div
              className="primebound-class-select__carousel-stage"
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => { swipeStartRef.current = null }}
            >
              <button
                type="button"
                className="primebound-class-select__peek primebound-class-select__peek--previous"
                style={classStyle(previousClass)}
                onClick={() => selectClass(previousClass.id)}
                aria-label={`Campeão anterior: ${previousClass.characterName}`}
              >
                <img src={`/games/primebound/portraits/${previousClass.id}.webp`} alt="" draggable={false} />
                <span><i aria-hidden="true">←</i><strong>{previousClass.characterName}</strong></span>
              </button>

              <article
                key={selectedClass.id}
                className={`primebound-class-select__active-slide${speakingClassId === selectedClassId ? ' is-speaking' : ''}`}
                role="group"
                aria-label={`${selectedClass.characterName}, ${selectedClass.name}, ${selectedIndex + 1} de ${HERO_COUNT}`}
                aria-roledescription="slide"
              >
                <span className="primebound-class-select__hero-number" aria-hidden="true">
                  {String(selectedIndex + 1).padStart(2, '0')}
                </span>
                <HeroPortrait heroClass={selectedClass} eager />
                <footer>
                  <span>{selectedClass.affinity.name}</span>
                  <code>{selectedClass.affinity.formula}</code>
                </footer>
              </article>

              <button
                type="button"
                className="primebound-class-select__peek primebound-class-select__peek--next"
                style={classStyle(nextClass)}
                onClick={() => selectClass(nextClass.id)}
                aria-label={`Próximo campeão: ${nextClass.characterName}`}
              >
                <img src={`/games/primebound/portraits/${nextClass.id}.webp`} alt="" draggable={false} />
                <span><strong>{nextClass.characterName}</strong><i aria-hidden="true">→</i></span>
              </button>
            </div>

            <div
              ref={rosterRef}
              className="primebound-class-select__roster"
              role="radiogroup"
              aria-label="Escolha direta de campeão"
              onKeyDown={handleCarouselKeyDown}
            >
              {HERO_CLASS_LIST.map((heroClass, index) => {
                const selected = heroClass.id === selectedClassId
                return (
                  <button
                    key={heroClass.id}
                    ref={(element) => { rosterButtonRefs.current[index] = element }}
                    type="button"
                    role="radio"
                    className={selected ? 'is-selected' : undefined}
                    style={classStyle(heroClass)}
                    aria-checked={selected}
                    aria-label={`Selecionar ${heroClass.characterName}, ${heroClass.name}`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectClass(heroClass.id)}
                  >
                    <img src={`/games/primebound/portraits/${heroClass.id}.webp`} alt="" loading="lazy" draggable={false} />
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{heroClass.characterName}</strong>
                  </button>
                )
              })}
            </div>

            <p className="primebound-class-select__carousel-hint">
              <kbd>←</kbd><kbd>→</kbd> ou <kbd>A</kbd><kbd>D</kbd>
              <span>ARRASTE PARA PASSAR</span>
            </p>
          </section>

          <aside className="primebound-class-select__identity">
            <header>
              <span className="primebound-class-select__counter">
                {String(selectedIndex + 1).padStart(2, '0')}<i>/</i>{String(HERO_COUNT).padStart(2, '0')}
              </span>
              <span className="primebound-class-select__discipline">{affinityKindLabel(selectedClass)}</span>
              <h2>{selectedClass.characterName}</h2>
              <strong>{selectedClass.name}</strong>
              <em>{selectedClass.title}</em>
              <p>{selectedClass.lore}</p>
            </header>

            <blockquote className={`primebound-class-select__quote${speakingClassId === selectedClassId ? ' is-speaking' : ''}`}>
              <span>FRASE DE EFEITO <i aria-hidden="true" /></span>
              <p>“{selectedFilm.quote}”</p>
              <button
                type="button"
                aria-pressed={speakingClassId === selectedClassId}
                aria-label={speakingClassId === selectedClassId
                  ? `Interromper frase de ${selectedClass.characterName}`
                  : `Ouvir frase de ${selectedClass.characterName}`}
                onClick={() => speakingClassId === selectedClassId
                  ? stopCatchphrase()
                  : playCatchphrase(selectedClassId)}
              >
                <b aria-hidden="true">{speakingClassId === selectedClassId ? '◼' : '▶'}</b>
                {speakingClassId === selectedClassId ? 'INTERROMPER' : 'OUVIR NOVAMENTE'}
              </button>
            </blockquote>

            <section className="primebound-class-select__stats" aria-labelledby="primebound-class-stats-title">
              <h3 id="primebound-class-stats-title">Atributos</h3>
              <div className="primebound-class-select__stats-grid">
                <StatMeter label="Vitalidade" value={selectedClass.stats.maxHealth} maximum={STAT_MAXIMA.maxHealth} displayValue={`${selectedClass.stats.maxHealth} PV`} />
                <StatMeter label="Energia" value={selectedClass.stats.maxStamina} maximum={STAT_MAXIMA.maxStamina} displayValue={`${selectedClass.stats.maxStamina}`} />
                <StatMeter label="Mobilidade" value={selectedClass.stats.movementSpeed} maximum={STAT_MAXIMA.movementSpeed} displayValue={`${selectedClass.stats.movementSpeed}`} />
                <StatMeter label="Poder" value={selectedClass.modifiers.damageMultiplier} maximum={STAT_MAXIMA.damage} displayValue={`${Math.round(selectedClass.modifiers.damageMultiplier * 100)}%`} />
                <StatMeter label="Defesa" value={defenseValue} maximum={STAT_MAXIMA.defense} displayValue={`${Math.round(defenseValue * 100)}%`} />
                <StatMeter label="Alcance" value={selectedClass.modifiers.rangeMultiplier} maximum={STAT_MAXIMA.range} displayValue={`${Math.round(selectedClass.modifiers.rangeMultiplier * 100)}%`} />
              </div>
            </section>
          </aside>

          <aside className="primebound-class-select__loadout">
            <PixelSkin heroClass={selectedClass} />

            <section className="primebound-class-select__affinity" aria-labelledby="primebound-class-affinity-title">
              <span>{affinityKindLabel(selectedClass)}</span>
              <h3 id="primebound-class-affinity-title">{selectedClass.affinity.name}</h3>
              <code>{selectedClass.affinity.formula}</code>
              <p>{selectedClass.affinity.description}</p>
            </section>

            <section className="primebound-class-select__kit" aria-labelledby="primebound-class-kit-title">
              <header>
                <h3 id="primebound-class-kit-title">Poderes</h3>
                <small>ARSENAL COMPLETO</small>
              </header>
              <ul>
                {HERO_ACTION_SLOTS.map((slot) => {
                  const action = selectedClass.actions[slot]
                  return (
                    <li key={slot} className={slot === 'R' ? 'is-ultimate' : undefined}>
                      <kbd>{slot}</kbd>
                      <span><strong>{action.label}</strong><small>{action.description}</small></span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section
              className="primebound-class-select__transformation"
              title={`${selectedTransformation.identity.costume} ${selectedTransformation.identity.screenMotif}`}
            >
              <span>F · FORMA PRIMA · 40 SEGUNDOS</span>
              <strong>{selectedTransformation.name}</strong>
              <code>{selectedTransformation.formula}</code>
              <small>{selectedTransformation.uniqueEffect.name} · {selectedTransformation.description}</small>
            </section>
          </aside>
        </div>

        <div className="primebound-class-select__commit">
          <span>
            <small>CAMPEÃO ESCOLHIDO</small>
            <strong>{selectedClass.characterName} <i>·</i> {selectedClass.name}</strong>
          </span>
          <button type="button" onClick={onStart}>
            <span>JOGAR COMO {selectedClass.characterName.toUpperCase()}</span>
            <b aria-hidden="true">→</b>
          </button>
        </div>

        <footer className="primebound-class-select__footer">
          <span>8 CAMPEÕES · 8 DISCIPLINAS · 1 ÚLTIMO PRIMO</span>
          <span>FONES RECOMENDADOS</span>
        </footer>
      </div>
    </section>
  )
}
