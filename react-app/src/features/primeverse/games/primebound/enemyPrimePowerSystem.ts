/** Pure combat profiles for enemy powers inspired by prime-number families. */

export const ENEMY_PRIME_POWER_FAMILY_IDS = [
  'prime-powers',
  'twin-primes',
  'sophie-germain',
  'mersenne',
  'eratosthenes-sieve',
  'goldbach',
  'wilson',
] as const

export type EnemyPrimePowerFamilyId =
  (typeof ENEMY_PRIME_POWER_FAMILY_IDS)[number]

export type EnemyEncounterRank = 'minion' | 'area-boss' | 'final-boss'
export type EnemyBossPhase = 1 | 2 | 3
export type EnemyPowerIntent = 'cast' | 'burst'
export type EnemyPowerPattern =
  | 'power-volley'
  | 'twin-lances'
  | 'sophie-chain'
  | 'mersenne-ring'
  | 'sieve-lanes'
  | 'goldbach-pair'
  | 'wilson-orbit'

export type EnemyAnimeCutInStyle =
  | 'exponential-ascension'
  | 'mirrored-duel'
  | 'chained-awakening'
  | 'apocalyptic-crown'
  | 'geometric-erasure'
  | 'binary-eclipse'
  | 'factorial-judgement'

export type EnemyAnimeCameraMove =
  | 'vertical-snap'
  | 'split-dolly'
  | 'chain-track'
  | 'radial-crash'
  | 'lane-sweep'
  | 'converging-zoom'
  | 'orbital-roll'

export type EnemyAnimeImpactShape =
  | 'nested-squares'
  | 'twin-cross'
  | 'linked-diamonds'
  | 'fractured-crown'
  | 'sieve-grid'
  | 'binary-sun'
  | 'factorial-seal'

/** Renderer-ready direction for an anime power activation and its impact frame. */
export interface EnemyPrimePowerAnimePresentation {
  readonly familyId: EnemyPrimePowerFamilyId
  readonly phase: EnemyBossPhase
  readonly techniqueName: string
  readonly battleCry: string
  readonly impactWord: string
  readonly glyph: string
  readonly flashColor: string
  readonly cutInStyle: EnemyAnimeCutInStyle
  readonly cameraMove: EnemyAnimeCameraMove
  readonly impactShape: EnemyAnimeImpactShape
  /** Duration of the impact freeze. The game loop can clamp or ignore this. */
  readonly hitStopMs: number
  /** Suggested camera displacement in CSS/canvas pixels. */
  readonly shakePx: number
  readonly afterimageCount: number
  readonly rayCount: number
  readonly screenFlashAlpha: number
  /** Camera scale at the apex of the activation. */
  readonly zoomScale: number
  /** Simulation multiplier during the dramatic anticipation. */
  readonly slowMotionScale: number
}

export interface EnemyPrimePowerDefinition {
  readonly id: EnemyPrimePowerFamilyId
  readonly name: string
  readonly shortName: string
  readonly formula: string
  readonly description: string
  readonly pattern: EnemyPowerPattern
  readonly intent: EnemyPowerIntent
  readonly color: string
}

export interface EnemyPrimePowerCast extends EnemyPrimePowerDefinition {
  readonly phase: EnemyBossPhase
  readonly projectileCount: number
  readonly projectileSpeed: number
  readonly projectileDamage: number
  readonly spreadRadians: number
  readonly radial: boolean
  readonly homingStrength: number
  readonly angularVelocity: number
  readonly cooldownMs: number
  readonly telegraphMs: number
  readonly anime: EnemyPrimePowerAnimePresentation
}

export const ENEMY_PRIME_POWERS: Readonly<
  Record<EnemyPrimePowerFamilyId, EnemyPrimePowerDefinition>
