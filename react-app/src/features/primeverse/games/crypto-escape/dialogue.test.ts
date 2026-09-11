import { describe, expect, it } from 'vitest'

import {
  advanceDialogue,
  ESCAPE_CHARACTERS,
  ESCAPE_DIALOGUES,
  getDialogueLine,
  isDialogueEnd,
  type DialogueSceneId,
  type DialogueSpeaker,
} from './dialogue'

const SCENE_IDS = [
  'arrival',
  'rotor-collected',
  'caesar-solved',
  'modular-solved',
  'rsa-unlocked',
] as const satisfies readonly DialogueSceneId[]

describe('Crypto Escape dialogue', () => {
  it('defines NORA and VESPER as distinct characters', () => {
    expect(Object.keys(ESCAPE_CHARACTERS)).toEqual(['NORA', 'VESPER'])
    expect(ESCAPE_CHARACTERS.NORA.role).toBe('Operadora de busca')
    expect(ESCAPE_CHARACTERS.VESPER.role).toBe('Presença no andar')
    expect(ESCAPE_CHARACTERS.NORA.color).not.toBe(
      ESCAPE_CHARACTERS.VESPER.color,
    )
  })

  it('covers every narrative milestone with both characters', () => {
    expect(Object.keys(ESCAPE_DIALOGUES)).toEqual(SCENE_IDS)

    for (const sceneId of SCENE_IDS) {
      const scene = ESCAPE_DIALOGUES[sceneId]
      const speakers = new Set<DialogueSpeaker>(
        scene.lines.map((line) => line.speaker),
      )

      expect(scene.id).toBe(sceneId)
      expect(scene.title.trim()).not.toBe('')
      expect(scene.lines.length).toBeGreaterThanOrEqual(2)
      expect(speakers).toEqual(new Set<DialogueSpeaker>(['NORA', 'VESPER']))
    }
  })

  it('keeps line identifiers unique and all content ready for display', () => {
    const lines = SCENE_IDS.flatMap(
      (sceneId) => ESCAPE_DIALOGUES[sceneId].lines,
    )

    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length)

    for (const line of lines) {
      expect(line.id.trim()).not.toBe('')
      expect(line.text).toBe(line.text.trim())
      expect(line.text.length).toBeGreaterThan(10)
      expect(ESCAPE_CHARACTERS[line.speaker]).toBeDefined()
    }
  })

  it('gets a line by index without exposing out-of-range values', () => {
    expect(getDialogueLine('arrival', 0)).toMatchObject({
      id: 'arrival-nora-01',
      speaker: 'NORA',
    })
    expect(getDialogueLine('arrival', 1)).toMatchObject({
      id: 'arrival-vesper-01',
      speaker: 'VESPER',
    })
    expect(getDialogueLine('arrival', -1)).toBeNull()
    expect(getDialogueLine('arrival', 2)).toBeNull()
    expect(getDialogueLine('arrival', 0.5)).toBeNull()
    expect(getDialogueLine('arrival', Number.NaN)).toBeNull()
    expect(getDialogueLine('arrival', Number.POSITIVE_INFINITY)).toBeNull()
    expect(getDialogueLine('missing-scene', 0)).toBeNull()
  })

  it('advances through valid lines and returns null after the final line', () => {
    for (const sceneId of SCENE_IDS) {
      expect(advanceDialogue(sceneId, 0)).toBe(1)
      expect(advanceDialogue(sceneId, 1)).toBeNull()
    }

    expect(advanceDialogue('arrival', -1)).toBeNull()
    expect(advanceDialogue('arrival', 0.5)).toBeNull()
    expect(advanceDialogue('missing-scene', 0)).toBeNull()
  })

  it('identifies the final line and treats malformed cursors as closed', () => {
    expect(isDialogueEnd('arrival', 0)).toBe(false)
    expect(isDialogueEnd('arrival', 1)).toBe(true)
    expect(isDialogueEnd('arrival', 2)).toBe(true)
    expect(isDialogueEnd('arrival', -1)).toBe(true)
    expect(isDialogueEnd('arrival', Number.NaN)).toBe(true)
    expect(isDialogueEnd('missing-scene', 0)).toBe(true)
  })
})
