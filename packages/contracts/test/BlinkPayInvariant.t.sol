// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { BlinkPayRouter } from "../src/BlinkPayRouter.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

interface InvariantVm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
}

contract DirectPaymentHandler {
    InvariantVm private constant vm =
        InvariantVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant MERCHANT_KEY = 0xA11CE;
    uint256 private constant MAX_PAYMENT = 1_000_000_000;

    MockUSDC public immutable token;
    BlinkPayRouter public immutable router;
    address public immutable merchant;
    uint256 public totalSettled;
    uint256 public paymentCount;

    constructor(
        MockUSDC configuredToken,
        BlinkPayRouter configuredRouter,
        address merchantAddress
    ) {
        token = configuredToken;
        router = configuredRouter;
        merchant = merchantAddress;
        token.approve(address(router), type(uint256).max);
    }

    function pay(uint256 entropy) external {
        uint256 amount = entropy % MAX_PAYMENT + 1;
        uint256 nonce = ++paymentCount;
        BlinkPayRouter.Invoice memory invoice = BlinkPayRouter.Invoice({
            invoiceId: keccak256(abi.encode("invariant-payment", nonce)),
            merchant: merchant,
            settlementToken: address(token),
            amount: amount,
            expiry: block.timestamp + 1 hours,
            nonce: nonce,
            chainId: block.chainid,
            metadataHash: keccak256("Invariant settlement")
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MERCHANT_KEY, router.invoiceDigest(invoice));
        router.payDirect(invoice, abi.encodePacked(r, s, v));
        totalSettled += amount;
    }
}

contract BlinkPayInvariantTest {
    InvariantVm private constant vm =
        InvariantVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant STARTING_BALANCE = 1_000_000_000_000_000;

    MockUSDC private token;
    BlinkPayRouter private router;
    DirectPaymentHandler private handler;
    address private merchant;
    address[] private targets;

    function setUp() public {
        token = new MockUSDC();
        router = new BlinkPayRouter(address(token));
        merchant = vm.addr(0xA11CE);
        handler = new DirectPaymentHandler(token, router, merchant);
        token.mint(address(handler), STARTING_BALANCE);
        targets.push(address(handler));
    }

    function targetContracts() external view returns (address[] memory) {
        return targets;
    }

    function invariantMerchantReceivesExactlyRecordedSettlement() public view {
        require(token.balanceOf(merchant) == handler.totalSettled(), "merchant accounting drift");
    }

    function invariantPayerDebitEqualsMerchantCredit() public view {
        require(
            token.balanceOf(address(handler)) + handler.totalSettled() == STARTING_BALANCE,
            "payer and merchant deltas diverged"
        );
    }

    function invariantRouterNeverCustodiesDirectSettlement() public view {
        require(token.balanceOf(address(router)) == 0, "router retained direct USDC");
    }
}
