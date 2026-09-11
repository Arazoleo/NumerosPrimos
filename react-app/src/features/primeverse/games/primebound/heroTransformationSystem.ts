import {
  HERO_CLASS_IDS,
  type HeroClassId,
  type HexColor,
} from './heroClassSystem'

/** Every awakening has the same readable, balanceable lifetime. */
export const HERO_TRANSFORMATION_DURATION_MS = 40_000

export const HERO_TRANSFORMATION_CLASS_IDS = HERO_CLASS_IDS

export type HeroTransformationPhase =
  | 'awakening'
  | 'ascended'
  | 'waning'
  | 'expired'

export type HeroTransformationAuraStyle =
  | 'prime-blade-constellation'
  | 'rsa-key-mandala'
  | 'modular-residue-comet'
  | 'mersenne-seraph-crown'
  | 'mobius-shadow-lattice'
  | 'goldbach-twin-sun'
  | 'eratosthenes-forge-grid'
  | 'elliptic-curve-oracle'

export type HeroTransformationSilhouette =
  | 'armored-prime-titan'
  | 'cipher-empress'
  | 'residue-horizon-hunter'
  | 'thirty-one-winged-arcanist'
  | 'mobius-null-assassin'
  | 'goldbach-paired-colossus'
  | 'sieve-prime-engineer'
  | 'elliptic-infinity-seer'

export type HeroTransformationCinematicStyle =
  | 'sword-sky-split'
  | 'dual-key-decryption'
  | 'horizon-orbit-break'
  | 'thirty-one-star-genesis'
  | 'mobius-inversion-vanish'
  | 'goldbach-even-world-break'
  | 'sieve-composite-erasure'
  | 'elliptic-point-at-infinity'

export interface HeroTransformationPalette {
  readonly primary: HexColor
  readonly secondary: HexColor
  readonly energy: HexColor
  readonly auraCore: HexColor
  readonly eyeGlow: HexColor
  readonly shadow: HexColor
  readonly flash: HexColor
}

export interface HeroTransformationAura {
  readonly style: HeroTransformationAuraStyle
  readonly glyph: string
  readonly particleGlyphs: readonly string[]
  readonly layers: number
  readonly pulseHz: number
  readonly radiusMultiplier: number
  readonly trailLength: number
}

export interface HeroTransformationIdentity {
  readonly silhouette: HeroTransformationSilhouette
  readonly costume: string
  readonly weaponManifestation: string
  readonly halo: string
  readonly screenMotif: string
}

/** Multipliers are applied on top of the selected hero class values. */
export interface HeroTransformationModifiers {
  readonly damageMultiplier: number
  readonly movementSpeedMultiplier: number
  readonly cooldownMultiplier: number
  readonly damageTakenMultiplier: number
  readonly rangeMultiplier: number
  readonly ultimateChargeMultiplier: number
}

interface TransformationEffectBase {
  readonly name: string
  readonly description: string
}

export interface IrreducibleCounterEffect extends TransformationEffectBase {
  readonly id: 'irreducible-counter'
  readonly parryWindowMultiplier: number
  readonly reflectedDamageMultiplier: number
  readonly guaranteedGuards: number
}

export interface RsaKeyOverflowEffect extends TransformationEffectBase {
  readonly id: 'rsa-key-overflow'
  readonly simultaneousMarks: number
  readonly detonationDamageMultiplier: number
  readonly chainRadius: number
}

export interface ModularResidueStepEffect extends TransformationEffectBase {
  readonly id: 'modular-residue-step'
  readonly dashInvulnerabilityMs: number
  readonly echoShots: number
  readonly echoDamageMultiplier: number
}

export interface MersenneSupernovaEffect extends TransformationEffectBase {
  readonly id: 'mersenne-supernova'
  readonly pulseIntervalMs: number
  readonly novaProjectiles: 31
  readonly novaDamageMultiplier: number
}

export interface MobiusAfterimageEffect extends TransformationEffectBase {
  readonly id: 'mobius-afterimage'
  readonly dashEchoDamageMultiplier: number
  readonly dashEchoRadius: number
}

