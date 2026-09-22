import { expect } from 'chai'
import hre, { ethers } from 'hardhat'
import { createProvider } from 'hardhat/internal/core/providers/construction'

import type { ContractTransactionResponse } from 'ethers'
import type { EIP1193Provider } from 'hardhat/types'

import { startRpcBridge } from './helpers/rpc-bridge'

/**
 * MarketplaceEscrow against the real Tether bytecode (ESC-G18). usdt-mainnet
 * pins USDT's behaviour on TetherLikeUSDT, a reproduction; this suite runs the
 * same money path on the deployed token at 0xdAC17F958D2ee523a2206206994597C13D831ec7,
 * on an in-process fork of mainnet, where every transaction goes to the fork
 * and mainnet is only read.
 *
 * It is opt-in: it needs MAINNET_RPC_URL, an endpoint of the reader's own,
 * which nothing in this repository sets, and without it it is skipped with
 * that said. Its flow is not left untested meanwhile: the same code runs
 * every time against a fork of a local chain that holds TetherLikeUSDT.
 */

const MAINNET_USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const HOUR = 3600
const DAY = 24 * HOUR
const BUDGET = BigInt(100_000_000)
const BILLED = BigInt(60_000_000)

const TOKEN_ABI = [
  'function approve(address spender, uint256 value)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value)',
  'function owner() view returns (address)',
  'function issue(uint256 amount)',
  'function mint(address to, uint256 amount)',
]

const TERMS_TYPES = {
  Terms: [
    { name: 'allocationId', type: 'bytes32' },
    { name: 'obligationId', type: 'bytes32' },
    { name: 'termsHash', type: 'bytes32' },
    { name: 'payer', type: 'address' },
    { name: 'payee', type: 'address' },
    { name: 'budget', type: 'uint256' },
    { name: 'workStart', type: 'uint64' },
    { name: 'workEnd', type: 'uint64' },
    { name: 'originExpiry', type: 'uint64' },
    { name: 'earlySubmission', type: 'bool' },
  ],
}

/** How a forked chain's token reaches the client: minted, or issued by its owner and sent. */
type Give = (fork: EIP1193Provider, token: string, to: string, amount: bigint) => Promise<void>

async function forkOf(url: string, blockNumber?: number): Promise<EIP1193Provider> {
  const fork = await createProvider(hre.config, 'hardhat', hre.artifacts)

  await fork.request({
    method: 'hardhat_reset',
    params: [{ forking: { jsonRpcUrl: url, ...(blockNumber === undefined ? {} : { blockNumber }) } }],
  })

  return fork
}

async function mined(sent: Promise<ContractTransactionResponse>): Promise<void> {
  await (await sent).wait()
}

async function reverts(sent: () => Promise<ContractTransactionResponse>): Promise<boolean> {
  try {
    await mined(sent())
  } catch {
    return true
  }

  return false
}

/**
 * Fund, submit and release one allocation on `token` on the fork, the way the
 * escrow panel does, with the approve-reset rule in the middle: a second
 * non-zero approval over a non-zero allowance reverts, and zero first works.
 */
async function settleOnFork(fork: EIP1193Provider, token: string, give: Give) {
  // No response cache: ethers otherwise answers a repeated estimate from the
  // one it made a moment ago, and the approval that must fail is repeated
  // right after the allowance is reset.
  const provider = new ethers.BrowserProvider(fork, undefined, { cacheTimeout: -1 })
  const accounts = (await fork.request({ method: 'eth_accounts' })) as string[]
  const [deployer, feeRecipient, origin, client, worker] = accounts
    .slice(0, 5)
    .map((account) => new ethers.JsonRpcSigner(provider, ethers.getAddress(account)))
  const artifact = await hre.artifacts.readArtifact('MarketplaceEscrow')
  const deployed = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer).deploy(
    token,
    feeRecipient.address,
    origin.address,
  )

  await deployed.waitForDeployment()

  const escrowAddress = await deployed.getAddress()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const escrow = deployed as any
  const usdt = new ethers.Contract(token, TOKEN_ABI, client)

  await give(fork, token, client.address, BUDGET)

  await mined(usdt.approve(escrowAddress, 1))
  const approveResetEnforced = await reverts(() => usdt.approve(escrowAddress, BUDGET))
  await mined(usdt.approve(escrowAddress, 0))
  await mined(usdt.approve(escrowAddress, BUDGET))

  const now = (await provider.getBlock('latest'))!.timestamp
  const terms = {
    allocationId: ethers.id('real-usdt-allocation'),
    obligationId: ethers.id('real-usdt-obligation'),
    termsHash: ethers.id('real-usdt-terms'),
    payer: client.address,
    payee: worker.address,
    budget: BUDGET,
    workStart: now + HOUR,
    workEnd: now + DAY,
    originExpiry: now + DAY,
    earlySubmission: false,
  }
  const signature = await origin.signTypedData(
    {
      name: 'WorkAddressMarketplaceEscrow',
      version: '1',
      chainId: (await provider.getNetwork()).chainId,
      verifyingContract: escrowAddress,
    },
    TERMS_TYPES,
    terms,
  )

  await mined(escrow.connect(client).fund(terms, signature))

  const held = await usdt.balanceOf(escrowAddress)

  await fork.request({ method: 'evm_setNextBlockTimestamp', params: [terms.workEnd] })
  await fork.request({ method: 'evm_mine', params: [] })
  await mined(escrow.connect(worker).submitInvoice(terms.allocationId, ethers.id('invoice'), BILLED))
  await fork.request({ method: 'evm_increaseTime', params: [7 * DAY + 1] })
  await fork.request({ method: 'evm_mine', params: [] })

  const workerBefore: bigint = await usdt.balanceOf(worker.address)
  const feeBefore: bigint = await usdt.balanceOf(feeRecipient.address)

  await mined(escrow.release(terms.allocationId))
  await mined(escrow.refundRemainder(terms.allocationId))

  return {
    approveResetEnforced,
    held,
    workerReceived: (await usdt.balanceOf(worker.address)) - workerBefore,
    feeReceived: (await usdt.balanceOf(feeRecipient.address)) - feeBefore,
    escrowLeft: await usdt.balanceOf(escrowAddress),
    clientLeft: await usdt.balanceOf(client.address),
  }
}

