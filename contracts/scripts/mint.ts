import { getAddress, parseEther, parseUnits, toQuantity } from 'ethers'

import type { HardhatRuntimeEnvironment } from 'hardhat/types'

import { readManifest } from './local-chain'

const TEST_TOKEN_ABI = [
  'function mint(address to, uint256 amount)',
  'function balanceOf(address owner) view returns (uint256)',
]

/** Below this a wallet cannot pay for approve + fund; it is topped up to GAS_TOP_UP. */
const GAS_FLOOR = parseEther('1')
const GAS_TOP_UP = parseEther('10')

/**
 * Mints local test USDT to any address and makes sure it can pay gas, so a
 * browser wallet that is not one of the node's own accounts can fund an
 * escrow. `amount` is in whole USDT, e.g. "1000" or "12.5".
 */
export async function mintLocal(
  hre: HardhatRuntimeEnvironment,
  options: { to: string; amount: string; manifest: string },
): Promise<{ to: string; minted: bigint; balance: bigint; gasToppedUp: boolean }> {
  const manifest = await readManifest(hre, options.manifest)
  const to = getAddress(options.to)
  const minted = parseUnits(String(options.amount), manifest.token.decimals)

  if (minted <= BigInt(0)) {
    throw new Error(`Cannot mint ${options.amount} USDT`)
  }

  const [deployer] = await hre.ethers.getSigners()
  const token = new hre.ethers.Contract(manifest.token.address, TEST_TOKEN_ABI, deployer)

  await (await token.mint(to, minted)).wait()

  const gasToppedUp = (await hre.ethers.provider.getBalance(to)) < GAS_FLOOR

  if (gasToppedUp) {
    await hre.network.provider.request({
      method: 'hardhat_setBalance',
      params: [to, toQuantity(GAS_TOP_UP)],
    })
  }

  return { to, minted, balance: await token.balanceOf(to), gasToppedUp }
}
