export interface DefeatPresentation {
  readonly headline: string
  readonly source: string
  readonly cause: string
}

const DEFAULT_PRESENTATION: DefeatPresentation = Object.freeze({
  headline: 'VETOR INTERROMPIDO',
  source: 'AMEAÇA NÃO IDENTIFICADA',
  cause: 'RECALIBRE A ROTA ANTES DO RETORNO',
})

export function parseDefeatPresentation(message: string): DefeatPresentation {
  const event = message.split('//', 1)[0]?.trim() ?? ''
  if (event.startsWith('FATORADO POR ')) {
    const detail = event.slice('FATORADO POR '.length).trim()
    const [source, ...causeParts] = detail.split(/\s+(?:·|—)\s+/)
    return Object.freeze({
      headline: 'ASSINATURA FATORADA',
      source: source || DEFAULT_PRESENTATION.source,
      cause: causeParts.join(' · ') || 'IMPACTO HOSTIL CONFIRMADO',
    })
  }
  if (event.includes('VETOR FOI REFLETIDO')) {
    return Object.freeze({
      headline: 'VETOR DEVOLVIDO',
      source: 'REFLEXÃO RSA',
      cause: 'SEU PRÓPRIO DANO ROMPEU A ASSINATURA',
    })
  }
  return DEFAULT_PRESENTATION
}

export function respawnProgress(
  respawnAtMs: number | null,
  nowMs: number,
  durationMs: number,
): number {
  if (respawnAtMs === null || !Number.isFinite(respawnAtMs) || !Number.isFinite(nowMs)) return 0
  if (!Number.isFinite(durationMs) || durationMs <= 0) return nowMs >= respawnAtMs ? 1 : 0
  return Math.max(0, Math.min(1, 1 - (respawnAtMs - nowMs) / durationMs))
}

export function respawnPhaseLabel(progress: number): string {
  if (progress >= 0.82) return 'RETORNO IMINENTE'
  if (progress >= 0.4) return 'RECOMPONDO CHAVE BIOMÉTRICA'
  return 'LENDO O PADRÃO HOSTIL'
}
