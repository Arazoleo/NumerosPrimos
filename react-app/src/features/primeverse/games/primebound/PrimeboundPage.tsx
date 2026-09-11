import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useDocumentTitle } from '../../useDocumentTitle'
import { calculateScore } from './gameLogic'
import HeroOriginFilm from './HeroOriginFilm'
import PrimeboundClassSelect from './PrimeboundClassSelect'
import PrimeboundGame, { type PrimeboundRunResult } from './PrimeboundGame'
import {
  DEFAULT_HERO_CLASS_ID,
  getHeroClass,
  type HeroClassId,
} from './heroClassSystem'
import { recordPrimeboundProgress } from './progressionAdapter'
import './primebound.css'

type PagePhase = 'intro' | 'class-select' | 'origin-film' | 'playing' | 'paused' | 'victory' | 'defeat'

interface CompletedRun extends PrimeboundRunResult {
  readonly score: number
  readonly isNewBest: boolean
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function PrimeboundMark() {
  return (
    <span className="primebound-mark" aria-hidden="true">
      <i />
      <b>◆</b>
    </span>
  )
}

export default function PrimeboundPage(): JSX.Element {
  useDocumentTitle('Primebound · O Último Primo')
  const [phase, setPhase] = useState<PagePhase>('intro')
  const [runKey, setRunKey] = useState(0)
  const [draftClassId, setDraftClassId] = useState<HeroClassId>(DEFAULT_HERO_CLASS_ID)
  const [runClassId, setRunClassId] = useState<HeroClassId>(DEFAULT_HERO_CLASS_ID)
  const [completedRun, setCompletedRun] = useState<CompletedRun | null>(null)
  const activeModalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (phase !== 'paused' && phase !== 'victory' && phase !== 'defeat') return undefined
    const modal = activeModalRef.current
    if (!modal) return undefined
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const focusableSelector = 'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
    const focusables = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector))
    focusables[0]?.focus()

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const current = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector))
      if (current.length === 0) {
        event.preventDefault()
        return
      }
      const first = current[0]
      const last = current[current.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    modal.addEventListener('keydown', trapFocus)
    return () => {
      modal.removeEventListener('keydown', trapFocus)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [phase])

  const startSelectedRun = useCallback(() => {
    setRunClassId(draftClassId)
    setRunKey((value) => value + 1)
    setCompletedRun(null)
    setPhase('origin-film')
  }, [draftClassId])

  const retryRun = useCallback(() => {
    setDraftClassId(runClassId)
    setRunKey((value) => value + 1)
    setCompletedRun(null)
    setPhase('playing')
  }, [runClassId])

  const finishRun = useCallback((result: PrimeboundRunResult) => {
    const score = calculateScore({
      enemiesDefeated: result.enemiesDefeated,
      runesActivated: result.runesCollected,
      damageTaken: result.damageTaken,
      elapsedMs: result.elapsedMs,
      victory: true,
    })
    const runId = `${Date.now()}-${Math.round(result.elapsedMs)}-${score}`
    const isNewBest = recordPrimeboundProgress({
      runId,
      score,
      xp: 160 + result.runesCollected * 30,
    })
    setCompletedRun({ ...result, score, isNewBest })
    setPhase('victory')
  }, [])

  return (
    <main className={`primebound primebound--${phase}`}>
      <div className="primebound__grain" aria-hidden="true" />

      {phase === 'intro' ? (
        <section className="primebound-intro" aria-labelledby="primebound-title">
          <div className="primebound-intro__art" aria-hidden="true" />
          <header className="primebound-nav">
            <Link to="/jogos" className="primebound-brand">
              <PrimeboundMark />
              <span><strong>PRIMEBOUND</strong><small>UMA LENDA DO PRIMEVERSE</small></span>
            </Link>
            <Link to="/jogos" className="primebound-back">← VOLTAR AOS JOGOS</Link>
          </header>

          <div className="primebound-intro__content">
            <p className="primebound-eyebrow"><span>AVENTURA 2D</span> · 12 REGIÕES</p>
            <h1 id="primebound-title">O Último<br /><em>Primo</em></h1>
            <p className="primebound-intro__lead">
              Escolha entre oito campeões, atravesse doze terras esquecidas e
              transforme números primos em poderes de anime. Explore regiões vivas, enfrente
              ameaças que emergem pelo caminho e desperte cada guardião no seu próprio ritmo,
              com dois retornos de checkpoint por região. Reúna as runas
              <strong> 2, 3, 5, 7, 11 e 13</strong>, amplie sua vitalidade e domine a
              ressonância prima antes que a Sentinela Composta desperte.
            </p>
            <div className="primebound-intro__actions">
              <button type="button" className="primebound-primary" onClick={() => setPhase('class-select')}>
                <span>ESCOLHER CAMPEÃO</span><b aria-hidden="true">→</b>
              </button>
              <span className="primebound-save-note"><i /> Progresso salvo ao concluir</span>
            </div>
          </div>

          <aside className="primebound-controls-card" aria-label="Controles do jogo">
            <span>COMO JOGAR</span>
            <div><kbd>WASD</kbd><p><strong>Mover</strong><small>Explore cada ruína</small></p></div>
            <div><kbd>J</kbd><p><strong>Golpe normal</strong><small>Encadeie acertos até formar primos</small></p></div>
            <div><kbd>1 · 2 · 3</kbd><p><strong>Técnicas primas</strong><small>Poderes únicos com recarga própria</small></p></div>
            <div><kbd>Q</kbd><p><strong>Guarda e parry</strong><small>Apare o golpe no instante certo</small></p></div>
            <div><kbd>R</kbd><p><strong>Ultimate</strong><small>Libere a energia prima acumulada</small></p></div>
            <div><kbd>F</kbd><p><strong>Forma Prima</strong><small>Transformação exclusiva por 40 segundos</small></p></div>
            <div><kbd>⇧ / K</kbd><p><strong>Investida</strong><small>Atravesse o perigo</small></p></div>
            <div><kbd>E</kbd><p><strong>Interagir</strong><small>Fale, investigue e fortaleça sua vida</small></p></div>
          </aside>

          <footer className="primebound-intro__footer">
            <span>12 REGIÕES · ENCONTROS DINÂMICOS · PIXEL ART ORIGINAL</span>
            <span>FONES RECOMENDADOS</span>
          </footer>
        </section>
      ) : phase === 'class-select' ? (
        <PrimeboundClassSelect
          selectedClassId={draftClassId}
          onSelect={setDraftClassId}
          onStart={startSelectedRun}
          onBack={() => setPhase('intro')}
        />
      ) : phase === 'origin-film' ? (
        <HeroOriginFilm heroClassId={runClassId} onFinish={() => setPhase('playing')} />
      ) : (
        <section className="primebound-stage" aria-label="Primebound, aventura em pixel art">
          {(phase === 'playing' || phase === 'paused') && (
            <PrimeboundGame
              key={`${runClassId}:${runKey}`}
              heroClassId={runClassId}
              paused={phase === 'paused'}
              onPauseChange={(paused) => setPhase(paused ? 'paused' : 'playing')}
              onExitToClassSelect={() => {
                setDraftClassId(runClassId)
                setCompletedRun(null)
                setPhase('class-select')
              }}
              onVictory={finishRun}
              onDefeat={(result) => {
                setCompletedRun({ ...result, score: 0, isNewBest: false })
                setPhase('defeat')
              }}
            />
          )}

          {phase === 'paused' && (
            <div className="primebound-modal-backdrop">
              <div ref={activeModalRef} className="primebound-modal primebound-modal--pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
                <span className="primebound-eyebrow">JORNADA SUSPENSA</span>
                <h2 id="pause-title">A chama ainda espera.</h2>
                <p>Respire. As ruínas permanecerão exatamente onde você parou.</p>
                <button type="button" className="primebound-primary" autoFocus onClick={() => setPhase('playing')}>CONTINUAR</button>
                <button type="button" className="primebound-text-button" onClick={() => {
                  setDraftClassId(runClassId)
                  setCompletedRun(null)
                  setPhase('class-select')
                }}>ABANDONAR E TROCAR CAMPEÃO</button>
                <button type="button" className="primebound-text-button" onClick={() => setPhase('intro')}>ABANDONAR JORNADA</button>
              </div>
            </div>
          )}

          {(phase === 'victory' || phase === 'defeat') && (
            <div className={`primebound-ending primebound-ending--${phase}`}>
              <div className="primebound-ending__art" aria-hidden="true" />
              <div ref={activeModalRef} className="primebound-ending__content" role="dialog" aria-modal="true" aria-labelledby="ending-title">
                <PrimeboundMark />
                <p className="primebound-eyebrow">{phase === 'victory' ? 'SEIS RUNAS RESTAURADAS' : 'A CHAMA SE APAGOU'}</p>
                <h2 id="ending-title">{phase === 'victory' ? <>O santuário<br /><em>se lembra.</em></> : <>A ruína<br /><em>permanece.</em></>}</h2>
                <p>{phase === 'victory'
                  ? 'Você reuniu as seis runas, rompeu os fatores da escuridão e devolveu aos primos a sua luz.'
                  : 'A Sentinela venceu esta batalha, mas toda boa prova permite uma nova tentativa.'}</p>
                {completedRun && (
                  <div className="primebound-results">
                    <div><span>CAMPEÃO</span><strong>{getHeroClass(completedRun.heroClassId).characterName}</strong></div>
                    <div><span>PONTUAÇÃO</span><strong>{completedRun.score.toLocaleString('pt-BR')}</strong></div>
                    <div><span>TEMPO</span><strong>{formatTime(completedRun.elapsedMs)}</strong></div>
                    <div><span>INIMIGOS</span><strong>{completedRun.enemiesDefeated}</strong></div>
                    <div><span>RUNAS</span><strong>{completedRun.runesCollected}/6</strong></div>
                    {completedRun.isNewBest && <small>NOVO RECORDE</small>}
                  </div>
                )}
                <div className="primebound-ending__actions">
                  <button type="button" className="primebound-primary" autoFocus onClick={retryRun}>{phase === 'victory' ? 'JOGAR NOVAMENTE' : 'TENTAR DE NOVO'}</button>
                  <button type="button" className="primebound-text-button" onClick={() => {
                    setDraftClassId(runClassId)
                    setPhase('class-select')
                  }}>TROCAR CAMPEÃO</button>
                  <Link to="/jogos" className="primebound-text-button">VOLTAR AO PRIMEVERSE</Link>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
