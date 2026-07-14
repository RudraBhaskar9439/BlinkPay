// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @title BlinkPayRouter
/// @notice Settles merchant-signed invoices in an exact, allowlisted ERC-20 asset.
contract BlinkPayRouter is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public constant DOMAIN_NAME = "BlinkPay";
    string public constant DOMAIN_VERSION = "1";

    bytes32 public constant INVOICE_TYPEHASH = keccak256(
        "Invoice(bytes32 invoiceId,address merchant,address settlementToken,uint256 amount,uint256 expiry,uint256 nonce,uint256 chainId,bytes32 metadataHash)"
    );

    struct Invoice {
        bytes32 invoiceId;
        address merchant;
        address settlementToken;
        uint256 amount;
        uint256 expiry;
        uint256 nonce;
        uint256 chainId;
        bytes32 metadataHash;
    }

    IERC20 public immutable settlementAsset;
    mapping(bytes32 invoiceId => bool paid) public paidInvoices;

    error EmptyInvoiceId();
    error InexactFundingInput(uint256 expected, uint256 received);
    error InexactSettlement(uint256 expected, uint256 received);
    error InvalidAmount();
    error InvalidChainId(uint256 expected, uint256 received);
    error InvalidMerchant();
    error InvalidMerchantSignature();
    error InvalidSettlementToken(address expected, address received);
    error InvoiceExpired(uint256 expiry, uint256 currentTimestamp);
    error InvoiceAlreadyPaid(bytes32 invoiceId);
    error InvalidSettlementAsset();

    event PaymentSettled(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed merchant,
        address settlementToken,
        uint256 settlementAmount,
        uint256 merchantNonce
    );

    constructor(address settlementToken) EIP712(DOMAIN_NAME, DOMAIN_VERSION) {
        if (settlementToken == address(0) || settlementToken.code.length == 0) {
            revert InvalidSettlementAsset();
        }
        settlementAsset = IERC20(settlementToken);
    }

    /// @notice Pays an invoice from the caller's approved settlement-token balance.
    /// @dev Reverts atomically unless the merchant receives the exact invoice amount.
    function payDirect(Invoice calldata invoice, bytes calldata merchantSignature)
        external
        nonReentrant
    {
        _validateInvoice(invoice, merchantSignature);

        uint256 merchantBalanceBefore = settlementAsset.balanceOf(invoice.merchant);
        paidInvoices[invoice.invoiceId] = true;

        settlementAsset.safeTransferFrom(msg.sender, invoice.merchant, invoice.amount);

        uint256 merchantBalanceAfter = settlementAsset.balanceOf(invoice.merchant);
        uint256 received = merchantBalanceAfter >= merchantBalanceBefore
            ? merchantBalanceAfter - merchantBalanceBefore
            : 0;
        if (received != invoice.amount) revert InexactSettlement(invoice.amount, received);

        _emitPaymentSettled(invoice, msg.sender);
    }

    /// @notice Returns the exact EIP-712 digest a merchant must sign.
    function invoiceDigest(Invoice calldata invoice) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    INVOICE_TYPEHASH,
                    invoice.invoiceId,
                    invoice.merchant,
                    invoice.settlementToken,
                    invoice.amount,
                    invoice.expiry,
                    invoice.nonce,
                    invoice.chainId,
                    invoice.metadataHash
                )
            )
        );
    }

    function _validateInvoice(Invoice calldata invoice, bytes calldata merchantSignature)
        internal
        view
    {
        if (invoice.invoiceId == bytes32(0)) revert EmptyInvoiceId();
        if (invoice.merchant == address(0)) revert InvalidMerchant();
        if (invoice.amount == 0) revert InvalidAmount();
        if (invoice.chainId != block.chainid) {
            revert InvalidChainId(block.chainid, invoice.chainId);
        }
        if (invoice.expiry < block.timestamp) {
            revert InvoiceExpired(invoice.expiry, block.timestamp);
        }
        if (invoice.settlementToken != address(settlementAsset)) {
            revert InvalidSettlementToken(address(settlementAsset), invoice.settlementToken);
        }
        if (paidInvoices[invoice.invoiceId]) revert InvoiceAlreadyPaid(invoice.invoiceId);

        bytes32 digest = invoiceDigest(invoice);
        if (!SignatureChecker.isValidSignatureNowCalldata(
                invoice.merchant, digest, merchantSignature
            )) {
            revert InvalidMerchantSignature();
        }
    }

    /// @dev Transfers settlement assets already held by the router and verifies exact receipt.
    function _settleMerchantFromRouter(Invoice calldata invoice) internal {
        uint256 merchantBalanceBefore = settlementAsset.balanceOf(invoice.merchant);
        settlementAsset.safeTransfer(invoice.merchant, invoice.amount);
        uint256 merchantBalanceAfter = settlementAsset.balanceOf(invoice.merchant);
        uint256 received = merchantBalanceAfter >= merchantBalanceBefore
            ? merchantBalanceAfter - merchantBalanceBefore
            : 0;
        if (received != invoice.amount) revert InexactSettlement(invoice.amount, received);
    }

    /// @dev Pulls an exact settlement-token contribution into the router.
    function _pullSettlementToRouter(address payer, uint256 amount) internal {
        uint256 balanceBefore = settlementAsset.balanceOf(address(this));
        settlementAsset.safeTransferFrom(payer, address(this), amount);
        uint256 balanceAfter = settlementAsset.balanceOf(address(this));
        uint256 received = balanceAfter >= balanceBefore ? balanceAfter - balanceBefore : 0;
        if (received != amount) revert InexactFundingInput(amount, received);
    }

    function _emitPaymentSettled(Invoice calldata invoice, address payer) internal {
        emit PaymentSettled(
            invoice.invoiceId,
            payer,
            invoice.merchant,
            invoice.settlementToken,
            invoice.amount,
            invoice.nonce
        );
    }
}