> = Object.freeze({
  'prime-powers': Object.freeze({
    id: 'prime-powers',
    name: 'Potência Prima',
    shortName: 'POTÊNCIA',
    formula: 'p²',
    description: 'Duplica a malha de disparos como uma potência de base prima.',
    pattern: 'power-volley',
    intent: 'cast',
    color: '#a8e86f',
  }),
  'twin-primes': Object.freeze({
    id: 'twin-primes',
    name: 'Lanças Gêmeas',
    shortName: 'GÊMEOS',
    formula: 'p, p + 2',
    description: 'Dispara sempre em pares separados por um intervalo constante.',
    pattern: 'twin-lances',
    intent: 'cast',
    color: '#79eef1',
  }),
  'sophie-germain': Object.freeze({
    id: 'sophie-germain',
    name: 'Corrente de Sophie',
    shortName: 'SOPHIE',
    formula: 'p → 2p + 1',
    description: 'Projéteis perseguidores se transformam em elos cada vez mais fortes.',
    pattern: 'sophie-chain',
    intent: 'cast',
    color: '#c2a0ff',
  }),
  mersenne: Object.freeze({
    id: 'mersenne',
    name: 'Coroa de Mersenne',
    shortName: 'MERSENNE',
    formula: '2ᵖ − 1',
    description: 'Invoca as coroas 3, 7 e 31; a última condensa sua energia em onze fragmentos.',
    pattern: 'mersenne-ring',
    intent: 'burst',
    color: '#ff9854',
  }),
  'eratosthenes-sieve': Object.freeze({
    id: 'eratosthenes-sieve',
    name: 'Linhas do Crivo',
    shortName: 'CRIVO',
    formula: '≠ 2k, 3k, 5k',
    description: 'Varre faixas compostas e deixa estreitas rotas primas entre elas.',
    pattern: 'sieve-lanes',
    intent: 'cast',
    color: '#72efb4',
  }),
  goldbach: Object.freeze({
    id: 'goldbach',
    name: 'Pacto de Goldbach',
    shortName: 'GOLDBACH',
    formula: '2n = p + q',
    description: 'Duas metades sincronizadas fecham o alvo entre somas primas.',
    pattern: 'goldbach-pair',
    intent: 'burst',
    color: '#ff92d5',
  }),
  wilson: Object.freeze({
    id: 'wilson',
    name: 'Órbita de Wilson',
    shortName: 'WILSON',
    formula: '(p−1)! ≡ −1 mod p',
    description: 'Projéteis fatoriais curvam em órbitas até completar o resto menos um.',
    pattern: 'wilson-orbit',
    intent: 'burst',
    color: '#8fb8ff',
  }),
} as const)

const PHASE_PROJECTILES: Readonly<
  Record<EnemyPrimePowerFamilyId, readonly [number, number, number]>
> = Object.freeze({
  'prime-powers': [2, 4, 8],
  'twin-primes': [2, 4, 6],
  'sophie-germain': [1, 2, 3],
  // The glyph still invokes 31, but only the brightest eleven fragments become
  // damaging projectiles so the safe gaps remain legible on the small canvas.
  mersenne: [3, 7, 11],
  'eratosthenes-sieve': [3, 5, 7],
  goldbach: [4, 6, 8],
  wilson: [5, 7, 9],
})

type AnimePhaseTuple<T> = readonly [T, T, T]

interface EnemyPrimePowerAnimeProfile {
  readonly techniqueNames: AnimePhaseTuple<string>
  readonly battleCries: AnimePhaseTuple<string>
  readonly impactWords: AnimePhaseTuple<string>
  readonly glyphs: AnimePhaseTuple<string>
  readonly flashColors: AnimePhaseTuple<string>
  readonly cutInStyle: EnemyAnimeCutInStyle
  readonly cameraMove: EnemyAnimeCameraMove
  readonly impactShape: EnemyAnimeImpactShape
  readonly hitStopMs: AnimePhaseTuple<number>
  readonly shakePx: AnimePhaseTuple<number>
  readonly afterimageCount: AnimePhaseTuple<number>
  readonly rayCount: AnimePhaseTuple<number>
  readonly screenFlashAlpha: AnimePhaseTuple<number>
  readonly zoomScale: AnimePhaseTuple<number>
  readonly slowMotionScale: AnimePhaseTuple<number>
}

function animeProfile(
  profile: EnemyPrimePowerAnimeProfile,
): Readonly<EnemyPrimePowerAnimeProfile> {
  return Object.freeze(profile)
}

const ENEMY_PRIME_POWER_ANIME_PROFILES: Readonly<
  Record<EnemyPrimePowerFamilyId, EnemyPrimePowerAnimeProfile>
