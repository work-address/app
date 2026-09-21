import { expect } from 'chai'
import hre, { ethers } from 'hardhat'
import { loadFixture, takeSnapshot, time } from '@nomicfoundation/hardhat-network-helpers'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  ESCROW_READ_ABI,
  buildReceipts,
  findAllocationsPaidTo,
  presentReceipt,
  receiptMessage,
  serializeReceipt,
  verifyReceipt,
  verifyReceipts,
} from '../packages/identity/src'

import { inProcessRpc, startRpcBridge } from './helpers/rpc-bridge'

import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import type { OriginCertificate, SettlementReceipt } from '../packages/identity/src'

/**
 * ID-09: qualified work receipts, built from and checked against the
 * escrow's own `Released` events and `readAllocation`, by someone holding a
 * deployment manifest and an RPC endpoint and nothing else. There is no
 * receipts contract to deploy here, by decision: MarketplaceEscrow and a
 * test token are the whole chain side.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const USDT = (value: number) => ethers.parseUnits(String(value), 6)
const HOUR = 60 * 60
const DAY = 24 * HOUR
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
const DOMAIN = { name: 'WorkAddressMarketplaceEscrow', version: '1' }

async function deploy() {
  const [origin, client, worker, platform, stranger] = await ethers.getSigners()
  const token: Any = await (await ethers.getContractFactory('MockUSDT')).deploy()
  const Escrow = await ethers.getContractFactory('MarketplaceEscrow')
  const deployBlock = (await ethers.provider.getBlockNumber()) + 1
  const escrow: Any = await Escrow.deploy(await token.getAddress(), platform.address, origin.address)
  // The same bytecode, the same origin signer, the same token: only the manifest tells it from the real one.
  const clone: Any = await Escrow.deploy(await token.getAddress(), platform.address, origin.address)
  const chainId = Number((await ethers.provider.getNetwork()).chainId)

  await token.mint(client.address, USDT(10_000))

  for (const target of [escrow, clone]) {
    await token.connect(client).approve(await target.getAddress(), ethers.MaxUint256)
  }

  const manifest = {
    network: 'hardhat',
    chainId,
    deployBlock,
    originSigner: origin.address,
    token: { contract: 'MockUSDT', address: await token.getAddress(), decimals: 6 },
    escrow: { contract: 'MarketplaceEscrow', address: await escrow.getAddress() },
  }

  return { origin, client, worker, platform, stranger, token, escrow, clone, chainId, manifest }
}

type Deployed = Awaited<ReturnType<typeof deploy>>

let sequence = 0

/** Funds one allocation on `target` and answers its signed terms. */
async function fund(deployed: Deployed, target: Any, overrides: Record<string, unknown> = {}) {
  const { origin, client, worker, chainId } = deployed
  const now = await time.latest()
  const label = `receipts-${(sequence += 1)}`
  const terms = {
    allocationId: ethers.id(`allocation-${label}`),
    obligationId: ethers.id(`obligation-${label}`),
    termsHash: ethers.id('accepted terms'),
    payer: client.address,
    payee: worker.address,
    budget: USDT(100),
    workStart: now + HOUR,
    workEnd: now + HOUR + 7 * DAY,
    originExpiry: now + DAY,
    earlySubmission: false,
    ...overrides,
  }
  const signature = await origin.signTypedData({ ...DOMAIN, chainId, verifyingContract: await target.getAddress() }, TERMS_TYPES, terms)

  await target.connect(client).fund(terms, signature)

  return { terms, signature }
}

/** Fund, bill `billed` after the period, wait out the dispute window, release. */
async function released(deployed: Deployed, target: Any, billed: bigint, overrides: Record<string, unknown> = {}) {
  const funded = await fund(deployed, target, overrides)
  const payee = (await ethers.getSigners()).find((signer) => signer.address === funded.terms.payee) as HardhatEthersSigner

  await time.increaseTo(funded.terms.workEnd)
  await target.connect(payee).submitInvoice(funded.terms.allocationId, ethers.id('invoice'), billed)
  await time.increase(7 * DAY)
  await target.connect(deployed.stranger).release(funded.terms.allocationId)

  return funded
}

