// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Test-only six-decimal ERC-20 used by local contract tests.
/// @dev This contract must never be configured as production USDC.
contract MockUSDC {
    string public constant name = "Mock USDC";
    string public constant symbol = "mUSDC";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    error InsufficientAllowance();
    error InsufficientBalance();
    error InvalidReceiver();

    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 amount);

    function mint(address receiver, uint256 amount) external {
        if (receiver == address(0)) revert InvalidReceiver();

        totalSupply += amount;
        balanceOf[receiver] += amount;
        emit Transfer(address(0), receiver, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address receiver, uint256 amount) external returns (bool) {
        _transfer(msg.sender, receiver, amount);
        return true;
    }

    function transferFrom(address owner, address receiver, uint256 amount) external returns (bool) {
        uint256 available = allowance[owner][msg.sender];
        if (available < amount) revert InsufficientAllowance();

        if (available != type(uint256).max) {
            allowance[owner][msg.sender] = available - amount;
            emit Approval(owner, msg.sender, available - amount);
        }

        _transfer(owner, receiver, amount);
        return true;
    }

    function _transfer(address owner, address receiver, uint256 amount) internal {
        if (receiver == address(0)) revert InvalidReceiver();

        uint256 balance = balanceOf[owner];
        if (balance < amount) revert InsufficientBalance();

        balanceOf[owner] = balance - amount;
        balanceOf[receiver] += amount;
        emit Transfer(owner, receiver, amount);
    }
}
