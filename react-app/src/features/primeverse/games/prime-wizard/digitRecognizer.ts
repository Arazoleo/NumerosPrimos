/**
 * Reconhecedor de dígitos desenhados à mão, baseado no $P Point-Cloud Recognizer
 * (Vatavu, Anthony & Wobbrock, 2012).
 *
 * O $P compara nuvens de pontos e ignora ordem e direção dos traços, o que é
 * exatamente o que precisamos para um dedo rastreado no ar: os traços chegam
 * tremidos, às vezes quebrados em vários pedaços, e cada pessoa escreve o "4"
 * de um jeito. Os modelos abaixo são desenhados à mão em uma caixa de 100×100
 * (y cresce para baixo) e cobrem as variações mais comuns de cada algarismo.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

export type Stroke = readonly Point[]

interface CloudPoint extends Point {
  readonly id: number
}

interface Template {
  readonly digit: number
  readonly cloud: PackedCloud
  readonly grid: Float64Array
}

export interface Recognition {
  readonly digit: number
  /** Distância $P ao melhor modelo; menor é melhor. */
  readonly distance: number
  /** Confiança aproximada em [0, 1]. */
  readonly confidence: number
}

const SAMPLE_SIZE = 32
const GRID = 7
const GRID_WEIGHT = 1.4
/** Acima disso o desenho não se parece com nenhum algarismo. */
const REJECT_SCORE = 2.6

/* ------------------------------------------------------------------ geometria */

function line(from: Point, ...to: Point[]): Point[] {
  const points: Point[] = []
  let previous = from
  for (const next of to) {
    for (let step = 0; step < 8; step += 1) {
      const t = step / 8
      points.push({ x: previous.x + (next.x - previous.x) * t, y: previous.y + (next.y - previous.y) * t })
    }
    previous = next
  }
  points.push(previous)
  return points
}

/** Arco elíptico. Ângulos em graus, 0 = direita, 90 = baixo (y para baixo). */
function arc(cx: number, cy: number, rx: number, ry: number, startDeg: number, endDeg: number): Point[] {
  const steps = Math.max(8, Math.round(Math.abs(endDeg - startDeg) / 12))
  const points: Point[] = []
  for (let step = 0; step <= steps; step += 1) {
    const angle = ((startDeg + (endDeg - startDeg) * (step / steps)) * Math.PI) / 180
    points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
  }
  return points
}

const p = (x: number, y: number): Point => ({ x, y })

function joined(...parts: Point[][]): Point[] {
  return parts.flat()
}

/* --------------------------------------------------------------------- modelos */

const RAW_TEMPLATES: ReadonlyArray<readonly [number, readonly Stroke[]]> = [
  [0, [arc(50, 50, 30, 48, -90, 270)]],
  [0, [arc(50, 50, 22, 48, -100, 265)]],
  [0, [arc(50, 50, 36, 46, -80, 275)]],

  [1, [line(p(50, 0), p(50, 100))]],
  [1, [line(p(30, 22), p(52, 0), p(52, 100))]],

  [2, [joined(arc(50, 28, 26, 26, 180, 400), line(p(70, 45), p(24, 100), p(80, 100)))]],
  [2, [joined(arc(48, 26, 24, 24, 200, 380), line(p(72, 26), p(26, 100), p(78, 100)))]],
  [2, [joined(arc(50, 30, 28, 30, 170, 410), line(p(71, 50), p(22, 98)), arc(40, 92, 10, 8, 180, 360), line(p(50, 92), p(82, 100)))]],

  [3, [joined(arc(48, 26, 25, 24, 200, 450), arc(48, 74, 28, 26, 270, 520))]],
  [3, [joined(line(p(24, 0), p(74, 0), p(44, 40)), arc(48, 70, 28, 29, 260, 515))]],
  [3, [joined(arc(46, 25, 26, 25, 190, 440), arc(46, 75, 30, 25, 280, 530))]],

  [4, [line(p(62, 0), p(18, 66), p(82, 66)), line(p(64, 28), p(64, 100))]],
  [4, [line(p(28, 0), p(24, 58), p(80, 58)), line(p(68, 0), p(68, 100))]],
  [4, [line(p(64, 100), p(64, 0), p(16, 68), p(84, 68))]],
  [4, [line(p(30, 0), p(26, 56), p(78, 56)), line(p(66, 18), p(66, 100))]],

  [5, [joined(line(p(74, 0), p(30, 0), p(27, 44)), arc(48, 70, 27, 28, 235, 515))]],
  [5, [joined(line(p(30, 0), p(27, 44)), arc(48, 70, 27, 28, 235, 515)), line(p(30, 0), p(76, 0))]],
  [5, [joined(line(p(70, 2), p(32, 2), p(30, 40)), arc(46, 68, 28, 31, 230, 505))]],

  [6, [joined(line(p(70, 4), p(48, 12), p(34, 32), p(28, 58)), arc(50, 76, 22, 23, 180, -180))]],
  [6, [joined(arc(66, 54, 40, 54, 260, 180), arc(52, 76, 24, 22, 180, -180))]],
  [6, [joined(line(p(62, 0), p(30, 52)), arc(48, 74, 22, 25, 205, -155))]],

  [7, [line(p(22, 0), p(78, 0), p(40, 100))]],
  [7, [line(p(22, 0), p(78, 0), p(40, 100)), line(p(36, 52), p(72, 52))]],
  [7, [line(p(20, 12), p(24, 0), p(80, 0), p(48, 100))]],

  [8, [joined(arc(50, 25, 21, 24, 90, 450), arc(50, 73, 26, 26, 270, 630))]],
  [8, [joined(arc(50, 26, 18, 25, 90, 450), arc(50, 74, 22, 25, 270, 630))]],
  [8, [joined(arc(50, 25, 22, 23, 20, -250), line(p(43, 47), p(28, 70)), arc(50, 75, 22, 24, 160, -160), line(p(30, 66), p(68, 32)))]],

  [9, [joined(arc(48, 28, 24, 26, 0, 360), line(p(72, 28), p(68, 100)))]],
  [9, [joined(arc(48, 28, 24, 26, 0, 360), line(p(72, 30), p(70, 70)), arc(52, 74, 18, 24, 0, 120))]],
  [9, [joined(arc(46, 27, 22, 25, -20, 340), line(p(67, 18), p(52, 100)))]],
]

