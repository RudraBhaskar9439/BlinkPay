// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Test double for 0x AllowanceHolder. Never deploy in production.
contract MockAllowanceHolder {
    using SafeERC20 for IERC20;

    function spend(IERC20 token, address owner, address recipient, uint256 amount) external {
        token.safeTransferFrom(owner, recipient, amount);
    }
}

/// @notice Test double for an allowlisted 0x swap target. Never deploy in production.
contract MockZeroExTarget {
    using SafeERC20 for IERC20;

    MockAllowanceHolder public immutable allowanceHolder;

    error ForcedSwapFailure();

    constructor(MockAllowanceHolder configuredAllowanceHolder) {
        allowanceHolder = configuredAllowanceHolder;
    }

    function swapExactOutput(
        IERC20 sellToken,
        IERC20 buyToken,
        uint256 sellAmount,
        uint256 buyAmount,
        address recipient,
        bool forceFailure
    ) external {
        if (forceFailure) revert ForcedSwapFailure();
        allowanceHolder.spend(sellToken, msg.sender, address(this), sellAmount);
        buyToken.safeTransfer(recipient, buyAmount);
    }

    function unsupportedCall() external { }
}
