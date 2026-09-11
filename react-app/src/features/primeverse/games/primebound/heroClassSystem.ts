import type { CombatCooldownId } from './combatSystem'
import type { CinematicActionId } from './cinematicSystem'

/**
 * Pure, presentation-friendly definitions for Primebound's playable heroes.
 *
 * Combat continues to use the canonical action IDs from combatSystem for
 * cooldowns, unlock rules and damage budgets. classCombatSystem owns how each
 * class delivers those actions in the world.
 */

export const HERO_CLASS_IDS = [
  'prime-warrior',
  'rsa-cryptographer',
  'modular-ranger',
  'mersenne-arcanist',
  'mobius-assassin',
  'goldbach-berserker',
  'sieve-engineer',
  'elliptic-oracle',
] as const

export type HeroClassId = (typeof HERO_CLASS_IDS)[number]

export const DEFAULT_HERO_CLASS_ID: HeroClassId = 'prime-warrior'

export const HERO_ARCHETYPES = [
  'warrior',
  'cryptographer',
  'ranger',
  'arcanist',
  'assassin',
  'berserker',
  'engineer',
  'oracle',
] as const

export type HeroArchetype = (typeof HERO_ARCHETYPES)[number]
export type HeroGender = 'man' | 'woman'
export type HexColor = `#${string}`

export const HERO_ACTION_SLOTS = ['J', '1', '2', '3', 'Q', 'R'] as const
export type HeroActionSlot = (typeof HERO_ACTION_SLOTS)[number]

/** Keyboard slots mapped to the mechanics already implemented by the game. */
export const HERO_SLOT_ACTION_IDS = Object.freeze({
  J: 'basic-strike',
  '1': 'twin-blades',
  '2': 'sophie-chain',
  '3': 'mersenne-burst',
  Q: 'irreducible-aegis',
  R: 'prime-infinity',
} as const satisfies Readonly<Record<HeroActionSlot, CombatCooldownId>>)

export type HeroActionIdForSlot<Slot extends HeroActionSlot> =
  (typeof HERO_SLOT_ACTION_IDS)[Slot]

export const HERO_CINEMATIC_SLOTS = ['3', 'R'] as const
export type HeroCinematicSlot = (typeof HERO_CINEMATIC_SLOTS)[number]

export const HERO_CINEMATIC_ACTION_IDS = Object.freeze({
  '3': HERO_SLOT_ACTION_IDS['3'],
  R: HERO_SLOT_ACTION_IDS.R,
} as const satisfies Readonly<Record<HeroCinematicSlot, CinematicActionId>>)

export const HERO_AFFINITY_IDS = [
  'irreducibility',
  'rsa',
  'modular-arithmetic',
  'mersenne-primes',
  'mobius-inversion',
  'goldbach-conjecture',
  'eratosthenes-sieve',
  'elliptic-curves',
] as const

export type HeroAffinityId = (typeof HERO_AFFINITY_IDS)[number]
export type HeroAffinityKind = 'number-theory' | 'cryptography'

export interface HeroAffinityDefinition {
  readonly id: HeroAffinityId
  readonly kind: HeroAffinityKind
  readonly name: string
  readonly formula: string
  readonly description: string
}

export interface HeroPalette {
  readonly skin: HexColor
  readonly shadow: HexColor
  readonly primary: HexColor
  readonly secondary: HexColor
  readonly accent: HexColor
  readonly energy: HexColor
}

export interface HeroClassStats {
  readonly maxHealth: number
  readonly maxStamina: number
  readonly movementSpeed: number
}

/** Multipliers are applied to the corresponding canonical combat value. */
export interface HeroClassModifiers {
  readonly damageMultiplier: number
  readonly damageTakenMultiplier: number
  readonly cooldownMultiplier: number
  readonly ultimateChargeMultiplier: number
  readonly parryWindowMultiplier: number
  readonly rangeMultiplier: number
}

export interface HeroActionDefinition<Slot extends HeroActionSlot = HeroActionSlot> {
  readonly slot: Slot
  readonly actionId: HeroActionIdForSlot<Slot>
  readonly label: string
  readonly spokenName: string
  readonly description: string
}

export type HeroActionLoadout = {
  readonly [Slot in HeroActionSlot]: HeroActionDefinition<Slot>
}

export interface HeroCinematicLines {
  readonly charge: string
  readonly release: string
  readonly impact: string
  readonly aftermath: string
}

export interface HeroCinematicVisual {
  readonly primary: HexColor
  readonly secondary: HexColor
  readonly peakZoom: number
  readonly maxDarkness: number
  readonly shakeAmplitude: number
}

/**
 * Class-specific direction for an existing cinematic action. Timing remains in
 * cinematicSystem so there is only one timing source of truth.
 */
export interface HeroCinematicDefinition<
  Slot extends HeroCinematicSlot = HeroCinematicSlot,
> {
  readonly slot: Slot
  readonly actionId: (typeof HERO_CINEMATIC_ACTION_IDS)[Slot]
  readonly title: string
  readonly spokenName: string
  readonly motif: string
  readonly lines: HeroCinematicLines
  readonly visual: HeroCinematicVisual
}

