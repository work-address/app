import { expect } from 'chai'
import { Wallet, getBytes, hexlify, keccak256, toUtf8Bytes } from 'ethers'

import {
  FIRST_RESERVED_SLOT,
  LEAF_COUNT,
  PROFILE_SCHEMA_V1,
  PROOF_LENGTH,
  ProfileError,
  assembleProfileTree,
  buildProfileTree,
  evmSubject,
  merkleRoot,
  processProof,
  proofFor,
  proofFromLevels,
  treeLevels,
} from '../src'

import type { ProfileErrorCode, ProfileFields, RandomBytes } from '../src'

const SUBJECT = evmSubject(Wallet.createRandom().address, 31337)

const FULL: ProfileFields = {
  name: 'Ada Lovelace',
  title: 'Analyst',
  company: 'Analytical Engines',
  bio: '<p>Notes on the engine</p>',
  rate: { currency: 'USDT', rateHourCents: 12050 },
  skills: ['Mathematics', 'Programming'],
  city: 'London',
  country: 'GB',
  facebook: 'ada',
  linkedIn: 'ada-lovelace',
  twitter: 'ada',
  instagram: 'ada',
  youtube: 'ada',
  telegram: 'ada',
}

function codeOf(run: () => unknown): ProfileErrorCode | 'no error' {
  try {
    run()
  } catch (error) {
    if (error instanceof ProfileError) return error.code
    throw error
  }

  return 'no error'
}

/** A deterministic source for one test: 32-byte words from a counter, never repeating. */
function countingRandom(): RandomBytes {
  let counter = 0

  return (length) => {
    counter += 1

    return getBytes(keccak256(toUtf8Bytes(`word ${counter}`))).slice(0, length)
  }
}

