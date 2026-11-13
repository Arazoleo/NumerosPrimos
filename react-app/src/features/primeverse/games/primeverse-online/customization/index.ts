/**
 * Ponto de entrada da personalização do Primeverse Online.
 *
 * Reúne dados, arte dos personagens e animações de energia para que a página
 * importe tudo de './customization' em um só lugar.
 */

// Dados: exploradores, energias e funções de busca
export { CHARACTERS, ENERGIES, getCharacter, getEnergy } from './characterData'
// Efeitos visuais das energias exibidos atrás do personagem na prévia
export { EnergyAnimation } from './EnergyAnimations'
// Arte dos personagens: corpo inteiro (prévia) e ícone (botões)
export { CharacterFigure, CharacterIcon } from './CharacterArt'
