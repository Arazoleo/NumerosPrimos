import { describe, expect, it } from 'vitest'

import {
  parseDefeatPresentation,
  respawnPhaseLabel,
  respawnProgress,
} from './defeatPresentation'

describe('Núcleo 257 defeat presentation', () => {
  it('extracts the attacker and ability from an authoritative defeat cue', () => {
    expect(parseDefeatPresentation('FATORADO POR CRIVO · DOMÍNIO DO CRIVO // RECONSTRUINDO')).toEqual({
      headline: 'ASSINATURA FATORADA',
      source: 'CRIVO',
      cause: 'DOMÍNIO DO CRIVO',
    })
  })

  it('describes reflected self-damage without inventing an attacker', () => {
    expect(parseDefeatPresentation('SEU VETOR FOI REFLETIDO // RECONSTRUINDO')).toMatchObject({
      headline: 'VETOR DEVOLVIDO',
      source: 'REFLEXÃO RSA',
    })
  })

  it('clamps reconstruction progress and exposes readable phases', () => {
    expect(respawnProgress(6_000, 1_000, 5_000)).toBe(0)
    expect(respawnProgress(6_000, 3_500, 5_000)).toBe(0.5)
    expect(respawnProgress(6_000, 7_000, 5_000)).toBe(1)
    expect(respawnPhaseLabel(0.2)).toBe('LENDO O PADRÃO HOSTIL')
    expect(respawnPhaseLabel(0.5)).toBe('RECOMPONDO CHAVE BIOMÉTRICA')
    expect(respawnPhaseLabel(0.9)).toBe('RETORNO IMINENTE')
  })
})
