// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EIP712} from '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import {SignatureChecker} from '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';

/**
 * @title IdentityRegistry
 * @notice Anchors which version of a wallet's public profile is current, and
 *         whether it has been withdrawn — following
 *         `web/docs/smart-contracts/SPEC.md` (SC-ID-01, SC-ID-02, SC-PR-01).
 *
 * A wallet-signed profile document already proves authorship without any chain.
 * Two things a signature cannot do are the whole reason this contract exists:
 *
 *   - **Currency.** An old signed document is indistinguishable from the live
 *     one, so a holder could present a stale, more flattering version.
 *   - **Withdrawal.** A signed document cannot be un-signed.
 *
 * So the chain holds exactly three things per version — a commitment, the
 * schema it was built under, and when — plus a head saying which version is
 * current and whether it still stands. Nothing else.
 *
 * **No profile content is stored here, and none can be.** The commitment is a
 * domain-separated hash of a salted Merkle root; the contract cannot open it,
 * which is what keeps names, rates and links off a permanent public ledger by
 * construction rather than by policy (SC-PR-01).
 *
 * **Reputation is deliberately absent.** The only reputation fact a chain can
 * attest is that an address was paid an amount by another address under known
 * terms, and `MarketplaceEscrow` already emits exactly that. A second record
 * would restate a stronger source, and SPEC §2 forbids a deployment that only
 * buys a badge. There is no receipt root, claim anchor or score here.
 *
 * **There is no privileged address of any kind** — no owner, no pause, no
 * upgrade hook, no constructor arguments. Three consequences are permanent and
 * are features rather than oversights: a lost wallet can never be recovered by
 * an operator, ETH force-sent here is stuck forever, and nobody can edit,
 * block or withdraw another subject's record. Adding an owner later would
 * defeat the point of anchoring identity here at all.
 *
 * **Subject scheme: `did:pkh:eip155` only.** The record key is a 20-byte EVM
 * `address`, so there is nowhere in storage, calldata or events to put a
 * Solana ed25519 key or a TON workchain:hash pair. That refusal is structural,
 * not a validation rule a later change can relax. Verifying ed25519 on the EVM,
 * or parsing TON Connect proofs, each needs its own design and threat model.
 * Non-EVM subjects keep sign-in, profiles and the same portable export,
 * self-signed — they simply have no anchor.
 *
 * UNAUDITED. Not for real funds or real identities until the review gate in
 * SPEC §14 is met.
 */
