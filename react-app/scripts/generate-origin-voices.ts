/**
 * Generates the origin-film voice lines and stores them in
 * public/games/primebound/origins/, where HeroOriginFilm picks them up
 * automatically (audio is static — no key or API ever ships to the client).
 *
 * Providers:
 *   edge (default)   Microsoft Edge neural voices, free, no key. Needs the
 *                    Python package: `python3 -m pip install --user edge-tts`.
 *   gemini           Real acting: Gemini TTS follows stage directions in
 *                    Portuguese. Free key at aistudio.google.com/apikey →
 *                    GEMINI_API_KEY. Free-tier daily quota is small; rerun the
 *                    script daily — it resumes, skipping finished lines.
 *                    Outputs .m4a via afconvert (macOS); the game plays both.
 *   elevenlabs       Used automatically when ELEVENLABS_API_KEY is set
 *                    (or force with TTS_PROVIDER=elevenlabs).
 *
 *   npm run voices:origins              # generate missing files
 *   npm run voices:origins -- --until-done   # marathon: waits out the daily
 *                                            # quota and resumes until every
 *                                            # line has an acted take
 *   npm run voices:origins -- --force   # regenerate everything
 *
 * Narration beats become <beatId>.mp3; each hero's signature line becomes
 * quote-<heroClassId>.mp3. Without any files, the films fall back to the
 * browser's Web Speech voices, so this script is an upgrade, not a requirement.
 */

import { execFile } from 'node:child_process'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

import type { HeroClassId } from '../src/features/primeverse/games/primebound/heroClassSystem'
import { HERO_ORIGIN_FILMS } from '../src/features/primeverse/games/primebound/heroOriginFilms'
import { HERO_VOICE_CUES, HERO_VOICE_LINES } from '../src/features/primeverse/games/primebound/heroVoiceLines'

const execFileAsync = promisify(execFile)

const OUTPUT_DIR = path.join(import.meta.dirname, '..', 'public', 'games', 'primebound', 'origins')
const GAME_VOICES_DIR = path.join(import.meta.dirname, '..', 'public', 'games', 'primebound', 'voices')

/* ------------------------------------------------------------- voice casts */

interface EdgeVoice {
  readonly voice: string
  readonly rate?: string
  readonly pitch?: string
  readonly volume?: string
}

/**
 * Segmented delivery: a line split into pieces with different prosody reads
 * like acting — quiet build-up, then the shout. Deltas apply over the hero's
 * base voice; segments are synthesized separately and the MP3s concatenated.
 */
interface LineSegment {
  readonly text: string
  readonly rate?: number
  readonly pitch?: number
  readonly volume?: number
}

const SEGMENTED_LINES: Readonly<
  Partial<Record<HeroClassId, Partial<Record<string, readonly LineSegment[]>>>>
