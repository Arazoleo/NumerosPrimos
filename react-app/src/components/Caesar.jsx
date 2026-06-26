import { useRef, useState } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import './Caesar.css'

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ANG = 360 / 26
const MSG = 'NUMEROS PRIMOS'

function shift(ch, k) {
  const i = ALPHA.indexOf(ch)
  if (i === -1) return ch
  return ALPHA[(i + k + 26) % 26]
}

function CaesarWheel({ k, kFloat }) {
  return (
    <svg viewBox="-120 -120 240 240" className="caesar-wheel">
      <circle cx="0" cy="0" r="108" fill="none" stroke="rgba(14,14,16,0.08)" strokeWidth="0.8" />
      <circle cx="0" cy="0" r="82"  fill="none" stroke="rgba(14,14,16,0.08)" strokeWidth="0.8" />
      <circle cx="0" cy="0" r="56"  fill="none" stroke="rgba(14,14,16,0.08)" strokeWidth="0.8" />

      {ALPHA.split('').map((ch, i) => {
        const a = (i * ANG - 90) * Math.PI / 180
        const x = Math.cos(a) * 95
        const y = Math.sin(a) * 95
        return (
          <text key={`o-${i}`} x={x} y={y}
            textAnchor="middle" dominantBaseline="central"
            className="caesar-letter outer">{ch}</text>
        )
      })}

      <motion.g style={{ rotate: kFloat }}>
        {ALPHA.split('').map((ch, i) => {
          const a = (i * ANG - 90) * Math.PI / 180
          const x = Math.cos(a) * 68
          const y = Math.sin(a) * 68
          const isAlignedTop = i === k
          return (
            <text key={`i-${i}`} x={x} y={y}
              textAnchor="middle" dominantBaseline="central"
              className={`caesar-letter inner ${isAlignedTop ? 'aligned' : ''}`}>{ch}</text>
          )
        })}
      </motion.g>

      <path d="M 0 -118 L -7 -106 L 7 -106 Z" fill="#F5B800" stroke="#0E0E10" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

function LetterTile({ original, k, encoded }) {
  return (
    <div className="letter-tile">
      <div className="letter-top">{original}</div>
      <motion.div
        className="letter-bottom"
        key={encoded}
        initial={{ opacity: 0, y: -8, rotateX: -60 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.25 }}
      >
        {encoded}
      </motion.div>
    </div>
  )
}

export default function Caesar() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  const kFloat = useTransform(scrollYProgress, [0.05, 0.92], [0, -25 * ANG])
  const kProgress = useTransform(scrollYProgress, [0.05, 0.92], [0, 25])

  const [k, setK] = useState(0)
  useMotionValueEvent(kProgress, 'change', (v) => {
    setK(Math.max(0, Math.min(25, Math.round(v))))
  })

  const encoded = MSG.split('').map(ch => shift(ch, k)).join('')

  return (
    <section id="caesar" ref={ref} className="caesar-section">
      <div className="caesar-sticky">
        <div className="container caesar-grid">
          <div className="caesar-text">
            <span className="kicker">// cifra de césar</span>
            <h2 className="h2">A primeira <em>criptografia</em><br/>da história.</h2>
            <p className="section-sub">
              Júlio César protegia suas mensagens deslocando cada letra por um número fixo.
              Simples e fácil de quebrar. Mas é o ponto de partida pra entender tudo o que veio depois.
            </p>

            <div className="caesar-readout">
              <div className="caesar-k">
                <span className="caesar-k-lbl">deslocamento</span>
                <span className="caesar-k-val">k = {k}</span>
              </div>

              <div className="caesar-row">
                <div className="caesar-row-lbl">cifrado</div>
                <div className="caesar-row-msg">
                  {MSG.split('').map((ch, i) => (
                    <span key={i} className={`tile ${ch === ' ' ? 'space' : ''}`}>{ch === ' ' ? ' ' : shift(ch, 25)}</span>
                  ))}
                </div>
              </div>

              <div className="caesar-arrow">↓</div>

              <div className="caesar-row cipher">
                <div className="caesar-row-lbl">decifrado</div>
                <div className="caesar-row-msg">
                  {MSG.split('').map((ch, i) => {
                    const cipherChar = ch === ' ' ? ' ' : shift(ch, 25);
                    const decodedChar = ch === ' ' ? ' ' : shift(cipherChar, 26 - (k % 26));
                    return <LetterTile key={i} original={cipherChar} k={k} encoded={decodedChar} />
                  })}
                </div>
              </div>

              <div className="caesar-formula">
                <code>m = (c - k) mod 26</code>
              </div>
            </div>
          </div>

          <div className="caesar-viz">
            <CaesarWheel k={k} kFloat={kFloat} />
            <div className="caesar-wheel-caption">
              ↑ <strong>topo</strong> mostra a letra cifrada do <strong>A</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
