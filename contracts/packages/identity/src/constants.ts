import { id } from 'ethers'

/** The schema this package builds and checks. The registry reserves 0 for "no schema". */
export const SCHEMA_ID_V1 = 1

/** Every tree has exactly this many leaves, so every proof has exactly `PROOF_LENGTH` elements. */
export const LEAF_COUNT = 32
export const PROOF_LENGTH = 5

/** `IdentityRegistry.PROFILE_LEAF_TYPEHASH`: the registry is the source of truth for this string. */
export const PROFILE_LEAF_TYPE =
  'ProfileLeaf(uint32 schemaId,address subject,uint16 slot,bytes32 pathHash,bytes32 valueHash,bytes32 salt)'
export const PROFILE_LEAF_TYPEHASH = id(PROFILE_LEAF_TYPE)

/** `IdentityRegistry.PROFILE_COMMITMENT_TYPEHASH`. */
export const PROFILE_COMMITMENT_TYPE =
  'ProfileCommitment(uint256 chainId,address registry,address subject,uint32 schemaId,bytes32 merkleRoot)'
export const PROFILE_COMMITMENT_TYPEHASH = id(PROFILE_COMMITMENT_TYPE)

export const PRESENTATION_FORMAT = 'work-address/profile-presentation'
export const EXPORT_FORMAT = 'work-address/profile-export'
export const FORMAT_VERSION = 1

/** The domain line of the message a wallet signs in self-signed mode. */
export const SELF_SIGNED_DOMAIN = 'work-address/profile-self-signed/v1'

/** CAIP-2 reference of Solana mainnet: the first 32 characters of its genesis hash. */
export const SOLANA_MAINNET = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
