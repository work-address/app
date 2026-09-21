// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {EIP712} from '@openzeppelin/contracts/utils/cryptography/EIP712.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import {SignatureChecker} from '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';

/**
 * @title MarketplaceEscrow
 * @notice Non-custodial USDT escrow for one worker and one period of
 *         marketplace work, following docs/smart-contracts/SPEC.md (SC-ES-01..03)
 *         and docs/specification/escrow-payments.md (ESC-04/05).
 *
 * The client funds the accepted budget before work starts. After the period
 * — or from work start, when the funded terms said `earlySubmission`, which
 * is how a fixed-price milestone is billed on delivery rather than on its due
 * date — the worker submits one invoice for at most the budget. The client
 * can dispute it until the release time, which refunds the billed amount, or
 * approve it and pay at once; after the release time anyone can release it.
 * Either way the worker gets 95% and the fixed platform recipient 5%.
 * Unbilled budget and unsubmitted allocations go back to the client. Nobody —
 * including the deployer and the origin signer — can move funded money
 * anywhere else, change funded terms or pause exits.
 *
 * Every allocation has exactly one terminal settlement: each of `_cancel`,
 * `_submit`, `refundExpired`, `_dispute` and `_release` leaves the state it
 * requires before it moves a token, so no two of them can run on the same
 * allocation and none of them can run twice. The remainder refund is the one
 * transfer outside that chain, and it is guarded by its own flag and can only
 * ever move budget that was never billed.
 *
 * Every party action can also be relayed: the payer or payee signs an EIP-712
 * `Action` (bound to the operation, allocation, exact payload, a per-signer
 * nonce and a deadline) and anyone submits it. Signatures from contract
 * wallets are checked with ERC-1271. A relayer pays gas but can never choose a
 * recipient or an amount (SC-SIG-01).
 *
 * UNAUDITED. Not for real funds until the review gate in the SPEC (§14) is met.
 */
