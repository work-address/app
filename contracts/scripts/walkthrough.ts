import { formatUnits, hexlify, id, parseUnits, randomBytes } from 'ethers'

import type { HardhatRuntimeEnvironment } from 'hardhat/types'

import { mintLocal } from './mint'
import { readManifest } from './local-chain'
import { advanceTime } from './time-advance'

const HOUR = 3_600
const DAY = 24 * HOUR

const TOKEN_ABI = [
  'function approve(address spender, uint256 amount)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
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
  ],
}

export type WalkthroughResult = {
  allocationId: string
  budget: bigint
  billed: bigint
  workerReceived: bigint
  feeReceived: bigint
  clientRefunded: bigint
  clientSpent: bigint
}

/**
 * One allocation from funding to settlement on the local deployment, with
 * the node's accounts #3 as client and #4 as worker: fund 120, advance to
 * work end, bill 100, advance past the dispute window, release (95 / 5) and
 * return the unbilled 20. The origin proof is signed by the deployment's own
 * origin signer, as web/api would sign it.
 */
export async function runWalkthrough(
  hre: HardhatRuntimeEnvironment,
  options: { manifest: string; log?: (line: string) => void },
): Promise<WalkthroughResult> {
  const log = options.log ?? console.log
  const manifest = await readManifest(hre, options.manifest)
  const { ethers } = hre
  const signers = await ethers.getSigners()
  const [client, worker] = [signers[3], signers[4]]
  const origin = await ethers.getSigner(manifest.originSigner)
  const decimals = manifest.token.decimals
  const usdt = (value: bigint) => `${formatUnits(value, decimals)} USDT`
  const token = new ethers.Contract(manifest.token.address, TOKEN_ABI, client)
  const escrow = await ethers.getContractAt('MarketplaceEscrow', manifest.escrow.address)
  const escrowAddress = manifest.escrow.address
  const balances = async () => ({
    client: (await token.balanceOf(client.address)) as bigint,
    worker: (await token.balanceOf(worker.address)) as bigint,
    fee: (await token.balanceOf(manifest.feeRecipient)) as bigint,
  })

  const budget = parseUnits('120', decimals)
  const billed = parseUnits('100', decimals)

  await mintLocal(hre, {
    to: client.address,
    amount: formatUnits(budget, decimals),
    manifest: options.manifest,
  })
  const start = await balances()

  const now = (await ethers.provider.getBlock('latest'))!.timestamp
  const salt = hexlify(randomBytes(32))
  const terms = {
    allocationId: id(`walkthrough-allocation-${salt}`),
    obligationId: id(`walkthrough-obligation-${salt}`),
    termsHash: id('walkthrough terms v1'),
    payer: client.address,
    payee: worker.address,
    budget,
    workStart: now + HOUR,
    workEnd: now + HOUR + DAY,
    originExpiry: now + HOUR,
  }
  const signature = await origin.signTypedData(
    {
      name: 'WorkAddressMarketplaceEscrow',
      version: '1',
      chainId: manifest.chainId,
      verifyingContract: escrowAddress,
    },
    TERMS_TYPES,
    terms,
  )

  // Mainnet USDT will not raise a non-zero allowance: reset it first.
  const allowance: bigint = await token.allowance(client.address, escrowAddress)

  if (allowance !== budget) {
    if (allowance !== BigInt(0)) {
      await (await token.approve(escrowAddress, 0)).wait()
    }
    await (await token.approve(escrowAddress, budget)).wait()
  }

  await (await escrow.connect(client).getFunction('fund')(terms, signature)).wait()
  log(`1. fund      client ${client.address} funded ${usdt(budget)}`)

  const toWorkEnd = await advanceTime(hre, terms.workEnd - (await latestTimestamp(hre)))
  log(`2. advance   chain time is now ${iso(toWorkEnd.after.timestamp)} (work end)`)

  await (
    await escrow
      .connect(worker)
      .getFunction('submitInvoice')(terms.allocationId, id('walkthrough invoice'), billed)
  ).wait()
  log(`3. submit    worker ${worker.address} billed ${usdt(billed)}`)

  const disputeWindow = Number(await escrow.getFunction('DISPUTE_WINDOW')())
  const pastDispute = await advanceTime(hre, disputeWindow)
  log(`4. advance   chain time is now ${iso(pastDispute.after.timestamp)} (dispute window over)`)

  await (await escrow.getFunction('release')(terms.allocationId)).wait()
  await (await escrow.getFunction('refundRemainder')(terms.allocationId)).wait()
  const end = await balances()
  const result: WalkthroughResult = {
    allocationId: terms.allocationId,
    budget,
    billed,
    workerReceived: end.worker - start.worker,
    feeReceived: end.fee - start.fee,
    clientRefunded: end.client - (start.client - budget),
    clientSpent: start.client - end.client,
  }

  log(
    `5. release   worker +${usdt(result.workerReceived)}, fee recipient +${usdt(result.feeReceived)}, ` +
      `client refunded ${usdt(result.clientRefunded)} (spent ${usdt(result.clientSpent)})`,
  )

  return result
}

async function latestTimestamp(hre: HardhatRuntimeEnvironment): Promise<number> {
  return (await hre.ethers.provider.getBlock('latest'))!.timestamp
}

function iso(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}