function expectSettled(result: Awaited<ReturnType<typeof settleOnFork>>) {
  expect(result.approveResetEnforced, 'approve over a non-zero allowance reverts').to.eq(true)
  expect(result.held).to.eq(BUDGET)
  expect(result.workerReceived).to.eq((BILLED * BigInt(95)) / BigInt(100))
  expect(result.feeReceived).to.eq((BILLED * BigInt(5)) / BigInt(100))
  expect(result.escrowLeft).to.eq(BigInt(0))
  expect(result.clientLeft).to.eq(BUDGET - BILLED)
}

describe('MarketplaceEscrow on a fork, against a deployed Tether-style token', function () {
  this.timeout(300_000)

  it('the fork flow settles 95 / 5 on a fork of a local chain holding TetherLikeUSDT', async () => {
    const source = await createProvider(hre.config, 'hardhat', hre.artifacts)
    const [deployer] = (await source.request({ method: 'eth_accounts' })) as string[]
    const factory = await hre.ethers.getContractFactory('TetherLikeUSDT')
    const sent = (await source.request({
      method: 'eth_sendTransaction',
      params: [{ from: deployer, data: (await factory.getDeployTransaction()).data }],
    })) as string
    const receipt = (await source.request({ method: 'eth_getTransactionReceipt', params: [sent] })) as {
      contractAddress: string
    }
    const bridge = await startRpcBridge(source)

    try {
      const mint: Give = async (fork, token, to, amount) => {
        const provider = new ethers.BrowserProvider(fork)
        const [minter] = (await fork.request({ method: 'eth_accounts' })) as string[]

        await mined(new ethers.Contract(token, TOKEN_ABI, new ethers.JsonRpcSigner(provider, minter)).mint(to, amount))
      }

      expectSettled(await settleOnFork(await forkOf(bridge.url), ethers.getAddress(receipt.contractAddress), mint))
    } finally {
      await bridge.close()
    }
  })

  const mainnet = (process.env.MAINNET_RPC_URL ?? '').trim()

  it(
    mainnet === ''
      ? 'settles on the real USDT on a mainnet fork (skipped: MAINNET_RPC_URL is not set, and nothing here sets it)'
      : 'settles on the real USDT on a mainnet fork, reading mainnet only',
    async function () {
      if (mainnet === '') {
        this.skip()
      }

      const block = process.env.MAINNET_FORK_BLOCK ? Number(process.env.MAINNET_FORK_BLOCK) : undefined
      const fork = await forkOf(mainnet, block)

      expect(await fork.request({ method: 'eth_getCode', params: [MAINNET_USDT, 'latest'] })).not.to.eq('0x')

      // The issuer mints to itself and sends on: no holder's balance is assumed.
      const issue: Give = async (forked, token, to, amount) => {
        const provider = new ethers.BrowserProvider(forked)
        const owner = ethers.getAddress(await new ethers.Contract(token, TOKEN_ABI, provider).owner())

        await forked.request({ method: 'hardhat_impersonateAccount', params: [owner] })
        await forked.request({ method: 'hardhat_setBalance', params: [owner, ethers.toQuantity(ethers.parseEther('10'))] })

        const tether = new ethers.Contract(token, TOKEN_ABI, new ethers.JsonRpcSigner(provider, owner))

        await mined(tether.issue(amount))
        await mined(tether.transfer(to, amount))
      }

      expectSettled(await settleOnFork(fork, MAINNET_USDT, issue))
    },
  )
})
