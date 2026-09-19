import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import {
  PROFILE_COMMITMENT_TYPEHASH,
  PROFILE_LEAF_TYPEHASH,
  SCHEMA_ID_V1,
  buildProfileTree,
  createAnchoredPresentation,
  createProfileExport,
  createSelfSignedPresentation,
  evmSubject,
  profileCommitment,
  profileFieldsFromAppUser,
  restoreProfileTree,
  selfSignedMessageFor,
  serializeDocument,
  verifyPresentationDocument,
} from '../packages/identity/src'
import { canonicalJson } from '../scripts/invoice-commitment'

import type { ProfilePresentation, ProfileTree } from '../packages/identity/src'

/**
 * packages/identity against the deployed IdentityRegistry. The library builds
 * a tree with real CSPRNG salts, and everything it computes off chain must be
 * what the chain computes: the commitment is `profileCommitment()`, every
 * leaf and root is the Solidity recomputation, and every disclosure it hands
 * out passes OpenZeppelin's `MerkleProof.verify`, with values re-encoded by
 * the scripts' own JCS rather than the library's. The registry's own
 * `checkPresentation` then answers the half of verification the library
 * deliberately leaves to an RPC call.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

enum Presentation {
  Unpublished,
  VersionUnknown,
  CommitmentMismatch,
  SchemaMismatch,
  Superseded,
  Deactivated,
  Current,
}

/** The app's public profile projection, with columns schema v1 must never read. */
const APP_USER = {
  name: '  Margaret Hamilton ',
  title: 'Director of software engineering',
  company: 'MIT Instrumentation Laboratory',
  bio: '<p>Apollo guidance computer</p>',
  rate: '180.00',
  skills: 'Flight software, Systems engineering,',
  city: 'Cambridge',
  country: 'US',
  linkedIn: 'margaret-hamilton',
  email: 'margaret@example.com',
  phone: '+1 555 0199',
  roles: ['admin'],
  premium: true,
  tz: 'America/New_York',
}

async function deploy() {
  const [holder, other] = await ethers.getSigners()
  const registry: Any = await (await ethers.getContractFactory('IdentityRegistry')).deploy()
  const secondRegistry: Any = await (await ethers.getContractFactory('IdentityRegistry')).deploy()
  const harness: Any = await (await ethers.getContractFactory('ProfileSchemaHarness')).deploy()
  const chainId = Number((await ethers.provider.getNetwork()).chainId)
  const anchor = { chainId, registry: await registry.getAddress(), version: 1 }

  return { holder, other, registry, secondRegistry, harness, chainId, anchor }
}

function holderTree(address: string, chainId: number): ProfileTree {
  const { fields, skipped } = profileFieldsFromAppUser(APP_USER)

  expect(skipped).to.deep.eq([])

  return buildProfileTree({ subject: evmSubject(address, chainId), fields })
}

async function checkOnChain(registry: Any, presentation: ProfilePresentation) {
  const check = verifyPresentationDocument(serializeDocument(presentation))

  if (!check.ok || check.mode !== 'anchored') throw new Error(`offline check failed: ${JSON.stringify(check)}`)

  const { subject, version, commitment, schemaId } = check.registryCheck
  const [result, subjectDeactivated] = await registry.checkPresentation(subject, version, commitment, schemaId)

  return { result: Number(result) as Presentation, subjectDeactivated: subjectDeactivated as boolean }
}