export interface GoldbachOverdriveEffect extends TransformationEffectBase {
  readonly id: 'goldbach-overdrive'
  readonly missingHealthDamageMultiplier: number
  readonly impactRadius: number
}

export interface SieveAutoforgeEffect extends TransformationEffectBase {
  readonly id: 'sieve-autoforge'
  readonly pulseIntervalMs: number
  readonly turretDamageMultiplier: number
}

export interface EllipticApotheosisEffect extends TransformationEffectBase {
  readonly id: 'elliptic-apotheosis'
  readonly orbIntervalMs: number
  readonly orbCount: number
}

export type HeroTransformationUniqueEffect =
  | IrreducibleCounterEffect
  | RsaKeyOverflowEffect
  | ModularResidueStepEffect
  | MersenneSupernovaEffect
  | MobiusAfterimageEffect
  | GoldbachOverdriveEffect
  | SieveAutoforgeEffect
  | EllipticApotheosisEffect

export interface HeroTransformationCinematic {
  readonly style: HeroTransformationCinematicStyle
  readonly durationMs: number
  readonly reducedMotionDurationMs: number
  readonly impactAtMs: number
  readonly hitStopMs: number
  readonly peakZoom: number
  readonly maxDarkness: number
  readonly shakeAmplitude: number
  readonly rayCount: number
  readonly afterimageCount: number
  readonly openingLine: string
  readonly releaseLine: string
  readonly aftermathLine: string
}

export interface HeroTransformationDefinition {
  readonly classId: HeroClassId
  readonly name: string
  readonly title: string
  readonly battleCry: string
  readonly formula: string
  readonly description: string
  readonly palette: HeroTransformationPalette
  readonly aura: HeroTransformationAura
  readonly identity: HeroTransformationIdentity
  readonly modifiers: HeroTransformationModifiers
  readonly uniqueEffect: HeroTransformationUniqueEffect
  readonly cinematic: HeroTransformationCinematic
}

export interface HeroTransformationState {
  readonly classId: HeroClassId
  readonly startedAtMs: number
  readonly expiresAtMs: number
  readonly durationMs: typeof HERO_TRANSFORMATION_DURATION_MS
}

export interface HeroTransformationProgress {
  readonly classId: HeroClassId
  readonly phase: HeroTransformationPhase
  readonly active: boolean
  readonly expired: boolean
  readonly elapsedMs: number
  readonly remainingMs: number
  /** Normalized lifetime progress from zero to one. */
  readonly progress: number
}

function freezeDefinition(
  definition: HeroTransformationDefinition,
): HeroTransformationDefinition {
  return Object.freeze({
    ...definition,
    palette: Object.freeze({ ...definition.palette }),
    aura: Object.freeze({
      ...definition.aura,
      particleGlyphs: Object.freeze([...definition.aura.particleGlyphs]),
    }),
    identity: Object.freeze({ ...definition.identity }),
    modifiers: Object.freeze({ ...definition.modifiers }),
    uniqueEffect: Object.freeze({ ...definition.uniqueEffect }),
    cinematic: Object.freeze({ ...definition.cinematic }),
  })
}

export const HERO_TRANSFORMATIONS: Readonly<
  Record<HeroClassId, HeroTransformationDefinition>
