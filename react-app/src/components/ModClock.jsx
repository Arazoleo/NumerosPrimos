import { useRef, useState } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import './ModClock.css'

const MOD = 12
const A_MAX = 47

function ModClock() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  const aFloat = useTransform(scrollYProgress, [0.05, 0.95], [0, A_MAX])

  const pointerRef = useRef(null)
  useMotionValueEvent(aFloat, 'change', v => {
    if (pointerRef.current) {
      pointerRef.current.setAttribute('transform', `rotate(${v * (360 / MOD)} 0 0)`)
    }
  })

  const [aVal, setAVal] = useState(0)
  useMotionValueEvent(aFloat, 'change', v => setAVal(Math.max(0, Math.floor(v))))

  const result = aVal % MOD
  const turns = Math.floor(aVal / MOD)

  return (
    <section id="relogio" ref={ref} className="modclock-section">
      <div className="modclock-sticky">
        <div className="container modclock-grid">
          <div className="modclock-text">
            <span className="kicker">// aritmética modular</span>
            <h2 className="h2">A matemática <em>do relógio</em>.</h2>
            <p className="section-sub">
              Num relógio de 12 horas, <strong>15h é o mesmo que 3h</strong>. Adicionar 12 não muda nada.
              Essa é a operação <code>a mod n</code>, o coração de toda criptografia moderna,
              pois com primos enormes ela se torna uma armadilha sem volta.
            </p>

            <div className="modclock-eq">
              <div className="eq-row">
                <span className="eq-big">{aVal}</span>
                <span className="eq-op">mod</span>
                <span className="eq-big">{MOD}</span>
                <span className="eq-op">=</span>
                <span className="eq-big result">{result}</span>
              </div>
              <div className="eq-explain">
                {turns > 0 ? (
                  <>
                    <strong>{aVal}</strong> = <strong>{MOD}</strong> × <strong>{turns}</strong> + <strong>{result}</strong>
                    <span className="dim"> · {turns} volta{turns > 1 ? 's' : ''} no relógio</span>
                  </>
                ) : (
                  <span className="dim">menos de uma volta — ainda na primeira</span>
                )}
              </div>
            </div>
          </div>

          <div className="modclock-viz">
            <svg viewBox="-130 -130 260 260" className="modclock-svg">
              <defs>
                <radialGradient id="clock-grad" cx="50%" cy="40%">
                  <stop offset="0%"  stopColor="#FFFBEA" />
                  <stop offset="100%" stopColor="#FFF4C2" />
                </radialGradient>
              </defs>

              <circle cx="0" cy="0" r="108" fill="url(#clock-grad)"
                stroke="rgba(14,14,16,0.10)" strokeWidth="1" />
              <circle cx="0" cy="0" r="92" fill="none"
                stroke="rgba(14,14,16,0.06)" strokeWidth="0.5" />

              {Array.from({ length: MOD }, (_, i) => {
                const a = (i * 360 / MOD - 90) * Math.PI / 180
                const x1 = Math.cos(a) * 102
                const y1 = Math.sin(a) * 102
                const x2 = Math.cos(a) * 108
                const y2 = Math.sin(a) * 108
                return <line key={`t-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(14,14,16,0.25)" strokeWidth="1.2" />
              })}

              {Array.from({ length: MOD }, (_, i) => {
                const a = (i * 360 / MOD - 90) * Math.PI / 180
                const x = Math.cos(a) * 82
                const y = Math.sin(a) * 82
                const active = result === i
                return (
                  <g key={`n-${i}`}>
                    {active && (
                      <motion.circle cx={x} cy={y} r="18"
                        fill="#FFCC1A"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                      />
                    )}
                    <text x={x} y={y}
                      textAnchor="middle" dominantBaseline="central"
                      fontFamily="'Space Grotesk', sans-serif"
                      fontWeight="700"
                      fontSize="18"
                      fill={active ? '#0E0E10' : 'rgba(14,14,16,0.55)'}>
                      {i}
                    </text>
                  </g>
                )
              })}

              <g ref={pointerRef} transform="rotate(0 0 0)">
                <line x1="0" y1="0" x2="0" y2="-86"
                  stroke="#0E0E10" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx="0" cy="-86" r="5" fill="#F5B800"
                  stroke="#0E0E10" strokeWidth="1.5" />
              </g>

              <circle cx="0" cy="0" r="7" fill="#0E0E10" />
            </svg>

            <div className="modclock-caption">
              role para girar o ponteiro ↓
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ModClock
