import { expect } from 'chai'
import { ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'

import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import type { BaseContract, ContractTransactionResponse } from 'ethers'

/**
 * Acceptance cases from docs/specification/escrow-payments.md (ESC-A**) and
 * docs/smart-contracts/SPEC.md (SC-A**), in token base units (6 decimals).
 */

const USDT = (value: number | string) => ethers.parseUnits(String(value), 6)
const HOUR = 60 * 60
const DAY = 24 * HOUR

enum State {
  None,
  Funded,
  Submitted,
  CancelledRefunded,
  ExpiredRefunded,
  DisputedRefunded,
  Released,
}

type Terms = {
  allocationId: string
  obligationId: string
  termsHash: string
  payer: string
  payee: string
  budget: bigint
  workStart: number
  workEnd: number
  originExpiry: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

describe('MarketplaceEscrow', () => {
  let origin: HardhatEthersSigner
  let client: HardhatEthersSigner
  let worker: HardhatEthersSigner
  let platform: HardhatEthersSigner
  let stranger: HardhatEthersSigner
  let token: Any
  let escrow: Any

  async function deploy(tokenName = 'MockUSDT') {
    const Token = await ethers.getContractFactory(tokenName)
    const deployedToken: Any = await Token.deploy()
    const Escrow = await ethers.getContractFactory('MarketplaceEscrow')
    const deployedEscrow: Any = await Escrow.deploy(
      await deployedToken.getAddress(),
      platform.address,
      origin.address,
    )

    await deployedToken.mint(client.address, USDT(10_000))
    await deployedToken
      .connect(client)
      .approve(await deployedEscrow.getAddress(), ethers.MaxUint256)

    return { token: deployedToken, escrow: deployedEscrow }
  }

  beforeEach(async () => {
    ;[origin, client, worker, platform, stranger] = await ethers.getSigners()
    ;({ token, escrow } = await deploy())
  })

  async function terms(overrides: Partial<Terms> = {}): Promise<Terms> {
    const now = await time.latest()
    const salt = ethers.hexlify(ethers.randomBytes(32))

    return {
      allocationId: ethers.keccak256(ethers.toUtf8Bytes(`allocation-${salt}`)),
      obligationId: ethers.keccak256(ethers.toUtf8Bytes(`obligation-${salt}`)),
      termsHash: ethers.keccak256(ethers.toUtf8Bytes('accepted terms v1')),
      payer: client.address,
      payee: worker.address,
      budget: USDT(100),
      workStart: now + HOUR,
      workEnd: now + HOUR + 7 * DAY,
      originExpiry: now + DAY,
      ...overrides,
    }
  }

  async function sign(
    value: Terms,
    signer: HardhatEthersSigner = origin,
    target: BaseContract = escrow,
    chainId?: bigint,
  ) {
    const network = await ethers.provider.getNetwork()

    return signer.signTypedData(
      {
        name: 'WorkAddressMarketplaceEscrow',
        version: '1',
        chainId: chainId ?? network.chainId,
        verifyingContract: await target.getAddress(),
      },
      {
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
      },
      value,
    )
  }

  async function funded(overrides: Partial<Terms> = {}) {
    const value = await terms(overrides)
    await escrow.connect(client).fund(value, await sign(value))

    return value
  }

  async function submitted(billed: bigint, overrides: Partial<Terms> = {}) {
    const value = await funded(overrides)
    await time.increaseTo(value.workEnd)
    await escrow
      .connect(worker)
      .submitInvoice(value.allocationId, ethers.id('invoice-1'), billed)

    return value
  }

  /** funded = held + workerTransferred + feeTransferred + clientRefunded, per allocation and overall. */
  async function expectConservation(allocationId: string) {
    const allocation = await escrow.readAllocation(allocationId)
    const held = await escrow.heldOf(allocationId)

    expect(
      held +
        allocation.workerTransferred +
        allocation.feeTransferred +
        allocation.clientRefunded,
    ).to.eq(allocation.budget)
    expect(await token.balanceOf(await escrow.getAddress())).to.eq(
      await escrow.totalHeld(),
    )
  }

  const settle = (tx: Promise<ContractTransactionResponse>) =>
    tx.then((response) => response.wait())

  describe('funding (SC-ES-01)', () => {
    it('ESC-A04: 100 funded and fully released pays 95 to the worker and 5 to the platform', async () => {
      const value = await submitted(USDT(100))

      await time.increase(7 * DAY)
      await expect(escrow.connect(stranger).release(value.allocationId))
        .to.emit(escrow, 'Released')
        .withArgs(value.allocationId, USDT(100), USDT(95), USDT(5))

      expect(await token.balanceOf(worker.address)).to.eq(USDT(95))
      expect(await token.balanceOf(platform.address)).to.eq(USDT(5))
      expect(await escrow.heldOf(value.allocationId)).to.eq(0)
      expect((await escrow.readAllocation(value.allocationId)).state).to.eq(
        State.Released,
      )
      await expectConservation(value.allocationId)
      await expect(
        escrow.release(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'WrongState')
    })

    it('SC-A10 / ESC-A03: a substituted payee, budget or deadline breaks the origin proof', async () => {
      const value = await terms()
      const signature = await sign(value)

      for (const changed of [
        { ...value, payee: stranger.address },
        { ...value, budget: USDT(1) },
        { ...value, workEnd: value.workEnd + DAY },
        { ...value, termsHash: ethers.id('other terms') },
      ]) {
        await expect(
          escrow.connect(client).fund(changed, signature),
        ).to.be.revertedWithCustomError(escrow, 'InvalidOrigin')
      }
    })

    it('SC-A08: a proof for another contract, another chain or from another signer is refused', async () => {
      const value = await terms()
      const { escrow: otherEscrow } = await deploy()

      await expect(
        escrow.connect(client).fund(value, await sign(value, origin, otherEscrow)),
      ).to.be.revertedWithCustomError(escrow, 'InvalidOrigin')
      await expect(
        escrow.connect(client).fund(value, await sign(value, origin, escrow, 999n)),
      ).to.be.revertedWithCustomError(escrow, 'InvalidOrigin')
      await expect(
        escrow.connect(client).fund(value, await sign(value, stranger)),
      ).to.be.revertedWithCustomError(escrow, 'InvalidOrigin')
    })

    it('only the payer funds, before work starts and before the proof expires', async () => {
      const value = await terms()
      const signature = await sign(value)

      await expect(
        escrow.connect(stranger).fund(value, signature),
      ).to.be.revertedWithCustomError(escrow, 'NotPayer')

      const late = await terms({ originExpiry: (await time.latest()) + 10 })
      const lateSignature = await sign(late)
      await time.increase(20)
      await expect(
        escrow.connect(client).fund(late, lateSignature),
      ).to.be.revertedWithCustomError(escrow, 'OriginExpired')

      const started = await terms({
        workStart: (await time.latest()) + 5,
        originExpiry: (await time.latest()) + DAY,
      })
      const startedSignature = await sign(started)
      await time.increase(10)
      await expect(
        escrow.connect(client).fund(started, startedSignature),
      ).to.be.revertedWithCustomError(escrow, 'TooLate')
    })

    it('ESC-A02 / SC-A11: the same allocation or obligation cannot be funded twice', async () => {
      const value = await funded()

      await expect(
        escrow.connect(client).fund(value, await sign(value)),
      ).to.be.revertedWithCustomError(escrow, 'AllocationExists')

      const sameObligation = {
        ...(await terms()),
        obligationId: value.obligationId,
      }
      await expect(
        escrow.connect(client).fund(sameObligation, await sign(sameObligation)),
      ).to.be.revertedWithCustomError(escrow, 'ObligationAlreadyFunded')
      expect(await token.balanceOf(await escrow.getAddress())).to.eq(USDT(100))
    })

    it('SC-A09 / ESC-A01: approval without balance or a short-delivering token never becomes a funded allocation', async () => {
      const value = await terms({ budget: USDT(20_000) })

      await expect(escrow.connect(client).fund(value, await sign(value))).to.be
        .reverted
      expect((await escrow.readAllocation(value.allocationId)).state).to.eq(
        State.None,
      )

      ;({ token, escrow } = await deploy('FeeOnTransferToken'))
      const feeTerms = await terms()
      await expect(
        escrow.connect(client).fund(feeTerms, await sign(feeTerms)),
      ).to.be.revertedWithCustomError(escrow, 'IncompleteTransfer')
      expect(await escrow.totalHeld()).to.eq(0)
    })

    it('rejects malformed terms', async () => {
      for (const overrides of [
        { payee: ethers.ZeroAddress },
        { payee: client.address },
        { budget: 0n },
        { workEnd: (await time.latest()) + HOUR },
      ]) {
        const value = await terms(overrides)
        await expect(
          escrow.connect(client).fund(value, await sign(value)),
        ).to.be.revertedWithCustomError(escrow, 'InvalidTerms')
      }
    })

    it('does not credit tokens sent directly to the contract', async () => {
      await token.mint(stranger.address, USDT(50))
      await token
        .connect(stranger)
        .transfer(await escrow.getAddress(), USDT(50))
      const value = await funded()

      expect(await escrow.totalHeld()).to.eq(USDT(100))
      expect(await escrow.heldOf(value.allocationId)).to.eq(USDT(100))
    })
  })

  describe('lifecycle (SC-ES-02)', () => {
    it('ESC-A05: 100 funded, 60 billed; remainder-first and release-first both reconcile to 57 / 3 / 40', async () => {
      for (const remainderFirst of [true, false]) {
        ;({ token, escrow } = await deploy())
        const value = await submitted(USDT(60))

        if (remainderFirst) {
          await settle(escrow.connect(stranger).refundRemainder(value.allocationId))
        }

        await time.increase(7 * DAY)
        await settle(escrow.connect(stranger).release(value.allocationId))

        if (!remainderFirst) {
          await settle(escrow.connect(stranger).refundRemainder(value.allocationId))
        }

        expect(await token.balanceOf(worker.address)).to.eq(USDT(57))
        expect(await token.balanceOf(platform.address)).to.eq(USDT(3))
        expect(await token.balanceOf(client.address)).to.eq(USDT(9_940))
        await expectConservation(value.allocationId)
        await expect(
          escrow.refundRemainder(value.allocationId),
        ).to.be.revertedWithCustomError(escrow, 'NothingToRefund')
      }
    })

    it('ESC-A06: a disputed 60 after the 40 remainder returns everything once and pays no fee', async () => {
      const value = await submitted(USDT(60))

      await escrow.refundRemainder(value.allocationId)
      await expect(escrow.connect(client).dispute(value.allocationId))
        .to.emit(escrow, 'DisputeRefunded')
        .withArgs(value.allocationId, USDT(60))

      expect(await token.balanceOf(client.address)).to.eq(USDT(10_000))
      expect(await token.balanceOf(worker.address)).to.eq(0)
      expect(await token.balanceOf(platform.address)).to.eq(0)
      await expectConservation(value.allocationId)
      await expect(
        escrow.connect(client).dispute(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'WrongState')
      await expect(
        escrow.release(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'WrongState')
    })

    it('ESC-A07: pre-work cancellation refunds in full and blocks a later submission', async () => {
      const value = await funded()

      await expect(
        escrow.connect(stranger).cancelBeforeWork(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'NotPayer')
      await escrow.connect(client).cancelBeforeWork(value.allocationId)
      await time.increaseTo(value.workEnd)

      await expect(
        escrow
          .connect(worker)
          .submitInvoice(value.allocationId, ethers.id('late'), USDT(10)),
      ).to.be.revertedWithCustomError(escrow, 'WrongState')
      expect(await token.balanceOf(client.address)).to.eq(USDT(10_000))
      await expectConservation(value.allocationId)
    })

    it('cannot cancel once work has started', async () => {
      const value = await funded()

      await time.increaseTo(value.workStart)
      await expect(
        escrow.connect(client).cancelBeforeWork(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'TooLate')
    })

    it('ESC-A08: without a submission, anyone refunds the payer at the deadline and not before', async () => {
      const value = await funded()
      const allocation = await escrow.readAllocation(value.allocationId)

      expect(allocation.submissionDeadline).to.eq(value.workEnd + 72 * HOUR)
      await time.increaseTo(Number(allocation.submissionDeadline) - 2)
      await expect(
        escrow.refundExpired(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'TooEarly')

      await time.increaseTo(allocation.submissionDeadline)
      await escrow.connect(stranger).refundExpired(value.allocationId)

      expect(await token.balanceOf(client.address)).to.eq(USDT(10_000))
      await expectConservation(value.allocationId)
    })

    it('submission: payee only, after work end, within budget, with a commitment, once', async () => {
      const value = await funded()
      const commitment = ethers.id('invoice')

      await expect(
        escrow.connect(worker).submitInvoice(value.allocationId, commitment, USDT(10)),
      ).to.be.revertedWithCustomError(escrow, 'TooEarly')

      await time.increaseTo(value.workEnd)

      await expect(
        escrow.connect(client).submitInvoice(value.allocationId, commitment, USDT(10)),
      ).to.be.revertedWithCustomError(escrow, 'NotPayee')
      await expect(
        escrow.connect(worker).submitInvoice(value.allocationId, commitment, 0),
      ).to.be.revertedWithCustomError(escrow, 'InvalidAmount')
      await expect(
        escrow.connect(worker).submitInvoice(value.allocationId, commitment, USDT(101)),
      ).to.be.revertedWithCustomError(escrow, 'InvalidAmount')
      await expect(
        escrow.connect(worker).submitInvoice(value.allocationId, ethers.ZeroHash, USDT(10)),
      ).to.be.revertedWithCustomError(escrow, 'InvalidCommitment')

      await escrow.connect(worker).submitInvoice(value.allocationId, commitment, USDT(10))
      await expect(
        escrow.connect(worker).submitInvoice(value.allocationId, commitment, USDT(20)),
      ).to.be.revertedWithCustomError(escrow, 'WrongState')
    })

    it('ESC-A09 / SC-A12: submission, expiry, dispute and release meet at exact boundaries with one outcome', async () => {
      const value = await funded()
      const deadline = Number(
        (await escrow.readAllocation(value.allocationId)).submissionDeadline,
      )

      // The last second of the submission window still accepts the invoice.
      await time.setNextBlockTimestamp(deadline - 1)
      await escrow
        .connect(worker)
        .submitInvoice(value.allocationId, ethers.id('edge'), USDT(50))
      await expect(
        escrow.refundExpired(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'WrongState')

      const releaseAt = Number(
        (await escrow.readAllocation(value.allocationId)).releaseAt,
      )
      expect(releaseAt).to.eq(deadline - 1 + 7 * DAY)

      // At releaseAt the dispute window has closed and release opens.
      await time.setNextBlockTimestamp(releaseAt)
      await expect(
        escrow.connect(client).dispute(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'TooLate')
      await escrow.release(value.allocationId)
      await expectConservation(value.allocationId)
    })

    it('the dispute window is open one second before release', async () => {
      const value = await submitted(USDT(30))
      const releaseAt = Number(
        (await escrow.readAllocation(value.allocationId)).releaseAt,
      )

      await expect(
        escrow.release(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'TooEarly')
      await time.setNextBlockTimestamp(releaseAt - 1)
      await escrow.connect(client).dispute(value.allocationId)

      expect((await escrow.readAllocation(value.allocationId)).state).to.eq(
        State.DisputedRefunded,
      )
    })

    it('only the payer disputes', async () => {
      const value = await submitted(USDT(30))

      for (const signer of [worker, stranger, platform]) {
        await expect(
          escrow.connect(signer).dispute(value.allocationId),
        ).to.be.revertedWithCustomError(escrow, 'NotPayer')
      }
    })
  })

  describe('fees and accounting (SC-ES-03)', () => {
    it('ESC-A16: the fee floors on tiny amounts and never exceeds 5%', async () => {
      const cases: Array<[bigint, bigint]> = [
        [1n, 0n],
        [19n, 0n],
        [20n, 1n],
        [USDT(1), 50_000n],
        [ethers.MaxUint256 / 10_000n, (ethers.MaxUint256 / 10_000n) * 500n / 10_000n],
      ]

      for (const [gross, fee] of cases) {
        const [net, computedFee] = await escrow.previewRelease(gross)
        expect(computedFee).to.eq(fee)
        expect(net + computedFee).to.eq(gross)
      }

      const value = await submitted(19n, { budget: 19n })
      await time.increase(7 * DAY)
      await escrow.release(value.allocationId)

      expect(await token.balanceOf(worker.address)).to.eq(19n)
      expect(await token.balanceOf(platform.address)).to.eq(0)
      await expectConservation(value.allocationId)
    })

    it('ESC-A10: a failing fee transfer reverts the whole release, which succeeds once unblocked', async () => {
      ;({ token, escrow } = await deploy('BlockingToken'))
      const value = await submitted(USDT(100))
      await time.increase(7 * DAY)

      await token.setBlocked(platform.address)
      await expect(escrow.release(value.allocationId)).to.be.revertedWith(
        'blocked recipient',
      )
      expect(await token.balanceOf(worker.address)).to.eq(0)
      expect((await escrow.readAllocation(value.allocationId)).state).to.eq(
        State.Submitted,
      )

      await token.setBlocked(ethers.ZeroAddress)
      await escrow.release(value.allocationId)
      await expect(
        escrow.release(value.allocationId),
      ).to.be.revertedWithCustomError(escrow, 'WrongState')
      expect(await token.balanceOf(worker.address)).to.eq(USDT(95))
      expect(await token.balanceOf(platform.address)).to.eq(USDT(5))
    })

    it('SC-A14: an unknown allocation id moves nothing and a reentrant token cannot double release', async () => {
      const unknown = ethers.id('never funded')

      await expect(escrow.release(unknown)).to.be.revertedWithCustomError(
        escrow,
        'WrongState',
      )
      await expect(
        escrow.refundRemainder(unknown),
      ).to.be.revertedWithCustomError(escrow, 'WrongState')

      ;({ token, escrow } = await deploy('ReentrantToken'))
      const value = await submitted(USDT(100))
      await time.increase(7 * DAY)
      await token.arm(await escrow.getAddress(), value.allocationId)
      await escrow.release(value.allocationId)

      expect(await token.attacked()).to.eq(true)
      expect(await token.reentryReverted()).to.eq(true)
      expect(await token.balanceOf(worker.address)).to.eq(USDT(95))
      await expectConservation(value.allocationId)
    })

    it('SC-A13: many allocations settle independently and the contract balance always equals what is held', async () => {
      const values: Terms[] = []

      for (let index = 0; index < 5; index += 1) {
        values.push(await funded({ budget: USDT(10 + index * 7) }))
      }

      const [a, b, c, d, e] = values
      await escrow.connect(client).cancelBeforeWork(a.allocationId)
      await time.increaseTo(b.workEnd)
      await escrow.connect(worker).submitInvoice(b.allocationId, ethers.id('b'), USDT(3))
      await escrow.connect(worker).submitInvoice(c.allocationId, ethers.id('c'), c.budget)
      await escrow.connect(worker).submitInvoice(d.allocationId, ethers.id('d'), USDT(1))
      await escrow.connect(client).dispute(d.allocationId)
      await time.increase(7 * DAY)
      await escrow.release(b.allocationId)
      await escrow.release(c.allocationId)
      await escrow.refundRemainder(b.allocationId)
      await escrow.refundExpired(e.allocationId)

      for (const value of values) {
        await expectConservation(value.allocationId)
      }

      expect(await escrow.totalHeld()).to.eq(
        (await escrow.heldOf(d.allocationId)) +
          (await escrow.heldOf(b.allocationId)),
      )
      expect(await token.balanceOf(await escrow.getAddress())).to.eq(
        await escrow.totalHeld(),
      )
    })
  })

  it('has no owner, pause or withdrawal surface (SC-OPS-01)', async () => {
    const names = escrow.interface.fragments
      .filter((fragment: Any) => fragment.type === 'function')
      .map((fragment: Any) => fragment.name)
      .sort()

    expect(names).to.deep.eq(
      [
        'ACTION_TYPEHASH',
        'BPS',
        'DISPUTE_WINDOW',
        'FEE_BPS',
        'SUBMISSION_WINDOW',
        'TERMS_TYPEHASH',
        'actionDigest',
        'cancelBeforeWork',
        'cancelBeforeWorkFor',
        'dispute',
        'disputeFor',
        'eip712Domain',
        'feeRecipient',
        'fund',
        'fundFor',
        'heldOf',
        'nonces',
        'obligationFunded',
        'originSigner',
        'previewRelease',
        'readAllocation',
        'refundExpired',
        'refundRemainder',
        'release',
        'submitInvoice',
        'submitInvoiceFor',
        'termsDigest',
        'token',
        'totalHeld',
      ].sort(),
    )
  })
})
