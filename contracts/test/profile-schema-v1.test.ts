import { expect } from 'chai'
import { ethers } from 'hardhat'
import { takeSnapshot } from '@nomicfoundation/hardhat-network-helpers'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import type { SnapshotRestorer } from '@nomicfoundation/hardhat-network-helpers'

import { canonicalJson } from '../scripts/invoice-commitment'

/**
 * Profile schema v1 (docs/profile-schema-v1.md). The vectors come from
 * `fixtures/profile-schema-v1.vectors.py`, a standard-library Python encoder
 * that shares no code with this repository's TypeScript. This suite
 * recomputes every leaf, root and proof in Solidity - the registry's own
 * PROFILE_LEAF_TYPEHASH, OpenZeppelin's MerkleProof.verify - and every
 * commitment with the deployed registry's profileCommitment(), then publishes
 * each commitment and reads it back as Current. One byte off anywhere fails.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

type Field = {
  slot: number
  pointer: string
  value: unknown
  valueJcs: string
  salt: string
  pathHash: string
  valueHash: string
  leaf: string
  proof: string[]
}

type Case = {
  name: string
  subject: string
  leafSubject: string
  source: Record<string, unknown>
  fields: Field[]
  fillers: { slot: number; leaf: string }[]
  leaves: string[]
  root: string
  commitment: string
}

type Fixture = {
  schemaId: number
  leafType: string
  leafTypehash: string
  commitmentType: string
  commitmentTypehash: string
  chainId: number
  registryDeployer: string
  registry: string
  slots: { slot: number; pointer: string; pathHash: string }[]
  cases: Case[]
}

const FIXTURE_PATH = path.join(__dirname, 'fixtures/profile-schema-v1.vectors.json')

/** Regenerating the fixture must be deliberate: re-pin only after reviewing the diff. */
const FIXTURE_SHA256 = '6ccd277507fa5a8e60fa283496735b784bb8320370adaa79c339eced7dc42c86'

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as Fixture

const LEAF_COUNT = 32
const DEPTH = 5
const FIELD_SLOTS = 14

enum Presentation {
  Unpublished,
  VersionUnknown,
  CommitmentMismatch,
  SchemaMismatch,
  Superseded,
  Deactivated,
  Current,
}

/** Every string inside a value, however deeply nested. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn)
  return []
}

/** The same 32 bytes with the last bit flipped. */
function flipLastBit(word: string): string {
  const bytes = ethers.getBytes(word)

  bytes[31] ^= 1

  return ethers.hexlify(bytes)
}