describe('building a profile tree', () => {
  it('draws fresh salts and fillers from the platform CSPRNG, so the same fields never give the same root', () => {
    const first = buildProfileTree({ subject: SUBJECT, fields: FULL })
    const second = buildProfileTree({ subject: SUBJECT, fields: FULL })

    expect(first.root).to.not.eq(second.root)
    expect(first.fields.map((field) => field.valueJcs)).to.deep.eq(second.fields.map((field) => field.valueJcs))

    const words = [...first.fields.map((field) => field.salt), ...first.fillers.map((filler) => filler.leaf)]

    expect(words).to.have.length(LEAF_COUNT)
    expect(new Set([...words, ...second.fields.map((field) => field.salt)]).size).to.eq(
      LEAF_COUNT + second.fields.length,
    )
  })

  it('always has 32 leaves, fields at their own slots and fillers everywhere else', () => {
    for (const fields of [FULL, { name: 'Only a name' }, {}]) {
      const tree = buildProfileTree({ subject: SUBJECT, fields })

      expect(tree.leaves).to.have.length(LEAF_COUNT)
      expect(tree.fields.length + tree.fillers.length).to.eq(LEAF_COUNT)
      expect(tree.fields.every((field) => field.slot < FIRST_RESERVED_SLOT)).to.eq(true)
      expect(tree.fields.every((field) => PROFILE_SCHEMA_V1[field.slot].key === field.key)).to.eq(true)
      expect(merkleRoot(tree.leaves)).to.eq(tree.root)
    }
  })

  it('gives every proof exactly 5 elements, whatever the number of fields', () => {
    for (const fields of [FULL, { country: 'PT' }]) {
      const tree = buildProfileTree({ subject: SUBJECT, fields })

      for (const field of tree.fields) {
        const proof = proofFor(tree, field.key)

        expect(proof, field.pointer).to.have.length(PROOF_LENGTH)
        expect(processProof(field.leaf, proof), field.pointer).to.eq(tree.root)
      }

      // Fillers too: every position in the tree sits exactly 5 levels down.
      for (let slot = 0; slot < LEAF_COUNT; slot += 1) {
        const proof = proofFromLevels(tree.levels, slot)

        expect(proof).to.have.length(PROOF_LENGTH)
        expect(processProof(tree.leaves[slot], proof)).to.eq(tree.root)
      }
    }
  })

  it('normalizes loose input to the one canonical value, and drops what is empty', () => {
    const tree = buildProfileTree({
      subject: SUBJECT,
      fields: {
        name: '  Jose\u0301  ',
        skills: [' Rust ', '', '  ', 'Go'],
        city: '   ',
        rate: { currency: 'USDT', rateHourCents: 0 },
      },
    })

    expect(tree.fields.map(({ key, value }) => ({ key, value }))).to.deep.eq([
      { key: 'name', value: 'Jos\u00e9' },
      { key: 'skills', value: ['Rust', 'Go'] },
    ])
  })

  it('refuses a field schema v1 does not have, such as email, phone, roles or premium', () => {
    for (const key of ['email', 'phone', 'roles', 'premium', 'tz']) {
      expect(codeOf(() => buildProfileTree({ subject: SUBJECT, fields: { [key]: 'x' } as ProfileFields })), key).to.eq(
        'UnknownField',
      )
    }
  })

  it('refuses a value no rule can turn into a canonical one', () => {
    const bad: ProfileFields[] = [
      { country: 'usa' },
      { country: 'gb' },
      { rate: { currency: 'USDT', rateHourCents: 1_000_000 } },
      { rate: { currency: 'USDT', rateHourCents: -1 } },
      { rate: { currency: 'USD', rateHourCents: 100 } as never },
      { rate: { currency: 'USDT', rateHourCents: 1.5 } },
      { skills: Array.from({ length: 65 }, (_, index) => `Skill ${index}`) },
      { skills: ['x'.repeat(129)] },
      { name: 'x'.repeat(257) },
      { name: 'lone \ud800 surrogate' },
      { name: 42 as never },
    ]

    for (const fields of bad) {
      expect(codeOf(() => buildProfileTree({ subject: SUBJECT, fields })), JSON.stringify(fields)).to.eq('InvalidField')
    }
  })

  it('counts length in code points, so 256 emoji fit a name', () => {
    const tree = buildProfileTree({ subject: SUBJECT, fields: { name: '\u{1F600}'.repeat(256) } })

    expect(tree.fields[0].value).to.eq('\u{1F600}'.repeat(256))
  })

  it('will not disclose a slot that holds a filler', () => {
    const tree = buildProfileTree({ subject: SUBJECT, fields: { name: 'Ada' } })

    expect(codeOf(() => proofFor(tree, 'title'))).to.eq('NotDisclosable')
    expect(codeOf(() => proofFor(tree, 20))).to.eq('NotDisclosable')
  })

  it('refuses a random source that returns the wrong length or repeats itself', () => {
    expect(
      codeOf(() => buildProfileTree({ subject: SUBJECT, fields: FULL, randomBytes: (length) => new Uint8Array(length - 1) })),
    ).to.eq('InvalidRandomness')

    const stuck = new Uint8Array(32).fill(7)

    expect(codeOf(() => buildProfileTree({ subject: SUBJECT, fields: FULL, randomBytes: () => stuck }))).to.eq(
      'InvalidRandomness',
    )
    expect(codeOf(() => buildProfileTree({ subject: SUBJECT, fields: FULL, randomBytes: () => new Uint8Array(32) }))).to.eq(
      'InvalidRandomness',
    )
    expect(codeOf(() => buildProfileTree({ subject: SUBJECT, fields: FULL, randomBytes: countingRandom() }))).to.eq(
      'no error',
    )
  })

  it('assembles only a complete tree: each slot once, no field in a reserved slot', () => {
    const tree = buildProfileTree({ subject: SUBJECT, fields: { name: 'Ada' } })
    const fields = tree.fields.map(({ slot, value, salt }) => ({ slot, value, salt }))

    expect(assembleProfileTree({ subject: SUBJECT, fields, fillers: tree.fillers }).root).to.eq(tree.root)
    expect(codeOf(() => assembleProfileTree({ subject: SUBJECT, fields, fillers: tree.fillers.slice(1) }))).to.eq(
      'InvalidDocument',
    )
    expect(
      codeOf(() =>
        assembleProfileTree({ subject: SUBJECT, fields, fillers: [...tree.fillers, { slot: 0, leaf: hexlify(new Uint8Array(32).fill(9)) }] }),
      ),
    ).to.eq('InvalidDocument')
    expect(
      codeOf(() =>
        assembleProfileTree({
          subject: SUBJECT,
          fields: [{ slot: FIRST_RESERVED_SLOT, value: 'x', salt: fields[0].salt }],
          fillers: tree.fillers.filter((filler) => filler.slot !== FIRST_RESERVED_SLOT),
        }),
      ),
    ).to.eq('InvalidDocument')
  })

  it('binds every leaf to the subject: the same fields and salts under another subject give another root', () => {
    const tree = buildProfileTree({ subject: SUBJECT, fields: FULL })
    const other = assembleProfileTree({
      subject: evmSubject(Wallet.createRandom().address, 31337),
      fields: tree.fields,
      fillers: tree.fillers,
    })

    expect(other.root).to.not.eq(tree.root)
    expect(other.fillers).to.deep.eq(tree.fillers)
  })

  it('refuses a tree that is not exactly 32 lowercase words', () => {
    const tree = buildProfileTree({ subject: SUBJECT, fields: FULL })

    expect(() => treeLevels(tree.leaves.slice(1))).to.throw(TypeError)
    expect(() => treeLevels([...tree.leaves, tree.leaves[0]])).to.throw(TypeError)
    expect(() => treeLevels([tree.leaves[0].toUpperCase().replace('0X', '0x'), ...tree.leaves.slice(1)])).to.throw(
      TypeError,
    )
  })
})
