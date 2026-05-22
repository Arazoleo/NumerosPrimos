import { useMemo, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent, AnimatePresence } from 'framer-motion'
import './Sieve.css'

const N = 100
const SIEVE_PRIMES = [2, 3, 5, 7]

function buildSieve() {
  const isPrime = new Array(N + 1).fill(true)
  isPrime[0] = isPrime[1] = false
  for (let p = 2; p * p <= N; p++) {
    if (isPrime[p]) for (let k = p * p; k <= N; k += p) isPrime[k] = false
  }

  const phases = { 2: 0.18, 3: 0.36, 5: 0.52, 7: 0.66 }
  const phaseLen = 0.10

  const cells = []
  for (let n = 1; n <= N; n++) {
    let strikeT = 99
    let highlightT = 99

    if (n === 1) {
      strikeT = 0.10
    } else if (!isPrime[n]) {
      for (const p of SIEVE_PRIMES) {
        if (n % p === 0) {
          const multiples = []
          for (let k = p * 2; k <= N; k += p) multiples.push(k)
          const idx = multiples.indexOf(n)
          strikeT = phases[p] + (idx / Math.max(1, multiples.length - 1)) * phaseLen
          break
        }
      }
    } else if (SIEVE_PRIMES.includes(n)) {
      highlightT = phases[n] - 0.015
    }
    cells.push({ n, isPrime: isPrime[n], strikeT, highlightT })
  }
  return cells
}

function SieveCell({ cell, progress }) {
  const { n, isPrime, strikeT, highlightT } = cell

  const struck       = useTransform(progress, [strikeT,  strikeT + 0.012], [0, 1])
  const struckOpac   = useTransform(progress, [strikeT,  strikeT + 0.012], [1, 0.32])
  const highlightAmt = useTransform(progress, [highlightT, highlightT + 0.025], [0, 1])
  const finalReveal  = useTransform(progress, [0.80, 0.92], isPrime ? [0, 1] : [0, 0])

  const bg = useTransform([highlightAmt, finalReveal], ([h, f]) => {
    const t = Math.max(h, f)
    if (t < 0.001) return 'rgba(255,255,255,1)'
    const r = 255
    const g = Math.round(255 - 51 * t)
    const b = Math.round(255 - 229 * t)
    return `rgba(${r},${g},${b},1)`
  })

  const borderColor = useTransform([highlightAmt, finalReveal], ([h, f]) =>
    Math.max(h, f) > 0.1 ? 'rgba(245,184,0,0.7)' : 'rgba(14,14,16,0.08)'
  )

  const scale = useTransform(highlightAmt, [0, 0.5, 1], [1, 1.18, 1])

  return (
    <motion.div
      className="sieve-cell"
      style={{ background: bg, borderColor, opacity: struckOpac, scale }}
    >
      <span className="sieve-n">{n}</span>
      <motion.div className="sieve-strike" style={{ scaleX: struck }} />
    </motion.div>
  )
}

const STEPS = [
  { from: 0.00, label: 'Escreva todos os números de 1 a 100.' },
  { from: 0.10, label: '1 não é primo. Risca.' },
  { from: 0.16, label: '2 é primo, risca todos os múltiplos de 2.' },
  { from: 0.34, label: '3 é primo, risca os múltiplos de 3 que sobraram.' },
  { from: 0.50, label: '5 é primo, risca os múltiplos de 5.' },
  { from: 0.64, label: '7 é primo, risca os múltiplos de 7.' },
  { from: 0.80, label: 'O que sobra são os 25 primos abaixo de 100.' },
]

function SieveStep({ progress }) {
  const [phase, setPhase] = useState(0)
  useMotionValueEvent(progress, 'change', (v) => {
    let p = 0
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (v >= STEPS[i].from) { p = i; break }
    }
    setPhase(prev => prev !== p ? p : prev)
  })
  return (
    <div className="sieve-step-box">
      <span className="sieve-step-num">passo {phase + 1} / {STEPS.length}</span>
      <AnimatePresence mode="wait">
        <motion.p key={phase}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="sieve-step-text">
          {STEPS[phase].label}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

export default function Sieve() {
  const ref = useRef(null)
  const cells = useMemo(buildSieve, [])
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  return (
    <section ref={ref} className="sieve-section">
      <div className="sieve-sticky">
        <div className="container sieve-grid">
          <div className="sieve-text">
            <span className="kicker">// crivo de eratóstenes</span>
            <h2 className="h2">Como você acha <em>os primos</em>?</h2>
            <p className="section-sub">Um método de mais de 2.200 anos: marque todos os múltiplos e veja quem sobra.</p>
            <SieveStep progress={scrollYProgress} />
          </div>
          <div className="sieve-board">
            {cells.map(c => (
              <SieveCell key={c.n} cell={c} progress={scrollYProgress} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
