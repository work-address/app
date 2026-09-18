import type { HardhatRuntimeEnvironment } from 'hardhat/types'

import { requireLocalChain } from './local-chain'

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400 }

export type BlockTime = { number: number; timestamp: number }

/** `90`, `90s`, `15m`, `72h` or `8d` as a positive whole number of seconds. */
export function parseDuration(input: string): number {
  const match = /^(\d+)([smhd]?)$/.exec(String(input).trim())
  const seconds = match ? Number(match[1]) * UNIT_SECONDS[match[2] || 's'] : NaN

  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(
      `Cannot read "${input}" as a duration: use seconds or a number with s, m, h or d, e.g. 90, 72h, 8d`,
    )
  }

  return seconds
}

async function latest(hre: HardhatRuntimeEnvironment): Promise<BlockTime> {
  const block = await hre.ethers.provider.getBlock('latest')

  if (!block) {
    throw new Error('The node returned no latest block')
  }

  return { number: block.number, timestamp: block.timestamp }
}

/**
 * Moves the local chain's clock forward and mines a block, so the new time is
 * what `block.timestamp` — and anything reading the latest block — sees.
 * Only the chain moves: an API signing terms still reads the wall clock.
 */
export async function advanceTime(
  hre: HardhatRuntimeEnvironment,
  seconds: number,
): Promise<{ before: BlockTime; after: BlockTime }> {
  await requireLocalChain(hre)

  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(`Cannot advance by ${seconds} seconds`)
  }

  const before = await latest(hre)

  await hre.network.provider.request({ method: 'evm_increaseTime', params: [seconds] })
  await hre.network.provider.request({ method: 'evm_mine', params: [] })

  return { before, after: await latest(hre) }
}