> = Object.freeze({
  'prime-powers': animeProfile({
    techniqueNames: ['Elevação Prima', 'Domínio Exponencial', 'Apoteose p²: Oito Ecos'],
    battleCries: [
      'Ascenda, base indivisível!',
      'Potência sobre potência!',
      'Toda força... elevada ao quadrado!',
    ],
    impactWords: ['ELEVA!', 'QUADRADO!', 'APOTEOSE!'],
    glyphs: ['p¹', 'p²', 'p² × 8'],
    flashColors: ['#d6ff9f', '#b8ff66', '#f0ffc8'],
    cutInStyle: 'exponential-ascension',
    cameraMove: 'vertical-snap',
    impactShape: 'nested-squares',
    hitStopMs: [36, 54, 82],
    shakePx: [1, 3, 6],
    afterimageCount: [1, 2, 4],
    rayCount: [3, 5, 8],
    screenFlashAlpha: [.1, .18, .28],
    zoomScale: [1.015, 1.03, 1.055],
    slowMotionScale: [.94, .84, .7],
  }),
  'twin-primes': animeProfile({
    techniqueNames: ['Lanças de Euclides', 'Intervalo Imutável', 'Par Eterno: p e p + 2'],
    battleCries: [
      'Dois pontos, uma sentença!',
      'Nem o infinito separa este par!',
      'Gêmeos eternos... atravessem juntos!',
    ],
    impactWords: ['DUPLO!', 'INTERVALO 2!', 'CONJUNÇÃO!'],
    glyphs: ['p ↔ p+2', '(p, p+2)', '∞ · (p, p+2)'],
    flashColors: ['#bfffff', '#65ffff', '#e4ffff'],
    cutInStyle: 'mirrored-duel',
    cameraMove: 'split-dolly',
    impactShape: 'twin-cross',
    hitStopMs: [40, 60, 88],
    shakePx: [2, 3, 6],
    afterimageCount: [1, 2, 4],
    rayCount: [4, 6, 9],
    screenFlashAlpha: [.11, .19, .29],
    zoomScale: [1.018, 1.034, 1.058],
    slowMotionScale: [.93, .82, .68],
  }),
  'sophie-germain': animeProfile({
    techniqueNames: ['Primeiro Elo', 'Cadeia Segura', 'Transcendência de Sophie'],
    battleCries: [
      'Um primo chama o próximo!',
      'Cresça... e permaneça indivisível!',
      'Sophie, conduza a corrente além do limite!',
    ],
    impactWords: ['CONECTA!', 'ENCADEIA!', 'TRANSCENDE!'],
    glyphs: ['p → 2p+1', 'p → q → 2q+1', 'p ⇢ 2p+1 ⇢ ∞'],
    flashColors: ['#e4d3ff', '#c88cff', '#f2e5ff'],
    cutInStyle: 'chained-awakening',
    cameraMove: 'chain-track',
    impactShape: 'linked-diamonds',
    hitStopMs: [32, 50, 78],
    shakePx: [1, 2, 5],
    afterimageCount: [1, 3, 5],
    rayCount: [2, 4, 7],
    screenFlashAlpha: [.09, .16, .26],
    zoomScale: [1.012, 1.027, 1.05],
    slowMotionScale: [.95, .85, .72],
  }),
  mersenne: animeProfile({
    techniqueNames: ['Coroa de Três', 'Sete Selos de Mersenne', 'Cataclismo 31: Coroa Absoluta'],
    battleCries: [
      'Três pontas coroam o vazio!',
      'Sete selos... rompam o horizonte!',
      'Dois elevado ao primo, menos um... CATACLISMO!',
    ],
    impactWords: ['COROA!', 'SETE SELOS!', '31 — RUÍNA!'],
    glyphs: ['2²−1 = 3', '2³−1 = 7', '2⁵−1 = 31'],
    flashColors: ['#ffc078', '#ff8a3d', '#fff0be'],
    cutInStyle: 'apocalyptic-crown',
    cameraMove: 'radial-crash',
    impactShape: 'fractured-crown',
    hitStopMs: [44, 70, 104],
    shakePx: [2, 4, 8],
    afterimageCount: [1, 2, 4],
    rayCount: [5, 8, 11],
    screenFlashAlpha: [.12, .22, .34],
    zoomScale: [1.02, 1.042, 1.072],
    slowMotionScale: [.91, .78, .64],
  }),
  'eratosthenes-sieve': animeProfile({
    techniqueNames: ['Risco dos Múltiplos', 'Expurgo 2 · 3 · 5', 'Domínio de Eratóstenes'],
    battleCries: [
      'Marquem os múltiplos!',
      'Dois, três, cinco... sejam eliminados!',
      'Neste domínio, apenas os primos sobrevivem!',
    ],
    impactWords: ['RISCA!', 'EXPURGA!', 'ELIMINADO!'],
    glyphs: ['n ≠ 2k', 'n ≠ 2k, 3k', 'n ≠ 2k, 3k, 5k'],
    flashColors: ['#b8ffda', '#61f5aa', '#dcffed'],
    cutInStyle: 'geometric-erasure',
    cameraMove: 'lane-sweep',
    impactShape: 'sieve-grid',
    hitStopMs: [30, 46, 72],
    shakePx: [1, 2, 4],
    afterimageCount: [1, 2, 3],
    rayCount: [3, 6, 10],
    screenFlashAlpha: [.08, .15, .24],
    zoomScale: [1.01, 1.025, 1.048],
    slowMotionScale: [.96, .87, .74],
  }),
  goldbach: animeProfile({
    techniqueNames: ['Paridade Partida', 'Conjectura Carmesim', 'Todo Par se Curva'],
    battleCries: [
      'Divida o par em duas chamas!',
      'Duas vontades primas, uma soma inevitável!',
      'Todo número par... curve-se à nossa soma!',
    ],
    impactWords: ['SOMA!', 'CONJECTURA!', 'IGUALDADE!'],
    glyphs: ['2n = p+q', 'p ⊕ q = 2n', '∀2n : p+q'],
    flashColors: ['#ffc5e8', '#ff69bd', '#ffe3f5'],
    cutInStyle: 'binary-eclipse',
    cameraMove: 'converging-zoom',
    impactShape: 'binary-sun',
    hitStopMs: [42, 66, 98],
    shakePx: [2, 4, 7],
    afterimageCount: [1, 3, 5],
    rayCount: [5, 8, 12],
    screenFlashAlpha: [.12, .21, .32],
    zoomScale: [1.019, 1.04, 1.066],
    slowMotionScale: [.92, .79, .65],
  }),
  wilson: animeProfile({
    techniqueNames: ['Resto Menos Um', 'Tribunal Fatorial', 'Veredito de Wilson'],
    battleCries: [
      'O resto já decidiu!',
      'Cada fator será testemunha!',
      'Fatorial completo... o veredito é MENOS UM!',
    ],
    impactWords: ['RESTO −1!', 'FATORIAL!', 'CULPADO!'],
    glyphs: ['(p−1)!', '≡ −1 mod p', '(p−1)! ≡ −1 (mod p)'],
    flashColors: ['#c8dcff', '#79a8ff', '#edf4ff'],
    cutInStyle: 'factorial-judgement',
    cameraMove: 'orbital-roll',
    impactShape: 'factorial-seal',
    hitStopMs: [46, 74, 110],
    shakePx: [2, 5, 8],
    afterimageCount: [1, 3, 5],
    rayCount: [6, 9, 13],
    screenFlashAlpha: [.13, .23, .36],
    zoomScale: [1.022, 1.045, 1.075],
    slowMotionScale: [.9, .76, .62],
  }),
} as const)

