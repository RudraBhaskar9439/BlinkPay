// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { BlinkPayRouter } from "../src/BlinkPayRouter.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function expectEmit(
        bool checkTopic1,
        bool checkTopic2,
        bool checkTopic3,
        bool checkData,
        address emitter
    ) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 newTimestamp) external;
}

contract BlinkPayRouterTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant MERCHANT_KEY = 0xA11CE;
    uint256 private constant WRONG_KEY = 0xBAD;
    uint256 private constant STARTING_BALANCE = 1_000_000_000;
    uint256 private constant INVOICE_AMOUNT = 12_500_000;

    MockUSDC private token;
    BlinkPayRouter private router;
    address private merchant;
    address private payer;

    event PaymentSettled(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed merchant,
        address settlementToken,
        uint256 settlementAmount,
        uint256 merchantNonce
    );

    function setUp() public {
        token = new MockUSDC();
        router = new BlinkPayRouter(address(token));
        merchant = vm.addr(MERCHANT_KEY);
        payer = vm.addr(0xB0B);

        token.mint(payer, STARTING_BALANCE);
        vm.prank(payer);
        token.approve(address(router), type(uint256).max);
    }

    function testPaysExactInvoiceAndEmitsReceipt() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice, MERCHANT_KEY);

        vm.expectEmit(true, true, true, true, address(router));
        emit PaymentSettled(
            invoice.invoiceId, payer, merchant, address(token), INVOICE_AMOUNT, invoice.nonce
        );

        vm.prank(payer);
        router.payDirect(invoice, signature);

        require(router.paidInvoices(invoice.invoiceId), "invoice not marked paid");
        require(token.balanceOf(merchant) == INVOICE_AMOUNT, "merchant underpaid");
        require(
            token.balanceOf(payer) == STARTING_BALANCE - INVOICE_AMOUNT, "payer charged incorrectly"
        );
    }

    function testRejectsInvoiceReplay() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice, MERCHANT_KEY);

        vm.prank(payer);
        router.payDirect(invoice, signature);

        vm.expectRevert(
            abi.encodeWithSelector(BlinkPayRouter.InvoiceAlreadyPaid.selector, invoice.invoiceId)
        );
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testRejectsExpiredInvoice() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice, MERCHANT_KEY);
        vm.warp(invoice.expiry + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPayRouter.InvoiceExpired.selector, invoice.expiry, invoice.expiry + 1
            )
        );
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testRejectsWrongChain() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        invoice.chainId = block.chainid + 1;
        bytes memory signature = _sign(invoice, MERCHANT_KEY);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPayRouter.InvalidChainId.selector, block.chainid, invoice.chainId
            )
        );
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testRejectsWrongSettlementToken() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        invoice.settlementToken = address(new MockUSDC());
        bytes memory signature = _sign(invoice, MERCHANT_KEY);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPayRouter.InvalidSettlementToken.selector,
                address(token),
                invoice.settlementToken
            )
        );
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testRejectsInvalidMerchantSignature() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice, WRONG_KEY);

        vm.expectRevert(BlinkPayRouter.InvalidMerchantSignature.selector);
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testRejectsInvoiceChangedAfterSigning() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice, MERCHANT_KEY);
        invoice.amount += 1;

        vm.expectRevert(BlinkPayRouter.InvalidMerchantSignature.selector);
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testRejectsZeroAmount() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        invoice.amount = 0;
        bytes memory signature = _sign(invoice, MERCHANT_KEY);

        vm.expectRevert(BlinkPayRouter.InvalidAmount.selector);
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testRejectsEmptyInvoiceId() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        invoice.invoiceId = bytes32(0);
        bytes memory signature = _sign(invoice, MERCHANT_KEY);

        vm.expectRevert(BlinkPayRouter.EmptyInvoiceId.selector);
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testRejectsInsufficientAllowanceWithoutMarkingPaid() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice, MERCHANT_KEY);

        vm.prank(payer);
        token.approve(address(router), 0);

        vm.expectRevert(MockUSDC.InsufficientAllowance.selector);
        vm.prank(payer);
        router.payDirect(invoice, signature);

        require(!router.paidInvoices(invoice.invoiceId), "failed invoice marked paid");
        require(token.balanceOf(merchant) == 0, "merchant balance changed");
    }

    function testConstructorRejectsNonContractAsset() public {
        vm.expectRevert(BlinkPayRouter.InvalidSettlementAsset.selector);
        new BlinkPayRouter(address(0x1234));
    }

    function testDeployerOwnsEmergencyPauseControl() public view {
        require(router.owner() == address(this), "unexpected owner");
        require(!router.paymentsPaused(), "router starts paused");
    }

    function testOnlyOwnerCanPausePayments() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, payer));
        vm.prank(payer);
        router.setPaymentsPaused(true);

        require(!router.paymentsPaused(), "unauthorized pause changed state");
    }

    function testPauseBlocksPaymentAndUnpauseRestoresIt() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice();
        bytes memory signature = _sign(invoice, MERCHANT_KEY);
        router.setPaymentsPaused(true);

        vm.expectRevert(BlinkPayRouter.PaymentsPaused.selector);
        vm.prank(payer);
        router.payDirect(invoice, signature);

        require(!router.paidInvoices(invoice.invoiceId), "paused invoice marked paid");
        require(token.balanceOf(payer) == STARTING_BALANCE, "paused payer balance changed");
        require(token.balanceOf(merchant) == 0, "paused merchant balance changed");

        router.setPaymentsPaused(false);
        vm.prank(payer);
        router.payDirect(invoice, signature);
        require(router.paidInvoices(invoice.invoiceId), "unpaused payment failed");
    }

    function _validInvoice() private view returns (BlinkPayRouter.Invoice memory) {
        return BlinkPayRouter.Invoice({
            invoiceId: keccak256("invoice-1"),
            merchant: merchant,
            settlementToken: address(token),
            amount: INVOICE_AMOUNT,
            expiry: block.timestamp + 1 hours,
            nonce: 7,
            chainId: block.chainid,
            metadataHash: keccak256("Design work")
        });
    }

    function _sign(BlinkPayRouter.Invoice memory invoice, uint256 privateKey)
        private
        returns (bytes memory)
    {
        bytes32 digest = router.invoiceDigest(invoice);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
