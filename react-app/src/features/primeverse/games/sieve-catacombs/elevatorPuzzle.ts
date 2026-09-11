import type { CatacombsLevelId } from './campaignLogic'

export type ElevatorPuzzleKind = 'caesar' | 'modular' | 'a1z26' | 'factor' | 'xor' | 'discrete-log'

export interface ElevatorPuzzle {
  readonly levelId: CatacombsLevelId
  readonly kind: ElevatorPuzzleKind
  /** Short name shown on the elevator keypad. */
  readonly title: string
  /** What the panel asks the player to type. */
  readonly prompt: string
  /** The ciphertext or numbers engraved on the door. */
  readonly challenge: string
  /** Always available: enough to reason it out without exploring. */
  readonly hint: string
  /** One clue per drawer fragment, revealed in the order they are found. */
  readonly fragments: readonly string[]
  readonly answer: string
  readonly solvedMessage: string
  readonly wrongMessage: string
}

/**
 * One cipher per floor, solved on the elevator keypad. Answers are compared after
 * normalisation, so "17", " 17 " and "17." all pass, and letters ignore case and
 * accents.
 */
export const ELEVATOR_PUZZLES: readonly ElevatorPuzzle[] = Object.freeze([
  {
    levelId: 'yellow-offices',
    kind: 'caesar',
    title: 'Teclado do elevador de serviço',
    prompt: 'Digite a palavra decifrada',
    challenge: 'HOHYDGRU',
    hint: 'Cifra de César: cada letra foi empurrada algumas casas para a frente no alfabeto.',
    fragments: [
      'Post-it na gaveta: "o turno da noite empurra tudo 3 casas".',
      'Crachá rasgado: "H → E, O → L, H → E..."',
    ],
    answer: 'ELEVADOR',
    solvedMessage: 'ELEVADOR aceito. As portas cedem.',
    wrongMessage: 'O teclado zumbe em recusa. Alguma coisa no corredor ouviu.',
  },
  {
    levelId: 'modular-pools',
    kind: 'modular',
    title: 'Válvula modular da escada seca',
    prompt: 'Digite o inverso de 3 módulo 7',
    challenge: '3 · x ≡ 1 (mod 7)',
    hint: 'Procure o número de 1 a 6 que, multiplicado por 3, deixa resto 1 ao dividir por 7.',
    fragments: [
      'Prancheta encharcada: "3 × 5 = 15, e 15 = 2 × 7 + 1".',
      'Azulejo riscado: "a válvula só abre com o inverso, nunca com o próprio 3".',
    ],
    answer: '5',
    solvedMessage: 'Válvula 5 destravada. A água escorre pelas grades.',
    wrongMessage: 'A válvula trava e o nível da água sobe um dedo.',
  },
  {
    levelId: 'hotel-23',
    kind: 'a1z26',
    title: 'Painel numérico do elevador de serviço',
    prompt: 'Digite a palavra escrita nos números',
    challenge: '17 · 21 · 1 · 18 · 20 · 15',
    hint: 'Cada número é a posição de uma letra no alfabeto: 1 = A, 2 = B, 3 = C…',
    fragments: [
      'Ficha de hóspede: "17 é a décima sétima letra".',
      'Chave do 23: "o hotel só responde ao nome do lugar onde você dorme".',
    ],
    answer: 'QUARTO',
    solvedMessage: 'QUARTO reconhecido. O elevador vazio abre.',
    wrongMessage: 'O painel apaga. Um carrinho de serviço range em outro andar.',
  },
  {
    levelId: 'crypt-49',
    kind: 'factor',
    title: 'Fechadura RSA da última peneira',
    prompt: 'Digite o menor fator primo de 391',
    challenge: 'n = 391',
    hint: 'RSA cai quando n = p × q é fatorado. Teste os primos em ordem: 2, 3, 5, 7, 11, 13, 17…',
    fragments: [
      'Osso gravado: "391 não cede a 2, 3, 5, 7, 11 nem 13".',
      'Lápide: "os dois fatores estão a seis passos um do outro".',
    ],
    answer: '17',
    solvedMessage: '391 = 17 × 23. A peneira final se abre.',
    wrongMessage: 'A fechadura recusa. A contagem do Fatorador acelera.',
  },
  {
    levelId: 'server-farm-11',
    kind: 'xor',
    title: 'Console de força bruta do rack 11',
    prompt: 'Digite o resultado em hexadecimal',
    challenge: '0x2D ⊕ 0x46',
    hint: 'XOR compara bit a bit: 1 quando os bits são diferentes, 0 quando são iguais.',
    fragments: [
      'Etiqueta de rack: "2D = 0010 1101".',
      'Log impresso: "46 = 0100 0110".',
    ],
    answer: '6B',
    solvedMessage: '0x6B aceito. O rack libera o elevador de manutenção.',
    wrongMessage: 'O rack rejeita a chave e recomeça a varredura em voz alta.',
  },
  {
    levelId: 'cold-vault-13',
    kind: 'discrete-log',
    title: 'Cofre frio de chaves 13',
    prompt: 'Digite 2^5 mod 13',
    challenge: 'g = 2 · p = 13 · a = 5',
    hint: 'Diffie-Hellman: eleve a base à chave privada e tire o resto da divisão por p.',
    fragments: [
      'Manual congelado: "2^5 = 32".',
      'Etiqueta do cofre: "32 = 2 × 13 + resto".',
    ],
    answer: '6',
    solvedMessage: 'Segredo compartilhado 6. O cofre respira e libera a superfície.',
    wrongMessage: 'O cofre esfria mais um grau. Alguma coisa se move entre as prateleiras.',
  },
])

export function getElevatorPuzzle(levelId: CatacombsLevelId): ElevatorPuzzle {
  const puzzle = ELEVATOR_PUZZLES.find((candidate) => candidate.levelId === levelId)
  if (!puzzle) throw new RangeError(`Nenhum enigma de elevador definido para ${levelId}.`)
  return puzzle
}

/** Uppercase, unaccented, punctuation-free: "0x6b" and " 6B " both become "6B". */
export function normalizeElevatorAnswer(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^0X/, '')
    .replace(/[^A-Z0-9]/g, '')
}

export function isElevatorAnswerCorrect(puzzle: ElevatorPuzzle, raw: string): boolean {
  const answer = normalizeElevatorAnswer(raw)
  if (answer.length === 0) return false
  return answer === normalizeElevatorAnswer(puzzle.answer)
}

/** Fragments are revealed one at a time, in the order the drawers gave them up. */
export function visibleFragments(puzzle: ElevatorPuzzle, foundCount: number): readonly string[] {
  const safeCount = Number.isFinite(foundCount) ? Math.max(0, Math.floor(foundCount)) : 0
  return puzzle.fragments.slice(0, Math.min(safeCount, puzzle.fragments.length))
}
