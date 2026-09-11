import { HERO_CLASS_IDS, type HeroClassId } from './heroClassSystem'

/**
 * In-game voice lines: what each champion says when the run begins and when
 * the big moves land. Files live in public/games/primebound/voices/ (generated
 * by scripts/generate-origin-voices.ts with each hero's cast voice); the Web
 * Speech fallback covers missing files, same as the origin films.
 */

export const HERO_VOICE_CUES = ['start', 'tech', 'ultimate', 'transform'] as const

export type HeroVoiceCue = (typeof HERO_VOICE_CUES)[number]

export const HERO_VOICE_LINES: Readonly<
  Record<HeroClassId, Readonly<Record<HeroVoiceCue, string>>>
> = Object.freeze({
  'prime-warrior': {
    start: 'Nenhum composto vai me parar... Nenhum!',
    tech: 'Corta em três!',
    ultimate: 'Agora! Cinco cortes — nenhuma divisão!',
    transform: 'É isso! Forma prima: irredutível!',
  },
  'rsa-cryptographer': {
    start: 'Chaves prontas! Hora de fatorar vocês... um por um!',
    tech: 'Pê e quê... marcados!',
    ultimate: 'Rede fechada! Todas as chaves, quebradas!',
    transform: 'Sim! Protocolo primo ativado!',
  },
  'modular-ranger': {
    start: 'Pode correr o quanto quiser... minha flecha sempre encontra o caminho.',
    tech: 'Resíduo travado!',
    ultimate: 'Céu de Mersenne — caia agora!',
    transform: 'Módulo total! Nada escapa!',
  },
  'mersenne-arcanist': {
    start: 'Escutem... a potência que falta... chegou!',
    tech: 'Dois elevado a pê... menos um!',
    ultimate: 'Pereçam diante de Mersenne!',
    transform: 'Acorde primo! Toquem comigo!',
  },
  'mobius-assassin': {
    start: 'Nem vai ver... o que te atingiu.',
    tech: 'Sinal trocado!',
    ultimate: 'A soma por trás da soma... acabou.',
    transform: 'Möbius! Inversão!',
  },
  'goldbach-berserker': {
    start: 'Par? Então são dois golpes! Vem!',
    tech: 'Primeiro primo!',
    ultimate: 'Dois sóis! Goldbach!',
    transform: 'Fúria par! Agora ninguém segura!',
  },
  'sieve-engineer': {
    start: 'Grade montada! Agora... bora riscar tudo!',
    tech: 'Múltiplo riscado!',
    ultimate: 'Crivo total! Todos de uma vez!',
    transform: 'Malha prima erguida! Perfeita!',
  },
  'elliptic-oracle': {
    start: 'Eu já vi como isso termina... e vocês perdem.',
    tech: 'Tangente!',
    ultimate: 'Terceiro ponto: colisão!',
    transform: 'A curva desperta! Sinta!',
  },
} as const)

export const HERO_VOICE_BASE_PATH = '/games/primebound/voices'

export function heroVoiceAudioPath(heroClassId: HeroClassId, cue: HeroVoiceCue): string {
  return `${HERO_VOICE_BASE_PATH}/${heroClassId}-${cue}.mp3`
}

export function assertHeroVoiceLinesCoverAllHeroes(): void {
  for (const heroClassId of HERO_CLASS_IDS) {
    for (const cue of HERO_VOICE_CUES) {
      if (!HERO_VOICE_LINES[heroClassId]?.[cue]) {
        throw new Error(`Missing voice line ${cue} for ${heroClassId}`)
      }
    }
  }
}
