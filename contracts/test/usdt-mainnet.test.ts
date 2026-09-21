import { expect } from 'chai'
import { ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'

import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

/**
 * MarketplaceEscrow against the settlement asset actually chosen in DEC-09:
 * mainnet USDT. Every other suite here uses OpenZeppelin tokens that return a
 * bool, so on its own it would pass even if a payout used a plain `transfer`
 * — which on mainnet reverts on every call and, with no owner or upgrade path,
 * would strand principal forever. This suite is what guards the SafeERC20
 * dependency (SC-A13), and it pins the issuer behaviours the public terms must
 * disclose (SPEC §9).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const USDT = (value: number) => ethers.parseUnits(String(value), 6)
const HOUR = 3600
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

describe('MarketplaceEscrow against mainnet USDT behaviour', () => {
  let origin: HardhatEthersSigner
  let client: HardhatEthersSigner
  let worker: HardhatEthersSigner
  let platform: HardhatEthersSigner
  let tether: HardhatEthersSigner
  let token: Any
  let escrow: Any
  let sequence = 0

  beforeEach(async () => {
    ;[origin, client, worker, platform, tether] = await ethers.getSigners()
    token = await (await ethers.getContractFactory('TetherLikeUSDT', tether)).deploy()
    escrow = await (await ethers.getContractFactory('MarketplaceEscrow')).deploy(
      await token.getAddress(),
      platform.address,
      origin.address,
    )
    await token.mint(client.address, USDT(1_000))
  })

  /** Funds one allocation with an exact approval, as the panel does. */
  async function fund(budget: bigint, approve = true) {
    sequence++

    const now = await time.latest()
    const terms = {
      allocationId: ethers.id(`usdt-allocation-${sequence}`),
      obligationId: ethers.id(`usdt-obligation-${sequence}`),
      termsHash: ethers.id(`usdt-terms-${sequence}`),
      payer: client.address,
      payee: worker.address,
      budget,
      workStart: now + HOUR,
      workEnd: now + DAY,
      originExpiry: now + DAY,
      earlySubmission: false,
    }
    const signature = await origin.signTypedData(
      {
        name: 'WorkAddressMarketplaceEscrow',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await escrow.getAddress(),
      },
      TERMS_TYPES,
      terms,
    )

    if (approve) {
      await token.connect(client).approve(await escrow.getAddress(), budget)
    }

    return { terms, signature, send: () => escrow.connect(client).fund(terms, signature) }
  }

  async function fundAndSubmit(budget: bigint, billed: bigint) {
    const { terms, send } = await fund(budget)

    await send()
    await time.increaseTo(terms.workEnd)
    await escrow.connect(worker).submitInvoice(terms.allocationId, ethers.id('invoice'), billed)

    return terms
  }

  async function expectReservesMatch() {
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(await escrow.totalHeld())
  }

  describe('no return value (SC-A13)', () => {
    it('settles the full lifecycle 57 / 3 / 40 through SafeERC20', async () => {
      const terms = await fundAndSubmit(USDT(100), USDT(60))

      await time.increase(7 * DAY)
      await expect(escrow.release(terms.allocationId)).to.changeTokenBalances(
        token,
        [worker, platform],
        [USDT(57), USDT(3)],
      )
      await expect(escrow.refundRemainder(terms.allocationId)).to.changeTokenBalance(token, client, USDT(40))

      expect(await token.balanceOf(await escrow.getAddress())).to.equal(0)
      await expectReservesMatch()
    })

    it('refunds a dispute and an expiry against the same ABI', async () => {
      const disputed = await fundAndSubmit(USDT(100), USDT(60))

      await expect(escrow.connect(client).dispute(disputed.allocationId)).to.changeTokenBalance(
        token,
        client,
        USDT(60),
      )

      const { terms: lapsed, send } = await fund(USDT(50))
      await send()
      await time.increaseTo(lapsed.workEnd + 72 * HOUR)

      await expect(escrow.refundExpired(lapsed.allocationId)).to.changeTokenBalance(token, client, USDT(50))
      await expectReservesMatch()
    })
  })

  describe('sender-only blacklist (SC-A13, ESC-A10)', () => {
    it('a blacklisted payer cannot fund, and nothing is recorded', async () => {
      const { terms, send } = await fund(USDT(100))

      await token.addBlackList(client.address)

      await expect(send()).to.be.reverted
      expect((await escrow.readAllocation(terms.allocationId)).state).to.equal(0)
      expect(await escrow.totalHeld()).to.equal(0)
    })

    it('a blacklisted payee and fee recipient are still paid, because Tether checks the sender', async () => {
      const terms = await fundAndSubmit(USDT(100), USDT(60))

      await token.addBlackList(worker.address)
      await token.addBlackList(platform.address)
      await time.increase(7 * DAY)

      await expect(escrow.release(terms.allocationId)).to.changeTokenBalances(
        token,
        [worker, platform],
        [USDT(57), USDT(3)],
      )
    })

    it('blacklisting the escrow itself freezes every exit until lifted — the accepted issuer risk', async () => {
      const terms = await fundAndSubmit(USDT(100), USDT(60))

      await token.addBlackList(await escrow.getAddress())

      await expect(escrow.connect(client).dispute(terms.allocationId)).to.be.reverted
      await expect(escrow.refundRemainder(terms.allocationId)).to.be.reverted
      await time.increase(7 * DAY)
      await expect(escrow.release(terms.allocationId)).to.be.reverted

      // Frozen, not lost: nothing moved, and the state never advanced.
      expect((await escrow.readAllocation(terms.allocationId)).state).to.equal(2)
      await expectReservesMatch()

      await token.removeBlackList(await escrow.getAddress())
      await expect(escrow.release(terms.allocationId)).to.changeTokenBalances(
        token,
        [worker, platform],
        [USDT(57), USDT(3)],
      )
    })

    it('pausing USDT freezes every exit the same way', async () => {
      const terms = await fundAndSubmit(USDT(100), USDT(60))

      await token.pause()
      await time.increase(7 * DAY)
      await expect(escrow.release(terms.allocationId)).to.be.reverted

      await token.unpause()
      await expect(escrow.release(terms.allocationId)).to.changeTokenBalance(token, worker, USDT(57))
    })
  })

  describe('approve reset rule (SC-A09, ESC-A01)', () => {
    it('a stale non-zero allowance cannot be raised until it is reset to zero', async () => {
      const spender = await escrow.getAddress()

      // An earlier funding attempt approved 500 and then never funded.
      await token.connect(client).approve(spender, USDT(500))

      const { send } = await fund(USDT(800), false)

      // What the funding panel currently does, and why it stalls on mainnet.
      await expect(token.connect(client).approve(spender, USDT(800))).to.be.reverted

      await token.connect(client).approve(spender, 0)
      await token.connect(client).approve(spender, USDT(800))
      await send()

      expect(await escrow.totalHeld()).to.equal(USDT(800))
    })
  })

  describe('issuer transfer fee (SPEC §9)', () => {
    it('a fee switched on before funding makes funding fail closed', async () => {
      await token.setParams(10, USDT(50))

      const { send } = await fund(USDT(100))

      await expect(send()).to.be.revertedWithCustomError(escrow, 'IncompleteTransfer')
      expect(await escrow.totalHeld()).to.equal(0)
    })

    it('a fee switched on after funding: escrow accounting stays exact, only recipients receive less', async () => {
      const terms = await fundAndSubmit(USDT(100), USDT(60))
      const escrowAddress = await escrow.getAddress()

      // 0.1%, as Tether's parameters allow.
      await token.setParams(10, USDT(50))
      await time.increase(7 * DAY)

      const before = await token.balanceOf(escrowAddress)
      await expect(escrow.release(terms.allocationId)).to.changeTokenBalances(
        token,
        [worker, platform],
        [USDT(57) - USDT(57) / 1000n, USDT(3) - USDT(3) / 1000n],
      )

      // The escrow parted with exactly the gross; what the token kept is the
      // issuer's, not a hole in the escrow's books.
      expect(before - (await token.balanceOf(escrowAddress))).to.equal(USDT(60))

      const allocation = await escrow.readAllocation(terms.allocationId)
      expect(allocation.workerTransferred).to.equal(USDT(57))
      expect(allocation.feeTransferred).to.equal(USDT(3))
      await expectReservesMatch()
    })
  })
})
