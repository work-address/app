import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import { getBytes } from 'ethers'
import { suite, test } from '@testdeck/mocha'

import {
  EXPORT_FORMAT,
  PRESENTATION_FORMAT,
  PROFILE_COMMITMENT_TYPEHASH,
  PROFILE_LEAF_TYPEHASH,
  PROFILE_SCHEMA_V1,
  SCHEMA_ID_V1,
  SELF_SIGNED_DOMAIN,
  buildProfileTree,
  committedField,
  createAnchoredPresentation,
  createProfileExport,
  createSelfSignedPresentation,
  pathHash,
  profileCommitment,
  profileFieldsFromAppUser,
  proofFor,
  restoreProfileTree,
  selfSignedMessageFor,
  serializeDocument,
  verifyPresentationDocument,
} from '@/vendor/identity'
import type { AppPublicUser, ProfileTree, RandomBytes } from '@/vendor/identity'

interface IVectorField {
  slot: number
  pointer: string
  value: unknown
  valueJcs: string
  salt: string
  leaf: string
  proof: string[]
}

interface IVector {
  name: string
  subject: string
  leafSubject: string
  source: Record<string, unknown>
  fields: IVectorField[]
  fillers: { slot: number; leaf: string }[]
  leaves: string[]
  root: string
  commitment?: string
  presentation: { disclose: number[]; text: string }
  export: { text: string }
  selfSigned?: {
    signer: string
    message: string
    signature: { scheme: 'eip191' | 'ed25519'; value: string }
  }
}

interface IFixture {
  schemaId: number
  leafTypehash: string
  commitmentTypehash: string
  chainId: number
  registry: string
  presentationFormat: string
  exportFormat: string
  selfSignedDomain: string
  slots: { slot: number; pointer: string; pathHash: string }[]
  cases: IVector[]
  selfSignedCases: IVector[]
}

/**
 * A byte-identical copy of the contracts repository's
 * test/fixtures/profile-schema-v1.vectors.json. The vectors come from an
 * independent Python encoder, and the contracts suite holds the same file to
 * the deployed IdentityRegistry.
 */
const FIXTURE = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../fixture/profile-schema-v1.vectors.json'),
    'utf8',
  ),
) as IFixture

const CREATED_AT = '2026-09-19T12:00:00.000Z'

/**
 * The vendored copy of @work-address/identity (src/vendor/identity) against
 * the published profile schema v1 vectors. If the copy drifts from the
 * library the chain was tested with, the commitment this service checks
 * would differ from the one a holder published, and every byte here would
 * say so first.
 */
@suite()
export class IdentityLibraryTest {
  /** The vector's salts and fillers, in the order buildProfileTree draws them. */
  private static randomBytesOf(vector: IVector): RandomBytes {
    const words = Array.from({ length: 32 }, (_, slot) => {
      const field = vector.fields.find((candidate) => candidate.slot === slot)
      const filler = vector.fillers.find((candidate) => candidate.slot === slot)
      const word = field?.salt ?? filler?.leaf

      if (!word) {
        throw new Error(`The vector has nothing at slot ${slot}`)
      }

      return word
    })
    let next = 0

    return (length) => {
      if (length !== 32 || next >= words.length) {
        throw new Error('Drew more randomness than the vector holds')
      }

      return getBytes(words[next++])
    }
  }

  private static treeOf(vector: IVector): ProfileTree {
    const { fields, skipped } = profileFieldsFromAppUser(
      vector.source as AppPublicUser,
    )

    expect(skipped, vector.name).to.deep.equal([])

    return buildProfileTree({
      subject: vector.subject,
      fields,
      randomBytes: IdentityLibraryTest.randomBytesOf(vector),
    })
  }

  @test()
  sharesTheConstantsTheEncoderAndTheRegistryUse() {
    expect(SCHEMA_ID_V1).to.equal(FIXTURE.schemaId)
    expect(PROFILE_LEAF_TYPEHASH).to.equal(FIXTURE.leafTypehash)
    expect(PROFILE_COMMITMENT_TYPEHASH).to.equal(FIXTURE.commitmentTypehash)
    expect(PRESENTATION_FORMAT).to.equal(FIXTURE.presentationFormat)
    expect(EXPORT_FORMAT).to.equal(FIXTURE.exportFormat)
    expect(SELF_SIGNED_DOMAIN).to.equal(FIXTURE.selfSignedDomain)
    expect(
      PROFILE_SCHEMA_V1.map(({ slot, pointer }) => ({
        slot,
        pointer,
        pathHash: pathHash(pointer),
      })),
    ).to.deep.equal(FIXTURE.slots)
  }

