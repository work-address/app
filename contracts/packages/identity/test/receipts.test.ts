import { expect } from 'chai'
import { Interface, Wallet } from 'ethers'
import fs from 'node:fs'
import path from 'node:path'

import { ESCROW_READ_ABI, ESCROW_STATES, RpcUnavailableError, buildReceipts, presentReceipt, readReceipt, receiptMessage, summarizeReceipts, verifyReceipt } from '../src'

import type { RpcRequest, SettlementReceipt } from '../src'

/**
 * The receipt builder and verifier on a scripted chain: the cases a real
 * escrow cannot be made to produce (a copy that pays itself, storage and
 * events that disagree, a release the chain has not finalized) and the ways
 * an endpoint fails. contracts/test/settlement-receipts runs the same code
 * against the deployed MarketplaceEscrow.
 */
const ESCROW = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
const TOKEN = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const PAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const PAYEE = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const ALLOCATION = `0x${'ab'.repeat(32)}`
const TX = `0x${'cd'.repeat(32)}`
const ABI = new Interface([...ESCROW_READ_ABI])
const MANIFEST = { chainId: 31337, deployBlock: 3, escrow: { address: ESCROW }, token: { address: TOKEN, decimals: 6 } }

type Chain = {
  latest: number
  finalized: number | null
  releasedAt: number
  payer?: string
  payee?: string
  /** What storage says was billed; the event always says 60. */
  billed?: bigint
  down?: boolean
}

function allocationAt(chain: Chain, block: number) {
  const released = block >= chain.releasedAt
  const billed = chain.billed ?? BigInt(60_000_000)

  return [
    chain.payer ?? PAYER,
    chain.payee ?? PAYEE,
    BigInt(100_000_000),
    billed,
    released ? BigInt(57_000_000) : BigInt(0),
    released ? BigInt(3_000_000) : BigInt(0),
    BigInt(0),
    1_790_000_000,
    1_790_604_800,
    1_790_864_000,
    1_791_209_600,
    ESCROW_STATES.indexOf(released ? 'Released' : 'Submitted'),
    false,
    false,
    `0x${'01'.repeat(32)}`,
    `0x${'02'.repeat(32)}`,
    `0x${'03'.repeat(32)}`,
  ]
}

function chainOf(chain: Chain): RpcRequest {
  const block = (number: number) => ({ number: `0x${number.toString(16)}`, hash: `0x${number.toString(16).padStart(64, '0')}`, timestamp: '0x6ab0a000' })

  return async (method, params) => {
    if (chain.down) throw new Error('connect ECONNREFUSED')
    if (method === 'eth_chainId') return '0x7a69'

    if (method === 'eth_getBlockByNumber') {
      if (params[0] === 'latest') return block(chain.latest)
      if (chain.finalized === null) throw new Error('unknown block tag')

      return block(chain.finalized)
    }

    if (method === 'eth_call') {
      const { data } = params[0] as { data: string }
      const at = Number(params[1])

      if (data.startsWith(ABI.getFunction('token')!.selector)) return ABI.encodeFunctionResult('token', [TOKEN])

      return ABI.encodeFunctionResult('readAllocation', [allocationAt(chain, at)])
    }

    if (method === 'eth_getLogs') {
      const { fromBlock, toBlock } = params[0] as { fromBlock: string; toBlock: string }

      if (Number(fromBlock) > chain.releasedAt || Number(toBlock) < chain.releasedAt) return []

      const { data, topics } = ABI.encodeEventLog('Released', [ALLOCATION, BigInt(60_000_000), BigInt(57_000_000), BigInt(3_000_000)])

      return [{ address: ESCROW, topics, data, blockNumber: `0x${chain.releasedAt.toString(16)}`, transactionHash: TX, logIndex: '0x2', removed: false }]
    }

    throw new Error(`unscripted ${method}`)
  }
}

async function receiptFrom(chain: Chain): Promise<SettlementReceipt> {
  const build = await buildReceipts({ subject: PAYEE, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: chainOf(chain) })

  expect(build.result).to.eq('Built')

  return build.receipts[0]
}