> = {
  'prime-warrior': {
    start: [
      { text: 'Nenhum composto vai me parar...', rate: -12, pitch: -6 },
      { text: 'Nenhum!', rate: 22, pitch: 16, volume: 35 },
    ],
    ultimate: [
      { text: 'Agora!', rate: 24, pitch: 14, volume: 35 },
      { text: 'Cinco cortes...', rate: 6, pitch: 4, volume: 25 },
      { text: 'nenhuma divisão!', rate: 18, pitch: 14, volume: 35 },
    ],
    transform: [
      { text: 'É isso!', rate: 20, pitch: 12, volume: 30 },
      { text: 'Forma prima: irredutível!', rate: 10, pitch: 8, volume: 25 },
    ],
  },
  'rsa-cryptographer': {
    start: [
      { text: 'Chaves prontas!', rate: 16, pitch: 10, volume: 25 },
      { text: 'Hora de fatorar vocês...', rate: -6 },
      { text: 'um por um!', rate: 14, pitch: 8, volume: 25 },
    ],
  },
  'modular-ranger': {
    start: [
      { text: 'Pode correr o quanto quiser...', rate: -8 },
      { text: 'minha flecha sempre encontra o caminho.', rate: 4, pitch: 4, volume: 20 },
    ],
  },
  'mersenne-arcanist': {
    start: [
      { text: 'Escutem...', rate: -18, pitch: -4 },
      { text: 'a potência que falta...', rate: -8 },
      { text: 'chegou!', rate: 18, pitch: 14, volume: 30 },
    ],
    ultimate: [
      { text: 'Pereçam...', rate: 4, pitch: 4, volume: 25 },
      { text: 'diante de Mersenne!', rate: 18, pitch: 14, volume: 40 },
    ],
  },
  'mobius-assassin': {
    start: [
      { text: 'Nem vai ver...', rate: -14, pitch: -6 },
      { text: 'o que te atingiu.', rate: -4, pitch: -4 },
    ],
    ultimate: [
      { text: 'A soma por trás da soma...', rate: -8, pitch: -6 },
      { text: 'acabou.', rate: -2, pitch: -8, volume: 20 },
    ],
  },
  'goldbach-berserker': {
    start: [
      { text: 'Par? Então são dois golpes!', rate: 12, pitch: -2, volume: 25 },
      { text: 'Vem!', rate: 24, pitch: 10, volume: 40 },
    ],
    ultimate: [
      { text: 'Dois sóis!', rate: 18, pitch: 8, volume: 35 },
      { text: 'Goldbach!', rate: 26, pitch: 14, volume: 40 },
    ],
    transform: [
      { text: 'Fúria par!', rate: 20, pitch: 10, volume: 35 },
      { text: 'Agora ninguém segura!', rate: 14, pitch: 4, volume: 30 },
    ],
  },
  'sieve-engineer': {
    start: [
      { text: 'Grade montada!', rate: 16, pitch: 8, volume: 25 },
      { text: 'Agora...', rate: -10 },
      { text: 'bora riscar tudo!', rate: 18, pitch: 10, volume: 30 },
    ],
  },
  'elliptic-oracle': {
    start: [
      { text: 'Eu já vi como isso termina...', rate: -10 },
      { text: 'e vocês perdem.', rate: -2, pitch: 4, volume: 15 },
    ],
  },
}

/** Battle cries get extra fire on top of each hero's base voice. */
const CUE_BOOSTS: Readonly<Record<string, { rate: number; pitch: number; volume: number }>> = {
  start: { rate: 6, pitch: 4, volume: 15 },
  tech: { rate: 16, pitch: 10, volume: 25 },
  ultimate: { rate: 12, pitch: 12, volume: 30 },
  transform: { rate: 10, pitch: 8, volume: 25 },
}

function boostVoice(base: EdgeVoice, cue: string): EdgeVoice {
  const boost = CUE_BOOSTS[cue]
  if (!boost) return base
  const parse = (value: string | undefined) => Number.parseInt(value ?? '0', 10) || 0
  return {
    voice: base.voice,
    rate: `${parse(base.rate) + boost.rate >= 0 ? '+' : ''}${parse(base.rate) + boost.rate}%`,
    pitch: `${parse(base.pitch) + boost.pitch >= 0 ? '+' : ''}${parse(base.pitch) + boost.pitch}Hz`,
    volume: `+${boost.volume}%`,
  }
}

/** Edge TTS cast: 3 native pt-BR voices + multilingual ones that speak pt-BR,
 * differentiated further with rate/pitch so no two characters sound alike. */
const EDGE_NARRATOR: EdgeVoice = { voice: 'pt-BR-ThalitaMultilingualNeural', rate: '-10%', pitch: '-4Hz' }
const EDGE_HERO_VOICES: Readonly<Record<HeroClassId, EdgeVoice>> = {
  'prime-warrior': { voice: 'en-US-AndrewMultilingualNeural', pitch: '-6Hz' },
  'rsa-cryptographer': { voice: 'en-US-EmmaMultilingualNeural', rate: '+8%', pitch: '+2Hz' },
  'modular-ranger': { voice: 'de-DE-SeraphinaMultilingualNeural', rate: '+6%', pitch: '+6Hz' },
  'mersenne-arcanist': { voice: 'en-US-BrianMultilingualNeural', rate: '-4%' },
  'mobius-assassin': { voice: 'en-US-AvaMultilingualNeural', rate: '-8%', pitch: '-10Hz' },
  'goldbach-berserker': { voice: 'de-DE-FlorianMultilingualNeural', rate: '+8%', pitch: '-14Hz' },
  'sieve-engineer': { voice: 'fr-FR-VivienneMultilingualNeural', rate: '+6%', pitch: '+4Hz' },
  'elliptic-oracle': { voice: 'de-DE-SeraphinaMultilingualNeural', rate: '-14%', pitch: '-6Hz' },
}

