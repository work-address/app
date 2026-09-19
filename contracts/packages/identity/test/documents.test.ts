import { expect } from 'chai'
import { ed25519 } from '@noble/curves/ed25519'
import { Wallet, encodeBase58, getAddress, hexlify } from 'ethers'

import {
  ProfileError,
  buildProfileTree,
  createAnchoredPresentation,
  createProfileExport,
  createSelfSignedPresentation,
  evmSubject,
  parseSubject,
  profileFieldsFromAppUser,
  rateHourCentsFromDecimal,
  restoreProfileTree,
  selfSignedMessageFor,
  serializeDocument,
  solanaSubject,
  verifyPresentationDocument,
} from '../src'

import { clone, flipLastBit } from './fixture'

import type { AppPublicUser, ProfileErrorCode, ProfileExport, ProfilePresentation } from '../src'

const CHAIN_ID = 31337
const REGISTRY = getAddress(`0x${'5f'.repeat(20)}`)
const ANCHOR = { chainId: CHAIN_ID, registry: REGISTRY, version: 1 }

function codeOf(run: () => unknown): ProfileErrorCode | 'no error' {
  try {
    run()
  } catch (error) {
    if (error instanceof ProfileError) return error.code
    throw error
  }

  return 'no error'
}

function solanaKey() {
  const secret = ed25519.utils.randomPrivateKey()
  const subject = solanaSubject(encodeBase58(ed25519.getPublicKey(secret)))

  return { secret, subject }
}

const FIELDS = {
  name: 'Grace Hopper',
  title: 'Rear admiral',
  rate: { currency: 'USDT' as const, rateHourCents: 25000 },
  skills: ['COBOL', 'Compilers'],
  country: 'US',
}

describe('the private export', () => {
  it('round-trips a CSPRNG tree through its JCS text', () => {
    const tree = buildProfileTree({ subject: evmSubject(Wallet.createRandom().address, CHAIN_ID), fields: FIELDS })
    const text = serializeDocument(createProfileExport(tree))
    const restored = restoreProfileTree(text)

    expect(restored.root).to.eq(tree.root)
    expect(restored.leaves).to.deep.eq(tree.leaves)
    expect(restored.fields.map(({ key, value, salt }) => ({ key, value, salt }))).to.deep.eq(
      tree.fields.map(({ key, value, salt }) => ({ key, value, salt })),
    )
  })

  it('is refused when any value, salt, filler or the root moved, or when a key is missing or extra', () => {
    const tree = buildProfileTree({ subject: evmSubject(Wallet.createRandom().address, CHAIN_ID), fields: FIELDS })
    const original = createProfileExport(tree)
    const edits: [string, (document: ProfileExport & Record<string, unknown>) => void, ProfileErrorCode][] = [
      ['value', (document) => (document.fields[0].value = 'Grace Brewster Hopper'), 'RootMismatch'],
      ['salt', (document) => (document.fields[1].salt = flipLastBit(document.fields[1].salt)), 'RootMismatch'],
      ['filler', (document) => (document.fillers[3].leaf = flipLastBit(document.fillers[3].leaf)), 'RootMismatch'],
      ['root', (document) => (document.root = flipLastBit(document.root)), 'RootMismatch'],
      ['subject', (document) => (document.subject = evmSubject(Wallet.createRandom().address, CHAIN_ID).did), 'RootMismatch'],
      ['a dropped filler', (document) => document.fillers.pop(), 'InvalidDocument'],
      ['a doubled field', (document) => document.fields.push(clone(document.fields[0])), 'InvalidDocument'],
      ['an extra key', (document) => (document.note = 'x'), 'InvalidDocument'],
      ['a non-canonical value', (document) => (document.fields[0].value = ' Grace Hopper'), 'InvalidField'],
      ['another format', (document) => (document.format = 'work-address/profile-presentation' as never), 'InvalidDocument'],
      ['another schema', (document) => (document.schemaId = 2 as never), 'InvalidDocument'],
    ]

    expect(codeOf(() => restoreProfileTree(clone(original)))).to.eq('no error')

    for (const [label, edit, code] of edits) {
      const document = clone(original) as ProfileExport & Record<string, unknown>

      edit(document)
      expect(codeOf(() => restoreProfileTree(document)), label).to.eq(code)
    }

    expect(codeOf(() => restoreProfileTree('{ not json'))).to.eq('InvalidDocument')
  })
})

