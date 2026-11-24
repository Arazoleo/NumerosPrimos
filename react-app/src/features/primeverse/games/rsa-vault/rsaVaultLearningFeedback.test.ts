import { describe, expect, it } from 'vitest'

import { buildRsaLearningFeedback } from './rsaVaultLearningFeedback'
import { evaluateRsaStage, RSA_VAULT_CHALLENGES } from './rsaVaultLogic'
import type { RsaStage, RsaVaultInputs } from './types'

const challenge = RSA_VAULT_CHALLENGES[0]
const emptyInputs: RsaVaultInputs = { p: '', q: '', totient: '', privateExponent: '', message: '' }

function feedback(stage: RsaStage, values: Partial<RsaVaultInputs>) {
  const inputs = { ...emptyInputs, ...values }
  const evaluation = evaluateRsaStage(challenge, stage, inputs)
  return buildRsaLearningFeedback(challenge, stage, inputs, evaluation)
}

describe('RSA Vault learning feedback', () => {
  it('shows the attempted product without substituting the secret factors', () => {
    const result = feedback('factor', { p: '2', q: '5' })
    expect(result).toMatchObject({ kind: 'error', stage: 'factor', equation: '2 × 5 = 10' })
    expect(result.instruction).toContain('N = 15')
    expect(result.equation).not.toContain('3 × 5')
  })

  it('confirms swapped factors in the order entered and points to the totient', () => {
    const result = feedback('factor', { p: '5', q: '3' })
    expect(result).toMatchObject({ kind: 'success', equation: '5 × 3 = 15' })
    expect(result.instruction).toContain('calcular φ(N)')
  })

  it.each([{ p: '', q: '5' }, { p: '-3', q: '5' }, { p: '1', q: '15' }, { p: '3.5', q: '5' }])(
    'shows the factor rule for malformed inputs without reproducing invalid values', (values) => {
      const result = feedback('factor', values)
      expect(result).toMatchObject({ kind: 'error', equation: 'p × q = N' })
      expect(result.instruction).toContain('inteiros primos maiores que 1')
    },
  )

  it('shows the totient calculation from confirmed swapped factors without solving it after an error', () => {
    const result = feedback('totient', { p: '5', q: '3', totient: '7' })
    expect(result).toMatchObject({ kind: 'error', equation: 'φ(15) = (5 − 1) × (3 − 1)' })
    expect(result.equation).not.toContain('= 8')
    expect(result.instruction).toContain('subtrações')
  })

  it('uses known challenge factors rather than unconfirmed changed fields for the totient rule', () => {
    const result = feedback('totient', { p: '11', q: '13', totient: '7' })
    expect(result.equation).toBe('φ(15) = (3 − 1) × (5 − 1)')
  })

  it('confirms a correct totient and points to the private exponent', () => {
    const result = feedback('totient', { p: '3', q: '5', totient: '8' })
    expect(result).toMatchObject({ kind: 'success', equation: 'φ(15) = 8' })
    expect(result.instruction).toContain('encontrar d')
  })

  it('explains malformed totient input without supplying the correct result', () => {
    const result = feedback('totient', { totient: '1.5' })
    expect(result.instruction).toContain('número inteiro')
    expect(result.equation).not.toContain('= 8')
  })

  it('shows the product and actual remainder of an incorrect private exponent', () => {
    const result = feedback('inverse', { privateExponent: '2' })
    expect(result).toMatchObject({ kind: 'error', equation: '3 × 2 = 6 → resto 6 (mod 8)' })
    expect(result.instruction).toContain('resto precisa ser 1')
    expect(result.equation).not.toContain('d = 3')
  })

  it('distinguishes a valid remainder from a non-canonical exponent without giving the answer', () => {
    const result = feedback('inverse', { privateExponent: '11' })
    expect(result).toMatchObject({ kind: 'error', equation: '3 × 11 = 33 → resto 1 (mod 8)' })
    expect(result.instruction).toContain('menor d positivo')
    expect(result.instruction).toContain('menor que 8')
    expect(result.instruction).not.toContain('d = 3')
  })

  it('shows the inverse rule for malformed input', () => {
    const result = feedback('inverse', { privateExponent: 'abc' })
    expect(result).toMatchObject({ kind: 'error', equation: '3 × d ≡ 1 (mod 8)' })
    expect(result.instruction).toContain('inteiro positivo')
  })

  it('confirms a correct inverse and points to the workbench', () => {
    const result = feedback('inverse', { privateExponent: '3' })
    expect(result).toMatchObject({ kind: 'success', equation: '3 × 3 = 9 → resto 1 (mod 8)' })
    expect(result.instruction).toContain('bancada')
  })

  it.each(['ABC', '', '123'])('teaches decoding without revealing the message for an incorrect attempt %s', (message) => {
    const result = feedback('decrypt', { message })
    expect(result).toMatchObject({ kind: 'error', equation: 'Cᵈ mod N → número → letra' })
    const text = `${result.title} ${result.detail} ${result.equation} ${result.instruction}`
    expect(text).not.toContain(challenge.message)
    expect(text).not.toContain(challenge.plaintextBlocks.join(', '))
    expect(result.instruction).toContain('A=1…Z=26')
    expect(result.instruction).toContain('ordem')
  })

  it('confirms only an already correct normalized message', () => {
    const result = feedback('decrypt', { message: ' g e m ' })
    expect(result).toMatchObject({ kind: 'success', equation: 'Mensagem confirmada: GEM' })
    expect(result.instruction).toContain('Aguarde a abertura')
  })

  it('keeps validation messages and feedback copy concise without mutating the inputs', () => {
    const inputs = { p: '3', q: '5', totient: '8', privateExponent: '3', message: 'GEM' }
    const before = { ...inputs }
    for (const stage of ['factor', 'totient', 'inverse', 'decrypt'] as const) {
      const evaluation = evaluateRsaStage(challenge, stage, inputs)
      const result = buildRsaLearningFeedback(challenge, stage, inputs, evaluation)
      expect(result.title).toBe(evaluation.title)
      expect(result.detail).toBe(evaluation.detail)
      expect(result.instruction.length).toBeLessThan(220)
      expect(result.equation.length).toBeLessThan(180)
    }
    expect(inputs).toEqual(before)
  })
})