/** ElevenLabs premade voices; swap any id for a favorite from your VoiceLab. */
const ELEVENLABS_NARRATOR_ID = 'Xb7hH8MSUJpSbSDYk0k2' // Alice — clear, unhurried
const ELEVENLABS_HERO_IDS: Readonly<Record<HeroClassId, string>> = {
  'prime-warrior': 'GnDrTQvdzZ7wqAKfLzVQ', // nativo BR — Cael
  'rsa-cryptographer': 'YklVF5l1Q8os8glyd5SM', // nativa BR — Ada
  'modular-ranger': 'RVmX026jCrF5VqUvpCk0', // nativa BR — Nara
  'mersenne-arcanist': 'I5Mp8yDo0fn7upNW3DzQ', // nativo BR — Noa
  'mobius-assassin': 'ZPsRjgkcEZrCBONpMnfV', // nativa BR — Maia, sombria
  'goldbach-berserker': 'jkiD8IhCU1i2V7VvmNwi', // nativo BR — Otto
  'sieve-engineer': 'fhtZMBwha5du5OxuvexO', // nativa BR — Lena
  'elliptic-oracle': 'MA970ZNagubdplnfHEiJ', // nativa BR — Íris
}

/** Gemini TTS prebuilt voices (timbre) — the acting comes from directions. */
const GEMINI_NARRATOR_VOICE = 'Sulafat'
const GEMINI_HERO_VOICES: Readonly<Record<HeroClassId, string>> = {
  'prime-warrior': 'Alnilam',
  'rsa-cryptographer': 'Autonoe',
  'modular-ranger': 'Laomedeia',
  'mersenne-arcanist': 'Iapetus',
  'mobius-assassin': 'Achernar',
  'goldbach-berserker': 'Algenib',
  'sieve-engineer': 'Sadachbia',
  'elliptic-oracle': 'Vindemiatrix',
}

type JobKind = 'narration' | 'quote' | string

const GEMINI_CUE_DIRECTIONS: Readonly<Record<string, string>> = {
  narration: 'Narre em português do Brasil como um trailer épico de fantasia, com gravidade e emoção crescente, mas em ritmo fluido, sem pausas longas: ',
  quote: 'Interprete em português do Brasil, com drama e convicção, como a frase final do filme de origem de um herói: ',
  start: 'Interprete em português do Brasil como um herói de anime entrando na batalha, com energia e atitude: ',
  tech: 'Grite em português do Brasil como um golpe de anime, curto e explosivo: ',
  ultimate: 'Grite em português do Brasil como o golpe final de um anime, com fúria total: ',
  transform: 'Anuncie em português do Brasil como uma transformação de anime, épico e triunfante: ',
}

/** Persona tweaks: not every champion shouts. */
const GEMINI_HERO_DIRECTIONS: Readonly<
  Partial<Record<HeroClassId, Partial<Record<string, string>>>>
> = {
  'mobius-assassin': {
    start: 'Sussurre em português do Brasil, com ameaça fria e calma de assassina: ',
    tech: 'Diga em português do Brasil, baixo e cortante, como uma assassina atacando das sombras: ',
    ultimate: 'Sussurre em português do Brasil, lento e ameaçador, como uma sentença final: ',
  },
  'elliptic-oracle': {
    start: 'Diga em português do Brasil com calma profética, serena e inevitável: ',
    quote: 'Diga em português do Brasil como uma profecia serena e inevitável: ',
  },
  'goldbach-berserker': {
    start: 'Grite em português do Brasil com fúria de berserker, rindo do inimigo: ',
    quote: 'Diga em português do Brasil com orgulho brutal de guerreiro: ',
  },
}

/* --------------------------------------------------------------- providers */

async function runEdge(edge: EdgeVoice, text: string, target: string): Promise<void> {
  const args = ['-m', 'edge_tts', `--voice=${edge.voice}`]
  if (edge.rate) args.push(`--rate=${edge.rate}`)
  if (edge.pitch) args.push(`--pitch=${edge.pitch}`)
  if (edge.volume) args.push(`--volume=${edge.volume}`)
  args.push(`--text=${text}`, `--write-media=${target}`)
  await execFileAsync('python3', args)
}

