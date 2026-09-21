import { expect } from 'chai'
import { ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

import {
  INVOICE_COMMITMENT_DOMAIN,
  INVOICE_COMMITMENT_DOMAIN_TAG,
  invoiceCommitment,
  invoiceCommitmentDocument,
  type InvoiceCommitmentBinding,
  type InvoiceRecordV1,
} from '../scripts/invoice-commitment'

/**
 * InvoiceCommitment v1 (README, "Canonical encodings"). The app computes the
 * commitment an issuer submits; this suite recomputes it from
 * `fixtures/invoice-commitment.v1.json` - a byte-identical copy of
 * app/api/src/test/fixture/invoice-commitment.v1.json, whose vectors were
 * produced by a third, independent encoder - and proves MarketplaceEscrow
 * takes exactly those bytes and that a verifier opens them from chain data.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

type Vector = {
  name: string
  chainId: number
  escrow: string
  allocationId: string
  salt: string
  record: InvoiceRecordV1
  document: string
  commitment: string
  amount: string
}

const FIXTURE_PATH = path.join(__dirname, 'fixtures/invoice-commitment.v1.json')

/** Pinned on both sides, so neither copy of the fixture changes alone. */
const FIXTURE_SHA256 = '56ff82ddec4f82e7d46d898b0b8dbf0e04909a6cae2da77975f8f978a6a35a0d'

/**
 * The fixture's escrow is the first contract this key-less address creates.
 * The test impersonates it, so the escrow lands at the vector's address
 * whatever else has run on the in-process chain.
 */
const VECTOR_DEPLOYER = '0x000000000000000000000000000000000000c0de'

const USDT = (value: number) => ethers.parseUnits(String(value), 6)
const HOUR = 3600
const DAY = 24 * HOUR
const SUBMIT = 2

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

const ACTION_TYPES = {
  Action: [
    { name: 'operation', type: 'uint8' },
    { name: 'allocationId', type: 'bytes32' },
    { name: 'payload', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as {
  domainTag: string
  domain: string
  vectors: Vector[]
  retired: { contractId: string }
}

const bindingOf = (vector: Vector): InvoiceCommitmentBinding => ({
  chainId: vector.chainId,
  escrow: vector.escrow,
  allocationId: vector.allocationId,
})

const commit = (vector: Vector) => invoiceCommitment(vector.record, bindingOf(vector), vector.salt)

describe('invoice commitment v1', () => {
  it('is the fixture the app pins', () => {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(FIXTURE_PATH)).digest('hex')

    expect(
      digest,
      'invoice-commitment.v1.json changed: change the app copy identically, and pin the new digest on both sides',
    ).to.eq(FIXTURE_SHA256)
  })

  it('derives the domain from its tag', () => {
    expect(INVOICE_COMMITMENT_DOMAIN_TAG).to.eq(fixture.domainTag)
    expect(INVOICE_COMMITMENT_DOMAIN).to.eq(fixture.domain)
    expect(ethers.keccak256(ethers.toUtf8Bytes(fixture.domainTag))).to.eq(fixture.domain)
  })

  it('reproduces every vector from its record, binding and salt, as abi.encodePacked would hash it', () => {
    expect(fixture.vectors).to.have.length.greaterThan(0)

    for (const vector of fixture.vectors) {
      expect(invoiceCommitmentDocument(vector.record, bindingOf(vector)), vector.name).to.eq(vector.document)
      expect(commit(vector), vector.name).to.eq(vector.commitment)
      expect(
        ethers.solidityPackedKeccak256(
          ['bytes32', 'bytes32', 'string'],
          [fixture.domain, vector.salt, vector.document],
        ),
        vector.name,
      ).to.eq(vector.commitment)
    }
  })

  it('changes with every record field, the chain, the escrow, the allocation and the salt', () => {
    const [vector] = fixture.vectors
    const clone = (): Vector => JSON.parse(JSON.stringify(vector))
    const changed = (value: unknown) => (typeof value === 'number' ? value + 1 : `${String(value)}0`)
    const mutations: [string, (copy: Any) => void][] = []

    for (const key of Object.keys(vector.record).filter((key) => key !== 'lines' && key !== 'version')) {
      mutations.push([`record.${key}`, (copy) => (copy.record[key] = changed(copy.record[key]))])
    }
    for (const key of Object.keys(vector.record.lines[0])) {
      mutations.push([`record.lines[0].${key}`, (copy) => (copy.record.lines[0][key] = changed(copy.record.lines[0][key]))])
    }
    mutations.push(
      ['record.lines dropped', (copy) => copy.record.lines.pop()],
      ['record.lines reordered', (copy) => copy.record.lines.reverse()],
      ['chainId', (copy) => (copy.chainId = 1)],
      ['escrow', (copy) => (copy.escrow = ethers.ZeroAddress.replace(/0$/, '1'))],
      ['allocationId', (copy) => (copy.allocationId = ethers.id('another allocation'))],
      ['salt', (copy) => (copy.salt = ethers.id('another salt'))],
    )

    for (const [name, mutate] of mutations) {
      const copy = clone()

      mutate(copy)

      expect(commit(copy), name).not.to.eq(vector.commitment)
    }
  })

  it('refuses a missing salt rather than committing without one', () => {
    const [vector] = fixture.vectors

    expect(() => invoiceCommitment(vector.record, bindingOf(vector), ethers.ZeroHash)).to.throw(TypeError)
    expect(() => invoiceCommitment(vector.record, bindingOf(vector), '0x1234')).to.throw(TypeError)
  })

  it('no longer matches the retired string formula, which anyone could recompute from public ids', () => {
    for (const vector of fixture.vectors) {
      const retired = ethers.id(
        `work-address:invoice:${fixture.retired.contractId}:${vector.allocationId}:${vector.amount}`,
      )

      expect(commit(vector), vector.name).not.to.eq(retired)
    }
  })

  describe('on MarketplaceEscrow', () => {
    let origin: HardhatEthersSigner
    let platform: HardhatEthersSigner
    let relayer: HardhatEthersSigner
    let signers: HardhatEthersSigner[]
    let token: Any
    let escrow: Any

    /** The local signer holding a record's (canonical, lowercase) address. */
    function signerFor(address: string): HardhatEthersSigner {
      const signer = signers.find((candidate) => candidate.address.toLowerCase() === address)

      if (!signer) throw new Error(`No local signer for ${address}`)

      return signer
    }

    before(async () => {
      signers = await ethers.getSigners()
      // #1 and #2 are the records' owner and issuer; the rest stay out of their way.
      origin = signers[0]
      platform = signers[5]
      relayer = signers[6]
      token = await (await ethers.getContractFactory('MockUSDT')).deploy()

      const deployer = await ethers.getImpersonatedSigner(VECTOR_DEPLOYER)

      await ethers.provider.send('hardhat_setBalance', [VECTOR_DEPLOYER, ethers.toQuantity(ethers.parseEther('1'))])
      expect(await ethers.provider.getTransactionCount(VECTOR_DEPLOYER), 'the vector deployer is unused').to.eq(0)

      escrow = await (await ethers.getContractFactory('MarketplaceEscrow', deployer)).deploy(
        await token.getAddress(),
        platform.address,
        origin.address,
      )

      expect((await escrow.getAddress()).toLowerCase()).to.eq(fixture.vectors[0].escrow)
      expect((await ethers.provider.getNetwork()).chainId).to.eq(BigInt(fixture.vectors[0].chainId))
    })

    /** Funds the vector's allocation, payer = the record's owner, payee = its issuer. */
    async function fundFor(vector: Vector, workEnd: number) {
      const payer = signerFor(vector.record.ownerAddress)
      const payee = signerFor(vector.record.issuerAddress)
      const now = await time.latest()
      const terms = {
        allocationId: vector.allocationId,
        obligationId: ethers.id(`obligation ${vector.allocationId}`),
        termsHash: ethers.id('accepted terms'),
        payer: payer.address,
        payee: payee.address,
        budget: USDT(200),
        workStart: now + HOUR,
        workEnd,
        originExpiry: now + HOUR,
        earlySubmission: false,
      }
      const origin712 = await origin.signTypedData(
        {
          name: 'WorkAddressMarketplaceEscrow',
          version: '1',
          chainId: vector.chainId,
          verifyingContract: await escrow.getAddress(),
        },
        TERMS_TYPES,
        terms,
      )

      await token.mint(payer.address, terms.budget)
      await token.connect(payer).approve(await escrow.getAddress(), terms.budget)
      await escrow.connect(payer).fund(terms, origin712)

      return payee
    }

    it('takes the vectors directly and relayed, and a verifier opens each from chain data', async () => {
      const [direct, otherSalt, relayed] = fixture.vectors
      const workEnd = (await time.latest()) + HOUR + 7 * DAY
      const directPayee = await fundFor(direct, workEnd)
      const relayedPayee = await fundFor(relayed, workEnd)

      await time.increaseTo(workEnd)

      await expect(escrow.connect(directPayee).submitInvoice(direct.allocationId, direct.commitment, direct.amount))
        .to.emit(escrow, 'InvoiceSubmitted')
        .withArgs(direct.allocationId, direct.commitment, direct.amount, anyValue)

      const deadline = (await time.latest()) + HOUR
      const signature = await relayedPayee.signTypedData(
        {
          name: 'WorkAddressMarketplaceEscrow',
          version: '1',
          chainId: relayed.chainId,
          verifyingContract: await escrow.getAddress(),
        },
        ACTION_TYPES,
        {
          operation: SUBMIT,
          allocationId: relayed.allocationId,
          payload: ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256'], [relayed.commitment, relayed.amount]),
          ),
          nonce: await escrow.nonces(relayedPayee.address),
          deadline,
        },
      )

      await expect(
        escrow
          .connect(relayer)
          .submitInvoiceFor(relayed.allocationId, relayed.commitment, relayed.amount, deadline, signature),
      )
        .to.emit(escrow, 'InvoiceSubmitted')
        .withArgs(relayed.allocationId, relayed.commitment, relayed.amount, anyValue)

      // The verifier: the chain id, the emitting contract and the event are
      // public; the record and the salt are the opening the issuer discloses.
      const chainId = (await ethers.provider.getNetwork()).chainId
      const events = await escrow.queryFilter(escrow.filters.InvoiceSubmitted())

      expect(events).to.have.length(2)

      for (const [event, vector] of [
        [events[0], direct],
        [events[1], relayed],
      ] as [Any, Vector][]) {
        const allocation = await escrow.readAllocation(event.args.allocationId)
        const opened = invoiceCommitment(
          vector.record,
          { chainId, escrow: event.address, allocationId: event.args.allocationId },
          vector.salt,
        )

        expect(opened, vector.name).to.eq(event.args.invoiceCommitment)
        expect(allocation.invoiceCommitment, vector.name).to.eq(opened)
        expect(allocation.payee.toLowerCase()).to.eq(vector.record.issuerAddress)
        expect(allocation.payer.toLowerCase()).to.eq(vector.record.ownerAddress)
        // The vectors bill exactly the invoice: cents to 6-decimal USDT.
        expect(allocation.billed).to.eq(BigInt(vector.record.amountCents) * BigInt(10_000))
      }

      // The same invoice under another salt does not open the submitted one.
      expect(commit(otherSalt)).not.to.eq((await escrow.readAllocation(direct.allocationId)).invoiceCommitment)
    })
  })
})
