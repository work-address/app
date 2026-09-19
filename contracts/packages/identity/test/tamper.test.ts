import { expect } from 'chai'
import { Wallet, getAddress, keccak256, toUtf8Bytes } from 'ethers'

import {
  SCHEMA_ID_V1,
  canonicalJson,
  processProof,
  profileLeaf,
  verifyPresentationDocument,
} from '../src'

import { clone, fixture, flipLastBit } from './fixture'

import type { PresentationFailure, ProfilePresentation } from '../src'

/**
 * SC-A04's tamper case: a presentation is only as good as the proof that no
 * byte of it moved. Every disclosed field of every vector is altered in each
 * of the ways the acceptance names (value, salt, slot, pointer, subject,
 * schemaId), and each alteration must fail.
 */

type Json = Record<string, unknown>

function failureOf(document: unknown): PresentationFailure | 'ok' {
  const check = verifyPresentationDocument(document)

  return check.ok ? 'ok' : check.reason
}

/** A different canonical value of the same kind, so only the proof can catch it. */
function otherValue(value: unknown): unknown {
  if (typeof value === 'string') return value === 'US' ? 'GB' : value.length === 2 ? 'ZZ' : `${value}x`
  if (Array.isArray(value)) return [...value, 'Extra']
  return { currency: 'USDT', rateHourCents: (value as { rateHourCents: number }).rateHourCents + 1 }
}

const presentations = [...fixture.cases, ...fixture.selfSignedCases].map((vector) => ({
  name: vector.name,
  document: JSON.parse(vector.presentation.text) as ProfilePresentation,
}))

