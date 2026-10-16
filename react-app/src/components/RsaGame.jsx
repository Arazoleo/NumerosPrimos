import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './RsaGame.css'

const LEVELS = [
  [ // Nivel 1
    { n: 14, p: 2, q: 7 }, { n: 15, p: 3, q: 5 }, { n: 21, p: 3, q: 7 },
    { n: 33, p: 3, q: 11 }, { n: 35, p: 5, q: 7 }, { n: 39, p: 3, q: 13 }
  ],
  [ // Nivel 2
    { n: 55, p: 5, q: 11 }, { n: 65, p: 5, q: 13 }, { n: 77, p: 7, q: 11 },
    { n: 85, p: 5, q: 17 }, { n: 91, p: 7, q: 13 }, { n: 95, p: 5, q: 19 }
  ],
  [ // Nivel 3
    { n: 119, p: 7, q: 17 }, { n: 133, p: 7, q: 19 }, { n: 143, p: 11, q: 13 },
    { n: 161, p: 7, q: 23 }, { n: 187, p: 11, q: 17 }, { n: 203, p: 7, q: 29 }
  ],
  [ // Nivel 4
    { n: 209, p: 11, q: 19 }, { n: 221, p: 13, q: 17 }, { n: 247, p: 13, q: 19 },
    { n: 253, p: 11, q: 23 }, { n: 299, p: 13, q: 23 }, { n: 319, p: 11, q: 29 },
    { n: 323, p: 17, q: 19 }, { n: 377, p: 13, q: 29 }
  ],
  [ // Nivel 5
    { n: 391, p: 17, q: 23 }, { n: 437, p: 19, q: 23 }, { n: 493, p: 17, q: 29 },
    { n: 551, p: 19, q: 29 }, { n: 589, p: 19, q: 31 }, { n: 667, p: 23, q: 29 },
    { n: 713, p: 23, q: 31 }
  ]
]

const TUTORIAL_STEPS = [
  { n: 15, hint: 'Dica: teste os menores números primos.' },
  { n: 21, hint: 'Dica: procure um primo que divida 21 sem deixar resto.' },
  { n: 35, hint: 'Agora tente descobrir os fatores sem uma dica.' }
]

const TIME_LIMIT = 80

function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

function arePrimeFactors(n, pInput, qInput) {
  const p = Number(pInput)
  const q = Number(qInput)
  return Number.isInteger(p) && Number.isInteger(q) && p * q === n && isPrime(p) && isPrime(q)
}

