import { AbiCoder, concat, keccak256, toUtf8Bytes } from 'ethers'

import { LEAF_COUNT, PROFILE_COMMITMENT_TYPEHASH, PROFILE_LEAF_TYPEHASH, PROOF_LENGTH } from './constants'

const coder = AbiCoder.defaultAbiCoder()

/** 32 bytes as lowercase 0x hex: the only spelling documents accept. */
export const BYTES32 = /^0x[0-9a-f]{64}$/

export function isBytes32(value: unknown): value is string {
  return typeof value === 'string' && BYTES32.test(value)
}

export function pathHash(pointer: string): string {
  return keccak256(toUtf8Bytes(pointer))
}

export function valueHash(valueJcs: string): string {
  return keccak256(toUtf8Bytes(valueJcs))
}

export type LeafInput = {
  schemaId: number
  /** The 20-byte address the leaf binds (`Subject.leafSubject`). */
  leafSubject: string
  slot: number
  pointer: string
  /** UTF-8 of this text is what `valueHash` hashes: the JCS of the canonical value. */
  valueJcs: string
  salt: string
}

/**
 * keccak256(bytes.concat(keccak256(abi.encode(PROFILE_LEAF_TYPEHASH, schemaId,
 * subject, slot, keccak256(pointer), keccak256(value), salt)))), exactly as
 * IdentityRegistry documents it. Double hashing keeps a leaf from ever
 * being read as an internal node.
 */
export function profileLeaf(input: LeafInput): string {
  return keccak256(
    keccak256(
      coder.encode(
        ['bytes32', 'uint32', 'address', 'uint16', 'bytes32', 'bytes32', 'bytes32'],
        [
          PROFILE_LEAF_TYPEHASH,
          input.schemaId,
          input.leafSubject,
          input.slot,
          pathHash(input.pointer),
          valueHash(input.valueJcs),
          input.salt,
        ],
      ),
    ),
  )
}

/** OpenZeppelin `Hashes.commutativeKeccak256`: the smaller word first. Both must be lowercase bytes32. */
export function hashPair(a: string, b: string): string {
  return a < b ? keccak256(concat([a, b])) : keccak256(concat([b, a]))
}

/** Every level from the 32 leaves (index 0) up to the root (index 5). Leaf i is slot i. */
export function treeLevels(leaves: readonly string[]): string[][] {
  if (leaves.length !== LEAF_COUNT || !leaves.every(isBytes32)) {
    throw new TypeError(`A profile tree is exactly ${LEAF_COUNT} lowercase bytes32 leaves`)
  }

  const levels: string[][] = [[...leaves]]

  while (levels[levels.length - 1].length > 1) {
    const level = levels[levels.length - 1]
    const next: string[] = []

    for (let i = 0; i < level.length; i += 2) next.push(hashPair(level[i], level[i + 1]))

    levels.push(next)
  }

  return levels
}

export function merkleRoot(leaves: readonly string[]): string {
  const levels = treeLevels(leaves)

  return levels[levels.length - 1][0]
}

/** The 5 siblings from the leaf up; `MerkleProof.verify(proof, root, leaf)` accepts it. */
export function proofFromLevels(levels: readonly string[][], index: number): string[] {
  const proof: string[] = []
  let position = index

  for (const level of levels.slice(0, -1)) {
    proof.push(level[position ^ 1])
    position >>= 1
  }

  if (proof.length !== PROOF_LENGTH) throw new TypeError(`A proof is ${PROOF_LENGTH} elements`)

  return proof
}

/** OpenZeppelin `MerkleProof.processProof`. */
export function processProof(leaf: string, proof: readonly string[]): string {
  return proof.reduce((node, sibling) => hashPair(node, sibling), leaf)
}

export type CommitmentInput = {
  chainId: number | bigint
  registry: string
  /** The EVM address that publishes. */
  subject: string
  schemaId: number
  root: string
}

/** `IdentityRegistry.profileCommitment(subject, schemaId, root)` on `chainId` at `registry`, computed off chain. */
export function profileCommitment(input: CommitmentInput): string {
  return keccak256(
    coder.encode(
      ['bytes32', 'uint256', 'address', 'address', 'uint32', 'bytes32'],
      [PROFILE_COMMITMENT_TYPEHASH, input.chainId, input.registry, input.subject, input.schemaId, input.root],
    ),
  )
}