async function synthesizeEdge(job: Job, target: string): Promise<void> {
  if (!job.segments) {
    await runEdge(job.edge, job.text, target)
    return
  }
  const parse = (value: string | undefined) => Number.parseInt(value ?? '0', 10) || 0
  const buffers: Buffer[] = []
  for (let index = 0; index < job.segments.length; index += 1) {
    const segment = job.segments[index]
    const rate = parse(job.edge.rate) + (segment.rate ?? 0)
    const pitch = parse(job.edge.pitch) + (segment.pitch ?? 0)
    const volume = segment.volume ?? 0
    const segmentVoice: EdgeVoice = {
      voice: job.edge.voice,
      rate: `${rate >= 0 ? '+' : ''}${rate}%`,
      pitch: `${pitch >= 0 ? '+' : ''}${pitch}Hz`,
      volume: `${volume >= 0 ? '+' : ''}${volume}%`,
    }
    const segmentPath = `${target}.seg${index}`
    await runEdge(segmentVoice, segment.text, segmentPath)
    buffers.push(await readFile(segmentPath))
    await rm(segmentPath)
  }
  await writeFile(target, Buffer.concat(buffers))
}

/**
 * eleven_v3 audio tags per line kind — real acting direction. Only documented
 * tags (unknown ones risk being read aloud). Maia whispers, Otto laughs.
 */
const V3_CUE_TAGS: Readonly<Record<string, string>> = {
  quote: '',
  start: '',
  tech: '[shouts] ',
  ultimate: '[shouts] ',
  transform: '[excited] ',
}

const V3_HERO_TAGS: Readonly<Partial<Record<HeroClassId, Partial<Record<string, string>>>>> = {
  'mobius-assassin': {
    quote: '[whispers] ',
    start: '',
    tech: '',
    ultimate: '[whispers] ',
  },
  'goldbach-berserker': {
    start: '[laughs] ',
    transform: '[shouts] ',
  },
  'elliptic-oracle': {
    tech: '',
    ultimate: '',
  },
}

/** Acting profile per line kind: shouts get low stability + high style. */
const ELEVENLABS_SETTINGS: Readonly<Record<string, { stability: number; style: number }>> = {
  narration: { stability: 0.5, style: 0.4 },
  quote: { stability: 0.4, style: 0.5 },
  start: { stability: 0.35, style: 0.55 },
  tech: { stability: 0.25, style: 0.7 },
  ultimate: { stability: 0.22, style: 0.75 },
  transform: { stability: 0.28, style: 0.65 },
}

async function synthesizeElevenLabs(apiKey: string, job: Job, target: string): Promise<void> {
  // Narration stays on multilingual_v2 — the approved Alice sound. Character
  // lines use eleven_v3: acted delivery via audio tags, fluent pt-BR.
  const useV3 = job.kind !== 'narration'
  const tag = useV3
    ? ((job.heroClassId && V3_HERO_TAGS[job.heroClassId]?.[job.kind]) ?? V3_CUE_TAGS[job.kind] ?? '')
    : ''
  const acting = ELEVENLABS_SETTINGS[job.kind] ?? ELEVENLABS_SETTINGS.narration
  const body = useV3
    ? {
        text: `${tag}${job.text}`,
        model_id: 'eleven_v3',
        language_code: 'pt',
        voice_settings: {
          stability: job.kind === 'quote' || job.kind === 'start' ? 0.5 : 0.0,
        },
      }
    : {
        text: job.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: acting.stability,
          style: acting.style,
          similarity_boost: 0.8,
          use_speaker_boost: true,
        },
      }
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${job.elevenLabsVoiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
  if (!response.ok) {
    throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`)
  }
  await writeFile(target, Buffer.from(await response.arrayBuffer()))
}

/* ------------------------------------------------------------------- main */

interface Job {
  readonly file: string
  readonly dir: string
  readonly text: string
  readonly kind: JobKind
  readonly heroClassId?: HeroClassId
  readonly edge: EdgeVoice
  readonly segments?: readonly LineSegment[]
  readonly elevenLabsVoiceId: string
}

function wavFromPcm(pcm: Buffer, sampleRate = 24_000): Buffer {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

class GeminiQuotaError extends Error {}
class GeminiEmptyError extends Error {}

/** The TTS preview occasionally returns 200 with no audio; retry, then skip. */
async function synthesizeGeminiWithRetry(apiKey: string, job: Job, targetM4a: string): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await synthesizeGemini(apiKey, job, targetM4a)
      return true
    } catch (error) {
      if (error instanceof GeminiEmptyError) {
        console.log(`sem áudio (${error.message}), tentativa ${attempt}/3…`)
        await new Promise((resolve) => setTimeout(resolve, 21_000))
        continue
      }
      throw error
    }
  }
  console.log(`· pulando ${job.file} nesta rodada (a próxima tenta de novo)`)
  return false
}

async function synthesizeGemini(apiKey: string, job: Job, targetM4a: string): Promise<void> {
  const direction =
    (job.heroClassId && GEMINI_HERO_DIRECTIONS[job.heroClassId]?.[job.kind]) ??
    GEMINI_CUE_DIRECTIONS[job.kind] ??
    GEMINI_CUE_DIRECTIONS.narration
  const voiceName = job.heroClassId && job.kind !== 'narration'
    ? GEMINI_HERO_VOICES[job.heroClassId]
    : GEMINI_NARRATOR_VOICE
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${direction}${job.text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      }),
    },
  )
  if (response.status === 429) throw new GeminiQuotaError()
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`)
  const payload = (await response.json()) as {
    candidates?: {
      finishReason?: string
      content?: { parts?: { inlineData?: { data?: string } }[] }
    }[]
  }
  const base64 = payload.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
  if (!base64) {
    throw new GeminiEmptyError(payload.candidates?.[0]?.finishReason ?? 'sem candidato')
  }
  const wavPath = `${targetM4a}.wav`
  await writeFile(wavPath, wavFromPcm(Buffer.from(base64, 'base64')))
  await execFileAsync('afconvert', ['-f', 'm4af', '-d', 'aac', wavPath, targetM4a])
  await rm(wavPath)
}

