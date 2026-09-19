import { expect } from 'chai'

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
  valueHash,
  verifyPresentationDocument,
} from '../src'

import { CREATED_AT, fixture, vectorRandomBytes } from './fixture'

import type { AppPublicUser, ProfileTree } from '../src'
import type { Vector } from './fixture'

/** The fixture comes from an independent Python encoder; every output here must match it byte for byte. */
describe('profile schema v1 vectors', () => {
  it('shares the constants the encoder and the registry use', () => {
    expect(SCHEMA_ID_V1).to.eq(fixture.schemaId)
    expect(PROFILE_LEAF_TYPEHASH).to.eq(fixture.leafTypehash)
    expect(PROFILE_COMMITMENT_TYPEHASH).to.eq(fixture.commitmentTypehash)
    expect(PRESENTATION_FORMAT).to.eq(fixture.presentationFormat)
    expect(EXPORT_FORMAT).to.eq(fixture.exportFormat)
    expect(SELF_SIGNED_DOMAIN).to.eq(fixture.selfSignedDomain)
  })

  it('has the slot table the encoder wrote', () => {
    expect(PROFILE_SCHEMA_V1.map(({ slot, pointer }) => ({ slot, pointer, pathHash: pathHash(pointer) }))).to.deep.eq(
      fixture.slots,
    )
  })

  const all: [Vector, 'anchored' | 'self-signed'][] = [
    ...fixture.cases.map((vector): [Vector, 'anchored'] => [vector, 'anchored']),
    ...fixture.selfSignedCases.map((vector): [Vector, 'self-signed'] => [vector, 'self-signed']),
  ]

  for (const [vector, mode] of all) {
    describe(vector.name, () => {
      let tree: ProfileTree

      before(() => {
        const { fields } = profileFieldsFromAppUser(vector.source as AppPublicUser)

        tree = buildProfileTree({ subject: vector.subject, fields, randomBytes: vectorRandomBytes(vector) })
      })

      it('maps the app record to exactly the committed values, and nothing else', () => {
        const { fields, skipped } = profileFieldsFromAppUser(vector.source as AppPublicUser)

        expect(skipped).to.deep.eq([])
        expect(Object.keys(fields).length).to.eq(vector.fields.length)

        for (const field of vector.fields) {
          const key = PROFILE_SCHEMA_V1[field.slot].key

          expect(fields[key], field.pointer).to.deep.eq(field.value)
        }
      })

      it('rebuilds every leaf, the root and every 5-element proof', () => {
        expect(tree.subject.leafSubject).to.eq(vector.leafSubject)
        expect(tree.leaves).to.deep.eq(vector.leaves)
        expect(tree.root).to.eq(vector.root)

        for (const field of vector.fields) {
          const committed = committedField(tree, field.slot)

          expect(committed, field.pointer).to.not.eq(undefined)
          expect(committed?.pointer).to.eq(field.pointer)
          expect(committed?.valueJcs, field.pointer).to.eq(field.valueJcs)
          expect(pathHash(field.pointer), field.pointer).to.eq(field.pathHash)
          expect(valueHash(field.valueJcs), field.pointer).to.eq(field.valueHash)
          expect(committed?.salt).to.eq(field.salt)
          expect(committed?.leaf, field.pointer).to.eq(field.leaf)
          expect(proofFor(tree, field.slot), field.pointer).to.deep.eq(field.proof)
        }

        expect(tree.fillers).to.deep.eq(vector.fillers)
      })

      it('writes the private export byte for byte, and restores the same tree from it', () => {
        expect(serializeDocument(createProfileExport(tree, { createdAt: CREATED_AT }))).to.eq(vector.export.text)

        const restored = restoreProfileTree(vector.export.text)

        expect(restored.root).to.eq(vector.root)
        expect(restored.leaves).to.deep.eq(vector.leaves)
      })

      if (mode === 'anchored') {
        it('computes the commitment the registry stores', () => {
          expect(
            profileCommitment({
              chainId: fixture.chainId,
              registry: fixture.registry,
              subject: vector.leafSubject,
              schemaId: SCHEMA_ID_V1,
              root: tree.root,
            }),
          ).to.eq(vector.commitment)
        })

        it('writes the anchored presentation byte for byte, and verifies the encoder\'s own', () => {
          const presentation = createAnchoredPresentation(tree, {
            disclose: vector.presentation.disclose,
            anchor: { chainId: fixture.chainId, registry: fixture.registry, version: 1 },
            createdAt: CREATED_AT,
          })

          expect(serializeDocument(presentation)).to.eq(vector.presentation.text)

          const check = verifyPresentationDocument(vector.presentation.text)

          expect(check.ok, JSON.stringify(check)).to.eq(true)
          if (!check.ok || check.mode !== 'anchored') throw new Error('expected an anchored result')

          expect(check.commitment).to.eq(vector.commitment)
          expect(check.registryCheck).to.deep.eq({
            chainId: fixture.chainId,
            registry: fixture.registry,
            subject: vector.leafSubject,
            version: 1,
            commitment: vector.commitment,
            schemaId: 1,
          })
          expect(check.disclosed.map(({ slot, value }) => ({ slot, value }))).to.deep.eq(
            vector.fields
              .filter((field) => vector.presentation.disclose.includes(field.slot))
              .map(({ slot, value }) => ({ slot, value })),
          )
        })
      } else {
        it('asks the wallet to sign exactly the encoder\'s message, and accepts its signature', () => {
          const selfSigned = vector.selfSigned

          if (!selfSigned) throw new Error('a self-signed vector carries its signature')

          expect(selfSignedMessageFor(tree)).to.eq(selfSigned.message)

          const presentation = createSelfSignedPresentation(tree, {
            disclose: vector.presentation.disclose,
            signature: selfSigned.signature.value,
            createdAt: CREATED_AT,
          })

          expect(presentation.signature).to.deep.eq(selfSigned.signature)
          expect(serializeDocument(presentation)).to.eq(vector.presentation.text)

          const check = verifyPresentationDocument(vector.presentation.text)

          expect(check.ok, JSON.stringify(check)).to.eq(true)
          if (!check.ok || check.mode !== 'self-signed') throw new Error('expected a self-signed result')

          expect(check.signer).to.eq(selfSigned.signer)
        })
      }
    })
  }
})
