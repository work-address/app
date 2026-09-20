import { ed25519 } from '@noble/curves/ed25519'
import { getBytes, toUtf8Bytes, verifyMessage } from 'ethers'

import { SELF_SIGNED_DOMAIN } from './constants'

import type { Subject } from './subject'

/**
 * Self-signed mode, for wallets that cannot or do not anchor: the subject's
 * wallet signs its schema, subject and root. A signature proves authorship,
 * but it cannot say which version is current or whether it was withdrawn.
 * Only the registry can, and a verifier must report the difference.
 */
export type SelfSignature = {
  /** `eip191` for did:pkh:eip155 (personal_sign), `ed25519` for did:pkh:solana. */
  scheme: 'eip191' | 'ed25519'
  /** Lowercase 0x hex: 65 bytes r, s, v for EIP-191; 64 bytes for Ed25519. */
  value: string
}

/** The exact text a wallet is asked to sign: UTF-8, lines joined by LF, no trailing newline. */
export function selfSignedMessage(input: { schemaId: number; subject: string; root: string }): string {
  return [
    'Work Address profile, self-signed',
    `domain: ${SELF_SIGNED_DOMAIN}`,
    `schemaId: ${input.schemaId}`,
    `subject: ${input.subject}`,
    `root: ${input.root}`,
  ].join('\n')
}

export function signatureSchemeFor(subject: Subject): SelfSignature['scheme'] {
  return subject.scheme === 'eip155' ? 'eip191' : 'ed25519'
}

const SIGNATURE_HEX = { eip191: /^0x[0-9a-f]{130}$/, ed25519: /^0x[0-9a-f]{128}$/ }

/**
 * Checks a self-signature against the subject's own key, offline. An EIP-191
 * signature must recover to the subject's address. A contract wallet
 * (ERC-1271) cannot be checked without a chain call, so it is not accepted
 * here. Ed25519 is checked strictly by RFC 8032, not ZIP-215.
 */
export function verifySelfSignature(subject: Subject, message: string, signature: SelfSignature): boolean {
  if (signature.scheme !== signatureSchemeFor(subject)) return false
  if (!SIGNATURE_HEX[signature.scheme].test(signature.value)) return false

  try {
    if (subject.scheme === 'eip155') {
      return verifyMessage(message, signature.value) === subject.address
    }

    return ed25519.verify(getBytes(signature.value), toUtf8Bytes(message), subject.publicKey, { zip215: false })
  } catch {
    return false
  }
}
