export type DialogueSpeaker = 'NORA' | 'VESPER'

export type DialogueSceneId =
  | 'arrival'
  | 'rotor-collected'
  | 'caesar-solved'
  | 'modular-solved'
  | 'rsa-unlocked'

export type DialogueTone =
  | 'calm'
  | 'urgent'
  | 'cryptic'
  | 'triumphant'

export interface DialogueCharacter {
  readonly id: DialogueSpeaker
  readonly name: string
  readonly role: string
  readonly color: string
}

export interface DialogueLine {
  readonly id: string
  readonly speaker: DialogueSpeaker
  readonly text: string
  readonly tone: DialogueTone
}

export interface DialogueScene {
  readonly id: DialogueSceneId
  readonly title: string
  readonly lines: readonly DialogueLine[]
}

export const ESCAPE_CHARACTERS: Readonly<
  Record<DialogueSpeaker, DialogueCharacter>
> = {
  NORA: {
    id: 'NORA',
    name: 'NORA',
    role: 'Operadora de busca',
    color: '#e8dc86',
  },
  VESPER: {
    id: 'VESPER',
    name: 'VESPER',
    role: 'Presença no andar',
    color: '#ef5b42',
  },
}

export const ESCAPE_DIALOGUES: Readonly<
  Record<DialogueSceneId, DialogueScene>
> = {
  arrival: {
    id: 'arrival',
    title: 'Canal aberto',
    lines: [
      {
        id: 'arrival-nora-01',
        speaker: 'NORA',
        text: 'Canal aberto. Sou NORA. Esse andar não existe na planta, mas ainda consigo ver você.',
        tone: 'calm',
      },
      {
        id: 'arrival-vesper-01',
        speaker: 'VESPER',
        text: 'Ela vê o corredor. Eu vejo quantas vezes você já passou por ele.',
        tone: 'cryptic',
      },
    ],
  },
  'rotor-collected': {
    id: 'rotor-collected',
    title: 'O rotor',
    lines: [
      {
        id: 'rotor-nora-01',
        speaker: 'NORA',
        text: 'O rotor corresponde ao console atrás da janela falsa. Não perca o sinal do objetivo.',
        tone: 'urgent',
      },
      {
        id: 'rotor-vesper-01',
        speaker: 'VESPER',
        text: 'Três passos para trás. Quantos para voltar ao mesmo lugar?',
        tone: 'cryptic',
      },
    ],
  },
  'caesar-solved': {
    id: 'caesar-solved',
    title: 'Mensagem decifrada',
    lines: [
      {
        id: 'caesar-nora-01',
        speaker: 'NORA',
        text: 'PRIMO confirmado. A junção úmida apareceu no mapa — e outra coisa também.',
        tone: 'triumphant',
      },
      {
        id: 'caesar-vesper-01',
        speaker: 'VESPER',
        text: 'Você transformou letras em resposta. Eu transformei seus passos em endereço.',
        tone: 'cryptic',
      },
    ],
  },
  'modular-solved': {
    id: 'modular-solved',
    title: 'Ciclo rompido',
    lines: [
      {
        id: 'modular-nora-01',
        speaker: 'NORA',
        text: 'Congruência aceita. O pulso atordoou a presença; use esses segundos e siga ao arquivo.',
        tone: 'urgent',
      },
      {
        id: 'modular-vesper-01',
        speaker: 'VESPER',
        text: 'Todo ciclo tem um resto. Neste andar, o resto segue você.',
        tone: 'cryptic',
      },
    ],
  },
  'rsa-unlocked': {
    id: 'rsa-unlocked',
    title: 'Contenção liberada',
    lines: [
      {
        id: 'rsa-nora-01',
        speaker: 'NORA',
        text: 'Chave reconstruída. A porta vermelha abriu. Não olhe para trás; atravesse agora.',
        tone: 'triumphant',
      },
      {
        id: 'rsa-vesper-01',
        speaker: 'VESPER',
        text: 'A porta está aberta. Só não sabemos para qual lado dela você escapou.',
        tone: 'cryptic',
      },
    ],
  },
}

function getDialogueScene(sceneId: DialogueSceneId | string): DialogueScene | null {
  if (!Object.prototype.hasOwnProperty.call(ESCAPE_DIALOGUES, sceneId)) {
    return null
  }

  return ESCAPE_DIALOGUES[sceneId as DialogueSceneId]
}

/** Returns null for unknown scenes and for unsafe, negative or out-of-range indexes. */
export function getDialogueLine(
  sceneId: DialogueSceneId | string,
  index: number,
): DialogueLine | null {
  if (!Number.isSafeInteger(index) || index < 0) return null

  return getDialogueScene(sceneId)?.lines[index] ?? null
}

/** Returns true when the current line is the last one, or cannot be resolved safely. */
export function isDialogueEnd(
  sceneId: DialogueSceneId | string,
  index: number,
): boolean {
  const scene = getDialogueScene(sceneId)

  if (!scene || !getDialogueLine(sceneId, index)) return true

  return index === scene.lines.length - 1
}

/** Returns the next valid line index, or null when the scene has finished. */
export function advanceDialogue(
  sceneId: DialogueSceneId | string,
  currentIndex: number,
): number | null {
  if (!getDialogueLine(sceneId, currentIndex)) return null

  const nextIndex = currentIndex + 1

  return getDialogueLine(sceneId, nextIndex) ? nextIndex : null
}