> = Object.freeze({
  'prime-warrior': freezeDefinition({
    classId: 'prime-warrior',
    name: 'Ascensão Irredutível',
    title: 'O Primo que Não se Parte',
    battleCry: 'Minha lâmina não se fatora — ASCENSÃO IRREDUTÍVEL!',
    formula: 'p | ab ⇒ p | a ∨ p | b',
    description: 'Cael se torna uma fortaleza ofensiva: bloqueia, devolve e rompe de frente.',
    palette: {
      primary: '#f2c15c', secondary: '#8c2638', energy: '#63edff',
      auraCore: '#fff5a8', eyeGlow: '#ff3b30', shadow: '#160b13', flash: '#fffbd6',
    },
    aura: {
      style: 'prime-blade-constellation',
      glyph: 'p ∤ 1',
      particleGlyphs: ['2', '3', '5', '7', '11', '13'],
      layers: 3,
      pulseHz: 2.3,
      radiusMultiplier: 1.34,
      trailLength: 7,
    },
    identity: {
      silhouette: 'armored-prime-titan',
      costume: 'Armadura negra rachada por veios de ouro e um manto vermelho em lâminas.',
      weaponManifestation: 'Espadão prismático formado por seis primos orbitais.',
      halo: 'Hexágono incompleto de números indivisíveis.',
      screenMotif: 'Cortes dourados verticais dividem tudo, menos o guerreiro.',
    },
    modifiers: {
      damageMultiplier: 1.52,
      movementSpeedMultiplier: 1.12,
      cooldownMultiplier: .82,
      damageTakenMultiplier: .66,
      rangeMultiplier: 1.12,
      ultimateChargeMultiplier: 1.15,
    },
    uniqueEffect: {
      id: 'irreducible-counter',
      name: 'Contraexemplo Impossível',
      description: 'As primeiras guardas são perfeitas e devolvem o golpe como uma prova por contradição.',
      parryWindowMultiplier: 1.8,
      reflectedDamageMultiplier: 1.55,
      guaranteedGuards: 3,
    },
    cinematic: {
      style: 'sword-sky-split',
      durationMs: 2_240,
      reducedMotionDurationMs: 920,
      impactAtMs: 1_380,
      hitStopMs: 180,
      peakZoom: 1.24,
      maxDarkness: .78,
      shakeAmplitude: 15,
      rayCount: 13,
      afterimageCount: 6,
      openingLine: 'Dois. Três. Cinco. Nenhum se parte.',
      releaseLine: 'A prova está na minha lâmina!',
      aftermathLine: 'Irredutível.',
    },
  }),
  'rsa-cryptographer': freezeDefinition({
    classId: 'rsa-cryptographer',
    name: 'Imperatriz das Duas Chaves',
    title: 'A Cifra Além da Fatoração',
    battleCry: 'Chave pública. Chave secreta. O mundo agora é meu código!',
    formula: 'c ≡ mᵉ (mod pq)',
    description: 'Ada sobrecarrega a rede RSA, espalha marcas e detona cadeias inteiras à distância.',
    palette: {
      primary: '#72ffe0', secondary: '#675cff', energy: '#b9fff2',
      auraCore: '#ffffff', eyeGlow: '#ff64d8', shadow: '#090e2a', flash: '#ddfff8',
    },
    aura: {
      style: 'rsa-key-mandala',
      glyph: 'n = pq',
      particleGlyphs: ['p', 'q', 'e', 'd', 'φ', 'n'],
      layers: 4,
      pulseHz: 3.1,
      radiusMultiplier: 1.48,
      trailLength: 5,
    },
    identity: {
      silhouette: 'cipher-empress',
      costume: 'Sobretudo violeta de circuitos luminosos, coroa binária e luvas de chave.',
      weaponManifestation: 'Dois discos-chave, público e privado, ligados por fitas de bits.',
      halo: 'Mandala assimétrica construída por p, q e o módulo n.',
      screenMotif: 'Blocos cifrados se abrem em cascata como vitrais digitais.',
    },
    modifiers: {
      damageMultiplier: 1.28,
      movementSpeedMultiplier: 1.16,
      cooldownMultiplier: .56,
      damageTakenMultiplier: .84,
      rangeMultiplier: 1.48,
      ultimateChargeMultiplier: 1.38,
    },
    uniqueEffect: {
      id: 'rsa-key-overflow',
      name: 'Overflow de Chaves',
      description: 'Marcas p e q saltam entre alvos; pares completos detonam uma quebra de chave em cadeia.',
      simultaneousMarks: 8,
      detonationDamageMultiplier: 1.72,
      chainRadius: 54,
    },
    cinematic: {
      style: 'dual-key-decryption',
      durationMs: 2_420,
      reducedMotionDurationMs: 980,
      impactAtMs: 1_520,
      hitStopMs: 150,
      peakZoom: 1.2,
      maxDarkness: .72,
      shakeAmplitude: 11,
      rayCount: 16,
      afterimageCount: 8,
      openingLine: 'Fatores encontrados. Segredo confirmado.',
      releaseLine: 'Decodificação imperial — RSA!',
      aftermathLine: 'Nunca confie numa chave composta.',
    },
  }),
  'modular-ranger': freezeDefinition({
    classId: 'modular-ranger',
    name: 'Horizonte dos Resíduos',
    title: 'A Flecha que Retorna ao Um',
    battleCry: 'Atravesse todos os módulos — e retorne ao ponto de origem!',
    formula: 'a^φ(n) ≡ 1 (mod n)',
    description: 'A patrulheira domina mobilidade, ecos de disparo e passos intocáveis entre resíduos.',
    palette: {
      primary: '#ff6f91', secondary: '#253b93', energy: '#73e8ff',
      auraCore: '#fff7d1', eyeGlow: '#59fff1', shadow: '#0b132c', flash: '#ffe9f1',
    },
    aura: {
      style: 'modular-residue-comet',
      glyph: 'a ≡ r mod n',
      particleGlyphs: ['0', '1', 'r', 'n', 'φ', '≡'],
      layers: 2,
      pulseHz: 4.2,
      radiusMultiplier: 1.22,
      trailLength: 13,
    },
    identity: {
      silhouette: 'residue-horizon-hunter',
      costume: 'Casaco curto azul-noite, cachecol coral infinito e grevas de órbita modular.',
      weaponManifestation: 'Arco circular sem corda que fecha cada disparo num anel de resíduos.',
      halo: 'Ponteiro de congruência girando sobre um mostrador de n posições.',
      screenMotif: 'Linhas de horizonte repetem a heroína em ecos separados por um módulo.',
    },
    modifiers: {
      damageMultiplier: 1.34,
      movementSpeedMultiplier: 1.42,
      cooldownMultiplier: .7,
      damageTakenMultiplier: .9,
      rangeMultiplier: 1.32,
      ultimateChargeMultiplier: 1.2,
    },
    uniqueEffect: {
      id: 'modular-residue-step',
      name: 'Passo de Resíduo Zero',
      description: 'Cada esquiva atravessa o dano, enquanto todo disparo se divide em ecos modulares.',
      dashInvulnerabilityMs: 260,
      echoShots: 3,
      echoDamageMultiplier: .42,
    },
    cinematic: {
      style: 'horizon-orbit-break',
      durationMs: 2_080,
      reducedMotionDurationMs: 840,
      impactAtMs: 1_260,
      hitStopMs: 120,
      peakZoom: 1.18,
      maxDarkness: .64,
      shakeAmplitude: 9,
      rayCount: 11,
      afterimageCount: 13,
      openingLine: 'Zero. Um. Todo caminho se repete.',
      releaseLine: 'Teorema do horizonte — dispare!',
      aftermathLine: 'Resto zero. Alvo nenhum.',
    },
  }),
  'mersenne-arcanist': freezeDefinition({
    classId: 'mersenne-arcanist',
    name: 'Serafim de Mersenne',
    title: 'O Arquimago da Trigésima Primeira Estrela',
    battleCry: 'Duas potências erguem o céu. Menos uma... e nasce uma estrela!',
    formula: 'Mₚ = 2ᵖ − 1',
    description: 'O arcanista aceita o risco de uma forma frágil para invocar o maior dano em área.',
    palette: {
      primary: '#ff9d4d', secondary: '#7135b8', energy: '#fff06a',
      auraCore: '#ffffff', eyeGlow: '#ff382e', shadow: '#180920', flash: '#fff4c2',
    },
    aura: {
      style: 'mersenne-seraph-crown',
      glyph: '2ᵖ−1',
      particleGlyphs: ['3', '7', '31', '127', '8191'],
      layers: 5,
      pulseHz: 2.8,
      radiusMultiplier: 1.62,
      trailLength: 9,
    },
    identity: {
      silhouette: 'thirty-one-winged-arcanist',
      costume: 'Manto cósmico laranja e violeta com constelações de expoentes primos.',
      weaponManifestation: 'Cajado-estrela cercado por 31 fragmentos solares numerados.',
      halo: 'Coroa quebrada de Mersenne com cinco asas de fogo geométrico.',
      screenMotif: 'Um firmamento de potências de dois perde uma estrela e entra em supernova.',
    },
    modifiers: {
      damageMultiplier: 1.68,
      movementSpeedMultiplier: 1.06,
      cooldownMultiplier: .78,
      damageTakenMultiplier: 1.04,
      rangeMultiplier: 1.4,
      ultimateChargeMultiplier: 1.24,
    },
    uniqueEffect: {
      id: 'mersenne-supernova',
      name: 'Supernova 31',
      description: 'Ondas periódicas liberam 31 fragmentos; poder extremo exige permanecer vulnerável.',
      pulseIntervalMs: 7_000,
      novaProjectiles: 31,
      novaDamageMultiplier: .34,
    },
    cinematic: {
      style: 'thirty-one-star-genesis',
      durationMs: 2_720,
      reducedMotionDurationMs: 1_040,
      impactAtMs: 1_700,
      hitStopMs: 210,
      peakZoom: 1.3,
      maxDarkness: .84,
      shakeAmplitude: 17,
      rayCount: 31,
      afterimageCount: 7,
      openingLine: 'Três. Sete. Trinta e um.',
      releaseLine: 'Coroa celeste de Mersenne — SUPERNOVA!',
      aftermathLine: 'Menos um... foi o bastante.',
    },
  }),
  'mobius-assassin': freezeDefinition({
    classId: 'mobius-assassin',
    name: 'Espectro da Inversão de Möbius',
    title: 'A Sombra que Apaga Quadrados',
    battleCry: 'Um fator repetido basta para zerar seu destino — INVERSÃO DE MÖBIUS!',
    formula: 'μ(n) = 0 se p² | n; caso contrário, (−1)ᵏ',
    description: 'A assassina alterna sinais, atravessa o campo e transforma fatores quadrados em pontos cegos.',
    palette: {
      primary: '#b58cff', secondary: '#173f35', energy: '#70f0ad',
      auraCore: '#efffe8', eyeGlow: '#d2ff4d', shadow: '#10091c', flash: '#e8ddff',
    },
    aura: {
      style: 'mobius-shadow-lattice',
      glyph: 'μ(n)',
      particleGlyphs: ['−1', '0', '+1', 'μ', 'p²'],
      layers: 3,
      pulseHz: 4.4,
      radiusMultiplier: 1.2,
      trailLength: 15,
    },
    identity: {
      silhouette: 'mobius-null-assassin',
      costume: 'Manto violeta segmentado por sinais verdes e máscara rachada no valor zero.',
      weaponManifestation: 'Duas adagas de inversão, uma positiva e outra negativa, que trocam de sinal.',
      halo: 'Fita de Möbius formada por divisores livres de quadrados.',
      screenMotif: 'Sombras −1 e +1 convergem; todo quadrado perfeito desaparece no zero.',
    },
    modifiers: {
      damageMultiplier: 1.46,
      movementSpeedMultiplier: 1.45,
      cooldownMultiplier: .62,
      damageTakenMultiplier: .78,
      rangeMultiplier: 1.28,
      ultimateChargeMultiplier: 1.25,
    },
    uniqueEffect: {
      id: 'mobius-afterimage',
      name: 'Pós-imagem de Möbius',
      description: 'Cada avanço dobra a trajetória e faz a pós-imagem explodir no sinal oposto.',
      dashEchoDamageMultiplier: .48,
      dashEchoRadius: 64,
    },
    cinematic: {
      style: 'mobius-inversion-vanish',
      durationMs: 2_160,
      reducedMotionDurationMs: 860,
      impactAtMs: 1_320,
      hitStopMs: 140,
      peakZoom: 1.22,
      maxDarkness: .76,
      shakeAmplitude: 12,
      rayCount: 11,
      afterimageCount: 9,
      openingLine: 'Menos um. Zero. Mais um. Escolha seu sinal.',
      releaseLine: 'Inversão absoluta — desapareça!',
      aftermathLine: 'Seu quadrado não deixou vestígio.',
    },
  }),
  'goldbach-berserker': freezeDefinition({
    classId: 'goldbach-berserker',
    name: 'Titã da Conjectura Dourada',
    title: 'O Punho dos Dois Primos',
    battleCry: 'Todo número par encontrará dois punhos primos — CONJECTURA DOURADA!',
    formula: '2n = p + q',
    description: 'O berserker converte cada impacto em dois primos cuja soma explode com força par.',
    palette: {
      primary: '#ffd166', secondary: '#a13d25', energy: '#ff6b4a',
      auraCore: '#fff4be', eyeGlow: '#ff3322', shadow: '#21080b', flash: '#fff0c2',
    },
    aura: {
      style: 'goldbach-twin-sun',
      glyph: 'p+q',
      particleGlyphs: ['3+5', '5+7', '7+11', '13+17'],
      layers: 4,
      pulseHz: 2.6,
      radiusMultiplier: 1.5,
      trailLength: 8,
    },
    identity: {
      silhouette: 'goldbach-paired-colossus',
      costume: 'Armadura rubra sem mangas, placas douradas pares e correntes marcadas por somas.',
      weaponManifestation: 'Manoplas-sóis que carregam um primo diferente em cada punho.',
      halo: 'Dois discos flamejantes cuja soma forma um círculo par completo.',
      screenMotif: 'O horizonte se divide em dois primos e colide novamente como um número par.',
    },
    modifiers: {
      damageMultiplier: 1.62,
      movementSpeedMultiplier: 1.18,
      cooldownMultiplier: .78,
      damageTakenMultiplier: .65,
      rangeMultiplier: 1.18,
      ultimateChargeMultiplier: 1.12,
    },
    uniqueEffect: {
      id: 'goldbach-overdrive',
      name: 'Sobrecarga do Par Dourado',
      description: 'A vida perdida alimenta os dois punhos primos e amplia o impacto que fecha cada soma.',
      missingHealthDamageMultiplier: 1.8,
      impactRadius: 112,
    },
    cinematic: {
      style: 'goldbach-even-world-break',
      durationMs: 2_460,
      reducedMotionDurationMs: 980,
      impactAtMs: 1_520,
      hitStopMs: 200,
      peakZoom: 1.28,
      maxDarkness: .8,
      shakeAmplitude: 16,
      rayCount: 14,
      afterimageCount: 6,
      openingLine: 'Um primo em cada mão. Uma soma inevitável.',
      releaseLine: 'Conjectura de Goldbach — colisão par!',
      aftermathLine: 'Dois primos. Nenhuma metade restante.',
    },
  }),
  'sieve-engineer': freezeDefinition({
    classId: 'sieve-engineer',
    name: 'Arquiteta do Crivo Infinito',
    title: 'A Máquina que Risca Compostos',
    battleCry: 'Ativem todas as linhas do crivo — nenhum composto passará pela grade!',
    formula: 'p ≤ √n ⇒ risque 2p, 3p, 4p, …',
    description: 'A engenheira ergue uma oficina orbital que marca múltiplos e fortalece tudo que sobrevive ao crivo.',
    palette: {
      primary: '#b9f34a', secondary: '#5a3823', energy: '#e9a45f',
      auraCore: '#f4ffd2', eyeGlow: '#adff2f', shadow: '#131a08', flash: '#f5ffc9',
    },
    aura: {
      style: 'eratosthenes-forge-grid',
      glyph: '√n',
      particleGlyphs: ['2', '3', '5', '7', '×', '✓'],
      layers: 5,
      pulseHz: 3.4,
      radiusMultiplier: 1.46,
      trailLength: 6,
    },
    identity: {
      silhouette: 'sieve-prime-engineer',
      costume: 'Exotraje verde e cobre com braços mecânicos que desenham linhas de múltiplos.',
      weaponManifestation: 'Canhão-compasso cercado por torres autônomas numeradas 2, 3, 5 e 7.',
      halo: 'Grade mecânica que apaga células compostas e ilumina as posições primas.',
      screenMotif: 'Fileiras numéricas cobrem o campo enquanto riscos luminosos eliminam múltiplos.',
    },
    modifiers: {
      damageMultiplier: 1.3,
      movementSpeedMultiplier: 1.12,
      cooldownMultiplier: .52,
      damageTakenMultiplier: .82,
      rangeMultiplier: 1.5,
      ultimateChargeMultiplier: 1.35,
    },
    uniqueEffect: {
      id: 'sieve-autoforge',
      name: 'Autoforja de Eratóstenes',
      description: 'A oficina fabrica torres em pulsos e calibra seus disparos contra células compostas.',
      pulseIntervalMs: 2_800,
      turretDamageMultiplier: 1.55,
    },
    cinematic: {
      style: 'sieve-composite-erasure',
      durationMs: 2_300,
      reducedMotionDurationMs: 900,
      impactAtMs: 1_450,
      hitStopMs: 130,
      peakZoom: 1.18,
      maxDarkness: .68,
      shakeAmplitude: 10,
      rayCount: 17,
      afterimageCount: 7,
      openingLine: 'Dois. Três. Cinco. Iniciando eliminação.',
      releaseLine: 'Crivo infinito — risquem os compostos!',
      aftermathLine: 'Somente os primos permaneceram na grade.',
    },
  }),
  'elliptic-oracle': freezeDefinition({
    classId: 'elliptic-oracle',
    name: 'Oráculo do Ponto no Infinito',
    title: 'A Voz de Todas as Curvas',
    battleCry: 'Somem os pontos, dobrem o destino — a curva termina somente no infinito!',
    formula: 'y² ≡ x³ + ax + b (mod p)',
    description: 'A oráculo prevê órbitas elípticas, multiplica pontos e curva ataques até o destino escolhido.',
    palette: {
      primary: '#73d9ff', secondary: '#672d78', energy: '#ff70c5',
      auraCore: '#f1fbff', eyeGlow: '#ff8cda', shadow: '#100b24', flash: '#e5f8ff',
    },
    aura: {
      style: 'elliptic-curve-oracle',
      glyph: 'P+Q',
      particleGlyphs: ['P', 'Q', '2P', '3P', '𝒪'],
      layers: 4,
      pulseHz: 2.9,
      radiusMultiplier: 1.44,
      trailLength: 11,
    },
    identity: {
      silhouette: 'elliptic-infinity-seer',
      costume: 'Vestes azul-celeste e magenta bordadas por curvas que se cruzam sem tocar o chão.',
      weaponManifestation: 'Astrolábio flutuante que soma pontos e dispara tangentes luminosas.',
      halo: 'Duas curvas elípticas abertas em torno do símbolo do ponto no infinito.',
      screenMotif: 'Pontos previstos percorrem arcos celestes e convergem além da moldura.',
    },
    modifiers: {
      damageMultiplier: 1.56,
      movementSpeedMultiplier: 1.1,
      cooldownMultiplier: .68,
      damageTakenMultiplier: .92,
      rangeMultiplier: 1.46,
      ultimateChargeMultiplier: 1.4,
    },
    uniqueEffect: {
      id: 'elliptic-apotheosis',
      name: 'Apoteose do Ponto Ômega',
      description: 'Orbes previstos percorrem a curva em intervalos regulares e convergem no ponto no infinito.',
      orbIntervalMs: 1_800,
      orbCount: 7,
    },
    cinematic: {
      style: 'elliptic-point-at-infinity',
      durationMs: 2_640,
      reducedMotionDurationMs: 1_020,
      impactAtMs: 1_640,
      hitStopMs: 170,
      peakZoom: 1.25,
      maxDarkness: .78,
      shakeAmplitude: 13,
      rayCount: 19,
      afterimageCount: 10,
      openingLine: 'Ponto P. Ponto Q. A tangente já conhece o fim.',
      releaseLine: 'Curva do destino — ponto no infinito!',
      aftermathLine: 'Toda órbita retornou à origem prevista.',
    },
  }),
})

