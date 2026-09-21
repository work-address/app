import { Interface } from 'ethers'

import type { RpcRequest } from '../src'

/**
 * A chain that exists only as the answers a test scripts for it, so the
 * verifier's handling of every reply, and of every way a reply can fail to
 * come, is checked without a node. The Hardhat suite in contracts/test holds
 * the same code to the deployed contracts.
 */
export const REGISTRY_ABI = new Interface([
  'function checkPresentation(address subject, uint32 version, bytes32 commitment, uint32 schemaId) view returns (uint8 result, bool subjectDeactivated)',
])

export type Script = {
  chainId?: number
  latest?: number
  /** null: the node has no such tag and refuses it. */
  finalized?: number | null
  /** The registry's answer by block number; a missing block answers `fallback`. */
  answers?: Record<number, [number, boolean]>
  fallback?: [number, boolean]
  /** Raw eth_call result instead of an encoded answer. */
  rawCall?: string
}

export function scriptedRpc(script: Script): { rpc: RpcRequest; asked: { method: string; params: unknown[] }[] } {
  const asked: { method: string; params: unknown[] }[] = []
  const latest = script.latest ?? 120
  const block = (number: number) => ({
    number: `0x${number.toString(16)}`,
    hash: `0x${number.toString(16).padStart(64, '0')}`,
    timestamp: `0x${(1_790_000_000 + number * 12).toString(16)}`,
  })

  const rpc: RpcRequest = async (method, params) => {
    asked.push({ method, params })

    if (method === 'eth_chainId') return `0x${(script.chainId ?? 31337).toString(16)}`

    if (method === 'eth_getBlockByNumber') {
      const tag = params[0]

      if (tag === 'latest') return block(latest)
      if (tag === 'finalized') {
        if (script.finalized === null) throw new Error('unknown block tag: finalized')

        return block(script.finalized ?? latest)
      }

      return block(Number(tag))
    }

    if (method === 'eth_call') {
      if (script.rawCall !== undefined) return script.rawCall

      const at = Number(params[1])
      const [result, deactivated] = script.answers?.[at] ?? script.fallback ?? [6, false]

      return REGISTRY_ABI.encodeFunctionResult('checkPresentation', [result, deactivated])
    }

    throw new Error(`unscripted ${method}`)
  }

  return { rpc, asked }
}
