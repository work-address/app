// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

interface IEscrowHook {
  function release(bytes32 allocationId) external;
  function refundRemainder(bytes32 allocationId) external;
}

/// @notice USDT-like test token: 6 decimals, open mint. Test use only.
contract MockUSDT is ERC20 {
  constructor() ERC20('Mock Tether USD', 'USDT') {}

  function decimals() public pure override returns (uint8) {
    return 6;
  }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }
}

/// @notice Takes 1% of every transfer, so the recipient gets less than sent.
contract FeeOnTransferToken is ERC20 {
  constructor() ERC20('Fee Token', 'FEE') {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function _update(address from, address to, uint256 value) internal override {
    if (from != address(0) && to != address(0)) {
      uint256 cut = value / 100;
      super._update(from, address(0xdead), cut);
      super._update(from, to, value - cut);
    } else {
      super._update(from, to, value);
    }
  }
}

/**
 * @notice Refuses transfers TO one blocked address — a generic recipient that
 *         cannot receive, used to prove a failed payout reverts the release
 *         atomically. This is not how USDT freezes: Tether's blacklist checks
 *         the sender, so a blacklisted recipient is still paid. See
 *         TetherLikeUSDT for the mainnet behaviour.
 */
contract BlockingToken is ERC20 {
  address public blocked;

  constructor() ERC20('Blocking Token', 'BLK') {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function setBlocked(address who) external {
    blocked = who;
  }

  function _update(address from, address to, uint256 value) internal override {
    require(to != blocked, 'blocked recipient');
    super._update(from, to, value);
  }
}

/// @notice Calls back into the escrow while paying out, to probe reentrancy.
contract ReentrantToken is ERC20 {
  IEscrowHook public escrow;
  bytes32 public target;
  bool public attacked;
  bool public reentryReverted;

  constructor() ERC20('Reentrant Token', 'RE') {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function arm(IEscrowHook escrow_, bytes32 target_) external {
    escrow = escrow_;
    target = target_;
  }

  function _update(address from, address to, uint256 value) internal override {
    super._update(from, to, value);

    if (address(escrow) != address(0) && from == address(escrow) && !attacked) {
      attacked = true;
      try escrow.release(target) {} catch {
        reentryReverted = true;
      }
    }
  }
}

/// @notice Minimal ERC-1271 smart wallet: its owner's ECDSA signature speaks for it.
contract MockSmartWallet {
  address public immutable owner;

  constructor(address owner_) {
    owner = owner_;
  }

  function execute(address target, bytes calldata data) external returns (bytes memory) {
    require(msg.sender == owner, 'not owner');
    (bool ok, bytes memory result) = target.call(data);
    require(ok, 'call failed');
    return result;
  }

  function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
    (address recovered, , ) = ECDSA.tryRecover(hash, signature);
    return recovered == owner ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
  }
}

/**
 * @notice Behaves like mainnet USDT (TetherToken, 0xdAC17F958D2ee523a2206206994597C13D831ec7)
 *         in every way the escrow depends on. Test use only.
 *
 * Deliberately not an OpenZeppelin ERC20, because the point is the parts that
 * are not standard:
 *
 *   - `transfer`, `transferFrom` and `approve` return NOTHING. A caller using a
 *     plain `IERC20.transfer` would try to decode a bool from empty returndata
 *     and revert, so every payout would fail; only SafeERC20 tolerates this.
 *   - The blacklist checks the SENDER only (`msg.sender` in `transfer`, `from`
 *     in `transferFrom`). A blacklisted recipient is still paid.
 *   - `pause()` stops every transfer.
 *   - An issuer-settable fee, capped by `maximumFee`, is deducted from what the
 *     recipient receives; the sender still pays the full value.
 *   - A non-zero allowance must be reset to zero before a new non-zero approve.
 *
 * Reverts carry no reason string, as Tether's do.
 */
contract TetherLikeUSDT {
  string public constant name = 'Tether USD';
  string public constant symbol = 'USDT';
  uint8 public constant decimals = 6;

  /// Where the issuer fee goes, as Tether sends it to its owner.
  address public immutable issuer;

  uint256 public totalSupply;
  uint256 public basisPointsRate;
  uint256 public maximumFee;
  bool public paused;

  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  mapping(address => bool) public isBlackListed;

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);

  constructor() {
    issuer = msg.sender;
  }

  modifier whenNotPaused() {
    require(!paused);
    _;
  }

  function mint(address to, uint256 amount) external {
    balanceOf[to] += amount;
    totalSupply += amount;
    emit Transfer(address(0), to, amount);
  }

  function transfer(address to, uint256 value) external whenNotPaused {
    require(!isBlackListed[msg.sender]);
    _move(msg.sender, to, value);
  }

  function transferFrom(address from, address to, uint256 value) external whenNotPaused {
    require(!isBlackListed[from]);

    uint256 allowed = allowance[from][msg.sender];

    require(allowed >= value);
    if (allowed < type(uint256).max) {
      allowance[from][msg.sender] = allowed - value;
    }

    _move(from, to, value);
  }

  function approve(address spender, uint256 value) external {
    require(!(value != 0 && allowance[msg.sender][spender] != 0));
    allowance[msg.sender][spender] = value;
    emit Approval(msg.sender, spender, value);
  }

  function _move(address from, address to, uint256 value) private {
    uint256 fee = (value * basisPointsRate) / 10_000;

    if (fee > maximumFee) {
      fee = maximumFee;
    }

    require(balanceOf[from] >= value);
    balanceOf[from] -= value;
    balanceOf[to] += value - fee;
    emit Transfer(from, to, value - fee);

    if (fee > 0) {
      balanceOf[issuer] += fee;
      emit Transfer(from, issuer, fee);
    }
  }

  // Issuer controls, open to anyone here because only tests call them.

  function addBlackList(address who) external {
    isBlackListed[who] = true;
  }

  function removeBlackList(address who) external {
    isBlackListed[who] = false;
  }

  function pause() external {
    paused = true;
  }

  function unpause() external {
    paused = false;
  }

  function setParams(uint256 newBasisPoints, uint256 newMaxFee) external {
    basisPointsRate = newBasisPoints;
    maximumFee = newMaxFee;
  }
}
