// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { BlinkPayRouter } from "../src/BlinkPayRouter.sol";
import { BlinkPaySwapRouter } from "../src/BlinkPaySwapRouter.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { MockAllowanceHolder, MockZeroExTarget } from "../src/MockZeroEx.sol";

interface SwapVm {
    function addr(uint256 privateKey) external returns (address);
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 newTimestamp) external;
}

contract BlinkPaySwapRouterTest {
    SwapVm private constant vm = SwapVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant MERCHANT_KEY = 0xA11CE;
    uint256 private constant STARTING_SELL_BALANCE = 100 ether;
    uint256 private constant INVOICE_AMOUNT = 12_500_000;
    uint256 private constant MAX_SELL = 8 ether;
    uint256 private constant ACTUAL_SELL = 6 ether;

    MockUSDC private settlementToken;
    MockUSDC private sellToken;
    MockAllowanceHolder private allowanceHolder;
    MockZeroExTarget private swapTarget;
    BlinkPaySwapRouter private router;
    address private merchant;
    address private payer;

    function setUp() public {
        settlementToken = new MockUSDC();
        sellToken = new MockUSDC();
        allowanceHolder = new MockAllowanceHolder();
        swapTarget = new MockZeroExTarget(allowanceHolder);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = MockZeroExTarget.swapExactOutput.selector;
        router = new BlinkPaySwapRouter(
            address(settlementToken),
            address(sellToken),
            address(swapTarget),
            address(allowanceHolder),
            selectors
        );

        merchant = vm.addr(MERCHANT_KEY);
        payer = vm.addr(0xB0B);
        sellToken.mint(payer, STARTING_SELL_BALANCE);
        settlementToken.mint(address(swapTarget), INVOICE_AMOUNT * 10);

        vm.prank(payer);
        sellToken.approve(address(router), type(uint256).max);
    }

    function testPaysExactInvoiceAndRefundsUnusedSellToken() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);

        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            MAX_SELL,
            invoice.expiry,
            _swapCall(ACTUAL_SELL, INVOICE_AMOUNT, address(router), false)
        );

        require(router.paidInvoices(invoice.invoiceId), "invoice not paid");
        require(settlementToken.balanceOf(merchant) == INVOICE_AMOUNT, "merchant amount wrong");
        require(
            sellToken.balanceOf(payer) == STARTING_SELL_BALANCE - ACTUAL_SELL,
            "payer did not receive refund"
        );
        require(sellToken.balanceOf(address(router)) == 0, "router retained sell token");
        require(settlementToken.balanceOf(address(router)) == 0, "router retained settlement");
        require(
            sellToken.allowance(address(router), address(allowanceHolder)) == 0,
            "allowance not cleared"
        );
    }

    function testRejectsExpiredQuoteWithoutChangingBalances() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);
        uint256 deadline = block.timestamp + 10;
        vm.warp(deadline + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySwapRouter.SwapQuoteExpired.selector, deadline, deadline + 1
            )
        );
        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            MAX_SELL,
            deadline,
            _swapCall(ACTUAL_SELL, INVOICE_AMOUNT, address(router), false)
        );

        _assertUnchanged(invoice.invoiceId);
    }

    function testRejectsQuoteDeadlineAfterInvoiceExpiry() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);
        uint256 deadline = invoice.expiry + 1;

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySwapRouter.InvalidQuoteDeadline.selector, deadline, invoice.expiry
            )
        );
        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            MAX_SELL,
            deadline,
            _swapCall(ACTUAL_SELL, INVOICE_AMOUNT, address(router), false)
        );
    }

    function testRejectsZeroMaximumSell() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);

        vm.expectRevert(BlinkPaySwapRouter.InvalidMaxSellAmount.selector);
        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            0,
            invoice.expiry,
            _swapCall(0, INVOICE_AMOUNT, address(router), false)
        );
    }

    function testRejectsMalformedSwapCallData() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);

        vm.expectRevert(BlinkPaySwapRouter.SwapCallDataTooShort.selector);
        vm.prank(payer);
        router.payWithSwap(invoice, signature, MAX_SELL, invoice.expiry, hex"1234");
    }

    function testRejectsUnapprovedSelector() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);
        bytes memory callData = abi.encodeCall(MockZeroExTarget.unsupportedCall, ());

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySwapRouter.SwapSelectorNotAllowed.selector,
                MockZeroExTarget.unsupportedCall.selector
            )
        );
        vm.prank(payer);
        router.payWithSwap(invoice, signature, MAX_SELL, invoice.expiry, callData);
    }

    function testSwapFailureRollsBackFundsAllowanceAndPaidFlag() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySwapRouter.SwapCallFailed.selector,
                abi.encodeWithSelector(MockZeroExTarget.ForcedSwapFailure.selector)
            )
        );
        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            MAX_SELL,
            invoice.expiry,
            _swapCall(ACTUAL_SELL, INVOICE_AMOUNT, address(router), true)
        );

        _assertUnchanged(invoice.invoiceId);
        require(
            sellToken.allowance(address(router), address(allowanceHolder)) == 0,
            "failed swap retained allowance"
        );
    }

    function testAggregatorCannotSpendAboveMaximum() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySwapRouter.SwapCallFailed.selector,
                abi.encodeWithSelector(MockUSDC.InsufficientAllowance.selector)
            )
        );
        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            MAX_SELL,
            invoice.expiry,
            _swapCall(MAX_SELL + 1, INVOICE_AMOUNT, address(router), false)
        );

        _assertUnchanged(invoice.invoiceId);
    }

    function testUnderpaymentRollsBackEntireSwap() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);
        uint256 underpayment = INVOICE_AMOUNT - 1;

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPaySwapRouter.InexactSwapOutput.selector, INVOICE_AMOUNT, underpayment
            )
        );
        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            MAX_SELL,
            invoice.expiry,
            _swapCall(ACTUAL_SELL, underpayment, address(router), false)
        );

        _assertUnchanged(invoice.invoiceId);
    }

    function testRedirectedOutputRollsBackEntireSwap() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);
        address attacker = vm.addr(0xBAD);

        vm.expectRevert(
            abi.encodeWithSelector(BlinkPaySwapRouter.InexactSwapOutput.selector, INVOICE_AMOUNT, 0)
        );
        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            MAX_SELL,
            invoice.expiry,
            _swapCall(ACTUAL_SELL, INVOICE_AMOUNT, attacker, false)
        );

        require(settlementToken.balanceOf(attacker) == 0, "attacker retained reverted output");
        _assertUnchanged(invoice.invoiceId);
    }

    function testInsufficientPayerAllowanceRollsBackPaidFlag() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);
        vm.prank(payer);
        sellToken.approve(address(router), MAX_SELL - 1);

        vm.expectRevert(MockUSDC.InsufficientAllowance.selector);
        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            MAX_SELL,
            invoice.expiry,
            _swapCall(ACTUAL_SELL, INVOICE_AMOUNT, address(router), false)
        );

        _assertUnchanged(invoice.invoiceId);
    }

    function testDirectAndSwapRoutesShareReplayProtection() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice);

        vm.prank(payer);
        router.payWithSwap(
            invoice,
            signature,
            MAX_SELL,
            invoice.expiry,
            _swapCall(ACTUAL_SELL, INVOICE_AMOUNT, address(router), false)
        );

        settlementToken.mint(payer, INVOICE_AMOUNT);
        vm.prank(payer);
        settlementToken.approve(address(router), INVOICE_AMOUNT);
        vm.expectRevert(
            abi.encodeWithSelector(BlinkPayRouter.InvoiceAlreadyPaid.selector, invoice.invoiceId)
        );
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testConstructorRejectsEmptySelectorList() public {
        bytes4[] memory selectors = new bytes4[](0);
        vm.expectRevert(BlinkPaySwapRouter.InvalidSwapConfiguration.selector);
        new BlinkPaySwapRouter(
            address(settlementToken),
            address(sellToken),
            address(swapTarget),
            address(allowanceHolder),
            selectors
        );
    }

    function _validInvoice() private view returns (BlinkPayRouter.Invoice memory) {
        return BlinkPayRouter.Invoice({
            invoiceId: keccak256("swap-invoice-1"),
            merchant: merchant,
            settlementToken: address(settlementToken),
            amount: INVOICE_AMOUNT,
            expiry: block.timestamp + 1 hours,
            nonce: 8,
            chainId: block.chainid,
            metadataHash: keccak256("Design work")
        });
    }

    function _sign(BlinkPayRouter.Invoice memory invoice) private returns (bytes memory) {
        bytes32 digest = router.invoiceDigest(invoice);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MERCHANT_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function _swapCall(uint256 sellAmount, uint256 buyAmount, address recipient, bool forceFailure)
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
                recipient,
                forceFailure
            )
        );
    }

    function _assertUnchanged(bytes32 invoiceId) private view {
        require(!router.paidInvoices(invoiceId), "failed invoice marked paid");
        require(sellToken.balanceOf(payer) == STARTING_SELL_BALANCE, "payer balance changed");
        require(settlementToken.balanceOf(merchant) == 0, "merchant balance changed");
        require(sellToken.balanceOf(address(router)) == 0, "router retained sell token");
    }
}
