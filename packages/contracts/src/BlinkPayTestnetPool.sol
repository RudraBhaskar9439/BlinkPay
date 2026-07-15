// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title BlinkPayTestnetPool
/// @notice Small constant-product pool used only to demonstrate exact-output payments on testnets.
/// @dev Liquidity is the token balance held by this contract. This is not a production AMM.
contract BlinkPayTestnetPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_DENOMINATOR = 10_000;

    IERC20 public immutable sellAsset;
    IERC20 public immutable settlementAsset;
    uint256 public immutable feeBps;
    address public immutable owner;

    error AmountOutIsZero();
    error InsufficientLiquidity(uint256 available, uint256 requested);
    error InvalidConfiguration();
    error MaximumSellExceeded(uint256 maximum, uint256 required);
    error NotOwner();
    error ZeroRecipient();

    event ExactOutputSwap(
        address indexed caller,
        address indexed recipient,
        uint256 sellAmount,
        uint256 settlementAmount
    );
    event LiquidityWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    constructor(address sellToken, address settlementToken, uint256 configuredFeeBps) {
        if (
            sellToken == address(0) || settlementToken == address(0) || sellToken == settlementToken
                || sellToken.code.length == 0 || settlementToken.code.length == 0
                || configuredFeeBps >= FEE_DENOMINATOR
        ) revert InvalidConfiguration();

        sellAsset = IERC20(sellToken);
        settlementAsset = IERC20(settlementToken);
        feeBps = configuredFeeBps;
        owner = msg.sender;
    }

    /// @notice Returns the input currently required to receive exactly `amountOut` settlement units.
    function quoteExactOutput(uint256 amountOut) public view returns (uint256 amountIn) {
        if (amountOut == 0) revert AmountOutIsZero();

        uint256 reserveIn = sellAsset.balanceOf(address(this));
        uint256 reserveOut = settlementAsset.balanceOf(address(this));
        if (amountOut >= reserveOut) revert InsufficientLiquidity(reserveOut, amountOut);

        uint256 feeMultiplier = FEE_DENOMINATOR - feeBps;
        uint256 numerator = reserveIn * amountOut * FEE_DENOMINATOR;
        uint256 denominator = (reserveOut - amountOut) * feeMultiplier;
        amountIn = numerator / denominator + 1;
    }

    /// @notice Swaps no more than `maxSellAmount` for exactly `amountOut` settlement units.
    function swapExactOutput(uint256 maxSellAmount, uint256 amountOut, address recipient)
        external
        nonReentrant
        returns (uint256 amountIn)
    {
        if (recipient == address(0)) revert ZeroRecipient();
        amountIn = quoteExactOutput(amountOut);
        if (amountIn > maxSellAmount) revert MaximumSellExceeded(maxSellAmount, amountIn);

        sellAsset.safeTransferFrom(msg.sender, address(this), amountIn);
        settlementAsset.safeTransfer(recipient, amountOut);

        emit ExactOutputSwap(msg.sender, recipient, amountIn, amountOut);
    }

    /// @notice Lets the deployer recover testnet liquidity after a demo.
    function withdraw(address token, address recipient, uint256 amount) external nonReentrant {
        if (msg.sender != owner) revert NotOwner();
        if (recipient == address(0)) revert ZeroRecipient();
        IERC20(token).safeTransfer(recipient, amount);
        emit LiquidityWithdrawn(token, recipient, amount);
    }
}