/* ---------------------------------------------------------------- normalização */

function pathLength(points: readonly CloudPoint[]): number {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].id === points[index - 1].id) length += distance(points[index - 1], points[index])
  }
  return length
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function resample(input: readonly CloudPoint[], size: number): CloudPoint[] {
  const points = input.slice()
  const interval = pathLength(points) / (size - 1)
  if (!Number.isFinite(interval) || interval === 0) {
    return Array.from({ length: size }, () => ({ ...points[0] }))
  }
  let accumulated = 0
  const result: CloudPoint[] = [{ ...points[0] }]
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (current.id !== previous.id) continue
    const segment = distance(previous, current)
    if (accumulated + segment >= interval) {
      const t = (interval - accumulated) / segment
      const inserted = {
        x: previous.x + t * (current.x - previous.x),
        y: previous.y + t * (current.y - previous.y),
        id: current.id,
      }
      result.push(inserted)
      points.splice(index, 0, inserted)
      accumulated = 0
    } else {
      accumulated += segment
    }
  }
  while (result.length < size) result.push({ ...points[points.length - 1] })
  return result.slice(0, size)
}

function normalize(strokes: readonly Stroke[]): CloudPoint[] {
  const points: CloudPoint[] = []
  strokes.forEach((stroke, id) => {
    for (const point of stroke) points.push({ x: point.x, y: point.y, id })
  })
  const sampled = resample(points, SAMPLE_SIZE)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of sampled) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  const scale = Math.max(maxX - minX, maxY - minY) || 1
  const scaled = sampled.map((point) => ({ x: (point.x - minX) / scale, y: (point.y - minY) / scale, id: point.id }))

  const centroid = scaled.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 })
  centroid.x /= scaled.length
  centroid.y /= scaled.length
  return scaled.map((point) => ({ x: point.x - centroid.x, y: point.y - centroid.y, id: point.id }))
}

/* -------------------------------------------------------------- casamento $P */

interface PackedCloud {
  readonly xs: Float64Array
  readonly ys: Float64Array
}

function pack(cloud: readonly CloudPoint[]): PackedCloud {
  return { xs: Float64Array.from(cloud, (point) => point.x), ys: Float64Array.from(cloud, (point) => point.y) }
}

const matchedScratch = new Uint8Array(SAMPLE_SIZE)

function cloudDistance(points: PackedCloud, template: PackedCloud, start: number): number {
  const count = SAMPLE_SIZE
  const matched = matchedScratch
  matched.fill(0)
  let sum = 0
  let index = start
  do {
    const px = points.xs[index]
    const py = points.ys[index]
    let best = Infinity
    let bestIndex = 0
    for (let candidate = 0; candidate < count; candidate += 1) {
      if (matched[candidate]) continue
      const dx = px - template.xs[candidate]
      const dy = py - template.ys[candidate]
      const d = dx * dx + dy * dy
      if (d < best) {
        best = d
        bestIndex = candidate
      }
    }
    matched[bestIndex] = 1
    const weight = 1 - ((index - start + count) % count) / count
    sum += weight * Math.sqrt(best)
    index = (index + 1) % count
  } while (index !== start)
  return sum
}

