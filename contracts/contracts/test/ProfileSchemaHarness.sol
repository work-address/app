// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Hashes} from '@openzeppelin/contracts/utils/cryptography/Hashes.sol';
import {MerkleProof} from '@openzeppelin/contracts/utils/cryptography/MerkleProof.sol';

interface IProfileLeafScheme {
  function PROFILE_LEAF_TYPEHASH() external view returns (bytes32);
}

/**
 * @notice Test use only. Recomputes profile schema v1 leaves, roots and proofs
 *         in Solidity, with the registry's own `PROFILE_LEAF_TYPEHASH` and
 *         OpenZeppelin's `MerkleProof`, so a vector is checked by the EVM
 *         rather than by the TypeScript that also produces it.
 */
contract ProfileSchemaHarness {
  /// @notice The leaf exactly as `IdentityRegistry` documents it, from the pointer text and the value's JCS bytes.
  function leaf(
    address registry,
    uint32 schemaId,
    address subject,
    uint16 slot,
    string calldata pointer,
    bytes calldata valueJcs,
    bytes32 salt
  ) external view returns (bytes32 pathHash, bytes32 valueHash, bytes32 leafHash) {
    bytes32 typehash = IProfileLeafScheme(registry).PROFILE_LEAF_TYPEHASH();

    pathHash = keccak256(bytes(pointer));
    valueHash = keccak256(valueJcs);
    leafHash = keccak256(
      bytes.concat(keccak256(abi.encode(typehash, schemaId, subject, slot, pathHash, valueHash, salt)))
    );
  }

  /// @notice The root of a 32-leaf tree, leaf i at position i, sorted-pair nodes.
  function root(bytes32[32] calldata leaves) external pure returns (bytes32) {
    bytes32[] memory level = new bytes32[](32);

    for (uint256 i = 0; i < 32; ++i) level[i] = leaves[i];

    for (uint256 width = 32; width > 1; width /= 2) {
      for (uint256 i = 0; i < width / 2; ++i) {
        level[i] = Hashes.commutativeKeccak256(level[2 * i], level[2 * i + 1]);
      }
    }

    return level[0];
  }

  function verify(bytes32[] memory proof, bytes32 merkleRoot, bytes32 leafHash) external pure returns (bool) {
    return MerkleProof.verify(proof, merkleRoot, leafHash);
  }
}