async function measureSeconds(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('afinfo', [filePath])
    const match = stdout.match(/estimated duration: ([0-9.]+)/)
    return match ? Number.parseFloat(match[1]) : null
  } catch {
    return null
  }
}

async function bestTakeSeconds(baseMp3: string): Promise<number | null> {
  return (await measureSeconds(baseMp3.replace(/\.mp3$/, '.m4a'))) ?? measureSeconds(baseMp3)
}

/**
 * Re-fits every beat's durationMs in heroOriginFilms.ts to whatever take will
 * actually play (acted .m4a first, Edge .mp3 otherwise): narration + breathing
 * room, and narration + hero quote on each film's closing beat. Runs after
 * every generation batch so mixed Edge/Gemini states stay in sync.
 */
async function fitFilmDurations(): Promise<void> {
  const timelinePath = path.join(import.meta.dirname, '..', 'src', 'features', 'primeverse', 'games', 'primebound', 'heroOriginFilms.ts')
  let source = await readFile(timelinePath, 'utf-8')
  let changes = 0
  for (const film of Object.values(HERO_ORIGIN_FILMS)) {
    const quoteSeconds = await bestTakeSeconds(path.join(OUTPUT_DIR, `quote-${film.heroClassId}.mp3`))
    for (let index = 0; index < film.beats.length; index += 1) {
      const beat = film.beats[index]
      const narrationSeconds = await bestTakeSeconds(path.join(OUTPUT_DIR, `${beat.id}.mp3`))
      if (narrationSeconds === null) continue
      const closing = index === film.beats.length - 1
      const seconds = closing
        ? narrationSeconds + (quoteSeconds ?? 3) + 1.5
        : narrationSeconds + 1.2
      const durationMs = Math.round(seconds * 10) * 100
      const pattern = new RegExp(`(\\{ id: '${beat.id}', durationMs: )[0-9_]+,`)
      const formatted = durationMs.toLocaleString('en-US').replace(/,/g, '_')
      const next = source.replace(pattern, `$1${formatted},`)
      if (next !== source) {
        source = next
        changes += 1
      }
    }
  }
  await writeFile(timelinePath, source)
  console.log(`\nDurações reajustadas na timeline: ${changes} beat(s).`)
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const provider = process.env.TTS_PROVIDER ?? (apiKey ? 'elevenlabs' : geminiKey ? 'gemini' : 'edge')
  if (provider === 'elevenlabs' && !apiKey) {
    console.error('TTS_PROVIDER=elevenlabs exige ELEVENLABS_API_KEY (ex.: em .env.local).')
    process.exitCode = 1
    return
  }
  if (provider === 'gemini' && !geminiKey) {
    console.error('TTS_PROVIDER=gemini exige GEMINI_API_KEY (grátis em aistudio.google.com/apikey).')
    process.exitCode = 1
    return
  }
  const force = process.argv.includes('--force')
  await mkdir(OUTPUT_DIR, { recursive: true })
  await mkdir(GAME_VOICES_DIR, { recursive: true })

  const jobs: Job[] = []
  for (const film of Object.values(HERO_ORIGIN_FILMS)) {
    for (const beat of film.beats) {
      jobs.push({
        file: `${beat.id}.mp3`,
        dir: OUTPUT_DIR,
        text: beat.caption,
        kind: 'narration',
        edge: EDGE_NARRATOR,
        elevenLabsVoiceId: ELEVENLABS_NARRATOR_ID,
      })
    }
    jobs.push({
      file: `quote-${film.heroClassId}.mp3`,
      dir: OUTPUT_DIR,
      text: film.quote,
      kind: 'quote',
      heroClassId: film.heroClassId,
      edge: EDGE_HERO_VOICES[film.heroClassId],
      elevenLabsVoiceId: ELEVENLABS_HERO_IDS[film.heroClassId],
    })
    for (const cue of HERO_VOICE_CUES) {
      const segments = SEGMENTED_LINES[film.heroClassId]?.[cue]
      jobs.push({
        file: `${film.heroClassId}-${cue}.mp3`,
        dir: GAME_VOICES_DIR,
        text: HERO_VOICE_LINES[film.heroClassId][cue],
        kind: cue,
        heroClassId: film.heroClassId,
        edge: segments
          ? EDGE_HERO_VOICES[film.heroClassId]
          : boostVoice(EDGE_HERO_VOICES[film.heroClassId], cue),
        segments,
        elevenLabsVoiceId: ELEVENLABS_HERO_IDS[film.heroClassId],
      })
    }
  }

  console.log(`Provedor: ${provider} · ${jobs.length} falas\n`)
  const untilDone = process.argv.includes('--until-done')

  const runPass = async (): Promise<'done' | 'quota' | 'retry'> => {
  let generated = 0
  let flaky = 0
  for (const job of jobs) {
    const target = path.join(job.dir, job.file)
    const targetM4a = target.replace(/\.mp3$/, '.m4a')
    const alreadyDone = provider === 'gemini'
      ? await fileExists(targetM4a)
      : (await fileExists(target)) || (await fileExists(targetM4a))
    if (!force && alreadyDone) {
      console.log(`· ${job.file} já existe, pulando`)
      continue
    }
    process.stdout.write(`→ ${job.file}… `)
    if (provider === 'elevenlabs') {
      await synthesizeElevenLabs(apiKey as string, job, target)
      await rm(targetM4a, { force: true })
      await new Promise((resolve) => setTimeout(resolve, 400))
    } else if (provider === 'gemini') {
      let produced = false
      try {
        produced = await synthesizeGeminiWithRetry(geminiKey as string, job, targetM4a)
      } catch (error) {
        if (error instanceof GeminiQuotaError) {
          console.log('cota do dia atingida.')
          console.log(`Progresso desta rodada: ${generated} fala(s).`)
          await fitFilmDurations()
          return 'quota'
        }
        throw error
      }
      if (!produced) {
        flaky += 1
        continue
      }
      // The Edge .mp3 stays as the fallback take; playback prefers the .m4a.
      // Free tier allows ~3 requests/min on the TTS model.
      await new Promise((resolve) => setTimeout(resolve, 21_000))
    } else {
      await synthesizeEdge(job, target)
      await rm(targetM4a, { force: true })
    }
    generated += 1
    console.log('ok')
  }
  console.log(`\nPronto: ${generated} arquivo(s) gerado(s) em ${OUTPUT_DIR}`)
  if (generated > 0) await fitFilmDurations()
  return flaky > 0 ? 'retry' : 'done'
  }

  for (;;) {
    const result = await runPass()
    if (result === 'done') {
      console.log('\nTodas as falas têm take final. Elenco completo!')
      return
    }
    if (!untilDone) {
      if (result === 'quota') {
        console.log('\nSem problema: rode `npm run voices:origins` de novo amanhã — ele continua daqui.')
        console.log('Ou deixe rodando direto com: npm run voices:origins -- --until-done')
      }
      return
    }
    const waitMinutes = result === 'quota' ? 60 : 2
    console.log(`\nMaratona: aguardando ${waitMinutes} min e retomando (Ctrl+C para parar; o progresso fica salvo)…`)
    await new Promise((resolve) => setTimeout(resolve, waitMinutes * 60_000))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