export type HeroCinematicLoadout = {
  readonly [Slot in HeroCinematicSlot]: HeroCinematicDefinition<Slot>
}

export interface HeroClassDefinition {
  readonly id: HeroClassId
  readonly archetype: HeroArchetype
  readonly name: string
  readonly characterName: string
  readonly gender: HeroGender
  readonly pronouns: string
  readonly title: string
  readonly lore: string
  readonly affinity: HeroAffinityDefinition
  readonly palette: HeroPalette
  readonly stats: HeroClassStats
  readonly modifiers: HeroClassModifiers
  readonly actions: HeroActionLoadout
  readonly cinematics: HeroCinematicLoadout
}

interface HeroActionCopy {
  readonly label: string
  readonly spokenName: string
  readonly description: string
}

type HeroActionCopyLoadout = Readonly<Record<HeroActionSlot, HeroActionCopy>>

interface HeroCinematicCopy {
  readonly title: string
  readonly spokenName: string
  readonly motif: string
  readonly lines: HeroCinematicLines
  readonly visual: HeroCinematicVisual
}

type HeroCinematicCopyLoadout = Readonly<Record<HeroCinematicSlot, HeroCinematicCopy>>

interface HeroClassSource extends Omit<HeroClassDefinition, 'actions' | 'cinematics'> {
  readonly actions: HeroActionCopyLoadout
  readonly cinematics: HeroCinematicCopyLoadout
}

function freezeAction<Slot extends HeroActionSlot>(
  slot: Slot,
  copy: HeroActionCopy,
): HeroActionDefinition<Slot> {
  return Object.freeze({
    slot,
    actionId: HERO_SLOT_ACTION_IDS[slot],
    ...copy,
  })
}

function freezeActionLoadout(actions: HeroActionCopyLoadout): HeroActionLoadout {
  return Object.freeze({
    J: freezeAction('J', actions.J),
    '1': freezeAction('1', actions['1']),
    '2': freezeAction('2', actions['2']),
    '3': freezeAction('3', actions['3']),
    Q: freezeAction('Q', actions.Q),
    R: freezeAction('R', actions.R),
  })
}

function freezeCinematic<Slot extends HeroCinematicSlot>(
  slot: Slot,
  copy: HeroCinematicCopy,
): HeroCinematicDefinition<Slot> {
  return Object.freeze({
    slot,
    actionId: HERO_CINEMATIC_ACTION_IDS[slot],
    ...copy,
    lines: Object.freeze({ ...copy.lines }),
    visual: Object.freeze({ ...copy.visual }),
  })
}

function freezeCinematicLoadout(
  cinematics: HeroCinematicCopyLoadout,
): HeroCinematicLoadout {
  return Object.freeze({
    '3': freezeCinematic('3', cinematics['3']),
    R: freezeCinematic('R', cinematics.R),
  })
}

function defineHeroClass(source: HeroClassSource): HeroClassDefinition {
  return Object.freeze({
    ...source,
    affinity: Object.freeze({ ...source.affinity }),
    palette: Object.freeze({ ...source.palette }),
    stats: Object.freeze({ ...source.stats }),
    modifiers: Object.freeze({ ...source.modifiers }),
    actions: freezeActionLoadout(source.actions),
    cinematics: freezeCinematicLoadout(source.cinematics),
  })
}