describe('packages/identity on IdentityRegistry', () => {
  it('builds on the typehashes the deployed registry publishes', async () => {
    const { registry } = await loadFixture(deploy)

    expect(await registry.PROFILE_LEAF_TYPEHASH()).to.eq(PROFILE_LEAF_TYPEHASH)
    expect(await registry.PROFILE_COMMITMENT_TYPEHASH()).to.eq(PROFILE_COMMITMENT_TYPEHASH)
    expect(await registry.SUBJECT_SCHEME()).to.eq('did:pkh:eip155')
  })

  it('computes every leaf and the root exactly as Solidity does', async () => {
    const { holder, registry, harness, chainId } = await loadFixture(deploy)
    const tree = holderTree(holder.address, chainId)

    expect(tree.fields.map((field) => field.key)).to.deep.eq([
      'name',
      'title',
      'company',
      'bio',
      'rate',
      'skills',
      'city',
      'country',
      'linkedIn',
    ])

    for (const field of tree.fields) {
      const [, , leaf] = await harness.leaf(
        await registry.getAddress(),
        SCHEMA_ID_V1,
        holder.address,
        field.slot,
        field.pointer,
        ethers.toUtf8Bytes(field.valueJcs),
        field.salt,
      )

      expect(leaf, field.pointer).to.eq(field.leaf)
    }

    expect(await harness.root(tree.leaves)).to.eq(tree.root)
  })

  it('computes the commitment registry.profileCommitment() computes, and publishes it as Current', async () => {
    const { holder, registry, harness, anchor, chainId } = await loadFixture(deploy)
    const tree = holderTree(holder.address, chainId)
    const commitment = profileCommitment({ ...anchor, subject: holder.address, schemaId: SCHEMA_ID_V1, root: tree.root })

    expect(await registry.profileCommitment(holder.address, SCHEMA_ID_V1, tree.root)).to.eq(commitment)

    await registry.connect(holder).publish(commitment, SCHEMA_ID_V1, 0)

    const presentation = createAnchoredPresentation(tree, { disclose: ['name', 'rate', 'skills', 'country'], anchor })

    expect(presentation.commitment).to.eq(commitment)
    expect(await checkOnChain(registry, presentation)).to.deep.eq({
      result: Presentation.Current,
      subjectDeactivated: false,
    })

    // The selected disclosures open on chain; the rest of the profile is not in the document.
    const text = serializeDocument(presentation)

    expect(text).to.not.contain('Apollo')
    expect(text).to.not.contain('margaret@example.com')

    for (const disclosure of presentation.disclosures) {
      const [, , leaf] = await harness.leaf(
        anchor.registry,
        SCHEMA_ID_V1,
        holder.address,
        disclosure.slot,
        disclosure.pointer,
        ethers.toUtf8Bytes(canonicalJson(disclosure.value)),
        disclosure.salt,
      )

      expect(disclosure.proof, disclosure.pointer).to.have.length(5)
      expect(await harness.verify(disclosure.proof, presentation.root, leaf), disclosure.pointer).to.eq(true)
    }
  })

  it('a changed value, salt or proof in a presentation fails MerkleProof.verify as well as the library', async () => {
    const { holder, registry, harness, anchor, chainId } = await loadFixture(deploy)
    const tree = holderTree(holder.address, chainId)
    const presentation = createAnchoredPresentation(tree, { disclose: ['title'], anchor })
    const [disclosure] = presentation.disclosures
    const leafOf = async (value: string, salt: string) =>
      (
        await harness.leaf(
          await registry.getAddress(),
          SCHEMA_ID_V1,
          holder.address,
          disclosure.slot,
          disclosure.pointer,
          ethers.toUtf8Bytes(canonicalJson(value)),
          salt,
        )
      )[2]
    const otherSalt = ethers.hexlify(ethers.randomBytes(32))

    expect(await harness.verify(disclosure.proof, tree.root, await leafOf(disclosure.value as string, disclosure.salt))).to.eq(
      true,
    )
    expect(await harness.verify(disclosure.proof, tree.root, await leafOf('Chief engineer', disclosure.salt))).to.eq(false)
    expect(await harness.verify(disclosure.proof, tree.root, await leafOf(disclosure.value as string, otherSalt))).to.eq(false)
    expect(
      await harness.verify(
        [...disclosure.proof.slice(0, 4), otherSalt],
        tree.root,
        await leafOf(disclosure.value as string, disclosure.salt),
      ),
    ).to.eq(false)

    const tampered = JSON.parse(serializeDocument(presentation))

    tampered.disclosures[0].value = 'Chief engineer'
    expect(verifyPresentationDocument(tampered)).to.include({ ok: false, reason: 'InvalidProof' })
  })

  it('an old version still opens offline, but the registry reports it Superseded, then the withdrawal', async () => {
    const { holder, registry, anchor, chainId } = await loadFixture(deploy)
    const first = holderTree(holder.address, chainId)
    const second = holderTree(holder.address, chainId)

    // Fresh salts and fillers: the same fields give a new root and a new commitment.
    expect(second.root).to.not.eq(first.root)

    const firstShown = createAnchoredPresentation(first, { disclose: ['name'], anchor })
    const secondShown = createAnchoredPresentation(second, { disclose: ['name'], anchor: { ...anchor, version: 2 } })

    await registry.connect(holder).publish(firstShown.commitment, SCHEMA_ID_V1, 0)
    await registry.connect(holder).publish(secondShown.commitment, SCHEMA_ID_V1, 1)

    expect(await checkOnChain(registry, firstShown)).to.deep.eq({ result: Presentation.Superseded, subjectDeactivated: false })
    expect(await checkOnChain(registry, secondShown)).to.deep.eq({ result: Presentation.Current, subjectDeactivated: false })

    // Claiming the old commitment is the current version does not survive the registry.
    const misdated = { ...firstShown, anchor: { ...anchor, version: 2 } }

    expect(await checkOnChain(registry, misdated)).to.deep.eq({
      result: Presentation.CommitmentMismatch,
      subjectDeactivated: false,
    })

    await registry.connect(holder).deactivate(0)

    expect(await checkOnChain(registry, secondShown)).to.deep.eq({ result: Presentation.Deactivated, subjectDeactivated: true })
    expect(await checkOnChain(registry, firstShown)).to.deep.eq({ result: Presentation.Superseded, subjectDeactivated: true })
  })

  it('a presentation cannot be lifted onto another subject or another deployment', async () => {
    const { holder, other, registry, secondRegistry, anchor, chainId } = await loadFixture(deploy)
    const tree = holderTree(holder.address, chainId)
    const presentation = createAnchoredPresentation(tree, { disclose: ['name', 'title'], anchor })

    await registry.connect(holder).publish(presentation.commitment, SCHEMA_ID_V1, 0)

    // Another wallet republishing the same bytes gains nothing: the leaves bind the holder.
    await registry.connect(other).publish(presentation.commitment, SCHEMA_ID_V1, 0)

    const lifted = JSON.parse(serializeDocument(presentation))

    lifted.subject = evmSubject(other.address, chainId).did
    expect(verifyPresentationDocument(lifted)).to.include({ ok: false, reason: 'InvalidProof' })

    // The same tree presented against a second deployment is another commitment.
    const elsewhere = { ...presentation, anchor: { ...anchor, registry: await secondRegistry.getAddress() } }

    expect(verifyPresentationDocument(elsewhere)).to.include({ ok: false, reason: 'CommitmentMismatch' })
    expect(await secondRegistry.profileCommitment(holder.address, SCHEMA_ID_V1, tree.root)).to.not.eq(presentation.commitment)
  })

  it('restores a published tree from its private export and presents from it', async () => {
    const { holder, registry, anchor, chainId } = await loadFixture(deploy)
    const tree = holderTree(holder.address, chainId)
    const commitment = profileCommitment({ ...anchor, subject: holder.address, schemaId: SCHEMA_ID_V1, root: tree.root })

    await registry.connect(holder).publish(commitment, SCHEMA_ID_V1, 0)

    const restored = restoreProfileTree(serializeDocument(createProfileExport(tree)))
    const presentation = createAnchoredPresentation(restored, { disclose: ['city'], anchor })

    expect(await checkOnChain(registry, presentation)).to.deep.eq({ result: Presentation.Current, subjectDeactivated: false })
  })

  it('self-signs with a wallet that never anchored, and the registry says so', async () => {
    const { holder, registry, anchor, chainId } = await loadFixture(deploy)
    const tree = holderTree(holder.address, chainId)
    const presentation = createSelfSignedPresentation(tree, {
      disclose: ['skills'],
      signature: await holder.signMessage(selfSignedMessageFor(tree)),
    })
    const check = verifyPresentationDocument(serializeDocument(presentation))

    if (!check.ok || check.mode !== 'self-signed') throw new Error(JSON.stringify(check))
    expect(check.signer).to.eq(holder.address)

    // A signature proves authorship, not currency: the chain has no record of this root.
    const commitment = profileCommitment({ ...anchor, subject: holder.address, schemaId: SCHEMA_ID_V1, root: tree.root })
    const [result] = await registry.checkPresentation(holder.address, 1, commitment, SCHEMA_ID_V1)

    expect(Number(result)).to.eq(Presentation.Unpublished)
  })
})
