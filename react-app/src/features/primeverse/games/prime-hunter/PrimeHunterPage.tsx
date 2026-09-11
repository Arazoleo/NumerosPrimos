import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ACHIEVEMENT_BY_ID, useProgressionStore } from '../../../../progression'
import { isPrime } from '../../../../lib/math'
import { audioBus } from '../../audio/audioBus'
import { useQualitySettings } from '../../graphics/useQualitySettings'
import QualityControl from '../../ui/QualityControl'
import { SceneBoundary, WebGLFallback } from '../../ui/SceneBoundary'
import { useDocumentTitle } from '../../useDocumentTitle'
import GameIntro from '../../ui/GameIntro'
import PrimeHunterScene, { type HunterShot } from './PrimeHunterScene'
import { HUNTER_TARGET_HITS, usePrimeHunterStore } from './primeHunterStore'
import '../../primeverse.css'
import './PrimeHunterPage.css'

const STAGE_LABELS = ['ÓRBITA 2–30', 'CINTURÃO 30–100', 'SETOR 100–500', 'FRONTEIRA 500+'] as const

interface RunReward {
  xp: number
  isNewBest: boolean
}

export default function PrimeHunterPage() {
  useDocumentTitle('Prime Hunter · Primeverse')
  const { quality, setQuality, profile } = useQualitySettings()
  const status = usePrimeHunterStore((state) => state.status)
  const outcome = usePrimeHunterStore((state) => state.outcome)
  const runId = usePrimeHunterStore((state) => state.runId)
  const score = usePrimeHunterStore((state) => state.score)
  const combo = usePrimeHunterStore((state) => state.combo)
  const bestCombo = usePrimeHunterStore((state) => state.bestCombo)
  const hits = usePrimeHunterStore((state) => state.hits)
  const errors = usePrimeHunterStore((state) => state.errors)
  const health = usePrimeHunterStore((state) => state.health)
  const stage = usePrimeHunterStore((state) => state.stage)
  const feedback = usePrimeHunterStore((state) => state.feedback)
  const start = usePrimeHunterStore((state) => state.start)
  const resetToReady = usePrimeHunterStore((state) => state.resetToReady)
  const togglePause = usePrimeHunterStore((state) => state.togglePause)
  const hitPrime = usePrimeHunterStore((state) => state.hitPrime)
  const hitComposite = usePrimeHunterStore((state) => state.hitComposite)
  const missShot = usePrimeHunterStore((state) => state.missShot)
  const breachPrime = usePrimeHunterStore((state) => state.breachPrime)
  const setStage = usePrimeHunterStore((state) => state.setStage)
  const startHunterRun = useProgressionStore((state) => state.startHunterRun)
  const recordPrimeHit = useProgressionStore((state) => state.recordPrimeHit)
  const recordPrimeMiss = useProgressionStore((state) => state.recordPrimeMiss)
  const recordHunterRun = useProgressionStore((state) => state.recordHunterRun)
  const bestScore = useProgressionStore((state) => state.bestScores['prime-hunter'] ?? 0)
  const level = useProgressionStore((state) => state.level)
  const [shot, setShot] = useState<HunterShot | null>(null)
  const [achievementToast, setAchievementToast] = useState<string | null>(null)
  const [reward, setReward] = useState<RunReward | null>(null)
  const shotIdRef = useRef(0)
  const committedRunRef = useRef(-1)
  const crosshairRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLElement>(null)

  const attempts = hits + errors
  const accuracy = attempts === 0 ? 100 : Math.round((hits / attempts) * 100)

  useEffect(() => {
    resetToReady()
    return resetToReady
  }, [resetToReady])

  const showAchievements = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return
    const id = ids[ids.length - 1] as keyof typeof ACHIEVEMENT_BY_ID
    setAchievementToast(ACHIEVEMENT_BY_ID[id]?.name ?? 'Conquista desbloqueada')
  }, [])

  useEffect(() => {
    if (!achievementToast) return
    const timer = window.setTimeout(() => setAchievementToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [achievementToast])

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const crosshair = crosshairRef.current
      const shell = shellRef.current
      if (!crosshair || !shell) return
      const rect = shell.getBoundingClientRect()
      crosshair.style.transform = `translate3d(${event.clientX - rect.left}px, ${event.clientY - rect.top}px, 0)`
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'p' && (status === 'playing' || status === 'paused')) {
        togglePause()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [status, togglePause])

  useEffect(() => {
    if (status !== 'results' || committedRunRef.current === runId) return
    committedRunRef.current = runId
    const finishXp = Math.max(12, Math.floor(score / 95))
    const result = recordHunterRun({
      score,
      hits,
      misses: errors,
      bestCombo,
      xp: finishXp,
    })
    setReward({ xp: finishXp + hits * 2, isNewBest: result.isNewBestScore })
    audioBus.play(outcome === 'sector-cleared' ? 'complete' : 'error')
    showAchievements(result.unlockedAchievements)
  }, [bestCombo, errors, hits, outcome, recordHunterRun, runId, score, showAchievements, status])

  const begin = () => {
    setReward(null)
    setShot(null)
    startHunterRun()
    start()
  }

  const shootTarget = useCallback((value: number, prime: boolean, position: [number, number, number]) => {
    shotIdRef.current += 1
    setShot({ id: shotIdRef.current, target: position, kind: prime ? 'prime' : 'composite' })
    audioBus.play('laser')
    if (prime) {
      hitPrime(value)
      audioBus.play('correct')
      const result = recordPrimeHit({ xp: 2 })
      showAchievements(result.unlockedAchievements)
    } else {
      hitComposite(value)
      audioBus.play('error')
      recordPrimeMiss()
    }
  }, [hitComposite, hitPrime, recordPrimeHit, recordPrimeMiss, showAchievements])

  const asteroidBreach = useCallback((value: number) => {
    if (!isPrime(value)) return
    breachPrime(value)
    audioBus.play('error')
    recordPrimeMiss()
  }, [breachPrime, recordPrimeMiss])

  const shootEmpty = useCallback((event: MouseEvent) => {
    if (status !== 'playing' || !shellRef.current) return
    const rect = shellRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 9
    const y = -((event.clientY - rect.top) / rect.height - 0.5) * 5.2
    shotIdRef.current += 1
    setShot({ id: shotIdRef.current, target: [x, y, -8], kind: 'miss' })
    audioBus.play('laser')
    missShot()
    recordPrimeMiss()
  }, [missShot, recordPrimeMiss, status])

  const resultTitle = outcome === 'sector-cleared' ? 'SETOR LIMPO' : 'NAVE AVARIADA'
  const resultCopy = outcome === 'sector-cleared'
    ? 'Você isolou vinte primos e estabilizou a rota.'
    : 'A defesa perdeu energia. Recalibre a mira e tente outra rota.'

  const healthMarks = useMemo(() => Array.from({ length: 3 }, (_, index) => index < health), [health])

  return (
    <main ref={shellRef} className={`primeverse-shell ph-shell is-${status}`}>
      <SceneBoundary>
        <Canvas
          className="pv-canvas"
          camera={{ position: [0, 0, 8], fov: 52, near: 0.1, far: 70 }}
          dpr={profile.dpr}
          gl={{ antialias: profile.antialias, alpha: false, powerPreference: 'high-performance' }}
          onPointerMissed={shootEmpty}
          fallback={<WebGLFallback />}
          aria-label="Campo tridimensional do jogo Prime Hunter"
        >
          <Suspense fallback={null}>
            <PrimeHunterScene
              profile={profile}
              playing={status === 'playing'}
              runId={runId}
              score={score}
              shot={shot}
              onHit={shootTarget}
              onBreach={asteroidBreach}
              onStageChange={setStage}
            />
          </Suspense>
        </Canvas>
      </SceneBoundary>

      <div className="pv-hud ph-hud">
        <header className="pv-topbar ph-topbar">
          <Link className="pv-brand" to="/jogos" aria-label="Voltar ao Primeverse">
            <span className="pv-brand__mark">P</span>
            <span><strong>PRIME HUNTER</strong><small>MISSÃO DE INTERCEPTAÇÃO</small></span>
          </Link>
          <div className="pv-topbar__actions">
            <span className="ph-level">LVL {String(level).padStart(2, '0')}</span>
            <QualityControl value={quality} onChange={setQuality} />
            {(status === 'playing' || status === 'paused') && (
              <button className="ph-pause-button" type="button" onClick={togglePause}>
                {status === 'paused' ? 'RETOMAR' : 'Ⅱ PAUSAR'}
              </button>
            )}
            <Link className="pv-icon-link" to="/jogos" aria-label="Sair do jogo">×</Link>
          </div>
        </header>

        {status !== 'ready' && (
          <div className="ph-stats" aria-label="Estatísticas da partida">
            <div className="ph-stat ph-stat--score"><span>SCORE</span><strong>{score.toLocaleString('pt-BR').padStart(5, '0')}</strong><small>BEST {bestScore.toLocaleString('pt-BR')}</small></div>
            <div className="ph-stat"><span>COMBO</span><strong className={combo >= 5 ? 'is-hot' : ''}>×{combo}</strong><small>MELHOR ×{bestCombo}</small></div>
            <div className="ph-stat"><span>PRECISÃO</span><strong>{accuracy}%</strong><small>{hits} ACERTOS · {errors} ERROS</small></div>
          </div>
        )}

        {status !== 'ready' && (
          <div className="ph-mission-status">
            <span>{STAGE_LABELS[stage]}</span>
            <div><i style={{ width: `${Math.min(100, (hits / HUNTER_TARGET_HITS) * 100)}%` }} /></div>
            <small>{hits}/{HUNTER_TARGET_HITS} PRIMOS</small>
          </div>
        )}

        {status !== 'ready' && (
          <div className="ph-health" aria-label={`${health} de 3 pontos de energia`}>
            <span>ENERGIA</span>
            <div>{healthMarks.map((active, index) => <i key={index} className={active ? 'is-active' : ''}>♥</i>)}</div>
          </div>
        )}

        {feedback && status === 'playing' && (
          <div key={feedback.id} className={`ph-feedback is-${feedback.kind}`} aria-live="polite">
            <strong>{feedback.title}</strong><span>{feedback.detail}</span>
          </div>
        )}

        <div ref={crosshairRef} className="ph-crosshair" aria-hidden="true"><i /><i /><span /></div>

        {status === 'ready' && (
          <GameIntro
            title="Prime Hunter"
            emphasis="Hunter"
            instruction="Números sobem pela tela. Acerte os primos e deixe os compostos passarem — errar custa a série."
            actionLabel="Começar a caçada"
            accent="#6ef0a8"
            mark="13"
            keys="Mouse ou toque para mirar e disparar · P pausa"
            onStart={start}
          />
        )}

        {status === 'paused' && (
          <section className="ph-modal ph-pause" aria-labelledby="pause-title">
            <span className="pv-kicker">// SIMULAÇÃO SUSPENSA</span>
            <h2 id="pause-title">PAUSA</h2>
            <p>Os alvos permanecem congelados no setor.</p>
            <button type="button" className="ph-primary" onClick={togglePause}><span>RETOMAR MISSÃO</span><strong>▶</strong></button>
            <Link to="/jogos">Abandonar e voltar ao Primeverse</Link>
          </section>
        )}

        {status === 'results' && (
          <section className="ph-modal ph-results" aria-labelledby="result-title">
            <span className="pv-kicker">// RELATÓRIO DE MISSÃO</span>
            <h2 id="result-title">{resultTitle}</h2>
            <p>{resultCopy}</p>
            <div className="ph-results__grid">
              <div><span>SCORE</span><strong>{score.toLocaleString('pt-BR')}</strong>{reward?.isNewBest && <small>NOVO RECORDE</small>}</div>
              <div><span>PRECISÃO</span><strong>{accuracy}%</strong></div>
              <div><span>BEST COMBO</span><strong>×{bestCombo}</strong></div>
              <div><span>XP RECEBIDO</span><strong>+{reward?.xp ?? 0}</strong></div>
            </div>
            <div className="ph-results__actions">
              <button type="button" className="ph-primary" onClick={begin}><span>JOGAR NOVAMENTE</span><strong>↻</strong></button>
              <Link className="ph-secondary" to="/jogos">VOLTAR AO PRIMEVERSE</Link>
            </div>
          </section>
        )}

        {achievementToast && (
          <div className="ph-achievement" role="status"><span>◆ CONQUISTA DESBLOQUEADA</span><strong>{achievementToast}</strong></div>
        )}

        {status === 'playing' && <div className="ph-controls">MIRA ATIVA <i /> CLIQUE / TOQUE PARA DISPARAR</div>}
      </div>
    </main>
  )
}