describe('settlement receipts', () => {
  it('names the escrow states in the order MarketplaceEscrow declares them', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../../contracts/MarketplaceEscrow.sol'), 'utf8')
    const declared = /enum State \{([^}]*)\}/.exec(source)?.[1].split(',').map((name) => name.trim())

    expect(declared).to.deep.eq([...ESCROW_STATES])
  })

  it('builds at the finalized block, and calls a release past it NotFinal on both sides', async () => {
    const settled: Chain = { latest: 60, finalized: 50, releasedAt: 40 }
    const receipt = await receiptFrom(settled)

    expect(receipt.source).to.deep.eq({ chainId: 31337, contract: ESCROW, allocationId: ALLOCATION, txHash: TX, blockNumber: 40, logIndex: 2 })
    expect(receipt.qualification).to.deep.eq({ finalizedAtBlock: 50 })

    const verified = await verifyReceipt(receipt, { manifest: MANIFEST, rpc: chainOf(settled) })

    expect([verified.result, verified.checkedAtBlock, verified.finalized]).to.deep.eq(['Verified', 50, true])

    const fresh: Chain = { latest: 60, finalized: 50, releasedAt: 55 }
    const pending = await buildReceipts({ subject: PAYEE, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: chainOf(fresh) })

    expect(pending.receipts).to.deep.eq([])
    expect(pending.allocations.map((entry) => entry.outcome)).to.deep.eq(['NotFinal'])

    const early = { ...receipt, source: { ...receipt.source, blockNumber: 55 } }

    expect((await verifyReceipt(early, { manifest: MANIFEST, rpc: chainOf(fresh) })).result).to.eq('NotFinal')
  })

  it('reports a chain with no finality as NotFinal, unless the head alone was asked for', async () => {
    const chain: Chain = { latest: 60, finalized: null, releasedAt: 40 }
    const build = await buildReceipts({ subject: PAYEE, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: chainOf(chain) })

    expect([build.result, build.receipts.length]).to.deep.eq(['NotFinal', 0])

    const head = await buildReceipts({ subject: PAYEE, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: chainOf(chain), finality: 'latest' })

    expect(head.receipts[0].qualification).to.deep.eq({ finalizedAtBlock: null })
    expect([head.checkedAtBlock, head.finalized]).to.deep.eq([60, false])
  })

  it('gives no receipt to a wallet that paid itself, or for an event storage does not back', async () => {
    const selfPaid = await buildReceipts(
      { subject: PAYEE, allocationIds: [ALLOCATION] },
      { manifest: MANIFEST, rpc: chainOf({ latest: 60, finalized: 50, releasedAt: 40, payer: PAYEE }) },
    )

    expect(selfPaid.allocations.map((entry) => entry.outcome)).to.deep.eq(['SelfPaid'])

    const disagreeing: Chain = { latest: 60, finalized: 50, releasedAt: 40, billed: BigInt(600_000_000) }
    const inflated = await buildReceipts({ subject: PAYEE, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: chainOf(disagreeing) })

    expect(inflated.allocations.map((entry) => entry.outcome)).to.deep.eq(['OutcomeMismatch'])

    const receipt = await receiptFrom({ latest: 60, finalized: 50, releasedAt: 40 })

    expect((await verifyReceipt(receipt, { manifest: MANIFEST, rpc: chainOf(disagreeing) })).result).to.eq('OutcomeMismatch')
    expect((await verifyReceipt(receipt, { manifest: MANIFEST, rpc: chainOf({ latest: 60, finalized: 50, releasedAt: 40, payer: PAYEE }) })).result).to.eq(
      'OutcomeMismatch',
    )
  })

  it('never turns an endpoint that cannot answer into a verdict on the receipt', async () => {
    const receipt = await receiptFrom({ latest: 60, finalized: 50, releasedAt: 40 })
    const down = chainOf({ latest: 60, finalized: 50, releasedAt: 40, down: true })
    const report = await verifyReceipt(receipt, { manifest: MANIFEST, rpc: down })

    expect([report.result, report.accepted, report.checkedAtBlock]).to.deep.eq(['RpcUnavailable', false, null])
    expect(report.detail).to.contain('says nothing about the receipt')
    expect((await buildReceipts({ subject: PAYEE, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: down })).result).to.eq('RpcUnavailable')

    const otherChain = { ...receipt, subject: `did:pkh:eip155:1:${PAYEE}`, source: { ...receipt.source, chainId: 1 } }
    const listed = [MANIFEST, { ...MANIFEST, chainId: 1 }]

    expect((await verifyReceipt(otherChain, { manifest: listed, rpc: chainOf({ latest: 60, finalized: 50, releasedAt: 40 }) })).result).to.eq('RpcUnavailable')
  })

  it('finds a release with one log request per allocation, however long ago the escrow was deployed', async () => {
    // A year of mainnet after the deployment: some 2.6 million blocks.
    const chain: Chain = { latest: 2_600_060, finalized: 2_600_000, releasedAt: 1_300_000 }
    const asked: { fromBlock: number; toBlock: number }[] = []
    const counted: RpcRequest = (method, params) => {
      if (method === 'eth_getLogs') {
        const { fromBlock, toBlock } = params[0] as { fromBlock: string; toBlock: string }

        asked.push({ fromBlock: Number(fromBlock), toBlock: Number(toBlock) })
      }

      return chainOf(chain)(method, params)
    }
    const build = await buildReceipts({ subject: PAYEE, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: counted })

    expect(build.receipts.map((receipt) => receipt.source.blockNumber)).to.deep.eq([1_300_000])
    expect(asked).to.deep.eq([{ fromBlock: 3, toBlock: 2_600_000 }])
  })

  it('pages the search only when the endpoint refuses the whole range at once', async () => {
    const chain: Chain = { latest: 60, finalized: 50, releasedAt: 40 }
    const asked: number[] = []
    const capped: RpcRequest = (method, params) => {
      if (method === 'eth_getLogs') {
        const { fromBlock, toBlock } = params[0] as { fromBlock: string; toBlock: string }

        asked.push(Number(toBlock) - Number(fromBlock) + 1)

        if (Number(toBlock) - Number(fromBlock) + 1 > 10) return Promise.reject(new Error('query exceeds max block range 10'))
      }

      return chainOf(chain)(method, params)
    }
    const build = await buildReceipts({ subject: PAYEE, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: capped, logRange: 10 })

    expect(build.receipts.map((receipt) => receipt.source.blockNumber)).to.deep.eq([40])
    // Blocks 3 to 50: refused as one request, then five pages of at most ten.
    expect(asked).to.deep.eq([48, 10, 10, 10, 10, 8])

    const down: RpcRequest = (method, params) =>
      method === 'eth_getLogs' ? Promise.reject(new RpcUnavailableError(method, 'connect ECONNREFUSED')) : chainOf(chain)(method, params)

    expect((await buildReceipts({ subject: PAYEE, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: down })).result).to.eq('RpcUnavailable')
  })

  it('reads exactly one shape of receipt', async () => {
    const receipt = await receiptFrom({ latest: 60, finalized: 50, releasedAt: 40 })
    const bad: [string, unknown][] = [
      ['not JSON', '{'],
      ['an extra key', { ...receipt, rating: 5 }],
      ['another claim type', { ...receipt, claimType: 'self-declared' }],
      ['an uppercase transaction hash', { ...receipt, source: { ...receipt.source, txHash: TX.toUpperCase() } }],
      ['an amount as a number', { ...receipt, outcome: { ...receipt.outcome, gross: 60000000 } }],
      ['a negative amount', { ...receipt, outcome: { ...receipt.outcome, fee: '-1' } }],
      ['a lowercase escrow address', { ...receipt, source: { ...receipt.source, contract: ESCROW.toLowerCase() } }],
      ['a subject on another chain than the source', { ...receipt, subject: `did:pkh:eip155:1:${PAYEE}` }],
      ['a Solana subject', { ...receipt, subject: 'did:pkh:solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T' }],
    ]

    expect('receipt' in readReceipt(JSON.stringify(receipt))).to.eq(true)

    for (const [name, input] of bad) {
      expect('reason' in readReceipt(input), name).to.eq(true)
      expect((await verifyReceipt(input, { manifest: MANIFEST, rpc: chainOf({ latest: 60, finalized: 50, releasedAt: 40 }) })).result, name).to.eq(
        'MalformedReceipt',
      )
    }
  })

  it('binds a presenting signature to every byte of the receipt', async () => {
    const wallet = Wallet.createRandom()
    const chain: Chain = { latest: 60, finalized: 50, releasedAt: 40, payee: wallet.address }
    const build = await buildReceipts({ subject: wallet.address, allocationIds: [ALLOCATION] }, { manifest: MANIFEST, rpc: chainOf(chain) })
    const presented = presentReceipt(build.receipts[0], await wallet.signMessage(receiptMessage(build.receipts[0])))

    expect((await verifyReceipt(presented, { manifest: MANIFEST, rpc: chainOf(chain) })).result).to.eq('Verified')

    const edited = { ...presented, outcome: { ...presented.outcome, workerNet: '58000000', fee: '2000000' } }

    expect((await verifyReceipt(edited, { manifest: MANIFEST, rpc: chainOf(chain) })).result).to.eq('SignatureInvalid')
  })

  it('adds up what it is given once per allocation, and keeps tokens apart', async () => {
    const receipt = await receiptFrom({ latest: 60, finalized: 50, releasedAt: 40 })
    const another = { ...receipt, source: { ...receipt.source, allocationId: `0x${'ef'.repeat(32)}` } }
    const otherToken = { ...another, source: { ...another.source, allocationId: `0x${'12'.repeat(32)}` }, outcome: { ...another.outcome, token: PAYER } }

    expect(summarizeReceipts([receipt, another, receipt, otherToken], 50)).to.deep.eq({
      releases: 3,
      duplicates: 1,
      totals: [
        { chainId: 31337, token: TOKEN, decimals: 6, releases: 2, gross: '120000000', workerNet: '114000000', fee: '6000000' },
        { chainId: 31337, token: PAYER, decimals: 6, releases: 1, gross: '60000000', workerNet: '57000000', fee: '3000000' },
      ],
      checkedAtBlock: 50,
    })
    expect(summarizeReceipts([])).to.deep.eq({ releases: 0, duplicates: 0, totals: [], checkedAtBlock: null })
  })
})
