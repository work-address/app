/**
 * @work-address/identity: profile schema v1 commitments for IdentityRegistry.
 *
 * Build a salted 32-leaf tree from public profile fields, compute the
 * commitment the registry stores, keep a private export, and hand out
 * presentations that disclose chosen fields with 5-element proofs, anchored
 * to the registry or self-signed by the wallet. Everything here is pure
 * computation: no network calls, no key custody, browser-safe.
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