describe('creating presentations', () => {
  it('anchors an EVM subject, discloses only what is chosen, and verifies offline', () => {
    const wallet = Wallet.createRandom()
    const tree = buildProfileTree({ subject: evmSubject(wallet.address, CHAIN_ID), fields: FIELDS })
    const presentation = createAnchoredPresentation(tree, { disclose: ['skills', 'name', 0], anchor: ANCHOR })
    const text = serializeDocument(presentation)

    expect(presentation.disclosures.map((disclosure) => disclosure.pointer)).to.deep.eq(['/name', '/skills'])
    expect(text).to.not.contain('Rear admiral')
    expect(text).to.not.contain('rateHourCents')
    expect(presentation.disclosures.every((disclosure) => disclosure.proof.length === 5)).to.eq(true)

    const check = verifyPresentationDocument(text)

    if (!check.ok || check.mode !== 'anchored') throw new Error(JSON.stringify(check))
    expect(check.registryCheck).to.deep.eq({
      chainId: CHAIN_ID,
      registry: REGISTRY,
      subject: wallet.address,
      version: 1,
      commitment: presentation.commitment,
      schemaId: 1,
    })
  })

  it('refuses to anchor on another chain, a Solana subject, or a filler slot', () => {
    const tree = buildProfileTree({ subject: evmSubject(Wallet.createRandom().address, CHAIN_ID), fields: FIELDS })

    expect(codeOf(() => createAnchoredPresentation(tree, { disclose: [0], anchor: { ...ANCHOR, chainId: 1 } }))).to.eq(
      'InvalidDocument',
    )
    expect(codeOf(() => createAnchoredPresentation(tree, { disclose: [0], anchor: { ...ANCHOR, version: 0 } }))).to.eq(
      'InvalidDocument',
    )
    expect(codeOf(() => createAnchoredPresentation(tree, { disclose: ['company'], anchor: ANCHOR }))).to.eq(
      'NotDisclosable',
    )
    expect(codeOf(() => createAnchoredPresentation(tree, { disclose: [0], anchor: ANCHOR, createdAt: '2026-09-19' }))).to.eq(
      'InvalidDocument',
    )

    const solana = buildProfileTree({ subject: solanaKey().subject, fields: FIELDS })

    expect(codeOf(() => createAnchoredPresentation(solana, { disclose: [0], anchor: ANCHOR }))).to.eq(
      'UnsupportedSubjectScheme',
    )
  })

  it('self-signs with an EVM wallet over EIP-191, and refuses another wallet\'s signature', async () => {
    const wallet = Wallet.createRandom()
    const tree = buildProfileTree({ subject: evmSubject(wallet.address, 1), fields: FIELDS })
    const signature = await wallet.signMessage(selfSignedMessageFor(tree))
    const presentation = createSelfSignedPresentation(tree, { disclose: ['country'], signature })
    const check = verifyPresentationDocument(serializeDocument(presentation))

    if (!check.ok || check.mode !== 'self-signed') throw new Error(JSON.stringify(check))
    expect(check.signer).to.eq(wallet.address)
    expect(check.disclosed).to.deep.eq([{ slot: 7, key: 'country', pointer: '/location/country', value: 'US' }])

    const stranger = await Wallet.createRandom().signMessage(selfSignedMessageFor(tree))

    expect(codeOf(() => createSelfSignedPresentation(tree, { disclose: ['country'], signature: stranger }))).to.eq(
      'SignatureInvalid',
    )
  })

  it('self-signs with a Solana key over Ed25519, binding the leaves to a hash of its DID', () => {
    const { secret, subject } = solanaKey()
    const tree = buildProfileTree({ subject, fields: FIELDS })
    const message = new TextEncoder().encode(selfSignedMessageFor(tree))
    const presentation = createSelfSignedPresentation(tree, {
      disclose: ['name', 'title'],
      signature: hexlify(ed25519.sign(message, secret)),
    })
    const check = verifyPresentationDocument(serializeDocument(presentation))

    if (!check.ok || check.mode !== 'self-signed') throw new Error(JSON.stringify(check))
    expect(check.signer).to.eq(subject.address)
    expect(check.subject.leafSubject).to.eq(subject.leafSubject)

    const other = solanaKey()

    expect(
      codeOf(() =>
        createSelfSignedPresentation(tree, { disclose: ['name'], signature: hexlify(ed25519.sign(message, other.secret)) }),
      ),
    ).to.eq('SignatureInvalid')
  })

  it('never lets a presentation carry an anchor and a signature, or neither', async () => {
    const wallet = Wallet.createRandom()
    const tree = buildProfileTree({ subject: evmSubject(wallet.address, CHAIN_ID), fields: FIELDS })
    const anchored = createAnchoredPresentation(tree, { disclose: [0], anchor: ANCHOR })
    const selfSigned = createSelfSignedPresentation(tree, {
      disclose: [0],
      signature: await wallet.signMessage(selfSignedMessageFor(tree)),
    })

    const both: ProfilePresentation = { ...anchored, signature: selfSigned.signature }
    const neither: ProfilePresentation = { ...selfSigned, signature: null }
    const commitmentOnly: ProfilePresentation = { ...selfSigned, commitment: anchored.commitment }

    for (const document of [both, neither, commitmentOnly]) {
      const check = verifyPresentationDocument(document)

      expect(check.ok).to.eq(false)
      if (!check.ok) expect(check.reason).to.eq('MalformedPresentation')
    }
  })

  it('refuses a proof of any length but 5', () => {
    const tree = buildProfileTree({ subject: evmSubject(Wallet.createRandom().address, CHAIN_ID), fields: FIELDS })
    const presentation = createAnchoredPresentation(tree, { disclose: [0], anchor: ANCHOR })

    for (const proof of [presentation.disclosures[0].proof.slice(0, 4), [...presentation.disclosures[0].proof, tree.leaves[1]]]) {
      const tampered = clone(presentation)

      tampered.disclosures[0].proof = proof
      const check = verifyPresentationDocument(tampered)

      expect(check.ok).to.eq(false)
      if (!check.ok) expect(check.reason).to.eq('MalformedPresentation')
    }
  })
})

