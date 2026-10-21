/**
 * Character definitions for Primeverse Online.
 * 
 * Defines four explorer archetypes (Primo, Lúmina, Zeta, Orion) and four
 * energy types (Prime Ring, Crypto Matrix, Factor Net, Cipher Lock). Each
 * character represents a mathematical theme, and each energy type includes
 * an educational power concept.
 */

import type { CharacterModel, EnergyType } from '../shared/protocol'

export interface CharacterDefinition {
  readonly id: CharacterModel
  readonly name: string
  readonly theme: string
  readonly description: string
  readonly accent: `#${string}` // HexColor
  readonly symbol: string
  readonly personality: string
}

export interface EnergyDefinition {
  readonly id: EnergyType
  readonly name: string
  readonly concept: string
  readonly powerName: string
  readonly powerDescription: string
  readonly visualDescription: string
  readonly accent: `#${string}` // HexColor
  readonly icon: string
}

export const CHARACTERS: readonly CharacterDefinition[] = [
  {
    id: 'primo',
    name: 'Primo',
    theme: 'O Explorador',
    description: 'Descubra os segredos dos números primos.',
    accent: '#5FA8FF',
    symbol: 'P',
    personality: 'curioso e equilibrado',
  },
  {
    id: 'lumina',
    name: 'Lúmina',
    theme: 'A Decifradora',
    description: 'Encontre padrões e revele mensagens escondidas.',
    accent: '#A983FF',
    symbol: 'L',
    personality: 'inteligente e observadora',
  },
  {
    id: 'zeta',
    name: 'Zeta',
    theme: 'O Caçador de Primos',
    description: 'Encontre números primos em grandes sequências.',
    accent: '#72E59A',
    symbol: 'Z',
    personality: 'rápido e explorador',
  },
  {
    id: 'orion',
    name: 'Orion',
    theme: 'O Guardião da Chave',
    description: 'Proteja segredos usando a matemática.',
    accent: '#F0C35A',
    symbol: 'O',
    personality: 'protetor e confiável',
  },
] as const

export const ENERGIES: readonly EnergyDefinition[] = [
  {
    id: 'prime-ring',
    name: 'Anel dos Primos',
    concept: 'Números primos',
    powerName: 'Escudo Primo',
    powerDescription: 'Os números primos formam um escudo que te protege de um erro em um desafio.',
    visualDescription: 'Anéis luminosos orbitando com números primos 2, 3, 5, 7 e 11',
    accent: '#5CEEE5',
    icon: '◎',
  },
  {
    id: 'crypto-matrix',
    name: 'Matriz Criptográfica',
    concept: 'Criptografia e padrões',
    powerName: 'Decifra-Pista',
    powerDescription: 'A matriz revela uma pista para ajudar você a decifrar o código.',
    visualDescription: 'Quadrados e pixels que se reorganizam como mensagens codificadas',
    accent: '#A983FF',
    icon: '▦',
  },
  {
    id: 'factor-net',
    name: 'Rede de Fatores',
    concept: 'Fatoração e relações',
    powerName: 'Visão dos Fatores',
    powerDescription: 'A rede mostra como um número pode ser dividido em fatores menores.',
    visualDescription: 'Pontos conectados por linhas formando uma rede geométrica',
    accent: '#72E59A',
    icon: '⬡',
  },
  {
    id: 'cipher-lock',
    name: 'Cifra Dourada',
    concept: 'Criptografia',
    powerName: 'Chave Secreta',
    powerDescription: 'A chave ajuda você a abrir um enigma criptográfico e entender como os códigos protegem mensagens.',
    visualDescription: 'Anéis geométricos dourados que se encaixam como uma fechadura',
    accent: '#F0C35A',
    icon: '⚿',
  },
] as const

export function getCharacter(id: CharacterModel): CharacterDefinition {
  return CHARACTERS.find((char) => char.id === id) ?? CHARACTERS[0]
}

export function getEnergy(id: EnergyType): EnergyDefinition {
  return ENERGIES.find((energy) => energy.id === id) ?? ENERGIES[0]
}
