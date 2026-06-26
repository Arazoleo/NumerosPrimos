import { useMemo, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import './Ulam.css'

const N_ULAM = 225

function isPrime(n) {
  if (n < 2) return false
  if (n < 4) return true
  if (n % 2 === 0) return false
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false
  return true
}

function ulamPositions(N) {
  const pos = [{ x: 0, y: 0 }]
  let x = 0, y = 0
  let dir = 0
  let steps = 1, taken = 0, runs = 0
  for (let i = 2; i <= N; i++) {
    if (dir === 0) x++
    else if (dir === 1) y++
    else if (dir === 2) x--
    else y--
    pos.push({ x, y })
    taken++
    if (taken === steps) {
      taken = 0
      dir = (dir + 1) % 4
      runs++
      if (runs % 2 === 0) steps++
    }
  }
  return pos
}

function UlamDot({ n, p, progress }) {
  const prime = isPrime(n)
  const start = (n - 1) / N_ULAM
  const end = start + 2 / N_ULAM
  const opacity = useTransform(progress, [start, end], [0, prime ? 1 : 0.16])
  const r       = useTransform(progress, [start, end], [0, prime ? 0.46 : 0.16])
  return (
    <motion.circle
      cx={p.x} cy={-p.y}
      r={r}
      fill={prime ? 'url(#ulam-grad)' : '#0E0E10'}
      style={{ opacity }}
    />
  )
}

function UlamStats({ progress }) {
  const [n, setN] = useState(1)
  const [primeCount, setPrimeCount] = useState(0)
  useMotionValueEvent(progress, 'change', (v) => {
    const cur = Math.max(1, Math.min(N_ULAM, Math.floor(v * N_ULAM) + 1))
    setN(cur)
    let c = 0
    for (let i = 2; i <= cur; i++) if (isPrime(i)) c++
    setPrimeCount(c)
  })
  return (
    <div className="ulam-stats">
      <div className="ulam-stat">
        <div className="ulam-stat-num">{n}</div>
        <div className="ulam-stat-lbl">números</div>
      </div>
      <div className="ulam-stat highlight">
        <div className="ulam-stat-num">{primeCount}</div>
        <div className="ulam-stat-lbl">primos</div>
      </div>
      <div className="ulam-stat">
        <div className="ulam-stat-num">{n > 0 ? ((primeCount / n) * 100).toFixed(1) : '0'}%</div>
        <div className="ulam-stat-lbl">densidade</div>
      </div>
    </div>
  )
}

export default function Ulam() {
  const ref = useRef(null)
  const data = useMemo(() => {
    const positions = ulamPositions(N_ULAM)
    let minX = 0, minY = 0, maxX = 0, maxY = 0
    positions.forEach(p => {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    })
    return { positions, minX, minY, maxX, maxY }
  }, [])

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  const { positions, minX, minY, maxX, maxY } = data
  const pad = 1.2
  const w = maxX - minX + 1 + 2 * pad
  const h = maxY - minY + 1 + 2 * pad
  const viewBox = `${minX - pad - 0.5} ${-(maxY + pad) - 0.5} ${w} ${h}`

  const rotate = useTransform(scrollYProgress, [0, 1], [-3, 4])

  return (
    <section id="ulam" ref={ref} className="ulam-section">
      <div className="ulam-sticky">
        <div className="container ulam-grid">
          <div className="ulam-text">
            <span className="kicker">// espiral de ulam</span>
            <h2 className="h2">O padrão <em>escondido</em><br/>nos primos.</h2>
            <p className="section-sub">
              Em 1963, Stanisław Ulam estava entediado numa reunião. Rabiscou um espiral
              de números inteiros, e marcou os primos. O resultado: <strong>diagonais inesperadas</strong>,
              um padrão que até hoje a matemática não explicou por completo.
            </p>
            <UlamStats progress={scrollYProgress} />
            <p className="ulam-hint">role pra preencher a espiral ↓</p>
          </div>
          <div className="ulam-viz">
            <motion.svg viewBox={viewBox} style={{ rotate }}>
              <defs>
                <radialGradient id="ulam-grad">
                  <stop offset="0%"   stopColor="#FFDB4D" />
                  <stop offset="80%"  stopColor="#F5B800" />
                  <stop offset="100%" stopColor="#C99300" />
                </radialGradient>
              </defs>
              {positions.map((p, i) => (
                <UlamDot key={i} n={i + 1} p={p} progress={scrollYProgress} />
              ))}
            </motion.svg>
          </div>
        </div>
      </div>
    </section>
  )
}
