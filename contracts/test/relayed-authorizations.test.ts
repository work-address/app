import { expect } from 'chai'
import { ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'

import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

/**
 * SC-SIG-01 relayed authorizations: a party signs, anyone submits. Covers
 * SC-A08 (replay, other operation/allocation/payload), expiry, wrong signers
 * and ERC-1271 contract wallets (SC-A17's current-policy half).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const USDT = (value: number) => ethers.parseUnits(String(value), 6)
const HOUR = 3600
const DAY = 24 * HOUR

enum Operation {
  Fund,
  Cancel,
  Submit,
  Dispute,
  Approve,
}

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

describe('MarketplaceEscrow relayed authorizations', () => {
  let origin: HardhatEthersSigner
  let client: HardhatEthersSigner
  let worker: HardhatEthersSigner
  let platform: HardhatEthersSigner
  let relayer: HardhatEthersSigner
  let token: Any
  let escrow: Any

  beforeEach(async () => {
    ;[origin, client, worker, platform, relayer] = await ethers.getSigners()
    token = await (await ethers.getContractFactory('MockUSDT')).deploy()
    escrow = await (await ethers.getContractFactory('MarketplaceEscrow')).deploy(
      await token.getAddress(),
      platform.address,
      origin.address,
    )
    await token.mint(client.address, USDT(1_000))
    await token.connect(client).approve(await escrow.getAddress(), ethers.MaxUint256)
  })

  async function domain() {
    return {
      name: 'WorkAddressMarketplaceEscrow',
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await escrow.getAddress(),
    }
  }

  async function terms(
    payer: string,
    payee: string = worker.address,
    earlySubmission = false,
  ) {
    const now = await time.latest()
    const salt = ethers.hexlify(ethers.randomBytes(32))

    const value = {
      allocationId: ethers.id(`allocation-${salt}`),
      obligationId: ethers.id(`obligation-${salt}`),
      termsHash: ethers.id('terms'),
      payer,
      payee,
      budget: USDT(100),
      workStart: now + HOUR,
      workEnd: now + HOUR + 7 * DAY,
      originExpiry: now + DAY,
      earlySubmission,
    }

    return {
      value,
      origin: await origin.signTypedData(await domain(), TERMS_TYPES, value),
    }
  }

  async function authorize(
    signer: HardhatEthersSigner,
    operation: Operation,
    allocationId: string,
    payload: string,
    options: { nonce?: bigint; forAddress?: string; deadline?: number } = {},
  ) {
    const nonce =
      options.nonce ?? (await escrow.nonces(options.forAddress ?? signer.address))
    const deadline = options.deadline ?? (await time.latest()) + HOUR

    return {
      deadline,
      signature: await signer.signTypedData(await domain(), ACTION_TYPES, {
        operation,
        allocationId,
        payload,
        nonce,
        deadline,
      }),
    }
  }

  it('a relayer runs fund, submit and dispute for the parties, paying their gas but moving nothing to itself', async () => {
    const { value, origin: originSignature } = await terms(client.address)
    const fund = await authorize(
      client,
      Operation.Fund,
      value.allocationId,
      await escrow.termsDigest(value),
    )

    await escrow
      .connect(relayer)
      .fundFor(value, originSignature, fund.deadline, fund.signature)

    await time.increaseTo(value.workEnd)
    const commitment = ethers.id('invoice')
    const payload = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'uint256'],
        [commitment, USDT(60)],
      ),
    )
    const submit = await authorize(worker, Operation.Submit, value.allocationId, payload)

    await escrow
      .connect(relayer)
      .submitInvoiceFor(value.allocationId, commitment, USDT(60), submit.deadline, submit.signature)

    const dispute = await authorize(client, Operation.Dispute, value.allocationId, ethers.ZeroHash)
    await escrow
      .connect(relayer)
      .disputeFor(value.allocationId, dispute.deadline, dispute.signature)

    expect((await escrow.readAllocation(value.allocationId)).state).to.eq(5)
    expect(await token.balanceOf(relayer.address)).to.eq(0)
    expect(await token.balanceOf(client.address)).to.eq(USDT(960))
    expect(await escrow.nonces(client.address)).to.eq(2)
    expect(await escrow.nonces(worker.address)).to.eq(1)
  })

  it('a relayed cancellation refunds the payer, and its signature cannot be replayed', async () => {
    const { value, origin: originSignature } = await terms(client.address)
    await escrow.connect(client).fund(value, originSignature)
    const cancel = await authorize(client, Operation.Cancel, value.allocationId, ethers.ZeroHash)

    await escrow
      .connect(relayer)
      .cancelBeforeWorkFor(value.allocationId, cancel.deadline, cancel.signature)

    expect(await token.balanceOf(client.address)).to.eq(USDT(1_000))
    await expect(
      escrow
        .connect(relayer)
        .cancelBeforeWorkFor(value.allocationId, cancel.deadline, cancel.signature),
    ).to.be.revertedWithCustomError(escrow, 'InvalidAuthorization')
  })

  it('SC-A08: a signature for another operation, allocation or payload is refused', async () => {
    const first = await terms(client.address)
    const second = await terms(client.address)
    await escrow.connect(client).fund(first.value, first.origin)
    await escrow.connect(client).fund(second.value, second.origin)
    await time.increaseTo(first.value.workEnd)

    // Signed as a cancellation, used as a dispute.
    const cancel = await authorize(client, Operation.Cancel, first.value.allocationId, ethers.ZeroHash)
    // Signed for the first allocation, used on the second.
    const commitment = ethers.id('invoice')
    const payload = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256'], [commitment, USDT(10)]),
    )
    const submitFirst = await authorize(worker, Operation.Submit, first.value.allocationId, payload)

    await expect(
      escrow
        .connect(relayer)
        .submitInvoiceFor(second.value.allocationId, commitment, USDT(10), submitFirst.deadline, submitFirst.signature),
    ).to.be.revertedWithCustomError(escrow, 'InvalidAuthorization')
    // Same allocation, different amount than signed.
    await expect(
      escrow
        .connect(relayer)
        .submitInvoiceFor(first.value.allocationId, commitment, USDT(99), submitFirst.deadline, submitFirst.signature),
    ).to.be.revertedWithCustomError(escrow, 'InvalidAuthorization')

    await escrow
      .connect(relayer)
      .submitInvoiceFor(first.value.allocationId, commitment, USDT(10), submitFirst.deadline, submitFirst.signature)
    await expect(
      escrow
        .connect(relayer)
        .disputeFor(first.value.allocationId, cancel.deadline, cancel.signature),
    ).to.be.revertedWithCustomError(escrow, 'InvalidAuthorization')
  })

  it('refuses expired authorizations and signatures from anyone but the party', async () => {
    const { value, origin: originSignature } = await terms(client.address)
    const digest = await escrow.termsDigest(value)
    const expired = await authorize(client, Operation.Fund, value.allocationId, digest, {
      deadline: (await time.latest()) + 5,
    })
    const impostor = await authorize(relayer, Operation.Fund, value.allocationId, digest, {
      forAddress: client.address,
    })

    await time.increase(10)
    await expect(
      escrow.connect(relayer).fundFor(value, originSignature, expired.deadline, expired.signature),
    ).to.be.revertedWithCustomError(escrow, 'AuthorizationExpired')
    await expect(
      escrow.connect(relayer).fundFor(value, originSignature, impostor.deadline, impostor.signature),
    ).to.be.revertedWithCustomError(escrow, 'InvalidAuthorization')
    expect(await escrow.nonces(client.address)).to.eq(0)
  })

  it('a relayed approval pays the worker, consumes one payer nonce and cannot be replayed', async () => {
    const { value, origin: originSignature } = await terms(
      client.address,
      worker.address,
      true,
    )
    await escrow.connect(client).fund(value, originSignature)
    await time.increaseTo(value.workStart)
    await escrow
      .connect(worker)
      .submitInvoice(value.allocationId, ethers.id('milestone'), USDT(100))

    const before = await escrow.nonces(client.address)
    const approve = await authorize(
      client,
      Operation.Approve,
      value.allocationId,
      ethers.ZeroHash,
    )

    await escrow
      .connect(relayer)
      .approveReleaseFor(value.allocationId, approve.deadline, approve.signature)

    expect(await token.balanceOf(worker.address)).to.eq(USDT(95))
    expect(await token.balanceOf(platform.address)).to.eq(USDT(5))
    expect(await token.balanceOf(relayer.address)).to.eq(0)
    expect(await escrow.nonces(client.address)).to.eq(before + 1n)

    // The nonce is spent, so the same signature buys nothing on a second run.
    await expect(
      escrow
        .connect(relayer)
        .approveReleaseFor(value.allocationId, approve.deadline, approve.signature),
    ).to.be.revertedWithCustomError(escrow, 'InvalidAuthorization')
  })

  it('an approval signed by the payee, or as another operation, is refused', async () => {
    const { value, origin: originSignature } = await terms(
      client.address,
      worker.address,
      true,
    )
    await escrow.connect(client).fund(value, originSignature)
    await time.increaseTo(value.workStart)
    await escrow
      .connect(worker)
      .submitInvoice(value.allocationId, ethers.id('milestone'), USDT(100))

    // The payee would love to approve their own bill; the nonce they sign is
    // the payer's, and the signature still has to be the payer's.
    const payeeSigned = await authorize(
      worker,
      Operation.Approve,
      value.allocationId,
      ethers.ZeroHash,
      { forAddress: client.address },
    )
    // Signed as a dispute, used as an approval: the same nonce, another meaning.
    const disputeSigned = await authorize(
      client,
      Operation.Dispute,
      value.allocationId,
      ethers.ZeroHash,
    )

    for (const authorization of [payeeSigned, disputeSigned]) {
      await expect(
        escrow
          .connect(relayer)
          .approveReleaseFor(
            value.allocationId,
            authorization.deadline,
            authorization.signature,
          ),
      ).to.be.revertedWithCustomError(escrow, 'InvalidAuthorization')
    }

    expect(await escrow.nonces(client.address)).to.eq(0)
    expect(await token.balanceOf(worker.address)).to.eq(0)
  })

  it('a relayed call on an unknown allocation has no signer to authorize it', async () => {
    const unknown = ethers.id('never funded')
    const dispute = await authorize(client, Operation.Dispute, unknown, ethers.ZeroHash)

    await expect(
      escrow.connect(relayer).disputeFor(unknown, dispute.deadline, dispute.signature),
    ).to.be.revertedWithCustomError(escrow, 'InvalidAuthorization')
  })

  it('ERC-1271: a smart-contract wallet funds and disputes through its owner signature', async () => {
    const wallet: Any = await (await ethers.getContractFactory('MockSmartWallet')).deploy(client.address)
    const walletAddress = await wallet.getAddress()

    await token.mint(walletAddress, USDT(100))
    await wallet
      .connect(client)
      .execute(
        await token.getAddress(),
        token.interface.encodeFunctionData('approve', [await escrow.getAddress(), USDT(100)]),
      )

    const { value, origin: originSignature } = await terms(walletAddress)
    const fund = await authorize(client, Operation.Fund, value.allocationId, await escrow.termsDigest(value), {
      forAddress: walletAddress,
    })

    await escrow.connect(relayer).fundFor(value, originSignature, fund.deadline, fund.signature)
    await time.increaseTo(value.workEnd)
    await escrow.connect(worker).submitInvoice(value.allocationId, ethers.id('invoice'), USDT(40))

    const dispute = await authorize(client, Operation.Dispute, value.allocationId, ethers.ZeroHash, {
      forAddress: walletAddress,
    })
    await escrow.connect(relayer).disputeFor(value.allocationId, dispute.deadline, dispute.signature)
    await escrow.refundRemainder(value.allocationId)

    expect(await token.balanceOf(walletAddress)).to.eq(USDT(100))

    // Another key's signature does not speak for the wallet.
    const other = await terms(walletAddress)
    const forged = await authorize(relayer, Operation.Fund, other.value.allocationId, await escrow.termsDigest(other.value), {
      forAddress: walletAddress,
    })
    await expect(
      escrow.connect(relayer).fundFor(other.value, other.origin, forged.deadline, forged.signature),
    ).to.be.revertedWithCustomError(escrow, 'InvalidAuthorization')
  })
})
