import { describe, expect, it } from 'vitest'

import { isSameWalletAddress, normalizeAddress } from './wallet-address'

const EVM = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
const TON_RAW =
  '0:4a5d1923244b0a845a7b5d8a29fd654b5a2a7a0331ce597e445b98dd23ab4025'
const SOLANA = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV'
/** SOLANA with its first letter's case flipped: a different base58 address. */
const SOLANA_VARIANT = '7ecDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV'

describe('isSameWalletAddress', () => {
  it('matches an EVM address whatever its casing, prefix included', () => {
    expect(isSameWalletAddress(EVM, EVM.toLowerCase())).toBe(true)
    expect(isSameWalletAddress(EVM, EVM.toUpperCase())).toBe(true)
  })

  it('matches a raw TON address whatever its casing', () => {
    expect(isSameWalletAddress(TON_RAW, TON_RAW.toUpperCase())).toBe(true)
  })

  it('matches a Solana address only exactly, as base58 is case-sensitive', () => {
    expect(isSameWalletAddress(SOLANA, SOLANA)).toBe(true)
    expect(isSameWalletAddress(SOLANA, SOLANA_VARIANT)).toBe(false)
    expect(isSameWalletAddress(SOLANA, SOLANA.toLowerCase())).toBe(false)
  })

  it('ignores surrounding whitespace', () => {
    expect(isSameWalletAddress(` ${SOLANA} `, SOLANA)).toBe(true)
    expect(isSameWalletAddress(`${EVM}\n`, EVM.toLowerCase())).toBe(true)
  })
})

describe('normalizeAddress', () => {
  it('lowercases hex addresses and keeps every other address as typed', () => {
    expect(normalizeAddress(EVM)).toBe(EVM.toLowerCase())
    expect(normalizeAddress(TON_RAW.toUpperCase())).toBe(TON_RAW)
    expect(normalizeAddress(` ${SOLANA} `)).toBe(SOLANA)
  })
})