export const HERO_CLASSES: Readonly<Record<HeroClassId, HeroClassDefinition>> =
  Object.freeze({
    'prime-warrior': defineHeroClass({
      id: 'prime-warrior',
      archetype: 'warrior',
      name: 'Guerreiro Primo',
      characterName: 'Cael',
      gender: 'man',
      pronouns: 'ele/dele',
      title: 'A Lâmina Irredutível',
      lore: 'Cael carrega uma espada forjada nas primeiras runas e enfrenta toda composição de frente.',
      affinity: {
        id: 'irreducibility',
        kind: 'number-theory',
        name: 'Irredutibilidade Prima',
        formula: 'p | ab ⇒ p | a ou p | b',
        description: 'Transforma a indivisibilidade dos primos em golpes diretos, guarda firme e ruptura.',
      },
      palette: {
        skin: '#c9916c',
        shadow: '#171119',
        primary: '#b98532',
        secondary: '#702d39',
        accent: '#f2c15c',
        energy: '#6ed7e8',
      },
      stats: { maxHealth: 12, maxStamina: 100, movementSpeed: 70 },
      modifiers: {
        damageMultiplier: 1.08,
        damageTakenMultiplier: 0.88,
        cooldownMultiplier: 1,
        ultimateChargeMultiplier: 1,
        parryWindowMultiplier: 1.05,
        rangeMultiplier: 1,
      },
      actions: {
        J: {
          label: 'Tríade 2·3·5',
          spokenName: 'Tríade Prima!',
          description: 'Encadeia três cortes; o terceiro, 5, ganha alcance e arremessa o alvo.',
        },
        '1': {
          label: 'Lâminas Gêmeas',
          spokenName: 'Lâminas Gêmeas!',
          description: 'Avança dentro do perigo e aplica dois cortes rápidos no contato.',
        },
        '2': {
          label: 'Corrente de Sophie',
          spokenName: 'Corrente de Sophie Germain!',
          description: 'Prende até três compostos e os arrasta para o alcance da espada.',
        },
        '3': {
          label: 'Ruptura de Mersenne',
          spokenName: 'Ruptura de Mersenne!',
          description: 'Faz 3, 7 e 31 explodirem em três ondas ao redor da lâmina.',
        },
        Q: {
          label: 'Guarda de Wilson',
          spokenName: 'Guarda de Wilson!',
          description: 'Apara no resto −1 do teorema de Wilson e devolve a força recebida.',
        },
        R: {
          label: 'Infinito de Euclides',
          spokenName: 'Infinito de Euclides!',
          description: 'Atravessa a linha inimiga com cinco cortes crescentes: 2, 3, 5, 7 e 11.',
        },
      },
      cinematics: {
        '3': {
          title: 'Três Ondas, Uma Ruptura',
          spokenName: 'Ruptura de Mersenne!',
          motif: 'Três anéis de aço inscrevem 3, 7 e 31 ao redor da espada.',
          lines: {
            charge: 'Ruptura...',
            release: 'De...',
            impact: 'MERSENNE!',
            aftermath: 'RUPTURA DE MERSENNE!',
          },
          visual: {
            primary: '#6ed7e8', secondary: '#f2c15c', peakZoom: 1.125,
            maxDarkness: 0.52, shakeAmplitude: 8,
          },
        },
        R: {
          title: 'A Prova Sem Fim',
          spokenName: 'Infinito de Euclides!',
          motif: 'Uma coroa de primos cresce até romper o limite da tela.',
          lines: {
            charge: 'Dois. Três. Cinco. Sete.',
            release: 'Multiplique todos e some um.',
            impact: 'INFINITO DE EUCLIDES!',
            aftermath: 'Sempre existe outro primo.',
          },
          visual: {
            primary: '#f2c15c', secondary: '#fff0a4', peakZoom: 1.25,
            maxDarkness: 0.76, shakeAmplitude: 14,
          },
        },
      },
    }),

    'rsa-cryptographer': defineHeroClass({
      id: 'rsa-cryptographer',
      archetype: 'cryptographer',
      name: 'Criptógrafa RSA',
      characterName: 'Ada',
      gender: 'woman',
      pronouns: 'ela/dela',
      title: 'A Guardiã das Duas Chaves',
      lore: 'Ada protegeu cidades inteiras com chaves públicas; agora invade os selos dos compostos.',
      affinity: {
        id: 'rsa',
        kind: 'cryptography',
        name: 'Criptografia RSA',
        formula: 'c ≡ m^e (mod n), com n = pq',
        description: 'Converte fatoração, expoentes e chaves assimétricas em controle e recargas velozes.',
      },
      palette: {
        skin: '#8f624d',
        shadow: '#10152c',
        primary: '#5268bd',
        secondary: '#282451',
        accent: '#efba70',
        energy: '#61e2c5',
      },
      stats: { maxHealth: 10, maxStamina: 110, movementSpeed: 74 },
      modifiers: {
        damageMultiplier: 0.96,
        damageTakenMultiplier: 1.04,
        cooldownMultiplier: 0.82,
        ultimateChargeMultiplier: 1.22,
        parryWindowMultiplier: 1.1,
        rangeMultiplier: 1.28,
      },
      actions: {
        J: {
          label: 'Pulso Coprimo',
          spokenName: 'Pulso Coprimo!',
          description: 'Projétil teleguiado que alterna as marcas p e q sobre o alvo.',
        },
        '1': {
          label: 'Par de Chaves',
          spokenName: 'Par de Chaves!',
          description: 'Duas chaves teleguiadas gravam p e q no mesmo inimigo.',
        },
        '2': {
          label: 'Fatoração RSA',
          spokenName: 'Fatoração RSA!',
          description: 'Detona todas as chaves gravadas; um par p × q causa ruptura máxima.',
        },
        '3': {
          label: 'Colapso de Mersenne',
          spokenName: 'Colapso de Mersenne!',
          description: 'Lança sete pacotes teleguiados que cercam alvos marcados com novos p e q.',
        },
        Q: {
          label: 'Firewall de Wilson',
          spokenName: 'Firewall de Wilson!',
          description: 'Ergue um firewall curto que devolve projéteis e grava outra chave no emissor.',
        },
        R: {
          label: 'Quebra de Euclides',
          spokenName: 'Quebra Infinita de Euclides!',
          description: 'Conecta todos os inimigos numa rede, quebra suas chaves e paralisa o campo.',
        },
      },
      cinematics: {
        '3': {
          title: 'Falha Binária',
          spokenName: 'Colapso de Mersenne!',
          motif: 'Bits ciano formam potências de dois e perdem sua última unidade.',
          lines: {
            charge: 'Expoente primo confirmado.',
            release: 'Subtraindo uma unidade da chave...',
            impact: 'COLAPSO DE MERSENNE!',
            aftermath: 'A cifra composta está aberta.',
          },
          visual: {
            primary: '#61e2c5', secondary: '#efba70', peakZoom: 1.1,
            maxDarkness: 0.58, shakeAmplitude: 7,
          },
        },
        R: {
          title: 'Chave Além do Horizonte',
          spokenName: 'Quebra Infinita de Euclides!',
          motif: 'Duas chaves orbitam um produto que sempre revela um novo primo.',
          lines: {
            charge: 'p e q não bastam.',
            release: 'O produto recebe mais um.',
            impact: 'QUEBRA INFINITA DE EUCLIDES!',
            aftermath: 'Nenhuma chave finita prende o infinito.',
          },
          visual: {
            primary: '#efba70', secondary: '#61e2c5', peakZoom: 1.2,
            maxDarkness: 0.68, shakeAmplitude: 11,
          },
        },
      },
    }),

    'modular-ranger': defineHeroClass({
      id: 'modular-ranger',
      archetype: 'ranger',
      name: 'Arqueira Modular',
      characterName: 'Nara',
      gender: 'woman',
      pronouns: 'ela/dela',
      title: 'O Olho dos Resíduos',
      lore: 'Nara lê padrões nos restos do mundo e encontra uma trajetória onde outros veem acaso.',
      affinity: {
        id: 'modular-arithmetic',
        kind: 'number-theory',
        name: 'Aritmética Modular',
        formula: 'a ≡ b (mod p)',
        description: 'Usa classes de resíduos para reposicionar, repetir disparos e evitar ataques.',
      },
      palette: {
        skin: '#704431',
        shadow: '#071b19',
        primary: '#287b70',
        secondary: '#193f58',
        accent: '#f0c95f',
        energy: '#7ff6dc',
      },
      stats: { maxHealth: 9, maxStamina: 120, movementSpeed: 82 },
      modifiers: {
        damageMultiplier: 1.02,
        damageTakenMultiplier: 1.12,
        cooldownMultiplier: 0.86,
        ultimateChargeMultiplier: 1.12,
        parryWindowMultiplier: 0.9,
        rangeMultiplier: 1.55,
      },
      actions: {
        J: {
          label: 'Flecha Unitária',
          spokenName: 'Flecha Unitária!',
          description: 'Um disparo linear rápido, preciso e indivisível.',
        },
        '1': {
          label: 'Disparo Gêmeo',
          spokenName: 'Disparo Gêmeo!',
          description: 'Duas flechas físicas abrem trajetórias paralelas sem perseguir o alvo.',
        },
        '2': {
          label: 'Trajetória de Sophie',
          spokenName: 'Trajetória de Sophie!',
          description: 'Uma flecha ricocheteia entre inimigos e marca o último ponto de impacto.',
        },
        '3': {
          label: 'Chuva de Mersenne',
          spokenName: 'Chuva de Mersenne!',
          description: 'Invoca uma chuva remota sobre a marca ou sobre o grupo mais denso.',
        },
        Q: {
          label: 'Desvio de Wilson',
          spokenName: 'Desvio de Wilson!',
          description: 'Recua com invulnerabilidade e responde imediatamente com uma flecha.',
        },
        R: {
          label: 'Horizonte de Euclides',
          spokenName: 'Horizonte de Euclides!',
          description: 'Dispara cinco flechas primas gigantes que atravessam todos no horizonte.',
        },
      },
      cinematics: {
        '3': {
          title: 'Céu de Mersenne',
          spokenName: 'Chuva de Mersenne!',
          motif: 'A mira se divide em três constelações arqueadas de 3, 7 e 31 pontos.',
          lines: {
            charge: 'Três órbitas na mira.',
            release: 'Dois elevado a p, menos um...',
            impact: 'CHUVA DE MERSENNE!',
            aftermath: 'Todos os resíduos encontraram o alvo.',
          },
          visual: {
            primary: '#7ff6dc', secondary: '#f0c95f', peakZoom: 1.14,
            maxDarkness: 0.48, shakeAmplitude: 7,
          },
        },
        R: {
          title: 'Flecha Sem Último Alvo',
          spokenName: 'Horizonte de Euclides!',
          motif: 'Uma flecha cruza uma sequência de constelações primas sem encontrar fim.',
          lines: {
            charge: 'Marque todos os primos conhecidos.',
            release: 'Agora multiplique e avance um passo.',
            impact: 'HORIZONTE DE EUCLIDES!',
            aftermath: 'Ainda existe outro alvo.',
          },
          visual: {
            primary: '#f0c95f', secondary: '#7ff6dc', peakZoom: 1.22,
            maxDarkness: 0.62, shakeAmplitude: 10,
          },
        },
      },
    }),

    'mersenne-arcanist': defineHeroClass({
      id: 'mersenne-arcanist',
      archetype: 'arcanist',
      name: 'Arcanista de Mersenne',
      characterName: 'Noa',
      gender: 'man',
      pronouns: 'ele/dele',
      title: 'O Conjurador das Potências',
      lore: 'Noa é um mago que escuta as potências de dois como acordes e convoca os raros primos ocultos entre elas.',
      affinity: {
        id: 'mersenne-primes',
        kind: 'number-theory',
        name: 'Primos de Mersenne',
        formula: 'Mₚ = 2^p − 1',
        description: 'Troca resistência física por alto dano, carga arcana e janelas amplas de conjuração.',
      },
      palette: {
        skin: '#d4a27a',
        shadow: '#18102c',
        primary: '#714cb5',
        secondary: '#3c255f',
        accent: '#ef78b7',
        energy: '#88dfff',
      },
      stats: { maxHealth: 10, maxStamina: 90, movementSpeed: 68 },
      modifiers: {
        damageMultiplier: 1.18,
        damageTakenMultiplier: 1.08,
        cooldownMultiplier: 1.08,
        ultimateChargeMultiplier: 1.16,
        parryWindowMultiplier: 1.2,
        rangeMultiplier: 1.22,
      },
      actions: {
        J: {
          label: 'Glifo Unitário',
          spokenName: 'Glifo Unitário!',
          description: 'Inscreve no chão um glifo armado que detona quando um inimigo pisa nele.',
        },
        '1': {
          label: 'Ecos Gêmeos',
          spokenName: 'Ecos Gêmeos!',
          description: 'Planta dois glifos persistentes em posições separadas diante do conjurador.',
        },
        '2': {
          label: 'Transmutação de Sophie',
          spokenName: 'Transmutação de Sophie!',
          description: 'Consome todos os glifos ativos e detona cada posição simultaneamente.',
        },
        '3': {
          label: 'Supernova de Mersenne',
          spokenName: 'Supernova de Mersenne!',
          description: 'Cria uma supernova remota com três pulsos que desaceleram quem ficar nela.',
        },
        Q: {
          label: 'Círculo de Wilson',
          spokenName: 'Círculo de Wilson!',
          description: 'A ward absorve projéteis próximos e transforma cada um em um novo glifo.',
        },
        R: {
          label: 'Constelação Infinita',
          spokenName: 'Constelação Infinita de Euclides!',
          description: 'Cobre o mapa com uma constelação persistente de cinco pulsos encadeados.',
        },
      },
      cinematics: {
        '3': {
          title: 'Nascimento de Mersenne',
          spokenName: 'Supernova de Mersenne!',
          motif: 'Polígonos violeta colapsam em três estrelas marcadas por 3, 7 e 31.',
          lines: {
            charge: 'Ouçam as potências de dois.',
            release: 'Retirem a última unidade...',
            impact: 'SUPERNOVA DE MERSENNE!',
            aftermath: 'Uma estrela prima permanece.',
          },
          visual: {
            primary: '#88dfff', secondary: '#ef78b7', peakZoom: 1.2,
            maxDarkness: 0.7, shakeAmplitude: 10,
          },
        },
        R: {
          title: 'Constelação Sem Fim',
          spokenName: 'Constelação Infinita de Euclides!',
          motif: 'Cada estrela prima conecta-se a uma nova estrela além da moldura.',
          lines: {
            charge: 'Trace a constelação conhecida.',
            release: 'Multiplique suas estrelas e some uma.',
            impact: 'CONSTELAÇÃO INFINITA!',
            aftermath: 'O céu nunca fica sem primos.',
          },
          visual: {
            primary: '#ef78b7', secondary: '#88dfff', peakZoom: 1.28,
            maxDarkness: 0.8, shakeAmplitude: 16,
          },
        },
      },
    }),

    'mobius-assassin': defineHeroClass({
      id: 'mobius-assassin',
      archetype: 'assassin',
      name: 'Assassina de Möbius',
      characterName: 'Maia',
      gender: 'woman',
      pronouns: 'ela/dela',
      title: 'A Sombra da Inversão',
      lore: 'Maia atravessa as divisões do campo sem deixar rastros e anula todo composto que repete um fator.',
      affinity: {
        id: 'mobius-inversion',
        kind: 'number-theory',
        name: 'Função de Möbius',
        formula: 'μ(n) ∈ {−1, 0, 1}',
        description: 'Alterna sinais entre fatores distintos e reduz a zero os números que escondem um quadrado.',
      },
      palette: {
        skin: '#9b6956',
        shadow: '#100d19',
        primary: '#593783',
        secondary: '#173f35',
        accent: '#b58cff',
        energy: '#70f0ad',
      },
      stats: { maxHealth: 8, maxStamina: 125, movementSpeed: 86 },
      modifiers: {
        damageMultiplier: 1.14,
        damageTakenMultiplier: 1.16,
        cooldownMultiplier: 0.78,
        ultimateChargeMultiplier: 1.1,
        parryWindowMultiplier: 0.82,
        rangeMultiplier: 1.18,
      },
      actions: {
        J: {
          label: 'Lâmina μ',
          spokenName: 'Lâmina de Möbius!',
          description: 'Alterna cortes positivos e negativos; fatores repetidos anulam o próximo impacto.',
        },
        '1': {
          label: 'Cortes Coprimos',
          spokenName: 'Cortes Coprimos!',
          description: 'Cruza o alvo com duas lâminas de sinais opostos e reaparece além dele.',
        },
        '2': {
          label: 'Inversão de Sophie',
          spokenName: 'Inversão de Sophie!',
          description: 'Detona marcas square-free e inverte o sinal de todos os alvos ligados.',
        },
        '3': {
          label: 'Nulidade de Mersenne',
          spokenName: 'Nulidade de Mersenne!',
          description: 'Inscreve 3, 7 e 31 em três sombras; fatores quadrados desaparecem na última onda.',
        },
        Q: {
          label: 'Véu de Wilson',
          spokenName: 'Véu de Wilson!',
          description: 'Some durante a janela de Wilson e devolve o ataque com o sinal invertido.',
        },
        R: {
          label: 'Domínio da Inversão',
          spokenName: 'Domínio da Inversão de Möbius!',
          description: 'Expande uma soma sobre divisores e apaga, em sequência, toda contribuição composta.',
        },
      },
      cinematics: {
        '3': {
          title: 'O Quadrado que Some',
          spokenName: 'Nulidade de Mersenne!',
          motif: 'Três sombras verdes alternam sinais até um quadrado violeta desaparecer.',
          lines: {
            charge: 'Um fator. Outro fator.',
            release: 'Se o quadrado se repetir...',
            impact: 'NULIDADE DE MERSENNE!',
            aftermath: 'μ reduz o composto a zero.',
          },
          visual: {
            primary: '#70f0ad', secondary: '#b58cff', peakZoom: 1.16,
            maxDarkness: 0.64, shakeAmplitude: 8,
          },
        },
        R: {
          title: 'A Soma por Trás da Soma',
          spokenName: 'Domínio da Inversão de Möbius!',
          motif: 'Camadas de divisores se invertem até restar uma única silhueta square-free.',
          lines: {
            charge: 'Some sobre todos os divisores.',
            release: 'Agora inverta cada sinal.',
            impact: 'DOMÍNIO DA INVERSÃO!',
            aftermath: 'Nenhum fator repetido sobrevive.',
          },
          visual: {
            primary: '#b58cff', secondary: '#70f0ad', peakZoom: 1.24,
            maxDarkness: 0.76, shakeAmplitude: 13,
          },
        },
      },
    }),

    'goldbach-berserker': defineHeroClass({
      id: 'goldbach-berserker',
      archetype: 'berserker',
      name: 'Berserker de Goldbach',
      characterName: 'Otto',
      gender: 'man',
      pronouns: 'ele/dele',
      title: 'O Punho dos Dois Primos',
      lore: 'Otto parte toda ameaça par em dois golpes primos e fica mais perigoso a cada soma que completa.',
      affinity: {
        id: 'goldbach-conjecture',
        kind: 'number-theory',
        name: 'Conjectura de Goldbach',
        formula: '2n = p + q',
        description: 'Converte números pares em duplas de primos e transforma cada par encontrado em força bruta.',
      },
      palette: {
        skin: '#a86f4e',
        shadow: '#1b0b0b',
        primary: '#a13d25',
        secondary: '#5a171f',
        accent: '#ffd166',
        energy: '#ff6b4a',
      },
      stats: { maxHealth: 14, maxStamina: 95, movementSpeed: 64 },
      modifiers: {
        damageMultiplier: 1.22,
        damageTakenMultiplier: 0.92,
        cooldownMultiplier: 1.12,
        ultimateChargeMultiplier: 1.26,
        parryWindowMultiplier: 0.78,
        rangeMultiplier: 0.9,
      },
      actions: {
        J: {
          label: 'Impacto Par',
          spokenName: 'Impacto Par!',
          description: 'Golpeia uma vez para abrir a soma e outra para completá-la com um primo.',
        },
        '1': {
          label: 'Machados Gêmeos',
          spokenName: 'Machados Gêmeos!',
          description: 'Avança com dois machados pesados que representam o par primo da vez.',
        },
        '2': {
          label: 'Corrente de Goldbach',
          spokenName: 'Corrente de Goldbach!',
          description: 'Une inimigos em pares e concentra a soma de suas forças no alvo central.',
        },
        '3': {
          label: 'Colisão de Mersenne',
          spokenName: 'Colisão de Mersenne!',
          description: 'Esmaga o chão em três ondas pareadas pelas potências 3, 7 e 31.',
        },
        Q: {
          label: 'Guarda da Soma',
          spokenName: 'Guarda da Soma!',
          description: 'Absorve uma parcela do golpe e responde com o primo que completa o par.',
        },
        R: {
          label: 'Conjectura Dourada',
          spokenName: 'Conjectura Dourada de Goldbach!',
          description: 'Convoca dois sóis primos cuja colisão divide todo número par no campo.',
        },
      },
      cinematics: {
        '3': {
          title: 'Dois Sóis de Mersenne',
          spokenName: 'Colisão de Mersenne!',
          motif: 'Dois astros dourados enquadram três anéis vermelhos marcados por 3, 7 e 31.',
          lines: {
            charge: 'Todo par pede dois primos.',
            release: 'Encontrei os meus.',
            impact: 'COLISÃO DE MERSENNE!',
            aftermath: 'A soma abriu a arena.',
          },
          visual: {
            primary: '#ffd166', secondary: '#ff6b4a', peakZoom: 1.18,
            maxDarkness: 0.6, shakeAmplitude: 12,
          },
        },
        R: {
          title: 'Todo Par, Dois Primos',
          spokenName: 'Conjectura Dourada de Goldbach!',
          motif: 'Pares de sóis primos ocupam o horizonte e convergem numa soma incandescente.',
          lines: {
            charge: 'Escolha um número par.',
            release: 'Eu encontro os dois primos.',
            impact: 'CONJECTURA DOURADA!',
            aftermath: 'A soma sempre encontra um par.',
          },
          visual: {
            primary: '#ff6b4a', secondary: '#ffd166', peakZoom: 1.3,
            maxDarkness: 0.72, shakeAmplitude: 17,
          },
        },
      },
    }),

    'sieve-engineer': defineHeroClass({
      id: 'sieve-engineer',
      archetype: 'engineer',
      name: 'Engenheira do Crivo',
      characterName: 'Lena',
      gender: 'woman',
      pronouns: 'ela/dela',
      title: 'A Arquiteta dos Primos',
      lore: 'Lena constrói grades vivas que riscam múltiplos, isolam compostos e deixam apenas os primos de pé.',
      affinity: {
        id: 'eratosthenes-sieve',
        kind: 'number-theory',
        name: 'Crivo de Eratóstenes',
        formula: 'kp, com k ≥ 2 ⇒ composto',
        description: 'Elimina sistematicamente os múltiplos de cada primo e converte o espaço restante em vantagem.',
      },
      palette: {
        skin: '#8c654d',
        shadow: '#11170b',
        primary: '#557a25',
        secondary: '#5a3823',
        accent: '#b9f34a',
        energy: '#e9a45f',
      },
      stats: { maxHealth: 11, maxStamina: 115, movementSpeed: 72 },
      modifiers: {
        damageMultiplier: 0.94,
        damageTakenMultiplier: 0.96,
        cooldownMultiplier: 0.8,
        ultimateChargeMultiplier: 1.04,
        parryWindowMultiplier: 1.12,
        rangeMultiplier: 1.5,
      },
      actions: {
        J: {
          label: 'Rebite Primo',
          spokenName: 'Rebite Primo!',
          description: 'Dispara um rebite calibrado que destaca o próximo múltiplo na grade.',
        },
        '1': {
          label: 'Torres Gêmeas',
          spokenName: 'Torres Gêmeas!',
          description: 'Instala duas torres alinhadas que cruzam disparos sobre a mesma coluna.',
        },
        '2': {
          label: 'Linha de Sophie',
          spokenName: 'Linha de Sophie Germain!',
          description: 'Projeta uma linha magnética que risca os compostos encontrados no trajeto.',
        },
        '3': {
          label: 'Campo de Mersenne',
          spokenName: 'Campo de Mersenne!',
          description: 'Programa um campo de minas nos ciclos primos 3, 7 e 31.',
        },
        Q: {
          label: 'Barreira do Crivo',
          spokenName: 'Barreira do Crivo!',
          description: 'Ergue uma placa que filtra projéteis hostis e recicla seus múltiplos.',
        },
        R: {
          label: 'Crivo Infinito',
          spokenName: 'Crivo Infinito de Eratóstenes!',
          description: 'Expande uma malha por toda a arena e risca sucessivas ondas de compostos.',
        },
      },
      cinematics: {
        '3': {
          title: 'O Campo de Mersenne',
          spokenName: 'Campo de Mersenne!',
          motif: 'Linhas verde-limão riscam múltiplos enquanto minas de cobre contam 3, 7 e 31.',
          lines: {
            charge: 'Grade calibrada.',
            release: 'Risque cada múltiplo.',
            impact: 'CAMPO DE MERSENNE!',
            aftermath: 'Somente os primos continuam acesos.',
          },
          visual: {
            primary: '#b9f34a', secondary: '#e9a45f', peakZoom: 1.12,
            maxDarkness: 0.5, shakeAmplitude: 9,
          },
        },
        R: {
          title: 'A Malha que Não Termina',
          spokenName: 'Crivo Infinito de Eratóstenes!',
          motif: 'Uma grade cobre a arena e risca infinitas diagonais compostas em sequência.',
          lines: {
            charge: 'Comece pelo dois.',
            release: 'Elimine todos os múltiplos.',
            impact: 'CRIVO INFINITO!',
            aftermath: 'O que resta é primo.',
          },
          visual: {
            primary: '#e9a45f', secondary: '#b9f34a', peakZoom: 1.22,
            maxDarkness: 0.66, shakeAmplitude: 12,
          },
        },
      },
    }),

    'elliptic-oracle': defineHeroClass({
      id: 'elliptic-oracle',
      archetype: 'oracle',
      name: 'Oráculo Elíptico',
      characterName: 'Íris',
      gender: 'woman',
      pronouns: 'ela/dela',
      title: 'A Voz do Ponto no Infinito',
      lore: 'Íris enxerga tangentes antes que existam e dobra pontos da curva para decidir onde o destino colide.',
      affinity: {
        id: 'elliptic-curves',
        kind: 'cryptography',
        name: 'Curvas Elípticas',
        formula: 'y² ≡ x³ + ax + b (mod p)',
        description: 'Soma e dobra pontos sobre corpos finitos para prever trajetórias e selar caminhos criptográficos.',
      },
      palette: {
        skin: '#b98571',
        shadow: '#0b1026',
        primary: '#345caa',
        secondary: '#672d78',
        accent: '#73d9ff',
        energy: '#ff70c5',
      },
      stats: { maxHealth: 9, maxStamina: 105, movementSpeed: 78 },
      modifiers: {
        damageMultiplier: 1.04,
        damageTakenMultiplier: 1.06,
        cooldownMultiplier: 0.92,
        ultimateChargeMultiplier: 1.28,
        parryWindowMultiplier: 1.3,
        rangeMultiplier: 1.38,
      },
      actions: {
        J: {
          label: 'Orbe Tangente',
          spokenName: 'Orbe Tangente!',
          description: 'Projeta um orbe pela tangente prevista e reflete o ponto no eixo da curva.',
        },
        '1': {
          label: 'Pontos Gêmeos',
          spokenName: 'Pontos Gêmeos!',
          description: 'Invoca dois pontos conjugados que convergem na próxima interseção.',
        },
        '2': {
          label: 'Soma de Sophie',
          spokenName: 'Soma Elíptica de Sophie!',
          description: 'Traça uma secante entre inimigos e materializa a soma no terceiro ponto.',
        },
        '3': {
          label: 'Singularidade de Mersenne',
          spokenName: 'Singularidade de Mersenne!',
          description: 'Dobra um ponto no solo e abre uma singularidade luminosa em 3, 7 e 31.',
        },
        Q: {
          label: 'Égide do Infinito',
          spokenName: 'Égide do Infinito!',
          description: 'Prevê a tangente do ataque e abre uma ward no ponto de identidade da curva.',
        },
        R: {
          label: 'Ponto no Infinito',
          spokenName: 'Ponto no Infinito!',
          description: 'Soma todas as trajetórias da arena até convergirem na identidade da curva.',
        },
      },
      cinematics: {
        '3': {
          title: 'Três Dobras de Mersenne',
          spokenName: 'Singularidade de Mersenne!',
          motif: 'Uma curva celeste recebe três tangentes e colapsa numa singularidade magenta.',
          lines: {
            charge: 'Escolha o primeiro ponto.',
            release: 'Dobre a curva três vezes.',
            impact: 'SINGULARIDADE DE MERSENNE!',
            aftermath: 'A interseção já estava escrita.',
          },
          visual: {
            primary: '#73d9ff', secondary: '#ff70c5', peakZoom: 1.17,
            maxDarkness: 0.62, shakeAmplitude: 8,
          },
        },
        R: {
          title: 'Destino no Infinito',
          spokenName: 'Ponto no Infinito!',
          motif: 'Tangentes e secantes atravessam a tela até a curva tocar seu ponto de identidade.',
          lines: {
            charge: 'Some todos os pontos.',
            release: 'A curva conhece o destino.',
            impact: 'PONTO NO INFINITO!',
            aftermath: 'Ômega fecha a trajetória.',
          },
          visual: {
            primary: '#ff70c5', secondary: '#73d9ff', peakZoom: 1.26,
            maxDarkness: 0.78, shakeAmplitude: 14,
          },
        },
      },
    }),
  })

