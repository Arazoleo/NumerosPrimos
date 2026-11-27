import { memo, useMemo, type ReactNode } from 'react'
import { isPrime } from '../../../lib/math'

/**
 * Capa generativa de cada jogo, desenhada com a própria matemática dele:
 * a espiral de Ulam para a Ulam Galaxy, a cardioide da tabuada modular para a
 * Modular Orbit, a árvore de fatores para a Factor Forge… Tudo em SVG, leve e
 * nítido em qualquer densidade de tela.
 */

const W = 400
const H = 300

type Draw = (accent: string) => ReactNode

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

const ulam: Draw = (accent) => {
  const dots: ReactNode[] = []
  let x = 0
  let y = 0
  let dx = 1
  let dy = 0
  let segment = 1
  let walked = 0
  let turns = 0
  for (let n = 1; n <= 1600; n += 1) {
    if (isPrime(n)) dots.push(<rect key={n} x={W / 2 + x * 6 - 2} y={H / 2 + y * 6 - 2} width={4} height={4} fill={accent} opacity={0.4 + 0.6 * Math.max(0, 1 - Math.hypot(x, y) / 28)} />)
    x += dx
    y += dy
    walked += 1
    if (walked === segment) {
      walked = 0
      ;[dx, dy] = [-dy, dx]
      turns += 1
      if (turns % 2 === 0) segment += 1
    }
  }
  return <g className="art-spin">{dots}</g>
}

const orbit: Draw = (accent) => {
  const n = 96
  const r = 120
  const point = (i: number) => [W / 2 + r * Math.cos((i / n) * Math.PI * 2 - Math.PI / 2), H / 2 + r * Math.sin((i / n) * Math.PI * 2 - Math.PI / 2)]
  return (
    <g className="art-spin">
      <circle cx={W / 2} cy={H / 2} r={r} fill="none" stroke={accent} strokeOpacity={0.35} />
      {range(n).map((i) => {
        const [x1, y1] = point(i)
        const [x2, y2] = point((i * 2) % n)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeOpacity={0.5} strokeWidth={0.8} />
      })}
    </g>
  )
}

const factorTree: Draw = (accent) => {
  const nodes: ReactNode[] = []
  const grow = (value: number, x: number, y: number, spread: number, depth: number) => {
    let divisor = 2
    while (divisor * divisor <= value && value % divisor !== 0) divisor += 1
    const prime = divisor * divisor > value
    nodes.push(<circle key={`c${x}-${y}`} cx={x} cy={y} r={prime ? 9 : 5} fill={prime ? accent : 'none'} stroke={accent} strokeWidth={1.4} />)
    nodes.push(<text key={`t${x}-${y}`} x={x} y={y - 14} textAnchor="middle" fill={accent} fillOpacity={0.75} fontSize={13} fontFamily="JetBrains Mono, monospace">{value}</text>)
    if (prime || depth > 4) return
    const left = divisor
    const right = value / divisor
    const childY = y + 44
    nodes.push(<line key={`l${x}-${y}`} x1={x} y1={y} x2={x - spread} y2={childY} stroke={accent} strokeOpacity={0.45} />)
    nodes.push(<line key={`r${x}-${y}`} x1={x} y1={y} x2={x + spread} y2={childY} stroke={accent} strokeOpacity={0.45} />)
    grow(left, x - spread, childY, spread * 0.55, depth + 1)
    grow(right, x + spread, childY, spread * 0.55, depth + 1)
  }
  grow(360, W / 2, 40, 96, 0)
  return <g>{nodes}</g>
}

const hunter: Draw = (accent) => (
  <g>
    {range(84).map((i) => {
      const n = i + 1
      const x = 32 + (i % 12) * 30
      const y = 46 + Math.floor(i / 12) * 32
      return isPrime(n)
        ? <circle key={n} cx={x} cy={y} r={7} fill={accent} />
        : <circle key={n} cx={x} cy={y} r={2} fill="#fff" fillOpacity={0.25} />
    })}
    <g className="art-pulse" stroke={accent} strokeWidth={1.5} fill="none">
      <circle cx={242} cy={142} r={26} />
      <line x1={242} y1={102} x2={242} y2={124} />
      <line x1={242} y1={160} x2={242} y2={182} />
      <line x1={202} y1={142} x2={224} y2={142} />
      <line x1={260} y1={142} x2={282} y2={142} />
    </g>
  </g>
)

