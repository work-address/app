import fs from 'node:fs'
import path from 'node:path'

import { getBytes } from 'ethers'

import type { RandomBytes } from '../src'

/**
 * contracts/test/fixtures/profile-schema-v1.vectors.json, written by the
 * independent Python encoder next to it. This package must reproduce it byte
 * for byte; the Hardhat suite holds the same file to the deployed registry.
 */
export const FIXTURE_PATH = path.join(__dirname, '../../../test/fixtures/profile-schema-v1.vectors.json')

export type VectorField = {
  slot: number
  pointer: string
  value: unknown
  valueJcs: string
  salt: string
  pathHash: string
  valueHash: string
  leaf: string
  proof: string[]
}

export type Vector = {
  name: string
  subject: string
  leafSubject: string
  source: Record<string, unknown>
  fields: VectorField[]
  fillers: { slot: number; leaf: string }[]
  leaves: string[]
  root: string
  commitment?: string
  presentation: { disclose: number[]; text: string }
  export: { text: string }
  selfSigned?: { signer: string; message: string; signature: { scheme: 'eip191' | 'ed25519'; value: string } }
}

export type Fixture = {
  schemaId: number
  leafTypehash: string
  commitmentTypehash: string
  chainId: number
  registry: string
  presentationFormat: string
  exportFormat: string
  selfSignedDomain: string
  slots: { slot: number; pointer: string; pathHash: string }[]
  cases: Vector[]
  selfSignedCases: Vector[]
}

export const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as Fixture

export const CREATED_AT = '2026-09-19T12:00:00.000Z'

/**
 * Hands back the vector's salts and fillers in the order `buildProfileTree`
 * draws them, slot 0 to 31, so the library's own build path reproduces the
 * vector rather than a second assembly path.
 */
export function vectorRandomBytes(vector: Vector): RandomBytes {
  const words = Array.from({ length: 32 }, (_, slot) => {
    const field = vector.fields.find((candidate) => candidate.slot === slot)
    const filler = vector.fillers.find((candidate) => candidate.slot === slot)
    const word = field?.salt ?? filler?.leaf

    if (!word) throw new Error(`The vector has nothing at slot ${slot}`)

    return word
  })
  let next = 0

  return (length) => {
    if (length !== 32 || next >= words.length) throw new Error('Drew more randomness than the vector holds')

    return getBytes(words[next++])
  }
}

/** Deep copy of a JSON document, for tampering. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** The same 32 bytes with the last bit flipped. */
export function flipLastBit(word: string): string {
  const bytes = getBytes(word)

  bytes[31] ^= 1

  return `0x${Buffer.from(bytes).toString('hex')}`
}