function isHeroClassId(value: string): value is HeroClassId {
  return Object.prototype.hasOwnProperty.call(HERO_TRANSFORMATIONS, value)
}

function assertFiniteTime(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative time.`)
  }
}

function assertTransformationState(state: HeroTransformationState): void {
  if (!isHeroClassId(state.classId)) {
    throw new RangeError(`Unknown hero transformation class: ${String(state.classId)}`)
  }
  assertFiniteTime(state.startedAtMs, 'startedAtMs')
  assertFiniteTime(state.expiresAtMs, 'expiresAtMs')
  if (
    state.durationMs !== HERO_TRANSFORMATION_DURATION_MS
    // Compare against the same addition used by startHeroTransformation. A
    // subtraction can introduce a tiny IEEE-754 drift for fractional RAF
    // clocks (for example 40_000.00000000003) and used to stop the game loop.
    || state.expiresAtMs !== state.startedAtMs + HERO_TRANSFORMATION_DURATION_MS
  ) {
    throw new RangeError('Invalid hero transformation duration.')
  }
}

function resolveTimes(
  state: HeroTransformationState,
  nowMs: number,
): { elapsedMs: number; remainingMs: number } {
  assertTransformationState(state)
  assertFiniteTime(nowMs, 'nowMs')
  if (nowMs < state.startedAtMs) {
    throw new RangeError('nowMs cannot be earlier than the transformation start.')
  }
  return {
    elapsedMs: Math.min(state.durationMs, nowMs - state.startedAtMs),
    remainingMs: Math.max(0, state.expiresAtMs - nowMs),
  }
}

export function resolveHeroTransformationDefinition(
  classId: HeroClassId,
): HeroTransformationDefinition {
  if (!isHeroClassId(classId)) {
    throw new RangeError(`Unknown hero transformation class: ${String(classId)}`)
  }
  return HERO_TRANSFORMATIONS[classId]
}

export function startHeroTransformation(
  classId: HeroClassId,
  startedAtMs: number,
): HeroTransformationState {
  resolveHeroTransformationDefinition(classId)
  assertFiniteTime(startedAtMs, 'startedAtMs')
  const expiresAtMs = startedAtMs + HERO_TRANSFORMATION_DURATION_MS
  if (!Number.isFinite(expiresAtMs)) {
    throw new RangeError('Transformation expiration must be finite.')
  }
  return Object.freeze({
    classId,
    startedAtMs,
    expiresAtMs,
    durationMs: HERO_TRANSFORMATION_DURATION_MS,
  })
}

export function getHeroTransformationElapsedMs(
  state: HeroTransformationState,
  nowMs: number,
): number {
  return resolveTimes(state, nowMs).elapsedMs
}

export function getHeroTransformationRemainingMs(
  state: HeroTransformationState,
  nowMs: number,
): number {
  return resolveTimes(state, nowMs).remainingMs
}

export function isHeroTransformationExpired(
  state: HeroTransformationState,
  nowMs: number,
): boolean {
  resolveTimes(state, nowMs)
  return nowMs >= state.expiresAtMs
}

export function isHeroTransformationActive(
  state: HeroTransformationState,
  nowMs: number,
): boolean {
  return !isHeroTransformationExpired(state, nowMs)
}

export function getHeroTransformationProgress(
  state: HeroTransformationState,
  nowMs: number,
): HeroTransformationProgress {
  const { elapsedMs, remainingMs } = resolveTimes(state, nowMs)
  const expired = nowMs >= state.expiresAtMs
  const progress = elapsedMs / state.durationMs
  const cinematicDurationMs = resolveHeroTransformationDefinition(state.classId)
    .cinematic.durationMs

  let phase: HeroTransformationPhase = 'ascended'
  if (expired) phase = 'expired'
  else if (elapsedMs < cinematicDurationMs) phase = 'awakening'
  else if (progress >= .8) phase = 'waning'

  return Object.freeze({
    classId: state.classId,
    phase,
    active: !expired,
    expired,
    elapsedMs,
    remainingMs,
    progress,
  })
}
