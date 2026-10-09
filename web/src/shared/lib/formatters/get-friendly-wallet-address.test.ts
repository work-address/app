import { describe, expect, it } from 'vitest'

import {
  decodeFriendWalletAddress,
  getFriendlyWalletAddress,
} from './get-friendly-wallet-address'

describe('wallet address formatting', () => {
  it('keeps the TON non-bounceable URL-safe format and raw-address round trip', () => {
    const raw = `0:${'ab'.repeat(32)}`
    const friendly = getFriendlyWalletAddress(raw)!
    expect(friendly).toBe('UQCrq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq5jh')
    expect(decodeFriendWalletAddress(friendly)).toBe(raw)
  })

  it('preserves an Ethereum address and missing values', () => {
    expect(getFriendlyWalletAddress('0x123')).toBe('0x123')
    expect(getFriendlyWalletAddress(null)).toBeNull()
  })
})
