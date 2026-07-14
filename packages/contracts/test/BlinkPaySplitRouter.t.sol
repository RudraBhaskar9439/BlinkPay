// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { BlinkPayRouter } from "../src/BlinkPayRouter.sol";
import { BlinkPaySplitRouter } from "../src/BlinkPaySplitRouter.sol";
import { BlinkPaySwapRouter } from "../src/BlinkPaySwapRouter.sol";
import { BlinkPayTestnetVault } from "../src/BlinkPayTestnetVault.sol";
import { BlinkPayVaultRouter } from "../src/BlinkPayVaultRouter.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { MockAllowanceHolder, MockZeroExTarget } from "../src/MockZeroEx.sol";

interface SplitVm {
    function addr(uint256 privateKey) external returns (address);
    function expectRevert() external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
}

contract BlinkPaySplitRouterTest {
    SplitVm private constant vm = SplitVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant MERCHANT_KEY = 0xA11CE;
    uint256 private constant STARTING_SETTLEMENT = 1_000_000_000;
    uint256 private constant DEPOSIT_ASSETS = 500_000_000;
    uint256 private constant INVOICE_AMOUNT = 125_000_000;
    uint256 private constant DIRECT_AMOUNT = 25_000_000;
    uint256 private constant SECONDARY_AMOUNT = INVOICE_AMOUNT - DIRECT_AMOUNT;
    uint256 private constant STARTING_SELL = 100 ether;
    uint256 private constant MAX_SELL = 8 ether;
    uint256 private constant ACTUAL_SELL = 6 ether;

    MockUSDC private settlementToken;
    MockUSDC private sellToken;
    MockAllowanceHolder private allowanceHolder;
    MockZeroExTarget private swapTarget;
    BlinkPayTestnetVault private vault;
    BlinkPaySplitRouter private router;
    address private merchant;
    address private payer;

    function setUp() public {
        settlementToken = new MockUSDC();
        sellToken = new MockUSDC();
        allowanceHolder = new MockAllowanceHolder();
        swapTarget = new MockZeroExTarget(allowanceHolder);
        vault = new BlinkPayTestnetVault(address(settlementToken));

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = MockZeroExTarget.swapExactOutput.selector;
        router = new BlinkPaySplitRouter(
            address(settlementToken),
            address(sellToken),
            address(swapTarget),
            address(allowanceHolder),
            selectors,
            address(vault)
        );

        merchant = vm.addr(MERCHANT_KEY);
        payer = vm.addr(0xB0B);
        settlementToken.mint(payer, STARTING_SETTLEMENT);
        sellToken.mint(payer, STARTING_SELL);
        settlementToken.mint(address(swapTarget), INVOICE_AMOUNT * 10);

        vm.prank(payer);
        settlementToken.approve(address(vault), DEPOSIT_ASSETS);
        vm.prank(payer);
        vault.deposit(DEPOSIT_ASSETS, payer);
        vm.prank(payer);
        settlementToken.approve(address(router), type(uint256).max);
        vm.prank(payer);
        vault.approve(address(router), type(uint256).max);
        vm.prank(payer);
        sellToken.approve(address(router), type(uint256).max);
    }

    function testDirectVaultSplitSettlesExactInvoice() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("split-vault");
        bytes memory signature = _sign(invoice);
        uint256 maximumShares = vault.previewWithdraw(SECONDARY_AMOUNT);

        vm.prank(payer);
        router.paySplitWithVault(invoice, signature, DIRECT_AMOUNT, maximumShares);

        require(router.paidInvoices(invoice.invoiceId), "invoice not paid");
        require(settlementToken.balanceOf(merchant) == INVOICE_AMOUNT, "merchant amount wrong");
        require(
            settlementToken.balanceOf(payer)
                == STARTING_SETTLEMENT - DEPOSIT_ASSETS - DIRECT_AMOUNT,
            "direct contribution wrong"
        );
        require(vault.balanceOf(payer) == DEPOSIT_ASSETS - SECONDARY_AMOUNT, "share burn wrong");
        require(vault.totalAssets() == DEPOSIT_ASSETS - SECONDARY_AMOUNT, "vault assets wrong");
        _assertRouterEmpty();
    }

    function testDirectSwapSplitSettlesAndRefunds() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("split-swap");
        bytes memory signature = _sign(invoice);

        vm.prank(payer);
        router.paySplitWithSwap(
            invoice,
            signature,
            DIRECT_AMOUNT,
            MAX_SELL,
            invoice.expiry,
            _swapCall(ACTUAL_SELL, SECONDARY_AMOUNT, false)
        );

        require(settlementToken.balanceOf(merchant) == INVOICE_AMOUNT, "merchant amount wrong");
        require(
            settlementToken.balanceOf(payer)
                == STARTING_SETTLEMENT - DEPOSIT_ASSETS - DIRECT_AMOUNT,
            "direct contribution wrong"
        );
        require(sellToken.balanceOf(payer) == STARTING_SELL - ACTUAL_SELL, "sell refund wrong");
        require(vault.balanceOf(payer) == DEPOSIT_ASSETS, "vault position changed");
        _assertRouterEmpty();
    }

    function testRejectsZeroOrFullDirectContribution() public {
        BlinkPayRouter.Invoice memory zeroInvoice = _validInvoice("split-zero-direct");
        bytes memory zeroSignature = _sign(zeroInvoice);
        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySplitRouter.InvalidDirectAmount.selector, 0, INVOICE_AMOUNT
            )
        );
        vm.prank(payer);
        router.paySplitWithVault(zeroInvoice, zeroSignature, 0, type(uint256).max);

        BlinkPayRouter.Invoice memory fullInvoice = _validInvoice("split-full-direct");
        bytes memory fullSignature = _sign(fullInvoice);
        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySplitRouter.InvalidDirectAmount.selector, INVOICE_AMOUNT, INVOICE_AMOUNT
            )
        );
        vm.prank(payer);
        router.paySplitWithVault(fullInvoice, fullSignature, INVOICE_AMOUNT, type(uint256).max);

        _assertUnchanged(zeroInvoice.invoiceId);
        require(!router.paidInvoices(fullInvoice.invoiceId), "full split marked paid");
    }

    function testVaultCapFailureRollsBackDirectContribution() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("split-vault-cap");
        bytes memory signature = _sign(invoice);
        uint256 requiredShares = vault.previewWithdraw(SECONDARY_AMOUNT);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPayVaultRouter.ShareLimitExceeded.selector, requiredShares - 1, requiredShares
            )
        );
        vm.prank(payer);
        router.paySplitWithVault(invoice, signature, DIRECT_AMOUNT, requiredShares - 1);

        _assertUnchanged(invoice.invoiceId);
    }

    function testMissingVaultAllowanceRollsBackDirectContribution() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("split-vault-allowance");
        bytes memory signature = _sign(invoice);
        uint256 maximumShares = vault.previewWithdraw(SECONDARY_AMOUNT);
        vm.prank(payer);
        vault.approve(address(router), 0);

        vm.expectRevert();
        vm.prank(payer);
        router.paySplitWithVault(invoice, signature, DIRECT_AMOUNT, maximumShares);

        _assertUnchanged(invoice.invoiceId);
    }

    function testMissingDirectAllowanceDoesNotTouchVault() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("split-direct-allowance");
        bytes memory signature = _sign(invoice);
        uint256 maximumShares = vault.previewWithdraw(SECONDARY_AMOUNT);
        vm.prank(payer);
        settlementToken.approve(address(router), DIRECT_AMOUNT - 1);

        vm.expectRevert(MockUSDC.InsufficientAllowance.selector);
        vm.prank(payer);
        router.paySplitWithVault(invoice, signature, DIRECT_AMOUNT, maximumShares);

        _assertUnchanged(invoice.invoiceId);
    }

    function testSwapFailureRollsBackBothContributions() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("split-swap-failure");
        bytes memory signature = _sign(invoice);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySwapRouter.SwapCallFailed.selector,
                abi.encodeWithSelector(MockZeroExTarget.ForcedSwapFailure.selector)
            )
        );
        vm.prank(payer);
        router.paySplitWithSwap(
            invoice,
            signature,
            DIRECT_AMOUNT,
            MAX_SELL,
            invoice.expiry,
            _swapCall(ACTUAL_SELL, SECONDARY_AMOUNT, true)
        );

        _assertUnchanged(invoice.invoiceId);
    }

    function testWrongSwapOutputRollsBackBothContributions() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("split-wrong-output");
        bytes memory signature = _sign(invoice);
        uint256 underpayment = SECONDARY_AMOUNT - 1;

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySwapRouter.InexactSwapOutput.selector, SECONDARY_AMOUNT, underpayment
            )
        );
        vm.prank(payer);
        router.paySplitWithSwap(
            invoice,
            signature,
            DIRECT_AMOUNT,
            MAX_SELL,
            invoice.expiry,
            _swapCall(ACTUAL_SELL, underpayment, false)
        );

        _assertUnchanged(invoice.invoiceId);
    }

    function testSplitAndSingleRoutesShareReplayProtection() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("split-replay");
        bytes memory signature = _sign(invoice);
        uint256 maximumShares = vault.previewWithdraw(SECONDARY_AMOUNT);

        vm.prank(payer);
        router.paySplitWithVault(invoice, signature, DIRECT_AMOUNT, maximumShares);

        vm.expectRevert(
            abi.encodeWithSelector(BlinkPayRouter.InvoiceAlreadyPaid.selector, invoice.invoiceId)
        );
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function _validInvoice(string memory salt)
        private
        view
        returns (BlinkPayRouter.Invoice memory)
    {
        return BlinkPayRouter.Invoice({
            invoiceId: keccak256(bytes(salt)),
            merchant: merchant,
            settlementToken: address(settlementToken),
            amount: INVOICE_AMOUNT,
            expiry: block.timestamp + 1 hours,
            nonce: 16,
            chainId: block.chainid,
            metadataHash: keccak256("Atomic split payment")
        });
    }

    function _sign(BlinkPayRouter.Invoice memory invoice) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MERCHANT_KEY, router.invoiceDigest(invoice));
        return abi.encodePacked(r, s, v);
    }

    function _swapCall(uint256 sellAmount, uint256 buyAmount, bool forceFailure)
        private
        view
        returns (bytes memory)
    {
        return abi.encodeCall(
            MockZeroExTarget.swapExactOutput,
            (
                IERC20(address(sellToken)),
                IERC20(address(settlementToken)),
                sellAmount,
                buyAmount,
                address(router),
                forceFailure
            )
        );
    }

    function _assertUnchanged(bytes32 invoiceId) private view {
        require(!router.paidInvoices(invoiceId), "failed invoice marked paid");
        require(
            settlementToken.balanceOf(payer) == STARTING_SETTLEMENT - DEPOSIT_ASSETS,
            "payer USDC changed"
        );
        require(vault.balanceOf(payer) == DEPOSIT_ASSETS, "payer shares changed");
        require(sellToken.balanceOf(payer) == STARTING_SELL, "payer sell balance changed");
        require(settlementToken.balanceOf(merchant) == 0, "merchant balance changed");
        _assertRouterEmpty();
    }

    function _assertRouterEmpty() private view {
        require(settlementToken.balanceOf(address(router)) == 0, "router retained USDC");
        require(sellToken.balanceOf(address(router)) == 0, "router retained sell token");
        require(vault.balanceOf(address(router)) == 0, "router retained shares");
    }
}