  @test()
  rebuildsEveryLeafRootAndProof() {
    for (const vector of [...FIXTURE.cases, ...FIXTURE.selfSignedCases]) {
      const tree = IdentityLibraryTest.treeOf(vector)

      expect(tree.subject.leafSubject, vector.name).to.equal(vector.leafSubject)
      expect(tree.leaves, vector.name).to.deep.equal(vector.leaves)
      expect(tree.root, vector.name).to.equal(vector.root)
      expect(tree.fillers, vector.name).to.deep.equal(vector.fillers)

      for (const field of vector.fields) {
        const committed = committedField(tree, field.slot)

        expect(committed?.valueJcs, field.pointer).to.equal(field.valueJcs)
        expect(committed?.leaf, field.pointer).to.equal(field.leaf)
        expect(proofFor(tree, field.slot), field.pointer).to.deep.equal(
          field.proof,
        )
      }
    }
  }

  @test()
  writesAndRestoresEveryPrivateExportByteForByte() {
    for (const vector of [...FIXTURE.cases, ...FIXTURE.selfSignedCases]) {
      const tree = IdentityLibraryTest.treeOf(vector)

      expect(
        serializeDocument(createProfileExport(tree, { createdAt: CREATED_AT })),
        vector.name,
      ).to.equal(vector.export.text)
      expect(restoreProfileTree(vector.export.text).root).to.equal(vector.root)
    }
  }

  @test()
  computesTheCommitmentAndAnchoredPresentationTheRegistryChecks() {
    for (const vector of FIXTURE.cases) {
      const tree = IdentityLibraryTest.treeOf(vector)

      expect(
        profileCommitment({
          chainId: FIXTURE.chainId,
          registry: FIXTURE.registry,
          subject: vector.leafSubject,
          schemaId: SCHEMA_ID_V1,
          root: tree.root,
        }),
        vector.name,
      ).to.equal(vector.commitment)

      const presentation = createAnchoredPresentation(tree, {
        disclose: vector.presentation.disclose,
        anchor: {
          chainId: FIXTURE.chainId,
          registry: FIXTURE.registry,
          version: 1,
        },
        createdAt: CREATED_AT,
      })

      expect(serializeDocument(presentation), vector.name).to.equal(
        vector.presentation.text,
      )

      const check = verifyPresentationDocument(vector.presentation.text)

      if (!check.ok || check.mode !== 'anchored') {
        throw new Error(`${vector.name}: ${JSON.stringify(check)}`)
      }

      expect(check.registryCheck).to.deep.equal({
        chainId: FIXTURE.chainId,
        registry: FIXTURE.registry,
        subject: vector.leafSubject,
        version: 1,
        commitment: vector.commitment,
        schemaId: 1,
      })
    }
  }

  @test()
  signsAndChecksEverySelfSignedPresentation() {
    for (const vector of FIXTURE.selfSignedCases) {
      const tree = IdentityLibraryTest.treeOf(vector)
      const selfSigned = vector.selfSigned

      if (!selfSigned) {
        throw new Error(`${vector.name} carries no signature`)
      }

      expect(selfSignedMessageFor(tree), vector.name).to.equal(
        selfSigned.message,
      )
      expect(
        serializeDocument(
          createSelfSignedPresentation(tree, {
            disclose: vector.presentation.disclose,
            signature: selfSigned.signature.value,
            createdAt: CREATED_AT,
          }),
        ),
        vector.name,
      ).to.equal(vector.presentation.text)

      const check = verifyPresentationDocument(vector.presentation.text)

      if (!check.ok || check.mode !== 'self-signed') {
        throw new Error(`${vector.name}: ${JSON.stringify(check)}`)
      }

      expect(check.signer).to.equal(selfSigned.signer)
    }
  }

  @test()
  refusesATamperedDisclosure() {
    const [vector] = FIXTURE.cases
    const document = JSON.parse(vector.presentation.text) as {
      disclosures: { value: unknown }[]
    }

    const text = document.disclosures.find(
      (disclosure) => typeof disclosure.value === 'string',
    )

    if (!text) {
      throw new Error('The vector discloses no text field')
    }

    text.value = `${String(text.value)}!`

    const check = verifyPresentationDocument(document)

    expect(check.ok).to.equal(false)
    expect(check.ok ? null : check.reason).to.equal('InvalidProof')
  }
}