export const HERO_CLASS_LIST: readonly HeroClassDefinition[] = Object.freeze(
  HERO_CLASS_IDS.map((classId) => HERO_CLASSES[classId]),
)

export interface HeroCombatValues {
  readonly damage: number
  readonly incomingDamage: number
  readonly cooldownMs: number
  readonly ultimateChargeGain: number
  readonly parryWindowMs: number
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`)
  }
}

export function isHeroClassId(value: string): value is HeroClassId {
  return Object.prototype.hasOwnProperty.call(HERO_CLASSES, value)
}

export function getHeroClass(classId: HeroClassId): HeroClassDefinition {
  if (!isHeroClassId(classId)) {
    throw new RangeError(`unsupported hero class: ${String(classId)}`)
  }
  return HERO_CLASSES[classId]
}

export function getHeroClassAction<Slot extends HeroActionSlot>(
  classId: HeroClassId,
  slot: Slot,
): HeroActionLoadout[Slot] {
  return getHeroClass(classId).actions[slot]
}

export function getHeroClassCinematic<Slot extends HeroCinematicSlot>(
  classId: HeroClassId,
  slot: Slot,
): HeroCinematicLoadout[Slot] {
  return getHeroClass(classId).cinematics[slot]
}

/** Applies one class profile without mutating the supplied canonical values. */
export function applyHeroClassModifiers(
  classId: HeroClassId,
  values: HeroCombatValues,
): HeroCombatValues {
  for (const [label, value] of Object.entries(values)) {
    assertNonNegativeFinite(value, label)
  }
  const modifiers = getHeroClass(classId).modifiers
  return Object.freeze({
    damage: values.damage * modifiers.damageMultiplier,
    incomingDamage: values.incomingDamage * modifiers.damageTakenMultiplier,
    cooldownMs: Math.round(values.cooldownMs * modifiers.cooldownMultiplier),
    ultimateChargeGain: values.ultimateChargeGain * modifiers.ultimateChargeMultiplier,
    parryWindowMs: Math.round(values.parryWindowMs * modifiers.parryWindowMultiplier),
  })
}