describe('tampering with a presentation', () => {
  for (const { name, document } of presentations) {
    describe(name, () => {
      it('verifies untouched', () => {
        expect(failureOf(document)).to.eq('ok')
        expect(document.disclosures.length).to.be.greaterThan(0)
      })

      it('fails when any disclosed value changes, even to another valid value', () => {
        for (let index = 0; index < document.disclosures.length; index += 1) {
          const tampered = clone(document)

          tampered.disclosures[index].value = otherValue(tampered.disclosures[index].value) as never
          expect(failureOf(tampered), tampered.disclosures[index].pointer).to.eq('InvalidProof')
        }
      })

      it('fails when any salt changes', () => {
        for (let index = 0; index < document.disclosures.length; index += 1) {
          const tampered = clone(document)

          tampered.disclosures[index].salt = flipLastBit(tampered.disclosures[index].salt)
          expect(failureOf(tampered), tampered.disclosures[index].pointer).to.eq('InvalidProof')
        }
      })

      it('fails when a field claims another slot, with or without the matching pointer', () => {
        for (let index = 0; index < document.disclosures.length; index += 1) {
          const original = document.disclosures[index]
          const target = original.slot === 0 ? 1 : 0

          if (document.disclosures.some((disclosure) => disclosure.slot === target)) continue

          const slotOnly = clone(document)
          slotOnly.disclosures[index].slot = target
          expect(failureOf(slotOnly), `${original.pointer} as slot ${target}`).to.eq('MalformedPresentation')

          // Consistent slot and pointer: only the leaf's slot binding stops it.
          const moved = clone(document)
          moved.disclosures[index].slot = target
          moved.disclosures[index].pointer = target === 0 ? '/name' : '/title'
          if (typeof original.value === 'string' && original.value.length === 2) {
            moved.disclosures[index].value = 'A two-letter code is not a name'
          }
          expect(failureOf(moved), `${original.pointer} moved to slot ${target}`).to.eq('InvalidProof')
        }
      })

      it('fails when a pointer changes', () => {
        for (let index = 0; index < document.disclosures.length; index += 1) {
          const tampered = clone(document)

          tampered.disclosures[index].pointer = `${tampered.disclosures[index].pointer}x`
          expect(failureOf(tampered)).to.eq('MalformedPresentation')
        }
      })

      it('fails when the subject changes', () => {
        const tampered = clone(document)
        const other = Wallet.createRandom().address

        tampered.subject = document.subject.startsWith('did:pkh:eip155:')
          ? document.subject.replace(/0x[0-9a-fA-F]{40}$/, other)
          : document.subject.replace(/:[1-9A-HJ-NP-Za-km-z]{32,44}$/, ':11111111111111111111111111111111')

        expect(failureOf(tampered)).to.eq('InvalidProof')
      })

      it('fails when the schema id changes, and a leaf under another schema id opens nothing', () => {
        const tampered = clone(document) as unknown as Json

        tampered.schemaId = 2
        expect(failureOf(tampered)).to.eq('UnsupportedSchema')

        // Below the schema gate: schemaId is inside every leaf, so the proof
        // does not reach the root under any other id.
        const vector = [...fixture.cases, ...fixture.selfSignedCases].find((candidate) => candidate.name === name)!
        const field = vector.fields[0]
        const leafUnder = (schemaId: number) =>
          profileLeaf({
            schemaId,
            leafSubject: vector.leafSubject,
            slot: field.slot,
            pointer: field.pointer,
            valueJcs: canonicalJson(field.value),
            salt: field.salt,
          })

        expect(processProof(leafUnder(SCHEMA_ID_V1), field.proof)).to.eq(vector.root)
        expect(processProof(leafUnder(2), field.proof)).to.not.eq(vector.root)
      })

      it('fails when a proof element or the root changes', () => {
        for (let index = 0; index < document.disclosures.length; index += 1) {
          for (let level = 0; level < 5; level += 1) {
            const tampered = clone(document)

            tampered.disclosures[index].proof[level] = flipLastBit(tampered.disclosures[index].proof[level])
            expect(failureOf(tampered), `level ${level}`).to.eq('InvalidProof')
          }
        }

        const rooted = clone(document)
        rooted.root = flipLastBit(rooted.root)
        expect(failureOf(rooted)).to.eq('InvalidProof')
      })

      if (document.anchor) {
        it('fails when the commitment, the registry or the chain changes', () => {
          const commitment = clone(document)
          commitment.commitment = flipLastBit(commitment.commitment as string)
          expect(failureOf(commitment)).to.eq('CommitmentMismatch')

          const registry = clone(document)
          registry.anchor = { ...registry.anchor!, registry: getAddress(`0x${'12'.repeat(20)}`) }
          expect(failureOf(registry)).to.eq('CommitmentMismatch')

          const chain = clone(document)
          chain.anchor = { ...chain.anchor!, chainId: 1 }
          expect(failureOf(chain)).to.eq('MalformedPresentation')

          // With nothing disclosed, the root is bound by the commitment alone.
          const bare = clone(document)
          bare.disclosures = []
          expect(failureOf(bare)).to.eq('ok')
          bare.root = keccak256(toUtf8Bytes('another root'))
          expect(failureOf(bare)).to.eq('CommitmentMismatch')
        })

        it('leaves the version to the registry, which is the only place it can be checked', () => {
          const later = clone(document)
          later.anchor = { ...later.anchor!, version: 2 }

          const check = verifyPresentationDocument(later)

          if (!check.ok || check.mode !== 'anchored') throw new Error('expected an anchored result')
          expect(check.registryCheck.version).to.eq(2)
        })
      } else {
        it('fails when the signature changes, or the root it signed does', () => {
          const signature = clone(document)
          const value = signature.signature!.value

          signature.signature = { ...signature.signature!, value: `${value.slice(0, 10)}${value[10] === 'a' ? 'b' : 'a'}${value.slice(11)}` }
          expect(failureOf(signature)).to.eq('SignatureInvalid')

          const bare = clone(document)
          bare.disclosures = []
          expect(failureOf(bare)).to.eq('ok')
          bare.root = keccak256(toUtf8Bytes('another root'))
          expect(failureOf(bare)).to.eq('SignatureInvalid')
        })
      }

      it('refuses a disclosure of a reserved slot, a repeated slot and an extra key', () => {
        const reserved = clone(document)
        reserved.disclosures[0].slot = 20
        expect(failureOf(reserved)).to.eq('MalformedPresentation')

        const repeated = clone(document)
        repeated.disclosures.push(clone(repeated.disclosures[0]))
        expect(failureOf(repeated)).to.eq('MalformedPresentation')

        const extra = clone(document) as unknown as Json
        extra.note = 'trust me'
        expect(failureOf(extra)).to.eq('MalformedPresentation')
      })

      it('refuses a value that is not in canonical form rather than normalizing it', () => {
        const padded = clone(document)
        const first = padded.disclosures[0]

        if (typeof first.value !== 'string') throw new Error('every vector discloses a text field first')
        first.value = ` ${first.value}`
        expect(failureOf(padded)).to.eq('MalformedPresentation')

        const decomposed = clone(document)
        decomposed.disclosures[0].value = 'Jose\u0301' as never
        expect(failureOf(decomposed)).to.eq('MalformedPresentation')
      })
    })
  }

  it('reports unparseable text and a foreign format distinctly', () => {
    expect(failureOf('{ not json')).to.eq('MalformedPresentation')

    const foreign = JSON.parse(fixture.cases[0].presentation.text) as Json
    foreign.format = 'work-address/profile-export'
    expect(failureOf(foreign)).to.eq('UnsupportedFormat')
  })
})
