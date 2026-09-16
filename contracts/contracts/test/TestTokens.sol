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

/// @notice Refuses transfers to one blocked address, like an issuer freeze.
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
