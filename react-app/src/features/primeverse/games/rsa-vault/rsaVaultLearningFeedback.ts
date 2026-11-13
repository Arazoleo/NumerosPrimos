import {
  normalizeRsaMessage,
  parseUnsignedBigInt,
  type RsaStageEvaluation,
} from './rsaVaultLogic'
import type { RsaStage, RsaVaultChallenge, RsaVaultInputs } from './types'

export interface RsaLearningFeedback {
  readonly kind: 'success' | 'error'
  readonly stage: RsaStage
  readonly title: string
  readonly detail: string
  readonly equation: string
  readonly instruction: string
}

function confirmedFactors(challenge: RsaVaultChallenge, inputs: RsaVaultInputs): readonly [bigint, bigint] {
  const p = parseUnsignedBigInt(inputs.p)
  const q = parseUnsignedBigInt(inputs.q)
  if (
    (p === challenge.primeP && q === challenge.primeQ)
    || (p === challenge.primeQ && q === challenge.primeP)
  ) return [p, q]
  return [challenge.primeP, challenge.primeQ]
}

export function buildRsaLearningFeedback(
  challenge: RsaVaultChallenge,
  stage: RsaStage,
  inputs: RsaVaultInputs,
  evaluation: RsaStageEvaluation,
): RsaLearningFeedback {
  const base = {
    kind: evaluation.correct ? 'success' as const : 'error' as const,
    stage,
    title: evaluation.title,
    detail: evaluation.detail,
  }

  if (stage === 'factor') {
    const p = parseUnsignedBigInt(inputs.p)
    const q = parseUnsignedBigInt(inputs.q)
    return {
      ...base,
      equation: !evaluation.malformed && p !== null && q !== null
        ? `${p} × ${q} = ${p * q}`
        : 'p × q = N',
      instruction: evaluation.correct
        ? 'Os fatores foram confirmados. Agora use p e q para calcular φ(N).'
        : evaluation.malformed
          ? 'Preencha p e q com inteiros primos maiores que 1 e teste novamente.'
          : `Compare o produto com N = ${challenge.modulus} e confirme que os dois fatores são primos. Depois, ajuste sua tentativa.`,
    }
  }

  if (stage === 'totient') {
    const [p, q] = confirmedFactors(challenge, inputs)
    return {
      ...base,
      equation: evaluation.correct
        ? `φ(${challenge.modulus}) = ${challenge.totient}`
        : `φ(${challenge.modulus}) = (${p} − 1) × (${q} − 1)`,
      instruction: evaluation.correct
        ? 'Totiente confirmado. Use φ(N) e o expoente público e para encontrar d.'
        : evaluation.malformed
          ? 'Digite um número inteiro, sem sinal nem casas decimais, para conferir a conta.'
          : 'Faça primeiro as duas subtrações; depois multiplique os resultados e confira o valor digitado.',
    }
  }

  if (stage === 'inverse') {
    const d = parseUnsignedBigInt(inputs.privateExponent)
    const product = d === null ? null : challenge.publicExponent * d
    const remainder = product === null ? null : product % challenge.totient
    return {
      ...base,
      equation: d !== null
        ? `${challenge.publicExponent} × ${d} = ${product} → resto ${remainder} (mod ${challenge.totient})`
        : `${challenge.publicExponent} × d ≡ 1 (mod ${challenge.totient})`,
      instruction: evaluation.correct
        ? 'Chave privada confirmada. Agora use a bancada para processar os blocos e converter os resultados em letras.'
        : remainder === 1n
          ? `O resto está correto, mas o cofre pede o menor d positivo: escolha um valor maior que 0 e menor que ${challenge.totient}.`
          : evaluation.malformed
            ? 'Digite um inteiro positivo para d e teste se a multiplicação deixa resto 1.'
            : 'O resto precisa ser 1. Ajuste d, multiplique por e e verifique novamente o resto da divisão por φ(N).',
    }
  }

  return {
    ...base,
    equation: evaluation.correct
      ? `Mensagem confirmada: ${normalizeRsaMessage(inputs.message)}`
      : 'Cᵈ mod N → número → letra',
    instruction: evaluation.correct
      ? 'Todos os blocos foram confirmados. Aguarde a abertura do cofre.'
      : 'Processe cada bloco na bancada, converta por A=1…Z=26 e confira as letras na mesma ordem dos blocos.',
  }
}
