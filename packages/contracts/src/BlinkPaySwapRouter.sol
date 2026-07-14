// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BlinkPayRouter } from "./BlinkPayRouter.sol";

/// @title BlinkPaySwapRouter
/// @notice Settles a signed USDC invoice through one immutable, allowlisted swap integration.
/// @dev The quote is generated for this contract as taker and recipient. The payer remains txOrigin.
contract BlinkPaySwapRouter is BlinkPayRouter {
    using SafeERC20 for IERC20;

    IERC20 public immutable sellAsset;
    address public immutable swapTarget;
    address public immutable allowanceTarget;
    mapping(bytes4 selector => bool allowed) public allowedSwapSelectors;

    error InexactSwapOutput(uint256 expected, uint256 received);
    error InvalidMaxSellAmount();
    error InvalidQuoteDeadline(uint256 quoteDeadline, uint256 invoiceExpiry);
    error InvalidSwapConfiguration();
    error SellBalanceAccountingError(uint256 maximumSell, uint256 remainingSell);
    error SwapCallDataTooShort();
    error SwapCallFailed(bytes reason);
    error SwapQuoteExpired(uint256 deadline, uint256 currentTimestamp);
    error SwapSelectorNotAllowed(bytes4 selector);

    event SwapPaymentSettled(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed sellToken,
        uint256 maximumSellAmount,
        uint256 actualSellAmount,
        uint256 refundedSellAmount
    );

    constructor(
        address settlementToken,
        address supportedSellToken,
        address configuredSwapTarget,
        address configuredAllowanceTarget,
        bytes4[] memory swapSelectors
    ) BlinkPayRouter(settlementToken) {
        if (
            supportedSellToken == address(0) || supportedSellToken == settlementToken
                || supportedSellToken.code.length == 0 || configuredSwapTarget == address(0)
                || configuredSwapTarget.code.length == 0 || configuredAllowanceTarget == address(0)
                || configuredAllowanceTarget.code.length == 0 || swapSelectors.length == 0
        ) revert InvalidSwapConfiguration();

        sellAsset = IERC20(supportedSellToken);
        swapTarget = configuredSwapTarget;
        allowanceTarget = configuredAllowanceTarget;

        for (uint256 index; index < swapSelectors.length; ++index) {
            bytes4 selector = swapSelectors[index];
            if (selector == bytes4(0)) revert InvalidSwapConfiguration();
            allowedSwapSelectors[selector] = true;
        }
    }

    /// @notice Pays a USDC invoice using at most `maxSellAmount` of the configured sell token.
    /// @dev Any unspent sell token is returned in the same transaction. Every failure rolls back.
    function payWithSwap(
        Invoice calldata invoice,
        bytes calldata merchantSignature,
        uint256 maxSellAmount,
        uint256 quoteDeadline,
        bytes calldata swapCallData
    ) external nonReentrant {
        _validateInvoice(invoice, merchantSignature);
        if (maxSellAmount == 0) revert InvalidMaxSellAmount();
        if (quoteDeadline > invoice.expiry) {
            revert InvalidQuoteDeadline(quoteDeadline, invoice.expiry);
        }
        if (quoteDeadline < block.timestamp) {
            revert SwapQuoteExpired(quoteDeadline, block.timestamp);
        }
        if (swapCallData.length < 4) revert SwapCallDataTooShort();

        bytes4 selector = bytes4(swapCallData[:4]);
        if (!allowedSwapSelectors[selector]) revert SwapSelectorNotAllowed(selector);

        paidInvoices[invoice.invoiceId] = true;
        (uint256 actualSellAmount, uint256 refund) =
            _executeSwap(maxSellAmount, invoice.amount, swapCallData);
        _settleMerchantFromRouter(invoice);

        if (refund != 0) sellAsset.safeTransfer(msg.sender, refund);

        emit PaymentSettled(
            invoice.invoiceId,
            msg.sender,
            invoice.merchant,
            invoice.settlementToken,
            invoice.amount,
            invoice.nonce
        );
        emit SwapPaymentSettled(
            invoice.invoiceId,
            msg.sender,
            address(sellAsset),
            maxSellAmount,
            actualSellAmount,
            refund
        );
    }

    function _executeSwap(
        uint256 maxSellAmount,
        uint256 expectedOutput,
        bytes calldata swapCallData
    ) private returns (uint256 actualSellAmount, uint256 refund) {
        uint256 sellBalanceBefore = sellAsset.balanceOf(address(this));
        uint256 settlementBalanceBefore = settlementAsset.balanceOf(address(this));

        sellAsset.safeTransferFrom(msg.sender, address(this), maxSellAmount);
        sellAsset.forceApprove(allowanceTarget, maxSellAmount);

        (bool success, bytes memory reason) = swapTarget.call(swapCallData);
        if (!success) revert SwapCallFailed(reason);

        sellAsset.forceApprove(allowanceTarget, 0);

        uint256 settlementBalanceAfter = settlementAsset.balanceOf(address(this));
        uint256 received = settlementBalanceAfter >= settlementBalanceBefore
            ? settlementBalanceAfter - settlementBalanceBefore
            : 0;
        if (received != expectedOutput) revert InexactSwapOutput(expectedOutput, received);

        uint256 sellBalanceAfter = sellAsset.balanceOf(address(this));
        refund = sellBalanceAfter >= sellBalanceBefore ? sellBalanceAfter - sellBalanceBefore : 0;
        if (refund > maxSellAmount) {
            revert SellBalanceAccountingError(maxSellAmount, refund);
        }
        actualSellAmount = maxSellAmount - refund;
    }
}
