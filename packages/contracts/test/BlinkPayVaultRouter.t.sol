// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { BlinkPayRouter } from "../src/BlinkPayRouter.sol";
import { BlinkPayTestnetVault } from "../src/BlinkPayTestnetVault.sol";
import { BlinkPayVaultRouter } from "../src/BlinkPayVaultRouter.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { MockAllowanceHolder, MockZeroExTarget } from "../src/MockZeroEx.sol";

interface VaultVm {
    function addr(uint256 privateKey) external returns (address);
    function expectRevert() external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
}

contract LimitedWithdrawVault is BlinkPayTestnetVault {
    uint256 public withdrawalLimit = type(uint256).max;

    constructor(address asset_) BlinkPayTestnetVault(asset_) { }

    function setWithdrawalLimit(uint256 newLimit) external {
        withdrawalLimit = newLimit;
    }

    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 standardMaximum = super.maxWithdraw(owner);
        return standardMaximum < withdrawalLimit ? standardMaximum : withdrawalLimit;
    }
}

contract BlinkPayVaultRouterTest {
    VaultVm private constant vm = VaultVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant MERCHANT_KEY = 0xA11CE;
    uint256 private constant STARTING_ASSETS = 1_000_000_000;
    uint256 private constant DEPOSIT_ASSETS = 500_000_000;
    uint256 private constant INVOICE_AMOUNT = 12_500_000;

    MockUSDC private settlementToken;
    MockUSDC private sellToken;
    MockAllowanceHolder private allowanceHolder;
    MockZeroExTarget private swapTarget;
    BlinkPayTestnetVault private vault;
    BlinkPayVaultRouter private router;
    address private merchant;
    address private payer;

    function setUp() public {
        settlementToken = new MockUSDC();
        sellToken = new MockUSDC();
        allowanceHolder = new MockAllowanceHolder();
        swapTarget = new MockZeroExTarget(allowanceHolder);
        vault = new BlinkPayTestnetVault(address(settlementToken));
        router = _deployRouter(address(vault));

        merchant = vm.addr(MERCHANT_KEY);
        payer = vm.addr(0xB0B);
        settlementToken.mint(payer, STARTING_ASSETS);

        vm.prank(payer);
        settlementToken.approve(address(vault), DEPOSIT_ASSETS);
        vm.prank(payer);
        vault.deposit(DEPOSIT_ASSETS, payer);
        vm.prank(payer);
        vault.approve(address(router), type(uint256).max);
    }

    function testRedeemsOnlyRequiredAssetsAndSettlesExactInvoice() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("vault-invoice-1");
        bytes memory signature = _sign(invoice);
        uint256 maximumShares = vault.previewWithdraw(INVOICE_AMOUNT);
        uint256 payerSharesBefore = vault.balanceOf(payer);
        uint256 vaultAssetsBefore = vault.totalAssets();

        vm.prank(payer);
        router.payFromVault(invoice, signature, maximumShares);

        require(router.paidInvoices(invoice.invoiceId), "invoice not marked paid");
        require(settlementToken.balanceOf(merchant) == INVOICE_AMOUNT, "merchant amount wrong");
        require(
            payerSharesBefore - vault.balanceOf(payer) == maximumShares,
            "unexpected shares redeemed"
        );
        require(vaultAssetsBefore - vault.totalAssets() == INVOICE_AMOUNT, "wrong asset redemption");
        require(settlementToken.balanceOf(address(router)) == 0, "router retained USDC");
        require(vault.balanceOf(address(router)) == 0, "router retained shares");
    }

    function testSharePriceChangeUsesPreviewWithdrawRounding() public {
        address donor = vm.addr(0xD0A0);
        settlementToken.mint(donor, 125_000_000);
        vm.prank(donor);
        settlementToken.transfer(address(vault), 125_000_000);

        uint256 maximumShares = vault.previewWithdraw(INVOICE_AMOUNT);
        require(maximumShares < INVOICE_AMOUNT, "donation did not raise share price");
        BlinkPayRouter.Invoice memory invoice = _validInvoice("vault-yield-invoice");
        bytes memory signature = _sign(invoice);

        vm.prank(payer);
        router.payFromVault(invoice, signature, maximumShares);

        require(settlementToken.balanceOf(merchant) == INVOICE_AMOUNT, "merchant not paid exactly");
    }

    function testRejectsMaximumShareCapBelowPreview() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("vault-cap-invoice");
        bytes memory signature = _sign(invoice);
        uint256 requiredShares = vault.previewWithdraw(INVOICE_AMOUNT);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPayVaultRouter.ShareLimitExceeded.selector, requiredShares - 1, requiredShares
            )
        );
        vm.prank(payer);
        router.payFromVault(invoice, signature, requiredShares - 1);

        _assertFailedPayment(invoice.invoiceId);
    }

    function testRejectsZeroMaximumShares() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("vault-zero-cap");
        bytes memory signature = _sign(invoice);

        vm.expectRevert(BlinkPayVaultRouter.InvalidMaxShares.selector);
        vm.prank(payer);
        router.payFromVault(invoice, signature, 0);

        _assertFailedPayment(invoice.invoiceId);
    }

    function testRejectsVaultMaxWithdrawBelowInvoice() public {
        LimitedWithdrawVault limitedVault = new LimitedWithdrawVault(address(settlementToken));
        BlinkPayVaultRouter limitedRouter = _deployRouter(address(limitedVault));
        uint256 limit = INVOICE_AMOUNT - 1;
        settlementToken.mint(payer, DEPOSIT_ASSETS);
        vm.prank(payer);
        settlementToken.approve(address(limitedVault), DEPOSIT_ASSETS);
        vm.prank(payer);
        limitedVault.deposit(DEPOSIT_ASSETS, payer);
        limitedVault.setWithdrawalLimit(limit);

        router = limitedRouter;
        BlinkPayRouter.Invoice memory invoice = _validInvoice("vault-liquidity-invoice");
        bytes memory signature = _sign(invoice);

        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPayVaultRouter.InsufficientVaultLiquidity.selector, INVOICE_AMOUNT, limit
            )
        );
        vm.prank(payer);
        limitedRouter.payFromVault(invoice, signature, type(uint256).max);

        require(!limitedRouter.paidInvoices(invoice.invoiceId), "failed invoice marked paid");
        require(settlementToken.balanceOf(merchant) == 0, "merchant balance changed");
    }

    function testMissingShareAllowanceRollsBackEverything() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("vault-allowance-invoice");
        bytes memory signature = _sign(invoice);
        uint256 maximumShares = vault.previewWithdraw(INVOICE_AMOUNT);
        uint256 sharesBefore = vault.balanceOf(payer);

        vm.prank(payer);
        vault.approve(address(router), 0);
        vm.expectRevert();
        vm.prank(payer);
        router.payFromVault(invoice, signature, maximumShares);

        require(vault.balanceOf(payer) == sharesBefore, "payer shares changed");
        _assertFailedPayment(invoice.invoiceId);
    }

    function testVaultPaymentSharesReplayProtectionWithDirectRoute() public {
        BlinkPayRouter.Invoice memory invoice = _validInvoice("vault-replay-invoice");
        bytes memory signature = _sign(invoice);
        uint256 maximumShares = vault.previewWithdraw(INVOICE_AMOUNT);

        vm.prank(payer);
        router.payFromVault(invoice, signature, maximumShares);

        vm.expectRevert(
            abi.encodeWithSelector(BlinkPayRouter.InvoiceAlreadyPaid.selector, invoice.invoiceId)
        );
        vm.prank(payer);
        router.payDirect(invoice, signature);
    }

    function testConstructorRejectsVaultWithWrongUnderlyingAsset() public {
        BlinkPayTestnetVault wrongVault = new BlinkPayTestnetVault(address(sellToken));
        vm.expectRevert(BlinkPayVaultRouter.InvalidVaultConfiguration.selector);
        _deployRouter(address(wrongVault));
    }

    function testConstructorRejectsNonContractVault() public {
        vm.expectRevert(BlinkPayVaultRouter.InvalidVaultConfiguration.selector);
        _deployRouter(address(0x1234));
    }

    function _deployRouter(address supportedVault) private returns (BlinkPayVaultRouter) {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = MockZeroExTarget.swapExactOutput.selector;
        return new BlinkPayVaultRouter(
            address(settlementToken),
            address(sellToken),
            address(swapTarget),
            address(allowanceHolder),
            selectors,
            supportedVault
        );
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
            nonce: 12,
            chainId: block.chainid,
            metadataHash: keccak256("Vault-funded work")
        });
    }

    function _sign(BlinkPayRouter.Invoice memory invoice) private returns (bytes memory) {
        bytes32 digest = router.invoiceDigest(invoice);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MERCHANT_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function _assertFailedPayment(bytes32 invoiceId) private view {
        require(!router.paidInvoices(invoiceId), "failed invoice marked paid");
        require(settlementToken.balanceOf(merchant) == 0, "merchant balance changed");
        require(settlementToken.balanceOf(address(router)) == 0, "router retained USDC");
    }
}