describe('subjects', () => {
  it('accepts only the canonical did:pkh spelling', () => {
    const address = Wallet.createRandom().address

    expect(parseSubject(`did:pkh:eip155:1:${address}`).leafSubject).to.eq(address)
    expect(codeOf(() => parseSubject(`did:pkh:eip155:1:${address.toLowerCase()}`))).to.eq('InvalidSubject')
    expect(codeOf(() => parseSubject(`did:pkh:eip155:01:${address}`))).to.eq('InvalidSubject')
    expect(codeOf(() => parseSubject(`did:pkh:eip155:0:${address}`))).to.eq('InvalidSubject')
    expect(codeOf(() => parseSubject('did:web:example.com'))).to.eq('UnsupportedSubjectScheme')
    expect(codeOf(() => parseSubject(`did:pkh:tezos:NetXdQprcVkpaWU:${address}`))).to.eq('UnsupportedSubjectScheme')
    expect(codeOf(() => parseSubject(address))).to.eq('InvalidSubject')

    const { subject } = solanaKey()

    expect(parseSubject(subject.did).leafSubject).to.eq(subject.leafSubject)
    // 31 bytes, and a key with a non-canonical leading character, are not keys.
    expect(codeOf(() => solanaSubject(encodeBase58(new Uint8Array(31).fill(1))))).to.eq('InvalidSubject')
    expect(codeOf(() => solanaSubject(`1${subject.address}`))).to.eq('InvalidSubject')
    expect(codeOf(() => solanaSubject('0OIl'))).to.eq('InvalidSubject')
  })
})

describe('reading the app public profile', () => {
  it('turns the decimal rate into whole cents without floating point', () => {
    const cases: [string | number | null, number | null][] = [
      ['85.5', 8550],
      ['85.50', 8550],
      ['0.01', 1],
      ['9999.99', 999999],
      [' 12 ', 1200],
      [85.5, 8550],
      [0.29, 29],
      ['0.00', null],
      ['0', null],
      ['', null],
      [null, null],
    ]

    for (const [raw, cents] of cases) expect(rateHourCentsFromDecimal(raw), String(raw)).to.eq(cents)

    for (const raw of ['12.345', '-1', '1e3', '10000.00', 'NaN', Number.NaN]) {
      expect(codeOf(() => rateHourCentsFromDecimal(raw)), String(raw)).to.eq('InvalidField')
    }
  })

  it('reads only schema v1 columns, so email, phone, roles, premium and tz never reach a leaf', () => {
    const user: AppPublicUser = {
      name: 'Grace',
      email: 'grace@example.com',
      phone: '+1 555 0100',
      whatsapp: '+1 555 0100',
      roles: ['admin'],
      premium: true,
      tz: 'America/New_York',
      address: Wallet.createRandom().address,
      skills: 'COBOL, ,Compilers',
      country: 'usa',
    }
    const { fields, skipped } = profileFieldsFromAppUser(user)

    expect(fields).to.deep.eq({ name: 'Grace', skills: ['COBOL', 'Compilers'] })
    expect(skipped.map(({ key }) => key)).to.deep.eq(['country'])

    const tree = buildProfileTree({ subject: evmSubject(Wallet.createRandom().address, CHAIN_ID), fields })
    const exported = serializeDocument(createProfileExport(tree))

    // Hex words cannot contain any of these, so a hit can only be a leaked column.
    for (const secret of ['grace@example.com', '+1 555 0100', 'admin', 'America/New_York', '"email"', '"phone"', '"premium"', '"tz"']) {
      expect(exported).to.not.contain(secret)
    }
  })
})
