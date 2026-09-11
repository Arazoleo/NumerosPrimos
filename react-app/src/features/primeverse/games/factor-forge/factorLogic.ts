import { isPrime } from '../../../../lib/math/primes'
import {
  primeFactorization,
  properDivisors,
  validateDivisor,
} from '../../../../lib/math/factorization'

import type { FactorNodeLayout, ForgeNode } from './types'

export const FORGE_CHALLENGES = [60, 84, 90, 126, 168, 210, 252, 360] as const

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

export function createRootNode(value: number, now = Date.now()): ForgeNode {
  return {
    id: 'root',
    value,
    parentId: null,
    children: null,
    depth: 0,
    createdAt: now,
    splitAt: null,
  }
}

export function splitFactorNode(
  nodes: readonly ForgeNode[],
  nodeId: string,
  divisor: number,
  now = Date.now(),
): ForgeNode[] | null {
  const node = nodes.find((candidate) => candidate.id === nodeId)

  if (!node || node.children || isPrime(node.value) || !validateDivisor(node.value, divisor)) {
    return null
  }

  const quotient = node.value / divisor
  const splitSequence = nodes.length
  const leftId = `${node.id}-l${splitSequence}`
  const rightId = `${node.id}-r${splitSequence}`
  const childDepth = node.depth + 1

  return [
    ...nodes.map((candidate) =>
      candidate.id === nodeId
        ? { ...candidate, children: [leftId, rightId] as const, splitAt: now }
        : candidate,
    ),
    {
      id: leftId,
      value: divisor,
      parentId: node.id,
      children: null,
      depth: childDepth,
      createdAt: now,
      splitAt: null,
    },
    {
      id: rightId,
      value: quotient,
      parentId: node.id,
      children: null,
      depth: childDepth,
      createdAt: now,
      splitAt: null,
    },
  ]
}

export function getLeafNodes(nodes: readonly ForgeNode[]): ForgeNode[] {
  return nodes.filter((node) => node.children === null)
}

export function getCompositeLeaves(nodes: readonly ForgeNode[]): ForgeNode[] {
  return getLeafNodes(nodes).filter((node) => !isPrime(node.value))
}

export function isFactorTreeComplete(nodes: readonly ForgeNode[]): boolean {
  const leaves = getLeafNodes(nodes)
  return leaves.length > 1 && leaves.every((node) => isPrime(node.value))
}

export function getDivisorOptions(value: number, limit = 6): number[] {
  const center = Math.sqrt(value)

  return properDivisors(value)
    .filter((divisor) => divisor > 1 && validateDivisor(value, divisor))
    .sort((a, b) => Math.abs(center - a) - Math.abs(center - b) || a - b)
    .slice(0, limit)
}

export function getOptimalStepCount(value: number): number {
  return Math.max(0, primeFactorization(value).length - 1)
}

export function formatPrimeProduct(valueOrFactors: number | readonly number[]): string {
  const factors = Array.isArray(valueOrFactors)
    ? [...valueOrFactors]
    : primeFactorization(valueOrFactors as number)
  const counts = new Map<number, number>()

  factors.forEach((factor) => counts.set(factor, (counts.get(factor) ?? 0) + 1))

  return [...counts.entries()]
    .map(([factor, exponent]) => {
      if (exponent === 1) return String(factor)
      const raised = String(exponent)
        .split('')
        .map((digit) => SUPERSCRIPT_DIGITS[digit] ?? digit)
        .join('')
      return `${factor}${raised}`
    })
    .join(' × ')
}

export function calculateForgeScore({
  value,
  elapsedMs,
  steps,
  invalidAttempts,
}: {
  value: number
  elapsedMs: number
  steps: number
  invalidAttempts: number
}): number {
  const optimalSteps = getOptimalStepCount(value)
  const complexity = Math.round(Math.log2(value) * 120)
  const speedBonus = Math.max(0, 1_500 - Math.floor(elapsedMs / 80))
  const efficiencyBonus = Math.max(0, 600 - Math.max(0, steps - optimalSteps) * 120)
  const precisionBonus = Math.max(0, 400 - invalidAttempts * 100)

  return Math.max(100, 500 + complexity + speedBonus + efficiencyBonus + precisionBonus)
}

export function calculateForgeXp(score: number, invalidAttempts: number): number {
  const precisionMultiplier = invalidAttempts === 0 ? 1.15 : 1
  return Math.max(25, Math.min(300, Math.round((score / 16) * precisionMultiplier)))
}

export function nextChallengeValue(currentValue: number): number {
  const currentIndex = FORGE_CHALLENGES.indexOf(
    currentValue as (typeof FORGE_CHALLENGES)[number],
  )
  return FORGE_CHALLENGES[(currentIndex + 1 + FORGE_CHALLENGES.length) % FORGE_CHALLENGES.length]
}

export function layoutFactorTree(nodes: readonly ForgeNode[]): FactorNodeLayout[] {
  if (nodes.length === 0) return []

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const leafWidths = new Map<string, number>()

  const measure = (id: string): number => {
    const node = byId.get(id)
    if (!node?.children) {
      leafWidths.set(id, 1)
      return 1
    }

    const width = measure(node.children[0]) + measure(node.children[1])
    leafWidths.set(id, width)
    return width
  }

  measure('root')
  const positions = new Map<string, FactorNodeLayout['position']>()
  let leafCursor = 0

  const place = (id: string): number => {
    const node = byId.get(id)
    if (!node) return 0

    let x: number
    if (!node.children) {
      x = leafCursor * 2.25
      leafCursor += 1
    } else {
      const leftX = place(node.children[0])
      const rightX = place(node.children[1])
      x = (leftX + rightX) / 2
    }

    positions.set(id, [x, -node.depth * 2.15, 0])
    return x
  }

  place('root')
  const totalWidth = Math.max(1, leafWidths.get('root') ?? 1)
  const centerOffset = ((totalWidth - 1) * 2.25) / 2

  return nodes.map((node) => {
    const position = positions.get(node.id) ?? [0, -node.depth * 2.15, 0]
    return {
      id: node.id,
      position: [position[0] - centerOffset, position[1], position[2]],
    }
  })
}