export default function RsaGame() {
  const [status, setStatus] = useState('idle') // idle, intro, playing, won, lost
  const [tutorialStep, setTutorialStep] = useState(0)
  const [tutorialComplete, setTutorialComplete] = useState(false)
  const [tutorialFeedback, setTutorialFeedback] = useState('')
  const [level, setLevel] = useState(0)
  const [variationIndex, setVariationIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [inputP, setInputP] = useState('')
  const [inputQ, setInputQ] = useState('')
  const [bestTime, setBestTime] = useState(null)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('rsaBestTime')
    if (saved) setBestTime(parseInt(saved, 10))
  }, [])

  useEffect(() => {
    let timer;
    if (status === 'playing' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(t => t - 1)
      }, 1000)
    } else if (status === 'playing' && timeLeft === 0) {
      setStatus('lost')
    }
    return () => clearInterval(timer)
  }, [status, timeLeft])

  const startIntro = () => {
    setTutorialStep(0)
    setTutorialComplete(false)
    setTutorialFeedback('')
    setInputP('')
    setInputQ('')
    setStatus('intro')
  }

  const handleTutorialCheck = (e) => {
    e.preventDefault()
    const current = TUTORIAL_STEPS[tutorialStep]

    if (arePrimeFactors(current.n, inputP, inputQ)) {
      setTutorialFeedback('')
      setTutorialComplete(true)
      return
    }

    if (!inputP || !inputQ) {
      setTutorialFeedback('Preencha os dois campos para testar sua resposta.')
    } else if (!isPrime(Number(inputP)) || !isPrime(Number(inputQ))) {
      setTutorialFeedback('Cada fator precisa ser um número primo. Tente novamente.')
    } else {
      setTutorialFeedback('Esses primos não resultam na chave. Tente outra combinação.')
    }
  }

  const advanceTutorial = () => {
    if (tutorialStep === TUTORIAL_STEPS.length - 1) {
      startGame()
      return
    }
    setTutorialStep(step => step + 1)
    setInputP('')
    setInputQ('')
    setTutorialComplete(false)
    setTutorialFeedback('')
  }

  const startGame = () => {
    setStatus('playing')
    setLevel(0)
    setVariationIndex(Math.floor(Math.random() * LEVELS[0].length))
    setTimeLeft(TIME_LIMIT)
    setInputP('')
    setInputQ('')
  }

  const handleCheck = (e) => {
    e.preventDefault()
    if (status !== 'playing') return

    const current = LEVELS[level][variationIndex]

    if (arePrimeFactors(current.n, inputP, inputQ)) {
      // Success
      if (level === LEVELS.length - 1) {
        setStatus('won')
        const timeSpent = TIME_LIMIT - timeLeft
        if (!bestTime || timeSpent < bestTime) {
          setBestTime(timeSpent)
          localStorage.setItem('rsaBestTime', timeSpent.toString())
        }
      } else {
        const nextLevel = level + 1
        setLevel(nextLevel)
        setVariationIndex(Math.floor(Math.random() * LEVELS[nextLevel].length))
        setInputP('')
        setInputQ('')
      }
    } else {
      // Error / Shake
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  const currentLevelData = LEVELS[level] ? LEVELS[level][variationIndex] : LEVELS[0][0]

  return (
    <section id="rsa-game" className="rsa-game-section">
      <div className="container rsa-game-grid">
        
        <div className="rsa-game-text">
          <span className="kicker">// minijogo</span>
          <h2 className="h2">Quebrando o<br/><em>Cadeado RSA</em>.</h2>
          <p className="section-sub">
            Inverta o processo: nós te damos a Chave Pública (N). Sua missão é atuar como um computador tentando quebrar a segurança, fatorando N em seus dois números primos originais (p e q).
          </p>
          
          <div className="game-rules">
            <ul>
              <li><strong>Desafio:</strong> {LEVELS.length} Fases progressivas.</li>
              <li><strong>Tempo:</strong> {TIME_LIMIT} segundos no total.</li>
              <li><strong>Ação:</strong> Digite dois números primos que multiplicados resultem no número do escudo.</li>
            </ul>
          </div>

          {bestTime !== null && (
            <div className="best-time-badge">
              🏆 Melhor Tempo: <strong>{bestTime}s</strong>
            </div>
          )}
        </div>

        <div className="rsa-game-interactive">
          <div className="rsa-game-card">
            
            <div className="rsa-game-header">
              <div className="level-badge">
                {status === 'intro'
                  ? `Tutorial · Etapa ${tutorialStep + 1} / ${TUTORIAL_STEPS.length}`
                  : `Nível ${level + 1} / ${LEVELS.length}`}
              </div>
              {status === 'intro' ? (
                <div className="time-badge tutorial-time-badge">Sem tempo</div>
              ) : (
                <div className={`time-badge ${timeLeft <= 10 && status === 'playing' ? 'danger' : ''}`}>
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
              )}
            </div>

            <div className="rsa-game-body">
              <AnimatePresence mode="wait">
                {status === 'idle' && (
                  <motion.div key="idle" className="game-state idle" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                    <div className="shield-icon">🛡️</div>
                    <h3>Pronto para fatorar?</h3>
                    <button className="btn btn-primary" onClick={startIntro}>Iniciar tutorial</button>
                  </motion.div>
                )}

                {status === 'intro' && (
                  <motion.div key="intro" className="game-state intro" initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}} exit={{opacity:0}}>
                    <div
                      className="tutorial-progress"
                      role="progressbar"
                      aria-label="Progresso do tutorial"
                      aria-valuemin={1}
                      aria-valuemax={TUTORIAL_STEPS.length}
                      aria-valuenow={tutorialStep + 1}
                    >
                      {TUTORIAL_STEPS.map((step, index) => (
                        <span
                          key={step.n}
                          className={`tutorial-progress-step ${index < tutorialStep || (index === tutorialStep && tutorialComplete) ? 'active' : ''}`}
                        />
                      ))}
                    </div>
                    <h3>{tutorialComplete ? 'Fatores encontrados!' : 'Forje os fatores'}</h3>
                    <p className="tutorial-description">
                      {tutorialComplete
                        ? 'Correto! Você encontrou dois primos cujo produto é a chave.'
                        : 'Jogue como no desafio: encontre os dois primos que, multiplicados, formam a chave.'}
                    </p>
                    <div className="target-shield tutorial-target">
                      <span className="shield-label">CHAVE DE TREINO (N)</span>
                      <span className="shield-number">{TUTORIAL_STEPS[tutorialStep].n}</span>
                    </div>

                    {tutorialComplete ? (
                      <>
                        <div className="tutorial-example">
                          <strong>{inputP} × {inputQ} = {TUTORIAL_STEPS[tutorialStep].n}</strong>
                          <span>Os dois fatores são primos. Etapa concluída!</span>
                        </div>
                        <div className="tutorial-actions">
                          <button className="btn btn-primary" onClick={advanceTutorial}>
                            {tutorialStep === TUTORIAL_STEPS.length - 1 ? 'Começar desafio' : 'Próxima chave'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="tutorial-hint">{TUTORIAL_STEPS[tutorialStep].hint}</p>
                        <form className="factor-form" onSubmit={handleTutorialCheck}>
                          <div className="inputs-row">
                            <div className="input-group">
                              <label htmlFor="tutorial-prime-p">Primo (p)</label>
                              <input
                                id="tutorial-prime-p"
                                type="number"
                                min="2"
                                step="1"
                                value={inputP}
                                onChange={e => setInputP(e.target.value)}
                                placeholder="ex: 3"
                                autoFocus
                              />
                            </div>
                            <div className="multiply-sign">×</div>
                            <div className="input-group">
                              <label htmlFor="tutorial-prime-q">Primo (q)</label>
                              <input
                                id="tutorial-prime-q"
                                type="number"
                                min="2"
                                step="1"
                                value={inputQ}
                                onChange={e => setInputQ(e.target.value)}
                                placeholder="ex: 5"
                              />
                            </div>
                          </div>
                          {tutorialFeedback && (
                            <p className="tutorial-feedback" role="status">{tutorialFeedback}</p>
                          )}
                          <button type="submit" className="btn btn-primary btn-block">Testar fatores</button>
                        </form>
                      </>
                    )}
                  </motion.div>
                )}

                {status === 'playing' && (
                  <motion.div key="playing" className="game-state playing" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                    <div className="target-shield">
                      <span className="shield-label">CHAVE PÚBLICA (N)</span>
                      <span className="shield-number">{currentLevelData.n}</span>
                    </div>

                    <form className="factor-form" onSubmit={handleCheck}>
                      <div className="inputs-row">
                        <div className="input-group">
                          <label>Primo (p)</label>
                          <input 
                            type="number" 
                            min="2" 
                            value={inputP} 
                            onChange={e => setInputP(e.target.value)} 
                            placeholder="ex: 3"
                            autoFocus
                          />
                        </div>
                        <div className="multiply-sign">×</div>
                        <div className="input-group">
                          <label>Primo (q)</label>
                          <input 
                            type="number" 
                            min="2" 
                            value={inputQ} 
                            onChange={e => setInputQ(e.target.value)} 
                            placeholder="ex: 5"
                          />
                        </div>
                      </div>
                      
                      <motion.button 
                        type="submit" 
                        className="btn btn-primary btn-block"
                        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
                        transition={{ duration: 0.4 }}
                      >
                        Desbloquear
                      </motion.button>
                    </form>
                  </motion.div>
                )}

                {status === 'won' && (
                  <motion.div key="won" className="game-state won" initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}}>
                    <div className="shield-icon success">🔓</div>
                    <h3>Sistema Invadido!</h3>
                    <p>Você completou em {TIME_LIMIT - timeLeft} segundos.</p>
                    <button className="btn btn-primary" onClick={startGame}>Jogar Novamente</button>
                  </motion.div>
                )}

                {status === 'lost' && (
                  <motion.div key="lost" className="game-state lost" initial={{opacity:0, scale:0.9}} animate={{opacity:1, scale:1}}>
                    <div className="shield-icon error">🔒</div>
                    <h3>Tempo Esgotado!</h3>
                    <p>A segurança do RSA te venceu.</p>
                    <p style={{ marginTop: '-12px', marginBottom: '24px', fontSize: '15px' }}>
                      A chave pública era <strong>{currentLevelData.n}</strong>.<br/>
                      Os primos eram <strong>{currentLevelData.p}</strong> e <strong>{currentLevelData.q}</strong>.
                    </p>
                    <button className="btn btn-primary" onClick={startGame}>Tentar Novamente</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
