import { useMemo, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import './FibSpiral.css'

const N_SQUARES = 10

function buildFibSpiral(n) {
  const fib = [1]
  let a = 1, b = 1
  for (let i = 1; i < n; i++) { fib.push(b); [a, b] = [b, a + b] }

  const sqs = [{ x: 0, y: 0, s: fib[0] }]
  if (n > 1) sqs.push({ x: fib[0], y: 0, s: fib[1] })

  let minX = 0, minY = 0
  let maxX = fib[0] + (n > 1 ? fib[1] : 0)
  let maxY = fib[0]

  for (let i = 2; i < n; i++) {
    const s = fib[i]
    const dir = (i - 2) % 4
    let sq
    if (dir === 0)      { sq = { x: minX, y: maxY, s };           maxY += s }
    else if (dir === 1) { sq = { x: minX - s, y: minY, s };       minX -= s }
    else if (dir === 2) { sq = { x: maxX - s, y: minY - s, s };   minY -= s }
    else                { sq = { x: maxX, y: maxY - s, s };       maxX += s }
    sqs.push(sq)
  }

  const cornerOf = (sq, which) => {
    const { x, y, s } = sq
    return which === 'BL' ? [x, y]
         : which === 'BR' ? [x + s, y]
         : which === 'TL' ? [x, y + s]
                          : [x + s, y + s]
  }
  const cornerMap = {
    init0: { start: 'TL', end: 'BR' },
    init1: { start: 'BL', end: 'TR' },
    0: { start: 'BR', end: 'TL' },
    1: { start: 'TR', end: 'BL' },
    2: { start: 'TL', end: 'BR' },
    3: { start: 'BL', end: 'TR' },
  }

  let pathStr = ''
  sqs.forEach((sq, i) => {
    const key = i === 0 ? 'init0' : i === 1 ? 'init1' : (i - 2) % 4
    const { start, end } = cornerMap[key]
    const [sx, sy] = cornerOf(sq, start)
    const [ex, ey] = cornerOf(sq, end)
    if (i === 0) pathStr += `M ${sx} ${-sy} `
    pathStr += `A ${sq.s} ${sq.s} 0 0 1 ${ex} ${-ey} `
  })

  const pad = 4
  const viewBox = `${minX - pad} ${-(maxY + pad)} ${(maxX - minX) + 2 * pad} ${(maxY - minY) + 2 * pad}`

  return { path: pathStr, squares: sqs, fib, bbox: { minX, minY, maxX, maxY }, viewBox }
}

function Square({ sq, index, totalN, progress }) {
  const threshold = index / totalN
  const opacity = useTransform(progress, [threshold - 0.02, threshold + 0.06], [0, 0.55])
  const scale  = useTransform(progress, [threshold - 0.02, threshold + 0.06], [0.6, 1])
  const cx = sq.x + sq.s / 2
  const cy = -(sq.y + sq.s / 2)
  return (
    <motion.rect
      x={sq.x} y={-(sq.y + sq.s)} width={sq.s} height={sq.s}
      rx={0.2}
      fill="none" stroke="rgba(14,14,16,0.30)" strokeWidth="0.15"
      style={{ opacity, scale, transformOrigin: `${cx}px ${cy}px` }}
    />
  )
}

function SquareNumber({ sq, value, index, totalN, progress }) {
  const threshold = index / totalN + 0.03
  const opacity = useTransform(progress, [threshold - 0.03, threshold + 0.04], [0, 1])
  const scale   = useTransform(progress, [threshold - 0.03, threshold + 0.04], [0.3, 1])
  const cx = sq.x + sq.s / 2
  const cy = -(sq.y + sq.s / 2)
  const fontSize = Math.max(0.6, sq.s * 0.42)
  return (
    <motion.text
      x={cx} y={cy}
      textAnchor="middle"
      dominantBaseline="central"
      fill="var(--ink)"
      fontFamily="'Space Grotesk', sans-serif"
      fontWeight="700"
      fontSize={fontSize}
      style={{ opacity, scale, transformOrigin: `${cx}px ${cy}px` }}
    >{value}</motion.text>
  )
}

function FibPill({ value, index, totalN, progress }) {
  const threshold = index / totalN
  const opacity = useTransform(progress, [threshold - 0.05, threshold + 0.03], [0.15, 1])
  const scale   = useTransform(progress, [threshold - 0.05, threshold + 0.03], [0.85, 1])
  const bg      = useTransform(progress, [threshold - 0.05, threshold + 0.03],
                               ['rgba(255,255,255,1)', 'rgba(255,219,77,1)'])
  return (
    <motion.span className="fib-pill" style={{ opacity, scale, background: bg }}>
      {value}
    </motion.span>
  )
}

export default function FibSpiral() {
  const ref = useRef(null)
  const data = useMemo(() => buildFibSpiral(N_SQUARES), [])
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  })

  const pathLength    = useTransform(scrollYProgress, [0.05, 0.85], [0, 1])
  const rotate        = useTransform(scrollYProgress, [0, 1], [-4, 6])
  const textOpacity   = useTransform(scrollYProgress, [0, 0.08, 0.92, 1], [0, 1, 1, 0.6])
  const textY         = useTransform(scrollYProgress, [0, 0.08], [40, 0])

  return (
    <section ref={ref} className="fib-section">
      <div className="fib-sticky">
        <div className="container fib-grid">
          <motion.div className="fib-text" style={{ opacity: textOpacity, y: textY }}>
            <span className="kicker">// proporção áurea</span>
            <h2 className="h2">Os primos, a <em>natureza</em><br/>e a espiral perfeita.</h2>
            <p className="section-sub">
              A sequência de <strong>Fibonacci</strong> aparece em flores, conchas, galáxias.
              Cada termo é a soma dos dois anteriores, e quando você desenha quadrados desses
              tamanhos, eles se enrolam numa espiral que a natureza também desenha sozinha.
            </p>

            <div className="fib-list">
              {data.fib.map((f, i) => (
                <FibPill key={i} value={f} index={i} totalN={data.squares.length} progress={scrollYProgress} />
              ))}
              <span className="fib-pill ellipsis">…</span>
            </div>

            <p className="fib-hint">role pra ver a espiral se formar ↓</p>
          </motion.div>

          <div className="fib-viz">
            <motion.svg viewBox={data.viewBox} style={{ rotate }} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="fib-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#C99300" />
                  <stop offset="60%"  stopColor="#F5B800" />
                  <stop offset="100%" stopColor="#FFDB4D" />
                </linearGradient>
                <filter id="fib-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="0.4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {data.squares.map((sq, i) => (
                <Square key={`sq-${i}`} sq={sq} index={i} totalN={data.squares.length} progress={scrollYProgress} />
              ))}

              <motion.path
                d={data.path}
                fill="none"
                stroke="url(#fib-grad)"
                strokeWidth="0.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#fib-glow)"
                style={{ pathLength }}
              />

              {data.squares.map((sq, i) => (
                <SquareNumber key={`n-${i}`} sq={sq} value={data.fib[i]} index={i} totalN={data.squares.length} progress={scrollYProgress} />
              ))}
            </motion.svg>
          </div>
        </div>
      </div>
    </section>
  )
}
