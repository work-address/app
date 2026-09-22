import type { IdentityChainTarget, IdentityConfig } from './identity-chain'
import type { baseApi } from '@/shared'

/**
 * The gasless path (WP-122): the holder signs IdentityRegistry's `Action` in
 * this browser and the API's relayer sends publishFor or deactivateFor and
 * pays the gas. Only a signature leaves the device - never the key or the
 * password - and the signature covers every argument the registry takes, so
 * the relayer cannot send anything the holder did not sign.
 */

/** What POST /user/identity/relay takes, from the generated client. */
export type IdentityRelayBody = baseApi.IdentityRelayDto

/** `IdentityRegistry.Operation`, by name; the index is the uint8 signed. */
export const IDENTITY_RELAY_OPERATIONS = ['Publish', 'Deactivate'] as const

export type IdentityRelayOperation = (typeof IDENTITY_RELAY_OPERATIONS)[number]

/** IdentityRegistry.ACTION_TYPEHASH's struct, field for field. */
export const IDENTITY_RELAY_ACTION_TYPES = {
  Action: [
    { name: 'operation', type: 'uint8' },
    { name: 'subject', type: 'address' },
    { name: 'payload', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
}

/**
 * How long a signed authorization stays usable, in chain seconds. Long
 * enough for the relayer to get it mined; short enough that one left
 * unsent is soon worthless.
 */
export const IDENTITY_RELAY_DEADLINE_SECONDS = 15 * 60

/** One relayed registry call, before it is signed. */
export type IdentityRelayCall =
  | {
      operation: 'Publish'
      subject: string
      commitment: string
      schemaId: number
      expectedVersion: number
    }
  | {
      operation: 'Deactivate'
      subject: string
      /** 0 withdraws whatever version is current. */
      expectedVersion: number
    }

/** The typed value the holder signs. */
export type IdentityRelayAction = {
  operation: number
  subject: string
  payload: string
  nonce: bigint
  deadline: number
}

/**
 * Whether to offer the gasless path: only when the API says a relayer runs
 * here. With it off the dialog is the direct transaction alone - the
 * fallback the holder always has.
 */
export const isIdentityRelayOffered = (
  config: IdentityConfig | null,
): boolean => Boolean(config?.enabled && config.relayEnabled)

/** The registry's EIP-712 domain on the chain the card anchors to. */
export const identityRelayDomain = (target: IdentityChainTarget) => ({
  name: 'WorkAddressIdentityRegistry',
  version: '1',
  chainId: target.chainId,
  verifyingContract: target.registryAddress,
})

/** The deadline an authorization signed at chain time `chainNow` carries. */
export const identityRelayDeadline = (chainNow: number): number =>
  chainNow + IDENTITY_RELAY_DEADLINE_SECONDS

/**
 * The payload the registry binds into the action: publishPayload
 * (commitment, schema, expected version) or deactivatePayload (expected
 * version), abi-encoded as the contract encodes them. Async because ethers
 * loads on demand in this feature.
 */
export const identityRelayPayload = async (
  call: IdentityRelayCall,
): Promise<string> => {
  const { AbiCoder, keccak256 } = await import('ethers')
  const coder = AbiCoder.defaultAbiCoder()

  return call.operation === 'Publish'
    ? keccak256(
        coder.encode(
          ['bytes32', 'uint32', 'uint32'],
          [call.commitment, call.schemaId, call.expectedVersion],
        ),
      )
    : keccak256(coder.encode(['uint32'], [call.expectedVersion]))
}

export const identityRelayAction = (
  call: IdentityRelayCall,
  payload: string,
  nonce: bigint,
  deadline: number,
): IdentityRelayAction => ({
  operation: IDENTITY_RELAY_OPERATIONS.indexOf(call.operation),
  subject: call.subject,
  payload,
  nonce,
  deadline,
})

/**
 * The request body: the call's own arguments and the signature over them,
 * and nothing else - a withdrawal carries no commitment or schema, which
 * the API refuses to see on one.
 */
export const identityRelayBody = (
  call: IdentityRelayCall,
  deadline: number,
  signature: string,
): IdentityRelayBody =>
  call.operation === 'Publish'
    ? {
        operation: 'Publish',
        subject: call.subject,
        commitment: call.commitment,
        schemaId: call.schemaId,
        expectedVersion: call.expectedVersion,
        deadline,
        signature,
      }
    : {
        operation: 'Deactivate',
        subject: call.subject,
        expectedVersion: call.expectedVersion,
        deadline,
        signature,
      }