function greedyCloudMatch(points: PackedCloud, template: PackedCloud): number {
  const step = Math.floor(Math.sqrt(SAMPLE_SIZE))
  let best = Infinity
  for (let start = 0; start < SAMPLE_SIZE; start += step) {
    best = Math.min(best, cloudDistance(points, template, start), cloudDistance(template, points, start))
  }
  return best
}

/**
 * Mapa de ocupação 7×7 suavizado. Complementa o $P, que olha só a nuvem de
 * pontos: o mapa diz *onde* fica a massa do desenho (a barra do 5 à esquerda,
 * a barriga de cima do 3 à direita) e desempata os pares que mais se confundem.
 */
function occupancy(cloud: readonly CloudPoint[]): Float64Array {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of cloud) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1
  const offsetX = (size - (maxX - minX)) / 2
  const offsetY = (size - (maxY - minY)) / 2
  const grid = new Float64Array(GRID * GRID)
  for (const point of cloud) {
    const gx = ((point.x - minX + offsetX) / size) * (GRID - 1)
    const gy = ((point.y - minY + offsetY) / size) * (GRID - 1)
    for (let row = 0; row < GRID; row += 1) {
      for (let column = 0; column < GRID; column += 1) {
        const d2 = (column - gx) ** 2 + (row - gy) ** 2
        grid[row * GRID + column] += Math.exp(-d2 / 0.9)
      }
    }
  }
  let norm = 0
  for (const value of grid) norm += value * value
  norm = Math.sqrt(norm) || 1
  for (let index = 0; index < grid.length; index += 1) grid[index] /= norm
  return grid
}

function features(cloud: readonly CloudPoint[]) {
  return { cloud: pack(cloud), grid: occupancy(cloud) }
}

function gridDistance(a: Float64Array, b: Float64Array): number {
  let dot = 0
  for (let index = 0; index < a.length; index += 1) dot += a[index] * b[index]
  return 1 - dot
}

const TEMPLATES: readonly Template[] = RAW_TEMPLATES.map(([digit, strokes]) => ({ digit, ...features(normalize(strokes)) }))

/* --------------------------------------------------------------------- API */

export function strokeBounds(strokes: readonly Stroke[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let count = 0
  for (const stroke of strokes) {
    for (const point of stroke) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
      count += 1
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, count }
}

/**
 * Reconhece um único algarismo. Devolve `null` quando o desenho é pequeno demais
 * ou não se parece com nenhum dígito — nesse caso o jogo pede para redesenhar.
 */
export function recognizeDigit(strokes: readonly Stroke[], minimumSize = 12): Recognition | null {
  const usable = strokes.filter((stroke) => stroke.length > 0)
  const bounds = strokeBounds(usable)
  if (bounds.count < 4) return null
  const size = Math.max(bounds.width, bounds.height)
  if (size < minimumSize) return null

  // Um traço alto e fino é um "1", seja qual for o tremor: o $P sozinho às vezes
  // confunde uma linha vertical torta com um 7 estreito.
  if (bounds.width < bounds.height * 0.24) return { digit: 1, distance: 0, confidence: 1 }
  // Um traço longo e deitado não é algarismo nenhum.
  if (bounds.height < bounds.width * 0.22) return null

  const input = features(normalize(usable))
  const bestByDigit = new Map<number, number>()
  for (const template of TEMPLATES) {
    const score = greedyCloudMatch(input.cloud, template.cloud) + GRID_WEIGHT * gridDistance(input.grid, template.grid) * 4
    bestByDigit.set(template.digit, Math.min(bestByDigit.get(template.digit) ?? Infinity, score))
  }
  const ranked = [...bestByDigit.entries()].sort((a, b) => a[1] - b[1])
  const [digit, score] = ranked[0]
  if (score > REJECT_SCORE) return null
  const runnerUp = ranked[1]?.[1] ?? score * 2
  const margin = (runnerUp - score) / runnerUp
  const confidence = Math.max(0, Math.min(1, (1 - score / REJECT_SCORE) * 0.6 + margin * 0.8))
  return { digit, distance: score, confidence }
}

/** Expõe os modelos para testes e para o tutorial animado. */
export function digitTemplates(): ReadonlyArray<readonly [number, readonly Stroke[]]> {
  return RAW_TEMPLATES
}
