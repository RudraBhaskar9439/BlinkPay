// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { BlinkPayRouter } from "../src/BlinkPayRouter.sol";
import { BlinkPaySwapRouter } from "../src/BlinkPaySwapRouter.sol";
import { BlinkPayTestnetPool } from "../src/BlinkPayTestnetPool.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

interface IntegrationVm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address sender) external;
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
}

contract BlinkPayTestnetIntegrationTest {
    IntegrationVm private constant vm =
        IntegrationVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant MERCHANT_KEY = 0xA11CE;
    uint256 private constant INVOICE_AMOUNT = 5_000_000;

    MockUSDC private wmon;
    MockUSDC private usdc;
    BlinkPayTestnetPool private pool;
    BlinkPaySwapRouter private router;
    address private merchant;
    address private payer;

    function setUp() public {
        wmon = new MockUSDC();
        usdc = new MockUSDC();
        pool = new BlinkPayTestnetPool(address(wmon), address(usdc), 30);

        wmon.mint(address(pool), 500_000_000);
        usdc.mint(address(pool), 1_000_000_000);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = BlinkPayTestnetPool.swapExactOutput.selector;
        router = new BlinkPaySwapRouter(
            address(usdc), address(wmon), address(pool), address(pool), selectors
        );

        merchant = vm.addr(MERCHANT_KEY);
        payer = vm.addr(0xB0B);
        wmon.mint(payer, 100_000_000);
        vm.prank(payer);
        wmon.approve(address(router), type(uint256).max);
    }

    function testLiveTestnetArchitectureSettlesExactOutputAndRefundsRouterCap() public {
        BlinkPayRouter.Invoice memory invoice = BlinkPayRouter.Invoice({
            invoiceId: keccak256("testnet-invoice"),
            merchant: merchant,
            settlementToken: address(usdc),
            amount: INVOICE_AMOUNT,
            expiry: block.timestamp + 1 hours,
            nonce: 1,
            chainId: block.chainid,
            metadataHash: keccak256("coffee")
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MERCHANT_KEY, router.invoiceDigest(invoice));
        bytes memory signature = abi.encodePacked(r, s, v);

        uint256 quoted = pool.quoteExactOutput(INVOICE_AMOUNT);
        uint256 maximum = quoted * 10_050 / 10_000 + 1;
        bytes memory swapCall = abi.encodeCall(
            BlinkPayTestnetPool.swapExactOutput, (maximum, INVOICE_AMOUNT, address(router))
        );
        uint256 payerBefore = wmon.balanceOf(payer);

        vm.prank(payer);
        router.payWithSwap(invoice, signature, maximum, invoice.expiry, swapCall);

        require(usdc.balanceOf(merchant) == INVOICE_AMOUNT, "merchant did not receive exact USDC");
        require(wmon.balanceOf(payer) == payerBefore - quoted, "payer did not receive cap refund");
        require(wmon.balanceOf(address(router)) == 0, "router retained WMON");
        require(usdc.balanceOf(address(router)) == 0, "router retained USDC");
        require(router.paidInvoices(invoice.invoiceId), "invoice not marked paid");
    }
}
