import { TypedDataEncoder, Wallet, verifyTypedData } from 'ethers'
import { describe, expect, it } from 'vitest'

import {
  IDENTITY_RELAY_ACTION_TYPES,
  IDENTITY_RELAY_DEADLINE_SECONDS,
  identityRelayAction,
  identityRelayBody,
  identityRelayDeadline,
  identityRelayDomain,
  identityRelayPayload,
  isIdentityRelayOffered,
  type IdentityRelayCall,
} from './identity-relay'

import type { IdentityConfig } from './identity-chain'

/**
 * The relayed Action as this browser signs it, against the vectors
 * app/contracts holds IdentityRegistry to (test/relay-action.contract.test.ts).
 * A field out of order or of the wrong type would sign a digest the
 * registry never computes: every relayed publish would be refused.
 *
 * Read with `import.meta.glob`, as the vendored library's copy test reads
 * its sources: this project's `fs` is a polyfilled stub under vitest.
 */
const RAW = import.meta.glob(
  [
    '../__fixtures__/relay-action.contract.json',
    '../../../../../contracts/test/fixtures/relay-action.contract.json',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const LOCAL = RAW['../__fixtures__/relay-action.contract.json']

const CONTRACTS =
  RAW['../../../../../contracts/test/fixtures/relay-action.contract.json']

type IdentityVector = {
  operation: number
  commitment?: string
  schemaId?: number
  expectedVersion: number
  nonce: string
  deadline: number
  payload: string
  digest: string
  signature: string
}

const vectors = JSON.parse(LOCAL) as {
  signer: string
  identity: {
    domain: { chainId: number; verifyingContract: string }
    subject: string
    actions: IdentityVector[]
  }
}

const target = {
  chainId: vectors.identity.domain.chainId,
  registryAddress: vectors.identity.domain.verifyingContract,
  rpcUrl: 'http://127.0.0.1:8545',
}

const callOf = (vector: IdentityVector): IdentityRelayCall =>
  vector.operation === 0
    ? {
        operation: 'Publish',
        subject: vectors.identity.subject,
        commitment: vector.commitment ?? '',
        schemaId: vector.schemaId ?? 0,
        expectedVersion: vector.expectedVersion,
      }
    : {
        operation: 'Deactivate',
        subject: vectors.identity.subject,
        expectedVersion: vector.expectedVersion,
      }

const config = (over: Partial<IdentityConfig>): IdentityConfig => ({
  enabled: true,
  chainId: 31_337,
  registryAddress: target.registryAddress,
  manifestUrl: null,
  schemaIds: [1],
  relayEnabled: true,
  ...over,
})

describe('the relayed Action', () => {
  it('reads the contracts vectors byte for byte', () => {
    expect(LOCAL).toEqual(expect.any(String))
    expect(LOCAL).toBe(CONTRACTS)
  })

  it.each(vectors.identity.actions.map((vector) => [vector.operation, vector]))(
    'operation %i: payload, digest and signer are the registry’s',
    async (_operation, vector) => {
      const call = callOf(vector)
      const payload = await identityRelayPayload(call)
      const action = identityRelayAction(
        call,
        payload,
        BigInt(vector.nonce),
        vector.deadline,
      )

      expect(payload).toBe(vector.payload)
      expect(
        TypedDataEncoder.hash(
          identityRelayDomain(target),
          IDENTITY_RELAY_ACTION_TYPES,
          action,
        ),
      ).toBe(vector.digest)
      expect(
        verifyTypedData(
          identityRelayDomain(target),
          IDENTITY_RELAY_ACTION_TYPES,
          action,
          vector.signature,
        ),
      ).toBe(vectors.signer)
    },
  )

  it('signs what a local wallet signs, and nothing the relayer could change', async () => {
    const wallet = Wallet.createRandom()
    const call: IdentityRelayCall = {
      operation: 'Publish',
      subject: wallet.address,
      commitment: `0x${'ab'.repeat(32)}`,
      schemaId: 1,
      expectedVersion: 3,
    }
    const payload = await identityRelayPayload(call)
    const action = identityRelayAction(call, payload, BigInt(7), 1_900_000_000)
    const signature = await wallet.signTypedData(
      identityRelayDomain(target),
      IDENTITY_RELAY_ACTION_TYPES,
      action,
    )

    expect(
      verifyTypedData(
        identityRelayDomain(target),
        IDENTITY_RELAY_ACTION_TYPES,
        {
          ...action,
          payload: await identityRelayPayload({ ...call, expectedVersion: 4 }),
        },
        signature,
      ),
    ).not.toBe(wallet.address)
  })
})

describe('identityRelayBody', () => {
  it('carries a publication’s commitment and schema, and a withdrawal’s neither', () => {
    expect(
      identityRelayBody(
        {
          operation: 'Publish',
          subject: '0x1111111111111111111111111111111111111111',
          commitment: `0x${'cd'.repeat(32)}`,
          schemaId: 1,
          expectedVersion: 0,
        },
        100,
        '0xsig',
      ),
    ).toEqual({
      operation: 'Publish',
      subject: '0x1111111111111111111111111111111111111111',
      commitment: `0x${'cd'.repeat(32)}`,
      schemaId: 1,
      expectedVersion: 0,
      deadline: 100,
      signature: '0xsig',
    })
    expect(
      identityRelayBody(
        {
          operation: 'Deactivate',
          subject: '0x1111111111111111111111111111111111111111',
          expectedVersion: 2,
        },
        100,
        '0xsig',
      ),
    ).toEqual({
      operation: 'Deactivate',
      subject: '0x1111111111111111111111111111111111111111',
      expectedVersion: 2,
      deadline: 100,
      signature: '0xsig',
    })
  })

  it('dates an authorization from the chain’s time, not the device’s', () => {
    expect(identityRelayDeadline(1_900_000_000)).toBe(
      1_900_000_000 + IDENTITY_RELAY_DEADLINE_SECONDS,
    )
  })
})

describe('isIdentityRelayOffered', () => {
  it('offers the gasless path only when the API says a relayer runs', () => {
    expect(isIdentityRelayOffered(config({}))).toBe(true)
    expect(isIdentityRelayOffered(config({ relayEnabled: false }))).toBe(false)
    expect(isIdentityRelayOffered(config({ enabled: false }))).toBe(false)
    expect(isIdentityRelayOffered(null)).toBe(false)
  })
})
