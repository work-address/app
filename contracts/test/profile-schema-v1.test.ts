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
 * each commitment and reads it back as Current. Every presentation's
 * disclosures open on chain, and every export rebuilds its root. One byte off
 * anywhere fails.
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

type Disclosure = { slot: number; pointer: string; value: unknown; salt: string; proof: string[] }

type Case = {
  name: string
  subject: string
  leafSubject: string
  source: Record<string, unknown>
  fields: Field[]
  fillers: { slot: number; leaf: string }[]
  leaves: string[]
  root: string
  /** Anchored cases only. */
  commitment?: string
  /** Self-signed cases only. */
  selfSigned?: { signer: string; message: string; signature: { scheme: string; value: string } }
  presentation: { disclose: number[]; text: string }
  export: { text: string }
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
  presentationFormat: string
  exportFormat: string
  selfSignedDomain: string
  slots: { slot: number; pointer: string; pathHash: string }[]
  cases: Case[]
  selfSignedCases: Case[]
}

const FIXTURE_PATH = path.join(__dirname, 'fixtures/profile-schema-v1.vectors.json')

/** Regenerating the fixture must be deliberate: re-pin only after reviewing the diff. */
const FIXTURE_SHA256 = '0228d6d3bb3ec449ab9a690251983abee9dcc9cec5ab047f459072bc89dd70a2'

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

  const vectors: [Case, 'anchored' | 'self-signed'][] = [
    ...fixture.cases.map((vector): [Case, 'anchored'] => [vector, 'anchored']),
    ...fixture.selfSignedCases.map((vector): [Case, 'self-signed'] => [vector, 'self-signed']),
  ]

  it('has three anchored and two self-signed cases', () => {
    expect(fixture.cases).to.have.length(3)
    expect(fixture.selfSignedCases.map((vector) => vector.subject.split(':').slice(0, 3).join(':'))).to.deep.eq([
      'did:pkh:eip155',
      'did:pkh:solana',
    ])
  })

  for (const [vector, mode] of vectors) {
    describe(vector.name, () => {
      it('binds its leaves to the subject the DID names', () => {
        expect(ethers.getAddress(vector.leafSubject)).to.eq(vector.leafSubject)

        if (mode === 'anchored') {
          expect(vector.subject).to.eq(`did:pkh:eip155:${fixture.chainId}:${vector.leafSubject}`)
        } else if (vector.subject.startsWith('did:pkh:eip155:')) {
          expect(vector.subject).to.match(new RegExp(`^did:pkh:eip155:[1-9][0-9]*:${vector.leafSubject}$`))
          expect(vector.selfSigned?.signer).to.eq(vector.leafSubject)
        } else {
          // A Solana key has no 20-byte address: the leaf binds a hash of its DID.
          expect(vector.leafSubject).to.eq(ethers.getAddress(ethers.dataSlice(ethers.id(vector.subject), 12)))
          expect(vector.subject.endsWith(`:${vector.selfSigned?.signer}`)).to.eq(true)
        }
      })

      it('every field leaf recomputes on chain from its pointer, JCS value and salt', async () => {
        const table = new Map(fixture.slots.map((row) => [row.slot, row.pointer]))

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

      it('its export is JCS text that rebuilds the root on chain from values, salts and fillers alone', async () => {
        const document = JSON.parse(vector.export.text) as Any

        expect(canonicalJson(document)).to.eq(vector.export.text)
        expect(Object.keys(document).sort()).to.deep.eq(
          ['createdAt', 'fields', 'fillers', 'format', 'formatVersion', 'root', 'schemaId', 'subject'].sort(),
        )
        expect([document.format, document.formatVersion, document.schemaId]).to.deep.eq([fixture.exportFormat, 1, 1])
        expect([document.subject, document.root]).to.deep.eq([vector.subject, vector.root])

        const leaves: string[] = new Array(LEAF_COUNT)

        for (const field of document.fields) {
          const [, , leaf] = await harness.leaf(
            await registry.getAddress(),
            fixture.schemaId,
            vector.leafSubject,
            field.slot,
            field.pointer,
            ethers.toUtf8Bytes(canonicalJson(field.value)),
            field.salt,
          )

          leaves[field.slot] = leaf
        }
        for (const filler of document.fillers) leaves[filler.slot] = filler.leaf

        expect(await harness.root(leaves)).to.eq(vector.root)
      })

      it('its presentation is JCS text whose every disclosure opens on chain', async () => {
        const document = JSON.parse(vector.presentation.text) as Any
        const disclosures = document.disclosures as Disclosure[]

        expect(canonicalJson(document)).to.eq(vector.presentation.text)
        expect([document.format, document.formatVersion, document.schemaId]).to.deep.eq([
          fixture.presentationFormat,
          1,
          1,
        ])
        expect([document.subject, document.root]).to.deep.eq([vector.subject, vector.root])
        expect(disclosures.map((disclosure) => disclosure.slot)).to.deep.eq(vector.presentation.disclose)
        expect(disclosures).to.deep.eq(
          vector.fields
            .filter((field) => vector.presentation.disclose.includes(field.slot))
            .map(({ slot, pointer, value, salt, proof }) => ({ slot, pointer, value, salt, proof })),
        )

        if (mode === 'anchored') {
          expect(document.anchor).to.deep.eq({ chainId: fixture.chainId, registry: fixture.registry, version: 1 })
          expect(document.commitment).to.eq(vector.commitment)
          expect(document.signature).to.eq(null)
        } else {
          expect([document.anchor, document.commitment]).to.deep.eq([null, null])
          expect(document.signature).to.deep.eq(vector.selfSigned?.signature)
        }

        for (const disclosure of disclosures) {
          const label = `slot ${disclosure.slot}`
          const [, , leaf] = await harness.leaf(
            await registry.getAddress(),
            fixture.schemaId,
            vector.leafSubject,
            disclosure.slot,
            disclosure.pointer,
            ethers.toUtf8Bytes(canonicalJson(disclosure.value)),
            disclosure.salt,
          )

          expect(disclosure.proof, label).to.have.length(DEPTH)
          expect(await harness.verify(disclosure.proof, vector.root, leaf), label).to.eq(true)
        }
      })

      if (mode === 'self-signed') {
        it('signs exactly the documented message', () => {
          const selfSigned = vector.selfSigned!

          expect(selfSigned.message).to.eq(
            [
              'Work Address profile, self-signed',
              `domain: ${fixture.selfSignedDomain}`,
              `schemaId: ${fixture.schemaId}`,
              `subject: ${vector.subject}`,
              `root: ${vector.root}`,
            ].join('\n'),
          )

          if (selfSigned.signature.scheme === 'eip191') {
            // ethers checks the Python secp256k1 signature; Ed25519 is checked by packages/identity.
            expect(ethers.verifyMessage(selfSigned.message, selfSigned.signature.value)).to.eq(selfSigned.signer)
          } else {
            expect(selfSigned.signature.scheme).to.eq('ed25519')
            expect(ethers.dataLength(selfSigned.signature.value)).to.eq(64)
          }
        })

        return
      }

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