contract MarketplaceEscrow is EIP712, ReentrancyGuard {
  using SafeERC20 for IERC20;

  /**
   * @notice Party actions that can be authorized by signature and relayed.
   *         Append only: the value is what a signature binds, so inserting
   *         one would silently repoint every authorization already signed.
   */
  enum Operation {
    Fund,
    Cancel,
    Submit,
    Dispute,
    Approve
  }

  enum State {
    None,
    Funded,
    Submitted,
    CancelledRefunded,
    ExpiredRefunded,
    DisputedRefunded,
    Released
  }

  /// @notice What both parties accepted on the marketplace, as the platform signed it.
  struct Terms {
    bytes32 allocationId;
    /// Opaque marketplace obligation (contract + period); one allocation each.
    bytes32 obligationId;
    /// Commitment to the accepted terms document; content stays off-chain.
    bytes32 termsHash;
    address payer;
    address payee;
    uint256 budget;
    uint64 workStart;
    uint64 workEnd;
    /// The origin proof cannot be used to fund after this time.
    uint64 originExpiry;
    /**
     * The payee may bill from `workStart` instead of `workEnd`. The
     * marketplace signs it for a fixed-price milestone, whose delivery is an
     * event rather than the end of a period, and never for an hourly week,
     * whose hours do not exist until the week has run. The submission
     * deadline is untouched either way: the window opens earlier, it does
     * not close later. See docs/adr/milestone-escrow.md.
     */
    bool earlySubmission;
  }

  struct Allocation {
    address payer;
    address payee;
    uint256 budget;
    uint256 billed;
    uint256 workerTransferred;
    uint256 feeTransferred;
    uint256 clientRefunded;
    uint64 workStart;
    uint64 workEnd;
    uint64 submissionDeadline;
    uint64 releaseAt;
    State state;
    bool remainderRefunded;
    /**
     * Copied from the funded terms, and packed into the same slot as the two
     * above so it costs no extra storage. It is deliberately not an event
     * field: `AllocationFunded` already carries `workStart`, `workEnd` and
     * `submissionDeadline`, and a tool that reads only logs and assumes the
     * later opening is early rather than wrong. One that needs the exact
     * window reads it here.
     */
    bool earlySubmission;
    bytes32 obligationId;
    bytes32 termsHash;
    bytes32 invoiceCommitment;
  }

  bytes32 public constant TERMS_TYPEHASH =
    keccak256(
      'Terms(bytes32 allocationId,bytes32 obligationId,bytes32 termsHash,address payer,address payee,uint256 budget,uint64 workStart,uint64 workEnd,uint64 originExpiry,bool earlySubmission)'
    );

  bytes32 public constant ACTION_TYPEHASH =
    keccak256(
      'Action(uint8 operation,bytes32 allocationId,bytes32 payload,uint256 nonce,uint64 deadline)'
    );

  uint256 public constant FEE_BPS = 500;
  uint256 public constant BPS = 10_000;
  uint64 public constant SUBMISSION_WINDOW = 72 hours;
  uint64 public constant DISPUTE_WINDOW = 7 days;

  IERC20 public immutable token;
  address public immutable feeRecipient;
  address public immutable originSigner;

  /// @notice Sum of every allocation's still-held principal. Direct transfers
  ///         to this contract are surplus and never credited to anyone.
  uint256 public totalHeld;

  mapping(bytes32 => Allocation) private allocations;
  mapping(bytes32 => bool) public obligationFunded;

  /// @notice Next relayed-authorization nonce per signer; each use consumes one.
  mapping(address => uint256) public nonces;

  event AllocationFunded(
    bytes32 indexed allocationId,
    bytes32 indexed obligationId,
    address indexed payer,
    address payee,
    uint256 budget,
    uint64 workStart,
    uint64 workEnd,
    uint64 submissionDeadline,
    bytes32 termsHash
  );
  event CancelledBeforeWork(bytes32 indexed allocationId, uint256 refunded);
  event InvoiceSubmitted(
    bytes32 indexed allocationId,
    bytes32 invoiceCommitment,
    uint256 amount,
    uint64 releaseAt
  );
  event ExpiredRefunded(bytes32 indexed allocationId, uint256 refunded);
  event RemainderRefunded(bytes32 indexed allocationId, uint256 refunded);
  event DisputeRefunded(bytes32 indexed allocationId, uint256 refunded);
  event Released(
    bytes32 indexed allocationId,
    uint256 gross,
    uint256 workerNet,
    uint256 fee
  );

  error ZeroAddress();
  error InvalidTerms();
  error OriginExpired();
  error InvalidOrigin();
  error AllocationExists();
  error ObligationAlreadyFunded();
  error NotPayer();
  error NotPayee();
  error WrongState(State current);
  error TooEarly(uint64 availableAt);
  error TooLate(uint64 closedAt);
  error InvalidAmount();
  error InvalidCommitment();
  error IncompleteTransfer(uint256 received, uint256 expected);
  error NothingToRefund();
  error AuthorizationExpired();
  error InvalidAuthorization();

  constructor(
    IERC20 token_,
    address feeRecipient_,
    address originSigner_
  ) EIP712('WorkAddressMarketplaceEscrow', '1') {
    if (
      address(token_) == address(0) ||
      feeRecipient_ == address(0) ||
      originSigner_ == address(0)
    ) {
      revert ZeroAddress();
    }

    token = token_;
    feeRecipient = feeRecipient_;
    originSigner = originSigner_;
  }

  // ---------------------------------------------------------------- funding

  /**
   * @notice The payer funds the exact accepted budget. The platform's origin
   *         signature binds every field, the chain and this contract, so no
   *         payee, amount or deadline can be substituted, and no other
   *         deployment or chain accepts it.
   */
  function fund(Terms calldata terms, bytes calldata originSignature) external nonReentrant {
    if (msg.sender != terms.payer) revert NotPayer();
    _fund(terms, originSignature);
  }

  /**
   * @notice Relayed funding: the payer's signature authorizes these exact
   *         terms; tokens still move from the payer's own allowance.
   */
  function fundFor(
    Terms calldata terms,
    bytes calldata originSignature,
    uint64 deadline,
    bytes calldata payerSignature
  ) external nonReentrant {
    _useAuthorization(
      terms.payer,
      Operation.Fund,
      terms.allocationId,
      termsDigest(terms),
      deadline,
      payerSignature
    );
    _fund(terms, originSignature);
  }

  function _fund(Terms calldata terms, bytes calldata originSignature) private {
    if (
      terms.payee == address(0) ||
      terms.payee == terms.payer ||
      terms.budget == 0 ||
      terms.workStart >= terms.workEnd ||
      terms.allocationId == bytes32(0) ||
      terms.obligationId == bytes32(0)
    ) {
      revert InvalidTerms();
    }
    if (block.timestamp > terms.originExpiry) revert OriginExpired();
    if (block.timestamp >= terms.workStart) revert TooLate(terms.workStart);
    if (allocations[terms.allocationId].state != State.None) revert AllocationExists();
    if (obligationFunded[terms.obligationId]) revert ObligationAlreadyFunded();
    if (ECDSA.recover(termsDigest(terms), originSignature) != originSigner) {
      revert InvalidOrigin();
    }

    uint64 submissionDeadline = terms.workEnd + SUBMISSION_WINDOW;
    Allocation storage allocation = allocations[terms.allocationId];

    allocation.payer = terms.payer;
    allocation.payee = terms.payee;
    allocation.budget = terms.budget;
    allocation.workStart = terms.workStart;
    allocation.workEnd = terms.workEnd;
    allocation.submissionDeadline = submissionDeadline;
    allocation.state = State.Funded;
    allocation.earlySubmission = terms.earlySubmission;
    allocation.obligationId = terms.obligationId;
    allocation.termsHash = terms.termsHash;
    obligationFunded[terms.obligationId] = true;
    totalHeld += terms.budget;

    // Credit only what actually arrived: a token that takes a transfer fee
    // or moves less than asked must not leave an under-backed allocation.
    uint256 before = token.balanceOf(address(this));
    token.safeTransferFrom(terms.payer, address(this), terms.budget);
    uint256 received = token.balanceOf(address(this)) - before;

    if (received != terms.budget) revert IncompleteTransfer(received, terms.budget);

    emit AllocationFunded(
      terms.allocationId,
      terms.obligationId,
      terms.payer,
      terms.payee,
      terms.budget,
      terms.workStart,
      terms.workEnd,
      submissionDeadline,
      terms.termsHash
    );
  }

  /// @notice The payer takes the whole budget back before work starts.
  function cancelBeforeWork(bytes32 allocationId) external nonReentrant {
    _cancel(allocationId, msg.sender);
  }

  /// @notice Relayed cancellation, authorized by the payer's signature.
  function cancelBeforeWorkFor(
    bytes32 allocationId,
    uint64 deadline,
    bytes calldata payerSignature
  ) external nonReentrant {
    address payer = allocations[allocationId].payer;

    _useAuthorization(payer, Operation.Cancel, allocationId, bytes32(0), deadline, payerSignature);
    _cancel(allocationId, payer);
  }

  function _cancel(bytes32 allocationId, address caller) private {
    Allocation storage allocation = _allocation(allocationId, State.Funded);

    if (caller != allocation.payer) revert NotPayer();
    if (block.timestamp >= allocation.workStart) revert TooLate(allocation.workStart);

    allocation.state = State.CancelledRefunded;
    uint256 amount = allocation.budget;
    _refund(allocation, amount);

    emit CancelledBeforeWork(allocationId, amount);
  }

  // ------------------------------------------------------------- submission

  /**
   * @notice The worker bills the allocation once, for a positive amount
   *         within the budget, before the submission deadline. The window
   *         opens at work end, or at work start when the funded terms said
   *         `earlySubmission` — a fixed-price milestone is billed when it is
   *         delivered, not when its due date arrives.
   */
  function submitInvoice(
    bytes32 allocationId,
    bytes32 invoiceCommitment,
    uint256 amount
  ) external nonReentrant {
    _submit(allocationId, invoiceCommitment, amount, msg.sender);
  }

  /// @notice Relayed submission; the payee's signature binds the commitment and amount.
  function submitInvoiceFor(
    bytes32 allocationId,
    bytes32 invoiceCommitment,
    uint256 amount,
    uint64 deadline,
    bytes calldata payeeSignature
  ) external nonReentrant {
    address payee = allocations[allocationId].payee;

    _useAuthorization(
      payee,
      Operation.Submit,
      allocationId,
      keccak256(abi.encode(invoiceCommitment, amount)),
      deadline,
      payeeSignature
    );
    _submit(allocationId, invoiceCommitment, amount, payee);
  }

  function _submit(
    bytes32 allocationId,
    bytes32 invoiceCommitment,
    uint256 amount,
    address caller
  ) private {
    Allocation storage allocation = _allocation(allocationId, State.Funded);

    uint64 opensAt = allocation.earlySubmission
      ? allocation.workStart
      : allocation.workEnd;

    if (caller != allocation.payee) revert NotPayee();
    if (block.timestamp < opensAt) revert TooEarly(opensAt);
    if (block.timestamp >= allocation.submissionDeadline) {
      revert TooLate(allocation.submissionDeadline);
    }
    if (amount == 0 || amount > allocation.budget) revert InvalidAmount();
    if (invoiceCommitment == bytes32(0)) revert InvalidCommitment();

    uint64 releaseAt = uint64(block.timestamp) + DISPUTE_WINDOW;

    allocation.state = State.Submitted;
    allocation.billed = amount;
    allocation.invoiceCommitment = invoiceCommitment;
    allocation.releaseAt = releaseAt;

    emit InvoiceSubmitted(allocationId, invoiceCommitment, amount, releaseAt);
  }

  /// @notice Anyone returns an unsubmitted allocation to the payer after the deadline.
  function refundExpired(bytes32 allocationId) external nonReentrant {
    Allocation storage allocation = _allocation(allocationId, State.Funded);

    if (block.timestamp < allocation.submissionDeadline) {
      revert TooEarly(allocation.submissionDeadline);
    }

    allocation.state = State.ExpiredRefunded;
    uint256 amount = allocation.budget;
    _refund(allocation, amount);

    emit ExpiredRefunded(allocationId, amount);
  }

  /// @notice Anyone returns the unbilled part of a submitted budget to the payer, once.
  function refundRemainder(bytes32 allocationId) external nonReentrant {
    Allocation storage allocation = allocations[allocationId];
    State state = allocation.state;

    if (
      state != State.Submitted &&
      state != State.Released &&
      state != State.DisputedRefunded
    ) {
      revert WrongState(state);
    }

    uint256 amount = allocation.budget - allocation.billed;

    if (allocation.remainderRefunded || amount == 0) revert NothingToRefund();

    allocation.remainderRefunded = true;
    _refund(allocation, amount);

    emit RemainderRefunded(allocationId, amount);
  }

  // ------------------------------------------------------------- settlement

  /// @notice The payer disputes the submitted bill before release; it is refunded.
  function dispute(bytes32 allocationId) external nonReentrant {
    _dispute(allocationId, msg.sender);
  }

  /// @notice Relayed dispute, authorized by the payer's signature.
  function disputeFor(
    bytes32 allocationId,
    uint64 deadline,
    bytes calldata payerSignature
  ) external nonReentrant {
    address payer = allocations[allocationId].payer;

    _useAuthorization(payer, Operation.Dispute, allocationId, bytes32(0), deadline, payerSignature);
    _dispute(allocationId, payer);
  }

  function _dispute(bytes32 allocationId, address caller) private {
    Allocation storage allocation = _allocation(allocationId, State.Submitted);

    if (caller != allocation.payer) revert NotPayer();
    if (block.timestamp >= allocation.releaseAt) revert TooLate(allocation.releaseAt);

    allocation.state = State.DisputedRefunded;
    uint256 amount = allocation.billed;
    _refund(allocation, amount);

    emit DisputeRefunded(allocationId, amount);
  }

  /// @notice Anyone releases an undisputed bill after the dispute window.
  function release(bytes32 allocationId) external nonReentrant {
    Allocation storage allocation = _allocation(allocationId, State.Submitted);

    if (block.timestamp < allocation.releaseAt) revert TooEarly(allocation.releaseAt);

    _release(allocationId, allocation);
  }

  /**
   * @notice The payer pays a submitted bill now, giving up the rest of their
   *         own dispute window. Same recipients and same 95/5 split as
   *         `release`; the only difference is who asked for it and when.
   *
   * No time bound: it is allowed for as long as the allocation is Submitted,
   * before or after `releaseAt`. A cut-off at `releaseAt` could only ever be
   * hit by a payer whose approval was mined a second late, and after that
   * moment the call is what anyone could do anyway.
   *
   * The state leaves Submitted before any token moves, so this cannot pay
   * twice, cannot race `release`, and a released allocation can no longer be
   * disputed (`_dispute` needs Submitted).
   */
  function approveRelease(bytes32 allocationId) external nonReentrant {
    _approve(allocationId, msg.sender);
  }

  /// @notice Relayed approval, authorized by the payer's signature.
  function approveReleaseFor(
    bytes32 allocationId,
    uint64 deadline,
    bytes calldata payerSignature
  ) external nonReentrant {
    address payer = allocations[allocationId].payer;

    _useAuthorization(payer, Operation.Approve, allocationId, bytes32(0), deadline, payerSignature);
    _approve(allocationId, payer);
  }

  function _approve(bytes32 allocationId, address caller) private {
    Allocation storage allocation = _allocation(allocationId, State.Submitted);

    if (caller != allocation.payer) revert NotPayer();

    _release(allocationId, allocation);
  }

  /// Settles a submitted bill: 95% to the payee, 5% to the fee recipient, once.
  function _release(bytes32 allocationId, Allocation storage allocation) private {
    uint256 gross = allocation.billed;
    uint256 fee = (gross * FEE_BPS) / BPS;
    uint256 net = gross - fee;

    allocation.state = State.Released;
    allocation.workerTransferred = net;
    allocation.feeTransferred = fee;
    totalHeld -= gross;

    // Both transfers or neither: a failing recipient reverts the release.
    token.safeTransfer(allocation.payee, net);
    if (fee > 0) {
      token.safeTransfer(feeRecipient, fee);
    }

    emit Released(allocationId, gross, net, fee);
  }

  // ------------------------------------------------------------------ views

  function readAllocation(bytes32 allocationId) external view returns (Allocation memory) {
    return allocations[allocationId];
  }

  /// @notice Principal of one allocation still in the contract.
  function heldOf(bytes32 allocationId) public view returns (uint256) {
    Allocation storage allocation = allocations[allocationId];

    return
      allocation.budget -
      allocation.workerTransferred -
      allocation.feeTransferred -
      allocation.clientRefunded;
  }

  /// @notice Fee and worker net for a gross amount, as release would compute them.
  function previewRelease(uint256 gross) external pure returns (uint256 workerNet, uint256 fee) {
    fee = (gross * FEE_BPS) / BPS;
    workerNet = gross - fee;
  }

  /// @notice The EIP-712 digest a party signs to authorize a relayed action.
  function actionDigest(
    Operation operation,
    bytes32 allocationId,
    bytes32 payload,
    uint256 nonce,
    uint64 deadline
  ) public view returns (bytes32) {
    return
      _hashTypedDataV4(
        keccak256(abi.encode(ACTION_TYPEHASH, uint8(operation), allocationId, payload, nonce, deadline))
      );
  }

  function termsDigest(Terms calldata terms) public view returns (bytes32) {
    return
      _hashTypedDataV4(
        keccak256(
          abi.encode(
            TERMS_TYPEHASH,
            terms.allocationId,
            terms.obligationId,
            terms.termsHash,
            terms.payer,
            terms.payee,
            terms.budget,
            terms.workStart,
            terms.workEnd,
            terms.originExpiry,
            terms.earlySubmission
          )
        )
      );
  }

  // --------------------------------------------------------------- internal

  function _allocation(bytes32 allocationId, State expected) private view returns (Allocation storage allocation) {
    allocation = allocations[allocationId];

    if (allocation.state != expected) revert WrongState(allocation.state);
  }

  /**
   * Checks and consumes one authorization. The nonce is taken before any
   * state changes, so a signature works once, for one operation on one
   * allocation with one payload, on this chain and contract only.
   */
  function _useAuthorization(
    address signer,
    Operation operation,
    bytes32 allocationId,
    bytes32 payload,
    uint64 deadline,
    bytes calldata signature
  ) private {
    if (signer == address(0)) revert InvalidAuthorization();
    if (block.timestamp > deadline) revert AuthorizationExpired();

    uint256 nonce = nonces[signer];
    bytes32 digest = actionDigest(operation, allocationId, payload, nonce, deadline);

    if (!SignatureChecker.isValidSignatureNow(signer, digest, signature)) {
      revert InvalidAuthorization();
    }

    nonces[signer] = nonce + 1;
  }

  function _refund(Allocation storage allocation, uint256 amount) private {
    allocation.clientRefunded += amount;
    totalHeld -= amount;
    token.safeTransfer(allocation.payer, amount);
  }
}
