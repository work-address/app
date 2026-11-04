import { describe, expect, it } from 'vitest'

import { shapeUser } from './shape'

import type { MockUser } from './db'

const user = (address: string) => ({ address }) as MockUser

describe('shapeUser', () => {
  it('pays an EVM account at its own address, as the API derives it', () => {
    expect(shapeUser(user('0xabc')).payWallet).toBe('0xabc')
  })

  it('has no wallet to pay for an email account', () => {
    expect(shapeUser(user('a@example.com')).payWallet).toBeNull()
  })
})
