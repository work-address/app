import { Buffer } from 'buffer'
import { sign } from 'tweetnacl'
import bs58 from 'bs58'

export type SolanaAuthFixtureResult = {
  address: string
  signature: string
  secretKey: Uint8Array
}

export function buildSolanaAuthPayload(options: {
  nonce: string
  secretKey?: Uint8Array
}): SolanaAuthFixtureResult {
  const secretKey = options.secretKey ?? sign.keyPair().secretKey
  const keyPair = sign.keyPair.fromSecretKey(secretKey)
  const message = Buffer.from(options.nonce, 'utf8')
  const signatureBytes = sign.detached(message, secretKey)
  const address = bs58.encode(keyPair.publicKey)

  return {
    address,
    signature: Buffer.from(signatureBytes).toString('base64'),
    secretKey,
  }
}

export function buildSolanaAuthPayloadWithInvalidSignature(options: {
  nonce: string
  secretKey?: Uint8Array
}): { address: string; signature: string } {
  const { address } = buildSolanaAuthPayload(options)
  const otherKey = sign.keyPair().secretKey

  return {
    address,
    signature: Buffer.from(
      sign.detached(Buffer.from('invalid-proof'), otherKey),
    ).toString('base64'),
  }
}