contract IdentityRegistry is EIP712 {
  /// @notice Subject actions that can be authorized by signature and relayed.
  enum Operation {
    Publish,
    Deactivate
  }

  /// @dev `None` is the zero value on purpose: a consumer reading `status`
  ///      alone can never mistake a never-published subject for an active one.
  enum Status {
    None,
    Active,
    Deactivated
  }

  /// @notice The result of checking one presented document against the chain.
  enum Presentation {
    Unpublished,
    VersionUnknown,
    CommitmentMismatch,
    SchemaMismatch,
    Superseded,
    Deactivated,
    Current
  }

  /// @dev One slot: 32 + 8 + 64 bits.
  struct Head {
    /// Equals `versions[subject].length`; 0 means never published.
    uint32 version;
    Status status;
    /// Moves on publication and on withdrawal.
    uint64 updatedAt;
  }

  /// @dev Two slots.
  struct Version {
    /// `profileCommitment(subject, schemaId, merkleRoot)` — never the bare root.
    bytes32 commitment;
    uint32 schemaId;
    uint64 publishedAt;
  }

  bytes32 public constant ACTION_TYPEHASH =
    keccak256('Action(uint8 operation,address subject,bytes32 payload,uint256 nonce,uint64 deadline)');

  /**
   * @notice Domain of the published commitment. Binding chain, registry and
   *         subject stops a commitment lifted from another subject's
   *         publication, or from another deployment, validating here.
   */
  bytes32 public constant PROFILE_COMMITMENT_TYPEHASH =
    keccak256('ProfileCommitment(uint256 chainId,address registry,address subject,uint32 schemaId,bytes32 merkleRoot)');

  /**
   * @notice Domain of one disclosed profile field, published so the contract is
   *         the single source of truth for the scheme even though it never
   *         verifies a proof.
   *
   * `leaf = keccak256(bytes.concat(keccak256(abi.encode(PROFILE_LEAF_TYPEHASH,
   * schemaId, subject, slot, keccak256(pointer), keccak256(value), salt))))`,
   * double-hashed for second-preimage resistance; internal nodes hash the
   * sorted pair. A tree is exactly 32 leaves, unused slots filled with random
   * bytes, so every proof is 5 elements and the tree does not leak how many
   * fields a person filled in. Salts are per field: one shared salt would hand
   * over the brute-force key for every other field the moment one is disclosed.
   *
   * `subject` is in the preimage so a leaf openable for one subject cannot be
   * replayed under another — without it, a stolen export could be transplanted
   * onto an attacker's own record.
   */
  bytes32 public constant PROFILE_LEAF_TYPEHASH =
    keccak256('ProfileLeaf(uint32 schemaId,address subject,uint16 slot,bytes32 pathHash,bytes32 valueHash,bytes32 salt)');

  /// @notice Which subject scheme this deployment accepts, so the bytecode is self-describing.
  string public constant SUBJECT_SCHEME = 'did:pkh:eip155';

  mapping(address => Head) private heads;
  /// @dev Version N is `versions[subject][N - 1]`. State rather than logs only:
  ///      SPEC §4 needs a verifier to check a *requested* version with nothing
  ///      but an RPC endpoint, and `eth_call` survives log pruning.
  mapping(address => Version[]) private versions;

  /// @notice Next relayed-authorization nonce per subject. A separate space from
  ///         the escrow's: an identity authorization is never interchangeable
  ///         with a funding one.
  mapping(address => uint256) public nonces;

  event IdentityPublished(
    address indexed subject,
    uint32 indexed version,
    uint32 schemaId,
    bytes32 commitment,
    uint64 publishedAt
  );
  event IdentityDeactivated(address indexed subject, uint32 indexed version, uint64 deactivatedAt);

  error InvalidCommitment();
  error InvalidSchema();
  error VersionConflict(uint32 expected, uint32 current);
  error NotPublished();
  error AlreadyDeactivated();
  error UnknownVersion(uint32 requested, uint32 current);
  error VersionOverflow();
  error AuthorizationExpired();
  error InvalidAuthorization();

  constructor() EIP712('WorkAddressIdentityRegistry', '1') {}

  // ------------------------------------------------------------- publication

  /**
   * @notice Publish or replace the caller's current profile version.
   *
   * Legal from every state. From nothing it creates version 1; from an active
   * record it is an update; from a withdrawn one it is reactivation, which
   * SPEC §3 requires to append a new version. There is deliberately no
   * `activate()`: re-exposing a withdrawn profile must restate exactly what is
   * being published, in a fresh signed payload, so a leaked or stale
   * authorization can never flip it back on by itself.
   */
  function publish(bytes32 commitment, uint32 schemaId, uint32 expectedVersion) external {
    _publish(msg.sender, commitment, schemaId, expectedVersion);
  }

  /// @notice Relayed publication; the subject's signature is the only consent.
  function publishFor(
    address subject,
    bytes32 commitment,
    uint32 schemaId,
    uint32 expectedVersion,
    uint64 deadline,
    bytes calldata subjectSignature
  ) external {
    _useAuthorization(
      subject,
      Operation.Publish,
      publishPayload(commitment, schemaId, expectedVersion),
      deadline,
      subjectSignature
    );
    _publish(subject, commitment, schemaId, expectedVersion);
  }

  function _publish(address subject, bytes32 commitment, uint32 schemaId, uint32 expectedVersion) private {
    if (commitment == bytes32(0)) revert InvalidCommitment();
    // Zero is reserved for "no schema", so it can never name a published one.
    if (schemaId == 0) revert InvalidSchema();

    Head storage head = heads[subject];
    uint32 current = head.version;

    if (expectedVersion != current) revert VersionConflict(expectedVersion, current);
    if (current == type(uint32).max) revert VersionOverflow();

    uint64 nowTs = uint64(block.timestamp);

    versions[subject].push(Version({commitment: commitment, schemaId: schemaId, publishedAt: nowTs}));
    head.version = current + 1;
    head.status = Status.Active;
    head.updatedAt = nowTs;

    emit IdentityPublished(subject, current + 1, schemaId, commitment, nowTs);
  }

  // ------------------------------------------------------------- withdrawal

  /**
   * @notice Withdraw the caller's current presentation.
   *
   * Pass `expectedVersion == 0` to mean "whatever is current". Withdrawal is
   * the one fail-closed operation, so it must not be losable to a race: a
   * relayer holding a publish authorization could otherwise land it exactly
   * when the subject broadcasts a takedown and make the takedown revert.
   */
  function deactivate(uint32 expectedVersion) external {
    _deactivate(msg.sender, expectedVersion);
  }

  /// @notice Relayed withdrawal, authorized by the subject's signature.
  function deactivateFor(
    address subject,
    uint32 expectedVersion,
    uint64 deadline,
    bytes calldata subjectSignature
  ) external {
    _useAuthorization(
      subject,
      Operation.Deactivate,
      deactivatePayload(expectedVersion),
      deadline,
      subjectSignature
    );
    _deactivate(subject, expectedVersion);
  }

  function _deactivate(address subject, uint32 expectedVersion) private {
    Head storage head = heads[subject];
    uint32 current = head.version;

    if (current == 0) revert NotPublished();
    // Reverting rather than doing nothing means a stale relayed authorization
    // is never silently consumed.
    if (head.status != Status.Active) revert AlreadyDeactivated();
    if (expectedVersion != 0 && expectedVersion != current) revert VersionConflict(expectedVersion, current);

    head.status = Status.Deactivated;
    head.updatedAt = uint64(block.timestamp);

    /**
     * Withdrawal voids every authorization this subject has signed but not yet
     * submitted. Without this, a publish authorization signed before the
     * takedown stays valid against the unchanged version number and a relayer
     * could re-expose the withdrawn profile afterwards — which is exactly what
     * a takedown must prevent. Consuming the nonce space is what makes the
     * "no silent reactivation" property true rather than merely intended.
     */
    nonces[subject] += 1;

    emit IdentityDeactivated(subject, current, uint64(block.timestamp));
  }

  // ------------------------------------------------------------------ views

  /**
   * @notice The current record. An unpublished subject reads as zeros rather
   *         than reverting: a missing record is a normal answer, not a failure.
   */
  function readIdentity(
    address subject
  ) external view returns (uint32 version, Status status, uint32 schemaId, bytes32 commitment, uint64 updatedAt) {
    Head storage head = heads[subject];

    version = head.version;
    status = head.status;
    updatedAt = head.updatedAt;

    if (version != 0) {
      Version storage current = versions[subject][version - 1];

      schemaId = current.schemaId;
      commitment = current.commitment;
    }
  }

  /// @notice One historical version, so an export naming version 3 stays checkable at head 7.
  function readIdentityAt(
    address subject,
    uint32 version
  ) external view returns (bytes32 commitment, uint32 schemaId, uint64 publishedAt, bool isCurrent) {
    uint32 current = heads[subject].version;

    if (version == 0 || version > current) revert UnknownVersion(version, current);

    Version storage stored = versions[subject][version - 1];

    return (stored.commitment, stored.schemaId, stored.publishedAt, version == current);
  }

  /// @notice Published version count; the value a client reads to build `expectedVersion`.
  function versionCount(address subject) external view returns (uint32) {
    return heads[subject].version;
  }

  /**
   * @notice The whole chain side of verification in one call, so two
   *         independent verifiers cannot disagree about what the chain said.
   *
   * `subjectDeactivated` is returned alongside the result rather than folded
   * into it: a holder presenting an old version of a profile that has since
   * been withdrawn entirely must not read as merely `Superseded`, which a
   * verifier UI would render as "out of date" instead of "taken down".
   */
  function checkPresentation(
    address subject,
    uint32 version,
    bytes32 commitment,
    uint32 schemaId
  ) external view returns (Presentation result, bool subjectDeactivated) {
    Head storage head = heads[subject];
    uint32 current = head.version;

    subjectDeactivated = head.status == Status.Deactivated;

    if (current == 0) return (Presentation.Unpublished, subjectDeactivated);
    if (version == 0 || version > current) return (Presentation.VersionUnknown, subjectDeactivated);

    Version storage stored = versions[subject][version - 1];

    if (stored.commitment != commitment) return (Presentation.CommitmentMismatch, subjectDeactivated);
    if (stored.schemaId != schemaId) return (Presentation.SchemaMismatch, subjectDeactivated);
    if (version < current) return (Presentation.Superseded, subjectDeactivated);

    return (
      head.status == Status.Active ? Presentation.Current : Presentation.Deactivated,
      subjectDeactivated
    );
  }

  /**
   * @notice The value that is published — never the bare Merkle root.
   *
   * The contract cannot check that a caller passed this rather than a raw
   * root, which is precisely what keeps profile content off chain. A verifier
   * must therefore recompute this from the export and compare, not trust the
   * stored bytes to be well-formed.
   */
  function profileCommitment(
    address subject,
    uint32 schemaId,
    bytes32 merkleRoot
  ) public view returns (bytes32) {
    return
      keccak256(
        abi.encode(PROFILE_COMMITMENT_TYPEHASH, block.chainid, address(this), subject, schemaId, merkleRoot)
      );
  }

  /// @notice Payload hash bound into a relayed publication authorization.
  function publishPayload(
    bytes32 commitment,
    uint32 schemaId,
    uint32 expectedVersion
  ) public pure returns (bytes32) {
    return keccak256(abi.encode(commitment, schemaId, expectedVersion));
  }

  /// @notice Payload hash bound into a relayed withdrawal authorization.
  function deactivatePayload(uint32 expectedVersion) public pure returns (bytes32) {
    return keccak256(abi.encode(expectedVersion));
  }

  /// @notice The EIP-712 digest a subject signs to authorize a relayed action.
  function actionDigest(
    Operation operation,
    address subject,
    bytes32 payload,
    uint256 nonce,
    uint64 deadline
  ) public view returns (bytes32) {
    return
      _hashTypedDataV4(
        keccak256(abi.encode(ACTION_TYPEHASH, uint8(operation), subject, payload, nonce, deadline))
      );
  }

  // --------------------------------------------------------------- internal

  /**
   * Checks and consumes one authorization. The nonce is read before any state
   * change, so a signature works once, for one operation on one subject with
   * one payload, on this chain and this contract only.
   */
  function _useAuthorization(
    address subject,
    Operation operation,
    bytes32 payload,
    uint64 deadline,
    bytes calldata signature
  ) private {
    if (subject == address(0)) revert InvalidAuthorization();
    if (block.timestamp > deadline) revert AuthorizationExpired();

    uint256 nonce = nonces[subject];
    bytes32 digest = actionDigest(operation, subject, payload, nonce, deadline);

    if (!SignatureChecker.isValidSignatureNow(subject, digest, signature)) {
      revert InvalidAuthorization();
    }

    nonces[subject] = nonce + 1;
  }
}