describe('settlement receipts from Released events', function () {
  this.timeout(120_000)

  const rpc = inProcessRpc(hre.network.provider)

  it('reads the escrow with fragments the compiled ABI has, signature for signature', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/escrow-abi.contract.json'), 'utf8')) as {
      functions: string[]
      events: string[]
    }

    for (const fragment of ESCROW_READ_ABI) {
      expect([...fixture.functions, ...fixture.events], fragment).to.include(fragment)
    }
  })

  it('1) fund, submit, 7 days, release: a receipt of worker 57 and fee 3 for 60 billed, and it verifies', async () => {
    const deployed = await loadFixture(deploy)
    const { worker, client, escrow, token, chainId, manifest } = deployed
    const { terms } = await released(deployed, escrow, USDT(60))
    const build = await buildReceipts({ subject: worker.address, allocationIds: [terms.allocationId] }, { manifest, rpc })

    expect(build.result).to.eq('Built')
    expect(build.allocations.map((entry) => entry.outcome)).to.deep.eq(['Released'])
    expect(build.receipts).to.have.length(1)

    const [receipt] = build.receipts
    const head = await ethers.provider.getBlockNumber()

    expect(receipt).to.deep.eq({
      format: 'work-address/settlement-receipt',
      formatVersion: 1,
      claimType: 'escrow-release',
      subject: `did:pkh:eip155:${chainId}:${worker.address}`,
      payer: client.address,
      source: {
        chainId,
        contract: await escrow.getAddress(),
        allocationId: terms.allocationId,
        txHash: receipt.source.txHash,
        blockNumber: head,
        logIndex: receipt.source.logIndex,
      },
      outcome: { gross: '60000000', workerNet: '57000000', fee: '3000000', token: await token.getAddress(), decimals: 6 },
      period: { workStart: terms.workStart, workEnd: terms.workEnd },
      termsHash: terms.termsHash,
      invoiceCommitment: ethers.id('invoice'),
      qualification: { finalizedAtBlock: head },
      signature: null,
    })

    // The event the receipt names is the one in that transaction.
    const mined = await ethers.provider.getTransactionReceipt(receipt.source.txHash)

    expect(mined?.logs.some((log) => log.index === receipt.source.logIndex && log.address === receipt.source.contract)).to.eq(true)

    const report = await verifyReceipt(serializeReceipt(receipt), { manifest, rpc, expectedSubject: worker.address })

    expect([report.result, report.accepted, report.checkedAtBlock, report.finalized]).to.deep.eq(['Verified', true, head, true])
    expect(report.detail).to.contain('Payment is not proof of skill')

    // A receipt that says more than the event does is not the event's receipt.
    for (const forged of [
      { ...receipt, outcome: { ...receipt.outcome, workerNet: '60000000', fee: '0' } },
      { ...receipt, payer: worker.address },
      { ...receipt, termsHash: ethers.id('other terms') },
      { ...receipt, period: { ...receipt.period, workEnd: receipt.period.workEnd + 1 } },
    ]) {
      expect((await verifyReceipt(forged, { manifest, rpc })).result).to.eq('OutcomeMismatch')
    }
  })

  it('2) SC-A06: a dispute, an expiry and a cancellation before work each earn no receipt, and each is named', async () => {
    const deployed = await loadFixture(deploy)
    const { worker, client, stranger, escrow, manifest } = deployed

    const cancelled = await fund(deployed, escrow)

    await escrow.connect(client).cancelBeforeWork(cancelled.terms.allocationId)

    const disputed = await fund(deployed, escrow)

    await time.increaseTo(disputed.terms.workEnd)
    await escrow.connect(worker).submitInvoice(disputed.terms.allocationId, ethers.id('invoice'), USDT(60))
    await escrow.connect(client).dispute(disputed.terms.allocationId)

    const expired = await fund(deployed, escrow)

    await time.increaseTo(expired.terms.workEnd + 72 * HOUR + 1)
    await escrow.connect(stranger).refundExpired(expired.terms.allocationId)

    const held = await fund(deployed, escrow)
    const build = await buildReceipts(
      {
        subject: worker.address,
        allocationIds: [cancelled, disputed, expired, held].map(({ terms }) => terms.allocationId).concat(ethers.id('never funded')),
      },
      { manifest, rpc },
    )

    expect(build.receipts).to.deep.eq([])
    expect(build.allocations.map((entry) => [entry.outcome, entry.refunded])).to.deep.eq([
      ['CancelledBeforeWork', USDT(100).toString()],
      // The disputed bill goes back; the unbilled remainder is a separate refund the payer may still take.
      ['DisputeRefunded', USDT(60).toString()],
      ['ExpiredRefunded', USDT(100).toString()],
      ['Funded', null],
      ['NotFound', null],
    ])

    // And a receipt written by hand for the disputed one is refused by the chain.
    const paid = await released(deployed, escrow, USDT(60))
    const [real] = (await buildReceipts({ subject: worker.address, allocationIds: [paid.terms.allocationId] }, { manifest, rpc })).receipts
    const claimed = { ...real, source: { ...real.source, allocationId: disputed.terms.allocationId } }

    expect((await verifyReceipt(claimed, { manifest, rpc })).result).to.eq('NotFound')
  })

  it('3) the same Released event from an escrow the manifest does not list is RegistryNotInManifest', async () => {
    const deployed = await loadFixture(deploy)
    const { worker, escrow, clone, manifest } = deployed
    const onClone = await released(deployed, clone, USDT(60))
    const cloneAddress: string = await clone.getAddress()
    const asked: string[] = []
    const counting = (method: string, params: unknown[]) => {
      asked.push(method)

      return rpc(method, params)
    }

    const refused = await buildReceipts({ subject: worker.address, allocationIds: [onClone.terms.allocationId], escrow: cloneAddress }, { manifest, rpc })

    expect([refused.result, refused.receipts.length]).to.deep.eq(['RegistryNotInManifest', 0])

    // Asked of the listed escrow instead, the allocation simply is not there.
    const elsewhere = await buildReceipts({ subject: worker.address, allocationIds: [onClone.terms.allocationId] }, { manifest, rpc })

    expect(elsewhere.allocations.map((entry) => entry.outcome)).to.deep.eq(['NotFound'])

    // Someone who lists the clone gets a structurally perfect receipt from it...
    const trusting = { ...manifest, escrow: { contract: 'MarketplaceEscrow', address: cloneAddress } }
    const [perfect] = (await buildReceipts({ subject: worker.address, allocationIds: [onClone.terms.allocationId] }, { manifest: trusting, rpc })).receipts

    expect(perfect.outcome.workerNet).to.eq('57000000')
    expect((await verifyReceipt(perfect, { manifest: trusting, rpc })).result).to.eq('Verified')

    // ...which the real manifest refuses without asking the chain anything.
    const report = await verifyReceipt(perfect, { manifest, rpc: counting })

    expect([report.result, report.accepted]).to.deep.eq(['RegistryNotInManifest', false])
    expect(asked).to.deep.eq([])
    expect(await escrow.getAddress()).to.not.eq(cloneAddress)
  })

  it('4) a receipt presented for subject C where the payee is B is refused', async () => {
    const deployed = await loadFixture(deploy)
    const { worker, stranger, escrow, chainId, manifest } = deployed
    const { terms } = await released(deployed, escrow, USDT(60))

    const asStranger = await buildReceipts({ subject: stranger.address, allocationIds: [terms.allocationId] }, { manifest, rpc })

    expect(asStranger.receipts).to.deep.eq([])
    expect(asStranger.allocations.map((entry) => entry.outcome)).to.deep.eq(['PayeeMismatch'])

    const [receipt] = (await buildReceipts({ subject: worker.address, allocationIds: [terms.allocationId] }, { manifest, rpc })).receipts
    const relabelled: SettlementReceipt = { ...receipt, subject: `did:pkh:eip155:${chainId}:${stranger.address}` }

    expect((await verifyReceipt(relabelled, { manifest, rpc })).result).to.eq('SubjectMismatch')
    expect((await verifyReceipt(receipt, { manifest, rpc, expectedSubject: stranger.address })).result).to.eq('SubjectMismatch')

    // The subject may sign what they present; nobody else's signature will do.
    const presented = presentReceipt(receipt, await worker.signMessage(receiptMessage(receipt)))

    expect((await verifyReceipt(presented, { manifest, rpc })).result).to.eq('Verified')
    expect(() => presentReceipt(receipt, '0x' + '11'.repeat(65))).to.throw("not the subject's signature")

    const forged = { ...receipt, signature: { scheme: 'eip191' as const, value: await stranger.signMessage(receiptMessage(receipt)) } }

    expect((await verifyReceipt(forged, { manifest, rpc })).result).to.eq('SignatureInvalid')
  })

  it('5) SC-A15: after the release is reverted away the receipt is NotFound, not verified', async () => {
    const deployed = await loadFixture(deploy)
    const { worker, escrow, manifest } = deployed
    const funded = await fund(deployed, escrow)

    await time.increaseTo(funded.terms.workEnd)
    await escrow.connect(worker).submitInvoice(funded.terms.allocationId, ethers.id('invoice'), USDT(60))
    await time.increase(7 * DAY)

    const beforeRelease = await takeSnapshot()

    await escrow.connect(deployed.stranger).release(funded.terms.allocationId)

    const [receipt] = (await buildReceipts({ subject: worker.address, allocationIds: [funded.terms.allocationId] }, { manifest, rpc })).receipts

    expect((await verifyReceipt(receipt, { manifest, rpc })).result).to.eq('Verified')

    await beforeRelease.restore()

    const gone = await verifyReceipt(receipt, { manifest, rpc })

    expect([gone.result, gone.accepted]).to.deep.eq(['NotFound', false])

    // The chain moves on to the same height without the release: still not found, and still not released.
    await time.increase(60)
    await hre.network.provider.request({ method: 'hardhat_mine', params: ['0x3'] })

    expect((await verifyReceipt(receipt, { manifest, rpc })).result).to.eq('NotFound')
    expect((await buildReceipts({ subject: worker.address, allocationIds: [funded.terms.allocationId] }, { manifest, rpc })).allocations[0].outcome).to.eq(
      'Submitted',
    )
  })

  it('6) the same allocation listed twice counts once', async () => {
    const deployed = await loadFixture(deploy)
    const { worker, escrow, manifest } = deployed
    const first = await released(deployed, escrow, USDT(60))
    const second = await released(deployed, escrow, USDT(100))
    const ids = [first.terms.allocationId, first.terms.allocationId.toUpperCase().replace('0X', '0x'), second.terms.allocationId, first.terms.allocationId]
    const build = await buildReceipts({ subject: worker.address, allocationIds: ids }, { manifest, rpc })

    expect(build.receipts).to.have.length(2)
    expect(build.allocations).to.have.length(2)

    const checked = await verifyReceipts([build.receipts[0], build.receipts[1], build.receipts[0]], { manifest, rpc })

    expect(checked.reports.map((report) => [report.result, report.duplicate])).to.deep.eq([
      ['Verified', false],
      ['Verified', false],
      ['Verified', true],
    ])
    expect(checked.summary.releases).to.eq(2)
    expect(checked.summary.duplicates).to.eq(1)
    expect(checked.summary.totals).to.deep.eq([
      {
        chainId: deployed.chainId,
        token: await deployed.token.getAddress(),
        decimals: 6,
        releases: 2,
        gross: '160000000',
        workerNet: '152000000',
        fee: '8000000',
      },
    ])
  })

  it('finds its own candidates from the funding events, for a verifier who asks the marketplace nothing', async () => {
    const deployed = await loadFixture(deploy)
    const { worker, stranger, escrow, clone, manifest } = deployed
    const mine = await released(deployed, escrow, USDT(60))
    const theirs = await fund(deployed, escrow, { payee: stranger.address })

    await released(deployed, clone, USDT(60))

    expect(await findAllocationsPaidTo(worker.address, { manifest, rpc, logRange: 5 })).to.deep.eq([mine.terms.allocationId])
    expect(await findAllocationsPaidTo(stranger.address, { manifest, rpc })).to.deep.eq([theirs.terms.allocationId])
  })

  it('opens the terms the payment was made under, against the origin signer the chain itself names', async () => {
    const deployed = await loadFixture(deploy)
    const { worker, stranger, escrow, chainId, manifest } = deployed
    const preimage = { version: 'work-address:terms:v2', contractId: 'c0ffee00-0000-4000-8000-000000000001', origin: { jobId: 'j', applicationId: 'a', clientId: 'c', freelancerId: 'f', previousContractId: null }, title: 'Build the thing', amount: '60' }
    const termsHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(preimage)))
    const { terms, signature } = await released(deployed, escrow, USDT(60), { termsHash })
    const [receipt] = (await buildReceipts({ subject: worker.address, allocationIds: [terms.allocationId] }, { manifest, rpc })).receipts
    const certificate: OriginCertificate = {
      contractId: preimage.contractId,
      version: 2,
      preimage,
      termsHash,
      domain: DOMAIN,
      types: TERMS_TYPES,
      allocations: [{ ...terms, budget: terms.budget.toString(), chainId, escrowAddress: await escrow.getAddress(), signature }],
    }

    const opened = await verifyReceipt(receipt, { manifest, rpc, certificate })

    expect(opened.result).to.eq('Verified')
    expect(opened.terms).to.deep.eq({
      disclosure: 'opened',
      contractId: preimage.contractId,
      origin: preimage.origin,
      signer: deployed.origin.address,
      qualifications: [],
    })

    // Terms somebody else signed, or terms for another amount, are not the terms of this payment.
    const resigned = await stranger.signTypedData({ ...DOMAIN, chainId, verifyingContract: await escrow.getAddress() }, TERMS_TYPES, terms)
    const bySomeoneElse = { ...certificate, allocations: [{ ...certificate.allocations[0], signature: resigned }] }
    const otherText = { ...certificate, preimage: { ...preimage, amount: '6000' } }

    expect((await verifyReceipt(receipt, { manifest, rpc, certificate: bySomeoneElse })).result).to.eq('TermsMismatch')
    expect((await verifyReceipt(receipt, { manifest, rpc, certificate: otherText })).result).to.eq('TermsMismatch')

    // A certificate that declares its own terms unreproducible is unproven, and the payment still verifies.
    const legacy = await verifyReceipt(receipt, { manifest, rpc, certificate: { ...otherText, version: null } })

    expect([legacy.result, legacy.terms?.disclosure]).to.deep.eq(['Verified', 'unproven'])
    expect(legacy.terms?.qualifications.join(' ')).to.contain('unproven, not invalid')
  })

  it('the command builds receipts from the chain alone and checks them, counting an allocation once', async () => {
    const deployed = await loadFixture(deploy)
    const { worker, stranger, escrow, clone, manifest } = deployed
    const paid = await released(deployed, escrow, USDT(60))
    const refunded = await fund(deployed, escrow)

    await escrow.connect(deployed.client).cancelBeforeWork(refunded.terms.allocationId)

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-receipts-'))
    const manifestFile = path.join(directory, 'manifest.json')
    const bridge = await startRpcBridge(hre.network.provider)
    const verify = path.join(__dirname, '../packages/identity/bin/verify')
    const run = (...args: string[]) =>
      new Promise<{ status: number; stdout: string; stderr: string }>((resolve) => {
        execFile(process.execPath, [verify, ...args, '--manifest', manifestFile, '--rpc', bridge.url], (error, stdout, stderr) =>
          resolve({ status: error ? Number(error.code) : 0, stdout, stderr }),
        )
      })

    fs.writeFileSync(manifestFile, JSON.stringify(manifest))

    try {
      // No hint given: the candidates come from the funding events themselves.
      const built = await run('receipts', '--subject', worker.address, '--out', path.join(directory, 'out'))
      const head = await ethers.provider.getBlockNumber()

      expect(built.status, built.stderr).to.eq(0)
      expect(built.stdout).to.contain(`${paid.terms.allocationId}: Released`)
      expect(built.stdout).to.contain(`${refunded.terms.allocationId}: CancelledBeforeWork`)
      expect(built.stdout).to.contain(`Block checked: ${head} (finalized)`)
      expect(fs.readdirSync(path.join(directory, 'out'))).to.deep.eq([`${paid.terms.allocationId}.json`])

      const file = path.join(directory, 'out', `${paid.terms.allocationId}.json`)
      const checked = await run('receipt', file, file, '--subject', worker.address)

      expect(checked.status, checked.stderr).to.eq(0)
      expect(checked.stdout).to.contain('Paid through escrow: 1 releases, 57000000 base units')
      expect(checked.stdout).to.contain('counted once')
      expect(checked.stdout).to.contain(`Block checked: ${head}`)

      expect((await run('receipt', file, '--subject', stranger.address)).status).to.eq(1)
      expect((await run('receipts', '--subject', worker.address, '--escrow', await clone.getAddress())).status).to.eq(1)

      await bridge.close()

      const down = await run('receipt', file)

      expect(down.status).to.eq(3)
      expect(down.stdout).to.contain('RpcUnavailable')
    } finally {
      await bridge.close().catch(() => undefined)
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})
