import { expect } from 'chai'
import { ethers } from 'hardhat'
import { time } from '@nomicfoundation/hardhat-network-helpers'

import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'

/**
 * SC-ID-01 publication, versioning and withdrawal, plus the SC-A cases the
 * registry is responsible for: A01 (nobody publishes for another subject),
 * A02 (concurrent edits conflict), A03 (identity never gates escrow) and A08
 * (authorizations do not replay across operation, subject, contract or chain).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

const HOUR = 3600
const DAY = 24 * HOUR
const USDT = (value: number) => ethers.parseUnits(String(value), 6)

enum Operation {
  Publish,
  Deactivate,
}

enum Status {
  None,
  Active,
  Deactivated,
}

enum Presentation {
  Unpublished,
  VersionUnknown,
  CommitmentMismatch,
  SchemaMismatch,
  Superseded,
  Deactivated,
  Current,
}

const ACTION_TYPES = {
  Action: [
    { name: 'operation', type: 'uint8' },
    { name: 'subject', type: 'address' },
    { name: 'payload', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
}

const SCHEMA = 1
const ROOT_A = ethers.id('merkle-root-a')
const ROOT_B = ethers.id('merkle-root-b')

describe('IdentityRegistry', () => {
  let alice: HardhatEthersSigner
  let mallory: HardhatEthersSigner
  let relayer: HardhatEthersSigner
  let registry: Any

  beforeEach(async () => {
    ;[alice, mallory, relayer] = await ethers.getSigners()
    registry = await (await ethers.getContractFactory('IdentityRegistry')).deploy()
  })

  async function domain() {
    return {
      name: 'WorkAddressIdentityRegistry',
      version: '1',
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await registry.getAddress(),
    }
  }

  /** What actually gets published: the domain-separated commitment, never the bare root. */
  async function commitmentFor(subject: string, root: string, schemaId = SCHEMA) {
    return registry.profileCommitment(subject, schemaId, root)
  }

  async function signAction(
    signer: HardhatEthersSigner,
    operation: Operation,
    subject: string,
    payload: string,
    deadline: number,
    nonce?: bigint,
  ) {
    return signer.signTypedData(await domain(), ACTION_TYPES, {
      operation,
      subject,
      payload,
      nonce: nonce ?? (await registry.nonces(subject)),
      deadline,
    })
  }

  describe('publication and versions', () => {
    it('an unpublished subject reads as None rather than reverting, and None is the zero value', async () => {
      const record = await registry.readIdentity(alice.address)

      expect(record.version).to.equal(0)
      expect(record.status).to.equal(Status.None)
      expect(record.commitment).to.equal(ethers.ZeroHash)
      expect(await registry.versionCount(alice.address)).to.equal(0)
    })

    it('publishes version 1, then appends, keeping versionCount and head in step', async () => {
      const first = await commitmentFor(alice.address, ROOT_A)

      await expect(registry.connect(alice).publish(first, SCHEMA, 0))
        .to.emit(registry, 'IdentityPublished')
        .withArgs(alice.address, 1, SCHEMA, first, (t: bigint) => t > 0n)

      const second = await commitmentFor(alice.address, ROOT_B)
      await registry.connect(alice).publish(second, SCHEMA, 1)

      const head = await registry.readIdentity(alice.address)
      expect(head.version).to.equal(2)
      expect(head.status).to.equal(Status.Active)
      expect(head.commitment).to.equal(second)
      expect(await registry.versionCount(alice.address)).to.equal(2)

      // History stays readable: an export naming version 1 is still checkable.
      const old = await registry.readIdentityAt(alice.address, 1)
      expect(old.commitment).to.equal(first)
      expect(old.isCurrent).to.equal(false)
    })

    it('refuses an empty commitment, a zero schema and an out-of-range version read', async () => {
      await expect(registry.connect(alice).publish(ethers.ZeroHash, SCHEMA, 0)).to.be.revertedWithCustomError(
        registry,
        'InvalidCommitment',
      )
      await expect(
        registry.connect(alice).publish(await commitmentFor(alice.address, ROOT_A), 0, 0),
      ).to.be.revertedWithCustomError(registry, 'InvalidSchema')

      await registry.connect(alice).publish(await commitmentFor(alice.address, ROOT_A), SCHEMA, 0)
      await expect(registry.readIdentityAt(alice.address, 2))
        .to.be.revertedWithCustomError(registry, 'UnknownVersion')
        .withArgs(2, 1)
    })

    it('SC-A02: two edits prepared against the same version yield exactly one accepted version', async () => {
      await registry.connect(alice).publish(await commitmentFor(alice.address, ROOT_A), SCHEMA, 0)

      await registry.connect(alice).publish(await commitmentFor(alice.address, ROOT_B), SCHEMA, 1)

      // The second editor still believes the head is version 1.
      await expect(registry.connect(alice).publish(await commitmentFor(alice.address, ROOT_A), SCHEMA, 1))
        .to.be.revertedWithCustomError(registry, 'VersionConflict')
        .withArgs(1, 2)

      expect(await registry.versionCount(alice.address)).to.equal(2)
    })

    it('SC-A01: the direct path cannot name another subject, and a relayed one needs their signature', async () => {
      // publish() takes no subject argument at all: publishing for someone else
      // is not expressible on the direct path.
      expect(registry.interface.getFunction('publish').inputs.map((i: Any) => i.name)).to.not.include('subject')

      const commitment = await commitmentFor(alice.address, ROOT_A)
      const deadline = (await time.latest()) + HOUR
      const mallorySignature = await signAction(
        mallory,
        Operation.Publish,
        alice.address,
        await registry.publishPayload(commitment, SCHEMA, 0),
        deadline,
      )

      await expect(
        registry
          .connect(mallory)
          .publishFor(alice.address, commitment, SCHEMA, 0, deadline, mallorySignature),
      ).to.be.revertedWithCustomError(registry, 'InvalidAuthorization')

      expect(await registry.versionCount(alice.address)).to.equal(0)
    })
  })

  describe('withdrawal', () => {
    beforeEach(async () => {
      await registry.connect(alice).publish(await commitmentFor(alice.address, ROOT_A), SCHEMA, 0)
    })

    it('withdraws the current presentation without appending a version', async () => {
      await expect(registry.connect(alice).deactivate(1))
        .to.emit(registry, 'IdentityDeactivated')
        .withArgs(alice.address, 1, (t: bigint) => t > 0n)

      const head = await registry.readIdentity(alice.address)
      expect(head.status).to.equal(Status.Deactivated)
      // The counter counts presentations; withdrawing one does not create one.
      expect(head.version).to.equal(1)
      expect(await registry.versionCount(alice.address)).to.equal(1)
    })

    it('accepts expectedVersion 0 as an unconditional takedown, so it cannot be raced into failing', async () => {
      await registry.connect(alice).deactivate(0)

      expect((await registry.readIdentity(alice.address)).status).to.equal(Status.Deactivated)
    })

    it('separates never-published from already-withdrawn, and never no-ops silently', async () => {
      await expect(registry.connect(mallory).deactivate(0)).to.be.revertedWithCustomError(
        registry,
        'NotPublished',
      )

      await registry.connect(alice).deactivate(1)
      await expect(registry.connect(alice).deactivate(1)).to.be.revertedWithCustomError(
        registry,
        'AlreadyDeactivated',
      )
    })

    it('reactivates only by publishing again, which appends a new version', async () => {
      await registry.connect(alice).deactivate(1)

      // There is deliberately no activate() or setStatus to flip it back on.
      expect(registry.interface.fragments.some((f: Any) => f.name === 'activate')).to.equal(false)
      expect(registry.interface.fragments.some((f: Any) => f.name === 'setStatus')).to.equal(false)

      await registry.connect(alice).publish(await commitmentFor(alice.address, ROOT_B), SCHEMA, 1)

      const head = await registry.readIdentity(alice.address)
      expect(head.status).to.equal(Status.Active)
      expect(head.version).to.equal(2)
    })
  })

  describe('relayed authorizations (SC-SIG-01, SC-A08)', () => {
    it('a relayer pays gas while only the subject consents', async () => {
      const commitment = await commitmentFor(alice.address, ROOT_A)
      const deadline = (await time.latest()) + HOUR
      const signature = await signAction(
        alice,
        Operation.Publish,
        alice.address,
        await registry.publishPayload(commitment, SCHEMA, 0),
        deadline,
      )

      await registry.connect(relayer).publishFor(alice.address, commitment, SCHEMA, 0, deadline, signature)

      expect((await registry.readIdentity(alice.address)).version).to.equal(1)
      expect(await registry.nonces(alice.address)).to.equal(1)
    })

    it('SC-A08: a signature does not replay, nor cross operation, subject or payload', async () => {
      const commitment = await commitmentFor(alice.address, ROOT_A)
      const deadline = (await time.latest()) + HOUR
      const payload = await registry.publishPayload(commitment, SCHEMA, 0)
      const signature = await signAction(alice, Operation.Publish, alice.address, payload, deadline)

      await registry.connect(relayer).publishFor(alice.address, commitment, SCHEMA, 0, deadline, signature)

      // Same signature again: the nonce is consumed.
      await expect(
        registry.connect(relayer).publishFor(alice.address, commitment, SCHEMA, 1, deadline, signature),
      ).to.be.revertedWithCustomError(registry, 'InvalidAuthorization')

      // A publish authorization submitted as a withdrawal.
      await expect(
        registry.connect(relayer).deactivateFor(alice.address, 1, deadline, signature),
      ).to.be.revertedWithCustomError(registry, 'InvalidAuthorization')

      // Alice's authorization replayed against Mallory's record.
      await expect(
        registry.connect(relayer).publishFor(mallory.address, commitment, SCHEMA, 0, deadline, signature),
      ).to.be.revertedWithCustomError(registry, 'InvalidAuthorization')
    })

    it('refuses an expired authorization', async () => {
      const commitment = await commitmentFor(alice.address, ROOT_A)
      const deadline = (await time.latest()) + HOUR
      const signature = await signAction(
        alice,
        Operation.Publish,
        alice.address,
        await registry.publishPayload(commitment, SCHEMA, 0),
        deadline,
      )

      await time.increase(2 * HOUR)

      await expect(
        registry.connect(relayer).publishFor(alice.address, commitment, SCHEMA, 0, deadline, signature),
      ).to.be.revertedWithCustomError(registry, 'AuthorizationExpired')
    })

    it('withdrawal voids authorizations the subject signed but never submitted', async () => {
      await registry.connect(alice).publish(await commitmentFor(alice.address, ROOT_A), SCHEMA, 0)

      // Alice signs an update and hands it to a relayer, who sits on it.
      const commitment = await commitmentFor(alice.address, ROOT_B)
      const deadline = (await time.latest()) + DAY
      const held = await signAction(
        alice,
        Operation.Publish,
        alice.address,
        await registry.publishPayload(commitment, SCHEMA, 1),
        deadline,
      )

      // She then takes the profile down entirely.
      await registry.connect(alice).deactivate(0)

      // The held authorization must not re-expose it: withdrawal consumed the
      // nonce space, so the stale consent is dead rather than merely stale.
      await expect(
        registry.connect(relayer).publishFor(alice.address, commitment, SCHEMA, 1, deadline, held),
      ).to.be.revertedWithCustomError(registry, 'InvalidAuthorization')

      expect((await registry.readIdentity(alice.address)).status).to.equal(Status.Deactivated)
    })

    it('ERC-1271: a contract wallet subject publishes through its owner signature', async () => {
      const wallet: Any = await (await ethers.getContractFactory('MockSmartWallet')).deploy(alice.address)
      const subject = await wallet.getAddress()
      const commitment = await commitmentFor(subject, ROOT_A)
      const deadline = (await time.latest()) + HOUR
      const signature = await signAction(
        alice,
        Operation.Publish,
        subject,
        await registry.publishPayload(commitment, SCHEMA, 0),
        deadline,
      )

      await registry.connect(relayer).publishFor(subject, commitment, SCHEMA, 0, deadline, signature)

      expect((await registry.readIdentity(subject)).version).to.equal(1)
    })
  })

  describe('commitment binding (SC-PR-01, SC-A04)', () => {
    it('binds the commitment to subject, registry and chain, so it cannot be transplanted', async () => {
      const forAlice = await commitmentFor(alice.address, ROOT_A)
      const forMallory = await commitmentFor(mallory.address, ROOT_A)

      // Same Merkle root, different subject: a stolen export cannot be
      // republished under someone else's record and still verify.
      expect(forAlice).to.not.equal(forMallory)

      // A second deployment is a different domain as well.
      const other: Any = await (await ethers.getContractFactory('IdentityRegistry')).deploy()
      expect(await other.profileCommitment(alice.address, SCHEMA, ROOT_A)).to.not.equal(forAlice)

      // And the schema is part of it.
      expect(await commitmentFor(alice.address, ROOT_A, SCHEMA + 1)).to.not.equal(forAlice)
    })

    it('publishes the leaf scheme so an independent verifier needs no hosted API', async () => {
      expect(await registry.PROFILE_LEAF_TYPEHASH()).to.equal(
        ethers.id(
          'ProfileLeaf(uint32 schemaId,address subject,uint16 slot,bytes32 pathHash,bytes32 valueHash,bytes32 salt)',
        ),
      )
      expect(await registry.SUBJECT_SCHEME()).to.equal('did:pkh:eip155')
    })
  })

  describe('checkPresentation (SC-A05)', () => {
    let current: string

    beforeEach(async () => {
      current = await commitmentFor(alice.address, ROOT_A)
      await registry.connect(alice).publish(current, SCHEMA, 0)
    })

    it('distinguishes unpublished, unknown version, wrong commitment and wrong schema', async () => {
      expect((await registry.checkPresentation(mallory.address, 1, current, SCHEMA))[0]).to.equal(
        Presentation.Unpublished,
      )
      expect((await registry.checkPresentation(alice.address, 2, current, SCHEMA))[0]).to.equal(
        Presentation.VersionUnknown,
      )
      expect((await registry.checkPresentation(alice.address, 1, ROOT_B, SCHEMA))[0]).to.equal(
        Presentation.CommitmentMismatch,
      )
      expect((await registry.checkPresentation(alice.address, 1, current, SCHEMA + 1))[0]).to.equal(
        Presentation.SchemaMismatch,
      )
    })

    it('reports the live version as Current and an older one as Superseded', async () => {
      const next = await commitmentFor(alice.address, ROOT_B)
      await registry.connect(alice).publish(next, SCHEMA, 1)

      expect((await registry.checkPresentation(alice.address, 2, next, SCHEMA))[0]).to.equal(
        Presentation.Current,
      )
      expect((await registry.checkPresentation(alice.address, 1, current, SCHEMA))[0]).to.equal(
        Presentation.Superseded,
      )
    })

    it('never lets a withdrawn profile read as merely out of date', async () => {
      const next = await commitmentFor(alice.address, ROOT_B)
      await registry.connect(alice).publish(next, SCHEMA, 1)
      await registry.connect(alice).deactivate(0)

      // The head itself reads as withdrawn, not current.
      const head = await registry.checkPresentation(alice.address, 2, next, SCHEMA)
      expect(head[0]).to.equal(Presentation.Deactivated)
      expect(head[1]).to.equal(true)

      // An older version is still Superseded, but the withdrawal travels with
      // it, so a verifier cannot render "out of date" for a taken-down profile.
      const older = await registry.checkPresentation(alice.address, 1, current, SCHEMA)
      expect(older[0]).to.equal(Presentation.Superseded)
      expect(older[1]).to.equal(true)
    })
  })

  describe('SC-A03: identity never gates escrow', () => {
    it('a withdrawn identity does not block a funded release', async () => {
      const [origin, client, worker, platform] = await ethers.getSigners()
      const token: Any = await (await ethers.getContractFactory('MockUSDT')).deploy()
      const escrow: Any = await (await ethers.getContractFactory('MarketplaceEscrow')).deploy(
        await token.getAddress(),
        platform.address,
        origin.address,
      )

      await token.mint(client.address, USDT(1_000))
      await token.connect(client).approve(await escrow.getAddress(), ethers.MaxUint256)

      const now = await time.latest()
      const terms = {
        allocationId: ethers.id('allocation-1'),
        obligationId: ethers.id('obligation-1'),
        termsHash: ethers.id('terms-1'),
        payer: client.address,
        payee: worker.address,
        budget: USDT(100),
        workStart: now + HOUR,
        workEnd: now + DAY,
        originExpiry: now + DAY,
        earlySubmission: false,
      }
      const originSignature = await origin.signTypedData(
        {
          name: 'WorkAddressMarketplaceEscrow',
          version: '1',
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await escrow.getAddress(),
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
            { name: 'earlySubmission', type: 'bool' },
          ],
        },
        terms,
      )

      await escrow.connect(client).fund(terms, originSignature)

      // The worker publishes an identity, then withdraws it mid-engagement.
      const commitment = await registry.profileCommitment(worker.address, SCHEMA, ROOT_A)
      await registry.connect(worker).publish(commitment, SCHEMA, 0)
      await registry.connect(worker).deactivate(0)

      await time.increaseTo(terms.workEnd)
      await escrow.connect(worker).submitInvoice(terms.allocationId, ethers.id('invoice-1'), USDT(60))
      await time.increase(7 * DAY)

      // Settlement is unaffected: the registry and the escrow share no import,
      // no address and no interface in either direction.
      await expect(escrow.release(terms.allocationId)).to.changeTokenBalances(
        token,
        [worker, platform],
        [USDT(57), USDT(3)],
      )
    })
  })
})
