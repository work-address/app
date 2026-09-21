/**
 * @work-address/identity: profile schema v1 commitments for IdentityRegistry.
 *
 * Build a salted 32-leaf tree from public profile fields, compute the
 * commitment the registry stores, keep a private export, and hand out
 * presentations that disclose chosen fields with 5-element proofs, anchored
 * to the registry or self-signed by the wallet. All of that is pure
 * computation: no network calls, no key custody, browser-safe.
 *
 * The independent verifier sits on top: `verifyPresentation` asks the
 * registry whether a presentation is current, `verifyOrigin` opens an origin
 * certificate offline, and the settlement receipts are built from and
 * checked against the escrow's own events. Those reach a chain only through
 * the `RpcRequest` the caller hands them (`rpc.ts`), never a Work Address
 * host.
 *
 * Unaudited. No DID Core conformance is claimed; subjects are named with
 * did:pkh as a convention.
 */
export * from './constants'
export * from './errors'
export * from './jcs'
export * from './schema'
export * from './app-user'
export * from './subject'
export * from './random'
export * from './tree'
export * from './profile'
export * from './self-signed'
export * from './documents'
export * from './verify-document'
export * from './rpc'
export * from './manifest'
export * from './verify'
export * from './origin'
