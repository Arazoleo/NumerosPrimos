import { describe, expect, it } from 'vitest'

import {
  createRootNode,
  formatPrimeProduct,
  getDivisorOptions,
  getLeafNodes,
  getOptimalStepCount,
  isFactorTreeComplete,
  layoutFactorTree,
  splitFactorNode,
} from './factorLogic'
import type { ForgeNode } from './types'

function split(nodes: readonly ForgeNode[], nodeId: string, divisor: number): ForgeNode[] {
  const result = splitFactorNode(nodes, nodeId, divisor, 100)
  if (!result) throw new Error(`Expected ${divisor} to split ${nodeId}`)
  return result
}

describe('Factor Forge logic', () => {
  it('supports the 84 → 12 × 7 → 3 × 4 → 2 × 2 path', () => {
    let nodes = [createRootNode(84, 0)]
    nodes = split(nodes, 'root', 12)

    const twelve = getLeafNodes(nodes).find((node) => node.value === 12)
    expect(twelve).toBeDefined()
    nodes = split(nodes, twelve!.id, 3)

    const four = getLeafNodes(nodes).find((node) => node.value === 4)
    expect(four).toBeDefined()
    nodes = split(nodes, four!.id, 2)

    expect(isFactorTreeComplete(nodes)).toBe(true)
    expect(getLeafNodes(nodes).map((node) => node.value).sort((a, b) => a - b)).toEqual([2, 2, 3, 7])
  })

  it('accepts a different valid path to the same unique prime product', () => {
    let nodes = [createRootNode(60, 0)]
    nodes = split(nodes, 'root', 6)

    const six = getLeafNodes(nodes).find((node) => node.value === 6)!
    const ten = getLeafNodes(nodes).find((node) => node.value === 10)!
    nodes = split(nodes, six.id, 2)
    nodes = split(nodes, ten.id, 5)

    const leaves = getLeafNodes(nodes).map((node) => node.value).sort((a, b) => a - b)
    expect(isFactorTreeComplete(nodes)).toBe(true)
    expect(leaves).toEqual([2, 2, 3, 5])
    expect(formatPrimeProduct(leaves)).toBe('2² × 3 × 5')
  })

  it('rejects invalid moves without changing the tree', () => {
    const nodes = [createRootNode(84, 0)]
    expect(splitFactorNode(nodes, 'root', 5, 100)).toBeNull()
    expect(splitFactorNode(nodes, 'root', 1, 100)).toBeNull()
    expect(nodes).toHaveLength(1)
  })

  it('offers useful divisors and knows the optimal binary split count', () => {
    expect(getDivisorOptions(84)).toContain(7)
    expect(getDivisorOptions(84)).not.toContain(1)
    expect(getOptimalStepCount(84)).toBe(3)
  })

  it('lays every tree node out at a unique point', () => {
    let nodes = [createRootNode(60, 0)]
    nodes = split(nodes, 'root', 6)
    const layout = layoutFactorTree(nodes)
    const points = new Set(layout.map((item) => item.position.join(',')))

    expect(layout).toHaveLength(nodes.length)
    expect(points.size).toBe(nodes.length)
  })
})