const animePresentationCache = new Map<string, EnemyPrimePowerAnimePresentation>()
const primePowerCastCache = new Map<string, EnemyPrimePowerCast>()
const BOSS_SHOWCASE_CAST_INTERVAL = 3

function assertHealth(health: number, maxHealth: number): void {
  if (!Number.isFinite(health) || !Number.isFinite(maxHealth)) {
    throw new RangeError('Enemy health must be finite.')
  }
  if (maxHealth <= 0 || health < 0 || health > maxHealth) {
    throw new RangeError('Enemy health must stay between zero and maxHealth.')
  }
}

function assertBossPhase(phase: EnemyBossPhase): void {
  if (!Number.isInteger(phase) || phase < 1 || phase > 3) {
    throw new RangeError('Enemy boss phase must be 1, 2, or 3.')
  }
}

export function isEnemyBossShowcaseCast(
  rank: EnemyEncounterRank,
  phase: EnemyBossPhase,
  completedPhaseCasts: number,
): boolean {
  assertBossPhase(phase)
  if (!Number.isInteger(completedPhaseCasts) || completedPhaseCasts < 0) {
    throw new RangeError('Completed phase casts must be a non-negative integer.')
  }
  return rank !== 'minion'
    && phase === 3
    && completedPhaseCasts > 0
    && completedPhaseCasts % BOSS_SHOWCASE_CAST_INTERVAL === 0
}