const network: Draw = (accent) => {
  const rings = [44, 86, 128]
  const nodes = rings.flatMap((r, ring) => range([5, 7, 11][ring]).map((i) => {
    const angle = (i / [5, 7, 11][ring]) * Math.PI * 2 + ring
    return [W / 2 + r * Math.cos(angle), H / 2 + r * Math.sin(angle) * 0.82] as const
  }))
  return (
    <g className="art-spin">
      {rings.map((r) => <ellipse key={r} cx={W / 2} cy={H / 2} rx={r} ry={r * 0.82} fill="none" stroke={accent} strokeOpacity={0.22} />)}
      {nodes.map(([x, y], i) => <line key={`l${i}`} x1={W / 2} y1={H / 2} x2={x} y2={y} stroke={accent} strokeOpacity={0.14} />)}
      {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 5 : 3} fill={accent} />)}
      <circle cx={W / 2} cy={H / 2} r={14} fill={accent} />
    </g>
  )
}

const wizard: Draw = (accent) => (
  <g>
    <g className="art-spin" fill="none" stroke={accent} strokeOpacity={0.4}>
      <polygon points={range(7).map((i) => `${W / 2 + 118 * Math.cos((i / 7) * Math.PI * 2)},${H / 2 + 118 * Math.sin((i / 7) * Math.PI * 2)}`).join(' ')} />
      <polygon points={range(7).map((i) => `${W / 2 + 118 * Math.cos(((i * 3) / 7) * Math.PI * 2)},${H / 2 + 118 * Math.sin(((i * 3) / 7) * Math.PI * 2)}`).join(' ')} strokeOpacity={0.2} />
      <circle cx={W / 2} cy={H / 2} r={132} />
    </g>
    <path className="art-draw" d="M150 92 L250 92 L184 222" fill="none" stroke={accent} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 12px ${accent})` }} />
    <path d="M150 92 L250 92 L184 222" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </g>
)

const defense: Draw = (accent) => (
  <g>
    {range(4).map((lane) => <line key={lane} x1={0} y1={70 + lane * 54} x2={W} y2={70 + lane * 54} stroke={accent} strokeOpacity={0.18} />)}
    {[[60, 1, 4], [130, 0, 6], [190, 2, 9], [250, 1, 7], [300, 3, 12], [340, 0, 5]].map(([x, lane, n]) => (
      <g key={`${x}`} transform={`translate(${x} ${97 + lane * 54})`}>
        {isPrime(n)
          ? <circle r={13} fill={accent} />
          : <rect x={-13} y={-13} width={26} height={26} fill="none" stroke="#fff" strokeOpacity={0.55} />}
        <text y={5} textAnchor="middle" fontSize={13} fontFamily="JetBrains Mono, monospace" fill={isPrime(n) ? '#08070c' : '#fff'}>{n}</text>
      </g>
    ))}
    <rect x={14} y={40} width={4} height={220} fill={accent} />
  </g>
)

const vault: Draw = (accent) => (
  <g>
    <g className="art-spin">
      {range(60).map((i) => {
        const angle = (i / 60) * Math.PI * 2
        const inner = i % 5 === 0 ? 96 : 106
        return <line key={i} x1={W / 2 + inner * Math.cos(angle)} y1={H / 2 + inner * Math.sin(angle)} x2={W / 2 + 116 * Math.cos(angle)} y2={H / 2 + 116 * Math.sin(angle)} stroke={accent} strokeOpacity={i % 5 === 0 ? 0.9 : 0.4} />
      })}
    </g>
    <circle cx={W / 2} cy={H / 2} r={78} fill="none" stroke={accent} strokeOpacity={0.4} />
    <circle cx={W / 2} cy={H / 2 - 14} r={16} fill={accent} />
    <path d={`M${W / 2 - 9} ${H / 2 - 4} L${W / 2 + 9} ${H / 2 - 4} L${W / 2 + 14} ${H / 2 + 36} L${W / 2 - 14} ${H / 2 + 36} Z`} fill={accent} />
  </g>
)

const relay: Draw = (accent) => (
  <g style={{ mixBlendMode: 'screen' }}>
    <circle className="art-drift-left" cx={160} cy={150} r={86} fill={accent} fillOpacity={0.35} />
    <circle className="art-drift-right" cx={240} cy={150} r={86} fill="#ffcc1a" fillOpacity={0.3} />
    {range(9).map((i) => <line key={i} x1={74} y1={110 + i * 10} x2={326} y2={110 + i * 10} stroke="#fff" strokeOpacity={0.08} />)}
    <circle cx={160} cy={150} r={6} fill="#fff" />
    <circle cx={240} cy={150} r={6} fill="#fff" />
  </g>
)

const corridor: Draw = (accent) => (
  <g fill="none" stroke={accent}>
    {range(7).map((i) => {
      const s = 1 - i * 0.13
      const w = W * 0.86 * s
      const h = H * 0.82 * s
      return <rect key={i} x={(W - w) / 2} y={(H - h) / 2} width={w} height={h} strokeOpacity={0.12 + i * 0.1} />
    })}
    {[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => <line key={`${x}${y}`} x1={x} y1={y} x2={W / 2} y2={H / 2} strokeOpacity={0.15} />)}
    <rect className="art-pulse" x={W / 2 - 9} y={H / 2 - 18} width={18} height={30} fill={accent} fillOpacity={0.8} stroke="none" />
  </g>
)

const pixelRunes: Draw = (accent) => {
  const glyphs: Record<number, string[]> = {
    2: ['111', '001', '111', '100', '111'],
    3: ['111', '001', '111', '001', '111'],
    5: ['111', '100', '111', '001', '111'],
    7: ['111', '001', '010', '010', '010'],
  }
  return (
    <g>
      {[2, 3, 5, 7].map((digit, index) => glyphs[digit].flatMap((row, y) => row.split('').map((cell, x) => cell === '1'
        ? <rect key={`${digit}-${x}-${y}`} x={58 + index * 78 + x * 16} y={86 + y * 16} width={14} height={14} fill={accent} fillOpacity={index % 2 ? 0.75 : 1} />
        : null)))}
      <rect x={40} y={196} width={320} height={4} fill={accent} fillOpacity={0.3} />
    </g>
  )
}

const skyline: Draw = (accent) => {
  const primes = range(60).filter(isPrime)
  return (
    <g>
      {primes.map((p, i) => {
        const h = 40 + p * 3.2
        return <rect key={p} x={18 + i * 22} y={H - h} width={18} height={h} fill={accent} fillOpacity={0.18 + (i % 3) * 0.18} />
      })}
      <path className="art-draw" d="M20 210 C120 120 210 230 380 60" fill="none" stroke="#fff" strokeOpacity={0.8} strokeWidth={2} strokeDasharray="6 6" />
    </g>
  )
}

const nucleus: Draw = (accent) => (
  <g>
    <g className="art-spin" fill="none" stroke={accent}>
      {[50, 86, 122].map((r, i) => (
        <polygon key={r} strokeOpacity={0.6 - i * 0.15} points={range(6).map((k) => `${W / 2 + r * Math.cos((k / 6) * Math.PI * 2 + i * 0.3)},${H / 2 + r * Math.sin((k / 6) * Math.PI * 2 + i * 0.3)}`).join(' ')} />
      ))}
    </g>
    <text x={W / 2} y={H / 2 + 12} textAnchor="middle" fontSize={34} fontWeight={600} fontFamily="JetBrains Mono, monospace" fill={accent}>257</text>
  </g>
)

const fallback = (glyph: string): Draw => (accent) => (
  <text x={W / 2} y={H / 2 + 30} textAnchor="middle" fontSize={96} fill={accent}>{glyph}</text>
)

const ART: Record<string, Draw> = {
  'primeverse-online': network,
  'prime-wizard': wizard,
  'prime-hunter': hunter,
  'factor-forge': factorTree,
  'modular-orbit': orbit,
  'prime-defense': defense,
  'rsa-vault': vault,
  'diffie-hellman': relay,
  'ulam-galaxy': ulam,
  'crypto-escape': corridor,
  primebound: pixelRunes,
  'skyline-runner': skyline,
  'nucleus-257': nucleus,
}

function GameArt({ id, accent, glyph }: { id: string; accent: string; glyph: string }) {
  const art = useMemo(() => (ART[id] ?? fallback(glyph))(accent), [accent, glyph, id])
  return (
    <svg className="pv-art" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`glow-${id}`} cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor={accent} stopOpacity={0.16} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#glow-${id})`} />
      {art}
    </svg>
  )
}

export default memo(GameArt)
