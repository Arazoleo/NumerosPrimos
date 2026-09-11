import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useQualitySettings } from '../../graphics/useQualitySettings'
import { useDocumentTitle } from '../../useDocumentTitle'
import SkylineRunnerExperience, {
  type SkylineRunResult,
} from './SkylineRunnerExperience'
import GameIntro from '../../ui/GameIntro'
import { recordSkylineRunnerProgress } from './progressionAdapter'
import './skyline-runner.css'

type PagePhase = 'intro' | 'playing' | 'paused' | 'victory' | 'defeat'

interface CompletedRun extends SkylineRunResult {
  readonly isNewBest: boolean
}

function formatTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function RunnerMark(): JSX.Element {
  return <span className="skyline-mark" aria-hidden="true"><i /><b>∕∕</b></span>
}

export default function SkylineRunnerPage(): JSX.Element {
  useDocumentTitle('Prime Runner · Skyline Protocol')
  const { quality, setQuality, profile } = useQualitySettings()
  const [phase, setPhase] = useState<PagePhase>('intro')
  const [runKey, setRunKey] = useState(0)
  const [result, setResult] = useState<CompletedRun | null>(null)
  const modalRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (phase !== 'paused' && phase !== 'victory' && phase !== 'defeat') return undefined
    const modal = modalRef.current
    if (!modal) return undefined
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    modal.querySelector<HTMLElement>('button, a[href]')?.focus()
    return () => {
      if (previous?.isConnected) previous.focus()
    }
  }, [phase])

  const beginRun = useCallback(() => {
    setRunKey((value) => value + 1)
    setResult(null)
    setPhase('playing')
  }, [])

  const finishRun = useCallback((run: SkylineRunResult) => {
    const isNewBest = recordSkylineRunnerProgress({
      runId: `${Date.now()}-${run.score}`,
      score: run.score,
      xp: run.xp,
    })
    setResult({ ...run, isNewBest })
    setPhase('victory')
  }, [])

  return (
    <main className={`skyline-runner skyline-runner--${phase}`} data-quality={quality}>
      <div className="skyline-noise" aria-hidden="true" />

      {phase === 'intro' ? (
        <GameIntro
          title="Prime Runner"
          emphasis="Runner"
          instruction="Atravesse a cidade sem tocar o chão da rua. Corra, deslize, escale bordas e use o gancho — o embalo é o que te mantém vivo."
          actionLabel="Saltar do telhado"
          accent="#ff5ea8"
          mark="17"
          keys="WASD mover · Espaço saltar · Ctrl deslizar · Mouse gancho"
          onStart={() => setPhase('playing')}
        />
      ) : (
        <section className="skyline-stage" aria-label="Prime Runner: Skyline Protocol">
          {(phase === 'playing' || phase === 'paused') && (
            <SkylineRunnerExperience
              key={runKey}
              paused={phase === 'paused'}
              profile={profile}
              quality={quality}
              onQualityChange={setQuality}
              onPauseChange={(paused) => setPhase(paused ? 'paused' : 'playing')}
              onVictory={finishRun}
              onDefeat={(run) => {
                setResult({ ...run, isNewBest: false })
                setPhase('defeat')
              }}
            />
          )}

          {phase === 'paused' && (
            <div className="skyline-modal-layer">
              <section ref={modalRef} className="skyline-modal skyline-pause" role="dialog" aria-modal="true" aria-labelledby="skyline-pause-title">
                <p className="skyline-kicker"><i /> CORRIDA SUSPENSA</p>
                <h2 id="skyline-pause-title">Respire no alto.</h2>
                <p>A cidade continua abaixo. Seu último ponto seguro está preservado.</p>
                <button type="button" className="skyline-primary" onClick={() => setPhase('playing')}>RETOMAR CORRIDA <span>→</span></button>
                <button type="button" className="skyline-quiet" onClick={() => setPhase('intro')}>ABANDONAR MISSÃO</button>
              </section>
            </div>
          )}

          {(phase === 'victory' || phase === 'defeat') && (
            <div className={`skyline-ending skyline-ending--${phase}`}>
              <div className="skyline-ending__art" aria-hidden="true" />
              <section ref={modalRef} className="skyline-ending__content" role="dialog" aria-modal="true" aria-labelledby="skyline-ending-title">
                <RunnerMark />
                <p className="skyline-kicker"><i /> {phase === 'victory' ? 'FAROL PRIMO ATIVO' : 'SINAL INTERROMPIDO'}</p>
                <h2 id="skyline-ending-title">{phase === 'victory' ? <>A cidade<br /><em>voltou a respirar.</em></> : <>O horizonte<br /><em>ainda espera.</em></>}</h2>
                <p>{phase === 'victory'
                  ? 'A tríade abriu uma rota segura sobre os telhados. Nilo transmitiu o protocolo para toda a resistência.'
                  : 'As Sentinelas venceram esta rota, mas Lia manteve o último checkpoint aberto para uma nova tentativa.'}</p>
                {result && (
                  <div className="skyline-results">
                    <div><span>PONTUAÇÃO</span><strong>{result.score.toLocaleString('pt-BR')}</strong></div>
                    <div><span>TEMPO</span><strong>{formatTime(result.elapsedMs)}</strong></div>
                    <div><span>FLOW MÁX.</span><strong>{Math.round(result.maxFlow)}%</strong></div>
                    <div><span>SENTINELAS</span><strong>{result.enemiesDefeated}/4</strong></div>
                    {result.isNewBest && <small>NOVO RECORDE</small>}
                  </div>
                )}
                <div className="skyline-ending__actions">
                  <button type="button" className="skyline-primary" onClick={beginRun}>{phase === 'victory' ? 'CORRER NOVAMENTE' : 'TENTAR DE NOVO'} <span>↗</span></button>
                  <Link className="skyline-quiet" to="/jogos">VOLTAR AO PRIMEVERSE</Link>
                </div>
              </section>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