export function resolveEnemyPrimePowerAnimePresentation(
  familyId: EnemyPrimePowerFamilyId,
  phase: EnemyBossPhase,
): EnemyPrimePowerAnimePresentation {
  const profile = ENEMY_PRIME_POWER_ANIME_PROFILES[familyId]
  if (!profile) throw new RangeError(`Unknown enemy prime family: ${String(familyId)}`)
  assertBossPhase(phase)
  const cacheKey = `${familyId}:${phase}`
  const cached = animePresentationCache.get(cacheKey)
  if (cached) return cached
  const phaseIndex = phase - 1

  const presentation = Object.freeze({
    familyId,
    phase,
    techniqueName: profile.techniqueNames[phaseIndex],
    battleCry: profile.battleCries[phaseIndex],
    impactWord: profile.impactWords[phaseIndex],
    glyph: profile.glyphs[phaseIndex],
    flashColor: profile.flashColors[phaseIndex],
    cutInStyle: profile.cutInStyle,
    cameraMove: profile.cameraMove,
    impactShape: profile.impactShape,
    hitStopMs: profile.hitStopMs[phaseIndex],
    shakePx: profile.shakePx[phaseIndex],
    afterimageCount: profile.afterimageCount[phaseIndex],
    rayCount: profile.rayCount[phaseIndex],
    screenFlashAlpha: profile.screenFlashAlpha[phaseIndex],
    zoomScale: profile.zoomScale[phaseIndex],
    slowMotionScale: profile.slowMotionScale[phaseIndex],
  })
  animePresentationCache.set(cacheKey, presentation)
  return presentation
}

export function getEnemyBossPhase(
  health: number,
  maxHealth: number,
  rank: EnemyEncounterRank,
): EnemyBossPhase {
  assertHealth(health, maxHealth)
  if (rank === 'minion') return 1
  const ratio = health / maxHealth
  if (ratio <= .32) return 3
  if (ratio <= .66) return 2
  return 1
}

export function resolveEnemyPrimePower(
  familyId: EnemyPrimePowerFamilyId,
  rank: EnemyEncounterRank,
  health: number,
  maxHealth: number,
): EnemyPrimePowerCast {
  const definition = ENEMY_PRIME_POWERS[familyId]
  if (!definition) throw new RangeError(`Unknown enemy prime family: ${String(familyId)}`)
  const phase = getEnemyBossPhase(health, maxHealth, rank)
  const phaseIndex = phase - 1
  const boss = rank !== 'minion'
  const finalBoss = rank === 'final-boss'
  const speed = 68 + phaseIndex * 10 + (boss ? 8 : 0) + (finalBoss ? 5 : 0)
  const cooldownMs = rank === 'minion'
    ? 1_780
    : rank === 'area-boss'
      ? [2_600, 2_400, 2_200][phaseIndex]
      : [2_850, 2_600, 2_350][phaseIndex]
  const telegraphMs = rank === 'minion'
    ? 520
    : rank === 'area-boss'
      ? [1_080, 1_000, 920][phaseIndex]
      : [1_160, 1_060, 960][phaseIndex]
  const cacheKey = `${familyId}:${rank}:${phase}`
  const cached = primePowerCastCache.get(cacheKey)
  if (cached) return cached

  const cast = Object.freeze({
    ...definition,
    phase,
    projectileCount: PHASE_PROJECTILES[familyId][phaseIndex],
    projectileSpeed: speed,
    projectileDamage: phase === 3 || finalBoss ? 2 : 1,
    spreadRadians: familyId === 'eratosthenes-sieve'
      ? .28
      : familyId === 'twin-primes' || familyId === 'goldbach' ? .17 : .12,
    radial: definition.intent === 'burst',
    homingStrength: familyId === 'sophie-germain' ? 2.4 + phase * .9 : 0,
    angularVelocity: familyId === 'wilson' ? .55 + phase * .32 : 0,
    cooldownMs,
    telegraphMs,
    anime: resolveEnemyPrimePowerAnimePresentation(familyId, phase),
  })
  primePowerCastCache.set(cacheKey, cast)
  return cast
}

export function enemyPowerPhaseLabel(power: EnemyPrimePowerCast): string {
  return `${power.shortName} · FASE ${power.phase} · ${power.formula}`
}
