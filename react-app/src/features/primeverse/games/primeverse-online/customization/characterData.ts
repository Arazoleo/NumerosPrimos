/**
 * Dados de personalização do Primeverse Online.
 *
 * Define os quatro exploradores (Primo, Lúmina, Zeta e Orion) e as quatro
 * energias (Anel dos Primos, Matriz Criptográfica, Rede de Fatores e Cifra
 * Dourada). Cada personagem representa um tema matemático e cada energia traz
 * um poder com um conceito educativo.
 *
 * Este arquivo só guarda dados (textos e cores). A aparência fica em
 * CharacterArt.tsx (personagens) e EnergyAnimations.tsx (energias).
 */

import type { CharacterModel, EnergyType } from '../shared/protocol'

/** Ficha de um explorador exibida na tela de personalização. */
export interface CharacterDefinition {
  /** Identificador salvo na sessão e enviado ao servidor. */
  readonly id: CharacterModel
  /** Nome exibido nos botões e na prévia. */
  readonly name: string
  /** Título curto do papel do personagem ("O Explorador"...). */
  readonly theme: string
  /** Frase que aparece na ficha de detalhes. */
  readonly description: string
  /** Cor-assinatura usada no ícone e nos acessórios (variável CSS --char). */
  readonly accent: `#${string}` // HexColor
}

/** Ficha de uma energia e do poder que ela concede. */
export interface EnergyDefinition {
  /** Identificador salvo na sessão; também escolhe a animação em EnergyAnimations.tsx. */
  readonly id: EnergyType
  /** Nome da energia mostrado no botão de escolha. */
  readonly name: string
  /** Conceito matemático que a energia representa. */
  readonly concept: string
  /** Nome do poder mostrado na ficha de detalhes. */
  readonly powerName: string
  /** Explicação do poder exibida para o jogador. */
  readonly powerDescription: string
  /** Cor padrão da energia; aplicada ao brilho quando a energia é escolhida. */
  readonly accent: `#${string}` // HexColor
  /** Símbolo em texto usado no botão de escolha. */
  readonly icon: string
}

/** Os quatro exploradores, na ordem em que aparecem na grade de escolha. */
export const CHARACTERS: readonly CharacterDefinition[] = [
  {
    id: 'primo',
    name: 'Primo',
    theme: 'O Explorador',
    description: 'Um astronauta curioso que explora o universo dos números primos.',
    accent: '#5FA8FF',
  },
  {
    id: 'lumina',
    name: 'Lúmina',
    theme: 'A Decifradora',
    description: 'Uma decifradora inteligente que encontra pistas e revela mensagens escondidas.',
    accent: '#A983FF',
  },
  {
    id: 'zeta',
    name: 'Zeta',
    theme: 'O Caçador de Primos',
    description: 'Um aventureiro ágil que enfrenta desafios e descobre padrões matemáticos.',
    accent: '#72E59A',
  },
  {
    id: 'orion',
    name: 'Orion',
    theme: 'O Guardião da Chave',
    description: 'Um guardião de segredos que usa a matemática para proteger códigos e informações.',
    accent: '#F0C35A',
  },
] as const

/** As quatro energias, na ordem em que aparecem na grade de escolha. */
export const ENERGIES: readonly EnergyDefinition[] = [
  {
    id: 'prime-ring',
    name: 'Anel dos Primos',
    concept: 'Números primos',
    powerName: 'Escudo Primo',
    powerDescription: 'Anéis de números primos protegem o explorador e representam a força dos números indivisíveis.',
    accent: '#5CEEE5',
    icon: '◎',
  },
  {
    id: 'crypto-matrix',
    name: 'Matriz Criptográfica',
    concept: 'Criptografia e padrões',
    powerName: 'Decifra-Pista',
    powerDescription: 'Pixels digitais se reorganizam para revelar pistas e ajudar a desvendar códigos.',
    accent: '#A983FF',
    icon: '▦',
  },
  {
    id: 'factor-net',
    name: 'Rede de Fatores',
    concept: 'Fatoração e relações',
    powerName: 'Visão dos Fatores',
    powerDescription: 'Uma rede luminosa conecta números e revela como eles se dividem em fatores menores.',
    accent: '#72E59A',
    icon: '⬡',
  },
  {
    id: 'cipher-lock',
    name: 'Cifra Dourada',
    concept: 'Criptografia',
    powerName: 'Chave Secreta',
    powerDescription: 'Anéis geométricos se encaixam como uma fechadura para simbolizar a descoberta de mensagens secretas.',
    accent: '#F0C35A',
    icon: '⚿',
  },
] as const

/** Busca um explorador pelo id; cai no Primo se o id for desconhecido. */
export function getCharacter(id: CharacterModel): CharacterDefinition {
  return CHARACTERS.find((char) => char.id === id) ?? CHARACTERS[0]
}

/** Busca uma energia pelo id; cai no Anel dos Primos se o id for desconhecido. */
export function getEnergy(id: EnergyType): EnergyDefinition {
  return ENERGIES.find((energy) => energy.id === id) ?? ENERGIES[0]
}
