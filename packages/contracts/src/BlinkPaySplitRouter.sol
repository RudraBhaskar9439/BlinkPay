// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BlinkPayVaultRouter } from "./BlinkPayVaultRouter.sol";

/// @title BlinkPaySplitRouter
/// @notice Atomically combines direct USDC with one allowlisted secondary route.
contract BlinkPaySplitRouter is BlinkPayVaultRouter {
    using SafeERC20 for IERC20;

    error InvalidDirectAmount(uint256 directAmount, uint256 invoiceAmount);

    event DirectVaultSplitSettled(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed vault,
        uint256 directAmount,
        uint256 vaultAmount,
        uint256 maximumShares,
        uint256 sharesRedeemed
    );

    event DirectSwapSplitSettled(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed sellToken,
        uint256 directAmount,
        uint256 swapOutputAmount,
        uint256 maximumSellAmount,
        uint256 actualSellAmount,
        uint256 refundedSellAmount
    );

    constructor(
        address settlementToken,
        address supportedSellToken,
        address configuredSwapTarget,
        address configuredAllowanceTarget,
        bytes4[] memory swapSelectors,
        address supportedVault
    )
        BlinkPayVaultRouter(
            settlementToken,
            supportedSellToken,
            configuredSwapTarget,
            configuredAllowanceTarget,
            swapSelectors,
            supportedVault
        )
    { }

    /// @notice Combines exact wallet USDC with an exact ERC-4626 withdrawal.
    function paySplitWithVault(
        Invoice calldata invoice,
        bytes calldata merchantSignature,
        uint256 directAmount,
        uint256 maxShares
    ) external nonReentrant {
        _validateInvoice(invoice, merchantSignature);
        uint256 vaultAmount = _splitShortfall(invoice.amount, directAmount);
        if (maxShares == 0) revert InvalidMaxShares();

        paidInvoices[invoice.invoiceId] = true;
        _pullSettlementToRouter(msg.sender, directAmount);
        uint256 sharesRedeemed = _redeemExactAssets(msg.sender, vaultAmount, maxShares);
        _settleMerchantFromRouter(invoice);

        _emitPaymentSettled(invoice, msg.sender);
        emit DirectVaultSplitSettled(
            invoice.invoiceId,
            msg.sender,
            address(vaultAsset),
            directAmount,
            vaultAmount,
            maxShares,
            sharesRedeemed
        );
    }

    /// @notice Combines exact wallet USDC with an exact-output WMON swap.
    function paySplitWithSwap(
        Invoice calldata invoice,
        bytes calldata merchantSignature,
        uint256 directAmount,
        uint256 maxSellAmount,
        uint256 quoteDeadline,
        bytes calldata swapCallData
    ) external nonReentrant {
        _validateInvoice(invoice, merchantSignature);
        uint256 swapOutputAmount = _splitShortfall(invoice.amount, directAmount);
        _validateSwapRequest(maxSellAmount, quoteDeadline, invoice.expiry, swapCallData);

        paidInvoices[invoice.invoiceId] = true;
        _pullSettlementToRouter(msg.sender, directAmount);
        (uint256 actualSellAmount, uint256 refund) =
            _executeSwap(maxSellAmount, swapOutputAmount, swapCallData);
        _settleMerchantFromRouter(invoice);

        if (refund != 0) sellAsset.safeTransfer(msg.sender, refund);

        _emitPaymentSettled(invoice, msg.sender);
        emit DirectSwapSplitSettled(
            invoice.invoiceId,
            msg.sender,
            address(sellAsset),
            directAmount,
            swapOutputAmount,
            maxSellAmount,
            actualSellAmount,
            refund
        );
    }

    function _splitShortfall(uint256 invoiceAmount, uint256 directAmount)
        private
        pure
        returns (uint256)
    {
        if (directAmount == 0 || directAmount >= invoiceAmount) {
            revert InvalidDirectAmount(directAmount, invoiceAmount);
        }
        return invoiceAmount - directAmount;
    }
}
