/**
 * Leitura de gestos a partir dos 21 marcos da mão do MediaPipe.
 *
 * Índices: 0 punho · 5–8 indicador (MCP, PIP, DIP, ponta) · 9–12 médio ·
 * 13–16 anelar · 17–20 mínimo. Tudo aqui é puro para poder ser testado sem câmera.
 */

export interface Landmark {
  readonly x: number
  readonly y: number
  readonly z?: number
}

export interface HandPose {
  /** Ponta do indicador, em coordenadas normalizadas do vídeo (0–1). */
  readonly tip: { readonly x: number; readonly y: number }
  /** Só o indicador esticado: a "caneta" encosta no ar. */
  readonly pointing: boolean
  /** Mão aberta, quatro dedos esticados. */
  readonly openPalm: boolean
}

const FINGERS = [
  { pip: 6, tip: 8 },
  { pip: 10, tip: 12 },
  { pip: 14, tip: 16 },
  { pip: 18, tip: 20 },
] as const

function reach(landmarks: readonly Landmark[], aspect: number, from: number, to: number) {
  const a = landmarks[from]
  const b = landmarks[to]
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y)
}

/** Quanto a ponta do dedo está mais longe do punho que a articulação do meio. */
export function fingerExtension(landmarks: readonly Landmark[], finger: 0 | 1 | 2 | 3, aspect = 1): number {
  const { pip, tip } = FINGERS[finger]
  const base = reach(landmarks, aspect, 0, pip)
  return base === 0 ? 0 : reach(landmarks, aspect, 0, tip) / base
}

export function readHandPose(landmarks: readonly Landmark[], aspect = 1): HandPose | null {
  if (landmarks.length < 21) return null
  const [index, middle, ring, pinky] = ([0, 1, 2, 3] as const).map((finger) => fingerExtension(landmarks, finger, aspect))
  const extended = (value: number) => value > 1.12
  const folded = (value: number) => value < 1.02
  return {
    tip: { x: landmarks[8].x, y: landmarks[8].y },
    pointing: extended(index) && folded(middle) && (folded(ring) || folded(pinky)),
    openPalm: extended(index) && extended(middle) && extended(ring) && extended(pinky),
  }
}

/**
 * Histerese para a caneta: precisa de alguns quadros seguidos apontando para
 * começar a escrever e de alguns sem apontar para levantar. Evita traços
 * picotados quando o modelo hesita por um quadro.
 */
export class PenLatch {
  private down = false
  private streak = 0

  constructor(private readonly framesToDown = 2, private readonly framesToUp = 4) {}

  update(pointing: boolean): boolean {
    if (pointing === this.down) {
      this.streak = 0
      return this.down
    }
    this.streak += 1
    if (this.streak >= (pointing ? this.framesToDown : this.framesToUp)) {
      this.down = pointing
      this.streak = 0
    }
    return this.down
  }

  reset() {
    this.down = false
    this.streak = 0
  }
}

/** Filtro One Euro (Casiez et al., 2012): suaviza o tremor sem atrasar movimentos rápidos. */
export class OneEuroFilter {
  private previous: number | null = null
  private previousDerivative = 0
  private previousTime = 0

  constructor(private readonly minCutoff = 1.4, private readonly beta = 0.02, private readonly derivativeCutoff = 1) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff)
    return 1 / (1 + tau / dt)
  }

  filter(value: number, timeMs: number): number {
    if (this.previous === null) {
      this.previous = value
      this.previousTime = timeMs
      return value
    }
    const dt = Math.max(1e-3, (timeMs - this.previousTime) / 1000)
    this.previousTime = timeMs
    const derivative = (value - this.previous) / dt
    const smoothedDerivative = this.previousDerivative + OneEuroFilter.alpha(this.derivativeCutoff, dt) * (derivative - this.previousDerivative)
    this.previousDerivative = smoothedDerivative
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative)
    this.previous = this.previous + OneEuroFilter.alpha(cutoff, dt) * (value - this.previous)
    return this.previous
  }

  reset() {
    this.previous = null
    this.previousDerivative = 0
  }
}
