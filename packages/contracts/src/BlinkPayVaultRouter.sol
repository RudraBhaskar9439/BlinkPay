// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { BlinkPaySwapRouter } from "./BlinkPaySwapRouter.sol";

/// @title BlinkPayVaultRouter
/// @notice Adds one immutable, allowlisted ERC-4626 funding route to BlinkPay settlement.
contract BlinkPayVaultRouter is BlinkPaySwapRouter {
    IERC4626 public immutable vaultAsset;

    error InsufficientVaultLiquidity(uint256 requestedAssets, uint256 availableAssets);
    error InvalidMaxShares();
    error InvalidVaultConfiguration();
    error ShareLimitExceeded(uint256 maximumShares, uint256 requiredShares);
    error VaultBalanceAccountingError(uint256 reportedShares, uint256 observedShares);
    error VaultOutputMismatch(uint256 expectedAssets, uint256 receivedAssets);

    event VaultPaymentSettled(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed vault,
        uint256 settlementAmount,
        uint256 maximumShares,
        uint256 sharesRedeemed
    );

    constructor(
        address settlementToken,
        address supportedSellToken,
        address configuredSwapTarget,
        address configuredAllowanceTarget,
        bytes4[] memory swapSelectors,
        address supportedVault
    )
        BlinkPaySwapRouter(
            settlementToken,
            supportedSellToken,
            configuredSwapTarget,
            configuredAllowanceTarget,
            swapSelectors
        )
    {
        if (supportedVault == address(0) || supportedVault.code.length == 0) {
            revert InvalidVaultConfiguration();
        }

        IERC4626 configuredVault = IERC4626(supportedVault);
        try configuredVault.asset() returns (address underlyingAsset) {
            if (underlyingAsset != settlementToken) revert InvalidVaultConfiguration();
        } catch {
            revert InvalidVaultConfiguration();
        }
        vaultAsset = configuredVault;
    }

    /// @notice Redeems only the settlement assets required by the signed invoice.
    /// @param maxShares Payer-defined cap protecting against share-price or rounding changes.
    function payFromVault(
        Invoice calldata invoice,
        bytes calldata merchantSignature,
        uint256 maxShares
    ) external nonReentrant {
        _validateInvoice(invoice, merchantSignature);
        if (maxShares == 0) revert InvalidMaxShares();

        paidInvoices[invoice.invoiceId] = true;
        uint256 sharesRedeemed = _redeemExactAssets(msg.sender, invoice.amount, maxShares);
        _settleMerchantFromRouter(invoice);

        emit PaymentSettled(
            invoice.invoiceId,
            msg.sender,
            invoice.merchant,
            invoice.settlementToken,
            invoice.amount,
            invoice.nonce
        );
        emit VaultPaymentSettled(
            invoice.invoiceId,
            msg.sender,
            address(vaultAsset),
            invoice.amount,
            maxShares,
            sharesRedeemed
        );
    }

    function _redeemExactAssets(address payer, uint256 assets, uint256 maxShares)
        private
        returns (uint256 observedShares)
    {
        uint256 availableAssets = vaultAsset.maxWithdraw(payer);
        if (availableAssets < assets) {
            revert InsufficientVaultLiquidity(assets, availableAssets);
        }

        uint256 previewedShares = vaultAsset.previewWithdraw(assets);
        if (previewedShares > maxShares) revert ShareLimitExceeded(maxShares, previewedShares);

        uint256 sharesBefore = vaultAsset.balanceOf(payer);
        uint256 settlementBefore = settlementAsset.balanceOf(address(this));
        uint256 reportedShares = vaultAsset.withdraw(assets, address(this), payer);
        uint256 sharesAfter = vaultAsset.balanceOf(payer);
        observedShares = sharesBefore >= sharesAfter ? sharesBefore - sharesAfter : 0;
        if (reportedShares != observedShares) {
            revert VaultBalanceAccountingError(reportedShares, observedShares);
        }
        if (observedShares > maxShares) revert ShareLimitExceeded(maxShares, observedShares);

        uint256 settlementAfter = settlementAsset.balanceOf(address(this));
        uint256 receivedAssets =
            settlementAfter >= settlementBefore ? settlementAfter - settlementBefore : 0;
        if (receivedAssets != assets) revert VaultOutputMismatch(assets, receivedAssets);
    }
}
