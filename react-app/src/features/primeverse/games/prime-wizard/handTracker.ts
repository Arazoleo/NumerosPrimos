import type { HandLandmarker } from '@mediapipe/tasks-vision'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import { readHandPose, type HandPose } from './handGesture'

/** Modelo oficial do MediaPipe (float16, ~7,5 MB), servido pelo CDN do Google com CORS. */
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export type TrackerFailure = 'denied' | 'unsupported' | 'model'

export class TrackerError extends Error {
  constructor(readonly reason: TrackerFailure, message: string) {
    super(message)
  }
}

export interface TrackedFrame {
  readonly pose: HandPose | null
  readonly timestamp: number
}

/**
 * Câmera + HandLandmarker. Um único laço de `requestVideoFrameCallback` (ou
 * rAF como reserva) entrega a pose a cada quadro novo do vídeo.
 */
export class HandTracker {
  private landmarker: HandLandmarker | null = null
  private stream: MediaStream | null = null
  private running = false
  private frameHandle = 0
  private lastVideoTime = -1

  constructor(private readonly video: HTMLVideoElement) {}

  async start(onFrame: (frame: TrackedFrame) => void): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new TrackerError('unsupported', 'Este navegador não libera a câmera para páginas web.')
    }

    const [stream, landmarker] = await Promise.all([
      navigator.mediaDevices
        .getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } })
        .catch((error: unknown) => {
          const name = error instanceof DOMException ? error.name : ''
          throw new TrackerError(
            name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported',
            name === 'NotAllowedError' ? 'A permissão da câmera foi negada.' : 'Não foi possível abrir a câmera.',
          )
        }),
      createLandmarker(),
    ]).catch((error: unknown) => {
      this.stop()
      throw error
    })

    this.stream = stream
    this.landmarker = landmarker
    this.video.srcObject = stream
    this.video.muted = true
    this.video.playsInline = true
    await this.video.play()
    this.running = true
    this.loop(onFrame)
  }

  private loop(onFrame: (frame: TrackedFrame) => void) {
    const step = () => {
      if (!this.running || !this.landmarker) return
      const video = this.video
      if (video.readyState >= 2 && video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = video.currentTime
        const timestamp = performance.now()
        const result = this.landmarker.detectForVideo(video, timestamp)
        const landmarks = result.landmarks[0]
        const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3
        onFrame({ pose: landmarks ? readHandPose(landmarks, aspect) : null, timestamp })
      }
      this.schedule(step)
    }
    this.schedule(step)
  }

  private schedule(step: () => void) {
    const video = this.video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number
    }
    this.frameHandle = video.requestVideoFrameCallback
      ? video.requestVideoFrameCallback(step)
      : window.requestAnimationFrame(step)
  }

  stop() {
    this.running = false
    const video = this.video as HTMLVideoElement & { cancelVideoFrameCallback?: (handle: number) => void }
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(this.frameHandle)
    window.cancelAnimationFrame(this.frameHandle)
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.video.srcObject = null
    this.landmarker?.close()
    this.landmarker = null
  }
}

async function createLandmarker(): Promise<HandLandmarker> {
  const { HandLandmarker } = await import('@mediapipe/tasks-vision')
  const fileset = { wasmLoaderPath, wasmBinaryPath }
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO' as const,
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.5,
  })
  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'))
  } catch {
    try {
      return await HandLandmarker.createFromOptions(fileset, options('CPU'))
    } catch {
      throw new TrackerError('model', 'Não foi possível carregar o modelo de visão computacional.')
    }
  }
}
