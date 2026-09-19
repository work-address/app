import { ProfileError } from './errors'

/** Returns `length` bytes. Injectable so test vectors can be reproduced; real use takes the default. */
export type RandomBytes = (length: number) => Uint8Array

/** The platform CSPRNG: Web Crypto's getRandomValues, in browsers and in Node 19+. */
export const secureRandomBytes: RandomBytes = (length) => {
  const source = globalThis.crypto

  if (!source || typeof source.getRandomValues !== 'function') {
    throw new ProfileError('InvalidRandomness', 'No CSPRNG here (crypto.getRandomValues); pass randomBytes')
  }

  return source.getRandomValues(new Uint8Array(length))
}