describe('profile schema v1', () => {
  let registry: Any
  let harness: Any
  let snapshot: SnapshotRestorer

  before(async () => {
    // The fixture's registry is the first CREATE of a key-less address. The
    // snapshot hands that nonce back afterwards, so another suite can deploy
    // at the same address.
    snapshot = await takeSnapshot()

    const deployer = await ethers.getImpersonatedSigner(fixture.registryDeployer)

    await ethers.provider.send('hardhat_setBalance', [
      fixture.registryDeployer,
      ethers.toQuantity(ethers.parseEther('1')),
    ])
    expect(await ethers.provider.getTransactionCount(fixture.registryDeployer), 'the vector deployer is unused').to.eq(0)

    registry = await (await ethers.getContractFactory('IdentityRegistry', deployer)).deploy()
    harness = await (await ethers.getContractFactory('ProfileSchemaHarness')).deploy()

    expect(await registry.getAddress()).to.eq(fixture.registry)
    expect((await ethers.provider.getNetwork()).chainId).to.eq(BigInt(fixture.chainId))
  })

  after(async () => {
    await snapshot.restore()
  })

  it('is the fixture this suite pins', () => {
    const digest = crypto.createHash('sha256').update(fs.readFileSync(FIXTURE_PATH)).digest('hex')

    expect(
      digest,
      'profile-schema-v1.vectors.json changed: regenerate it only with its Python encoder, review the diff, then pin the new digest',
    ).to.eq(FIXTURE_SHA256)
  })

  it('builds on the typehashes the registry publishes', async () => {
    expect(fixture.schemaId).to.eq(1)
    expect(await registry.PROFILE_LEAF_TYPEHASH()).to.eq(fixture.leafTypehash)
    expect(await registry.PROFILE_COMMITMENT_TYPEHASH()).to.eq(fixture.commitmentTypehash)
    expect(ethers.id(fixture.leafType)).to.eq(fixture.leafTypehash)
    expect(ethers.id(fixture.commitmentType)).to.eq(fixture.commitmentTypehash)
  })

  it('fixes one pointer per field slot, leaves the rest reserved, and names no excluded field', async () => {
    expect(fixture.slots.map((row) => row.slot)).to.deep.eq([...Array(FIELD_SLOTS).keys()])
    expect(new Set(fixture.slots.map((row) => row.pointer)).size).to.eq(FIELD_SLOTS)

    for (const row of fixture.slots) {
      expect(row.pointer, `slot ${row.slot}`).to.match(/^(\/[A-Za-z]+)+$/)
      expect(row.pointer.toLowerCase(), `slot ${row.slot}`).to.not.match(
        /email|phone|whatsapp|role|premium|tz|timezone|address|id$/,
      )
      expect(ethers.id(row.pointer), `slot ${row.slot}`).to.eq(row.pathHash)
    }
  })

  for (const vector of fixture.cases) {
    describe(vector.name, () => {
      it('every field leaf recomputes on chain from its pointer, JCS value and salt', async () => {
        const table = new Map(fixture.slots.map((row) => [row.slot, row.pointer]))

        expect(vector.subject).to.eq(`did:pkh:eip155:${fixture.chainId}:${vector.leafSubject}`)
        expect(ethers.getAddress(vector.leafSubject)).to.eq(vector.leafSubject)
        expect(vector.fields).to.have.length.greaterThan(0)

        for (const field of vector.fields) {
          const label = `slot ${field.slot}`

          expect(table.get(field.slot), label).to.eq(field.pointer)
          expect(canonicalJson(field.value), label).to.eq(field.valueJcs)

          for (const text of stringsIn(field.value)) {
            expect(text.normalize('NFC'), label).to.eq(text)
            expect(text.trim(), label).to.eq(text)
            expect(text, label).to.not.eq('')
          }

          const [pathHash, valueHash, leaf] = await harness.leaf(
            await registry.getAddress(),
            fixture.schemaId,
            vector.leafSubject,
            field.slot,
            field.pointer,
            ethers.toUtf8Bytes(field.valueJcs),
            field.salt,
          )

          expect(pathHash, label).to.eq(field.pathHash)
          expect(valueHash, label).to.eq(field.valueHash)
          expect(leaf, label).to.eq(field.leaf)
        }
      })

      it('its 32 leaves, fillers where no field is, give the root', async () => {
        expect(vector.leaves).to.have.length(LEAF_COUNT)
        expect(vector.fields.length + vector.fillers.length).to.eq(LEAF_COUNT)

        for (const field of vector.fields) {
          expect(field.slot, 'a reserved slot never holds a field').to.be.lessThan(FIELD_SLOTS)
          expect(vector.leaves[field.slot]).to.eq(field.leaf)
        }
        for (const filler of vector.fillers) {
          expect(vector.leaves[filler.slot]).to.eq(filler.leaf)
        }

        expect(new Set(vector.leaves).size, 'no two leaves are equal').to.eq(LEAF_COUNT)
        expect(await harness.root(vector.leaves)).to.eq(vector.root)
      })

      it('every proof is 5 elements and passes MerkleProof.verify; one flipped bit does not', async () => {
        for (const field of vector.fields) {
          const label = `slot ${field.slot}`

          expect(field.proof, label).to.have.length(DEPTH)
          expect(await harness.verify(field.proof, vector.root, field.leaf), label).to.eq(true)

          const [, , saltTampered] = await harness.leaf(
            await registry.getAddress(),
            fixture.schemaId,
            vector.leafSubject,
            field.slot,
            field.pointer,
            ethers.toUtf8Bytes(field.valueJcs),
            flipLastBit(field.salt),
          )
          const proofTampered = [...field.proof.slice(0, 4), flipLastBit(field.proof[4])]

          expect(await harness.verify(field.proof, vector.root, saltTampered), label).to.eq(false)
          expect(await harness.verify(proofTampered, vector.root, field.leaf), label).to.eq(false)
          expect(await harness.verify(field.proof, flipLastBit(vector.root), field.leaf), label).to.eq(false)
        }
      })

      it('its commitment is registry.profileCommitment(), and publishes as Current', async () => {
        expect(await registry.profileCommitment(vector.leafSubject, fixture.schemaId, vector.root)).to.eq(
          vector.commitment,
        )

        const subject = await ethers.getImpersonatedSigner(vector.leafSubject)

        await ethers.provider.send('hardhat_setBalance', [
          vector.leafSubject,
          ethers.toQuantity(ethers.parseEther('1')),
        ])
        await registry.connect(subject).publish(vector.commitment, fixture.schemaId, 0)

        const [result, subjectDeactivated] = await registry.checkPresentation(
          vector.leafSubject,
          1,
          vector.commitment,
          fixture.schemaId,
        )

        expect(result).to.eq(Presentation.Current)
        expect(subjectDeactivated).to.eq(false)
        expect((await registry.readIdentity(vector.leafSubject)).commitment).to.eq(vector.commitment)
      })
    })
  }
})
