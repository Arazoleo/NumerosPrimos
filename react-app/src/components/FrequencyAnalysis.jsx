import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import './FrequencyAnalysis.css'

const PLAIN_TEXT = "TODA LINGUA TEM SUAS MANIAS EM PORTUGUES AS LETRAS A E O S APARECEM MUITO MAIS DO QUE Z W OU X"
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function shiftChar(ch, k) {
  const i = ALPHA.indexOf(ch)
  if (i === -1) return ch
  return ALPHA[(i + k) % 26]
}

const CIPHER_TEXT = PLAIN_TEXT.split('').map(c => shiftChar(c, 7)).join('')

// Top letters we care about highlighting
const PT_FREQ = { A: 14.6, E: 12.5, O: 10.7, S: 7.8, R: 6.5, I: 6.1 }
const TOP_PT_LETTERS = Object.keys(PT_FREQ)

function AnimatedLetter({ cipherChar, plainChar, isDecoded, globalIndex }) {
  const [displayChar, setDisplayChar] = useState(cipherChar)
  const [settled, setSettled] = useState(!isDecoded)

  useEffect(() => {
    if (isDecoded) {
      setSettled(false)
      let iterations = 0;
      const maxIterations = 8 + Math.random() * 15;
      const startDelay = globalIndex * 15;
      
      let interval;
      const timeout = setTimeout(() => {
        interval = setInterval(() => {
          if (iterations >= maxIterations) {
            clearInterval(interval)
            setDisplayChar(plainChar)
            setSettled(true)
          } else {
            setDisplayChar(ALPHA[Math.floor(Math.random() * 26)])
            iterations++
          }
        }, 35)
      }, startDelay)

      return () => {
        clearTimeout(timeout)
        clearInterval(interval)
      }
    } else {
      setDisplayChar(cipherChar)
      setSettled(true)
    }
  }, [isDecoded, plainChar, cipherChar, globalIndex])

  return (
    <motion.span 
      className={`freq-char ${isDecoded && settled ? 'decoded' : ''}`}
      animate={isDecoded && settled ? { scale: [1.2, 1], opacity: [0.5, 1] } : { scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {displayChar}
    </motion.span>
  )
}

export default function FrequencyAnalysis() {
  const [analyzing, setAnalyzing] = useState(false)

  const currentText = analyzing ? PLAIN_TEXT : CIPHER_TEXT

  const frequencies = useMemo(() => {
    const counts = {}
    let totalLetters = 0
    for (const char of currentText) {
      if (ALPHA.includes(char)) {
        counts[char] = (counts[char] || 0) + 1
        totalLetters++
      }
    }
    
    // Sort letters by frequency
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // show top 10

    // Calculate percentage for max height
    const maxCount = sorted[0]?.[1] || 1
    
    return sorted.map(([char, count]) => ({
      char,
      percent: (count / maxCount) * 100,
      isTop: TOP_PT_LETTERS.includes(analyzing ? char : shiftChar(char, 26 - 7))
    }))
  }, [currentText, analyzing])

  return (
    <section id="frequencia" className="freq-section">
      <div className="container freq-grid">
        
        <div className="freq-interactive">
          <div className="freq-chart-container">
            <div className="freq-chart-title">Frequência de Letras</div>
            <div className="freq-chart">
              {frequencies.map((item, i) => (
                <div key={`${item.char}-${i}`} className="freq-bar-wrap">
                  <div 
                    className={`freq-bar ${item.isTop && analyzing ? 'highlight' : ''}`}
                    style={{ height: `${item.percent}%` }}
                  />
                  <div className="freq-bar-label">{item.char}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="freq-message">
            {PLAIN_TEXT.split(' ').map((word, wIdx, words) => {
              const previousWordsLength = words.slice(0, wIdx).reduce((acc, w) => acc + w.length + 1, 0);
              return (
                <span key={wIdx} className="freq-word">
                  {word.split('').map((char, cIdx) => {
                    const globalIndex = previousWordsLength + cIdx;
                    const cipherChar = shiftChar(char, 7);
                    return (
                      <AnimatedLetter 
                        key={cIdx} 
                        cipherChar={cipherChar} 
                        plainChar={char} 
                        isDecoded={analyzing} 
                        globalIndex={globalIndex} 
                      />
                    )
                  })}
                </span>
              )
            })}
          </div>

          <div className="freq-actions">
            <button 
              className={`btn ${analyzing ? 'btn-ghost' : 'btn-primary'}`}
              onClick={() => setAnalyzing(!analyzing)}
            >
              {analyzing ? "Esconder Padrões" : "Aplicar Análise de Frequência"}
            </button>
          </div>
        </div>

        <div className="freq-text-content">
          <span className="kicker">// quebrando o código</span>
          <h2 className="h2" style={{ marginBottom: '24px' }}>A fraqueza<br/>dos <em>padrões</em>.</h2>
          
          <p>
            Como você viu no texto ao lado, toda língua tem suas preferências. Em português, as vogais e a letra S dominam a escrita. A Análise de Frequência tira vantagem disso: contando os símbolos de uma mensagem secreta, podemos deduzir que o símbolo mais comum provavelmente esconde a letra 'A' ou 'E'.
          </p>

          <p>
            Foi explorando padrões, repetições estruturais e a previsibilidade humana que <strong>Alan Turing</strong> e sua equipe em Bletchley Park conseguiram quebrar a máquina <strong>Enigma</strong> na Segunda Guerra Mundial.
          </p>

          <p>
            Os alemães enviavam mensagens diárias com formatações previsíveis (como a previsão do tempo). Turing usou esses fragmentos conhecidos (chamados de <em>cribs</em>) para criar as máquinas Bombe, automatizando a busca pelas chaves e derrotando a Enigma.
          </p>
        </div>

      </div>
    </section>
  )
}
