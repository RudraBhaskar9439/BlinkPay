// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface ForkVm {
    function createSelectFork(string calldata urlOrAlias, uint256 blockNumber)
        external
        returns (uint256 forkId);
}

interface HardenedBlinkPayRouter {
    function settlementAsset() external view returns (address);
    function sellAsset() external view returns (address);
    function swapTarget() external view returns (address);
    function allowanceTarget() external view returns (address);
    function vaultAsset() external view returns (address);
    function allowedSwapSelectors(bytes4 selector) external view returns (bool);
    function paidInvoices(bytes32 invoiceId) external view returns (bool);
    function paymentsPaused() external view returns (bool);
}

contract BlinkPayMonadForkTest {
    ForkVm private constant vm = ForkVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant ACCEPTANCE_BLOCK = 44_982_723;
    address private constant ROUTER = 0x6054f7E75E07f5d127DceEA3b2D683959a51c9AA;
    address private constant USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;
    address private constant WMON = 0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541;
    address private constant POOL = 0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3;
    address private constant VAULT = 0xbb171586DE327A2c9BB2ea3A7D200B9A92fbeb89;
    address private constant PAYER = 0x76D7D56fb21A6969E1F07B722e3c63E2c80a7cB1;
    address private constant MERCHANT = 0xD1A199076f5BA0Da38E190D05D60A19a092061d2;
    bytes32 private constant ACCEPTED_INVOICE =
        0xe76a313ceda0bd16d477466976c7f67ce3bb8f5c7ebcc96f018eb502d8b40bd0;
    bytes4 private constant SWAP_SELECTOR = 0x95bfcde8;

    function testPinnedHardenedAcceptanceState() external {
        vm.createSelectFork("https://testnet-rpc.monad.xyz", ACCEPTANCE_BLOCK);

        HardenedBlinkPayRouter router = HardenedBlinkPayRouter(ROUTER);
        require(router.settlementAsset() == USDC, "unexpected settlement asset");
        require(router.sellAsset() == WMON, "unexpected sell asset");
        require(router.swapTarget() == POOL, "unexpected swap target");
        require(router.allowanceTarget() == POOL, "unexpected allowance target");
        require(router.vaultAsset() == VAULT, "unexpected vault");
        require(router.allowedSwapSelectors(SWAP_SELECTOR), "selector not allowed");
        require(!router.paymentsPaused(), "router unexpectedly paused");
        require(router.paidInvoices(ACCEPTED_INVOICE), "accepted invoice not recorded");

        require(IERC20(USDC).balanceOf(PAYER) == 0, "unexpected payer USDC");
        require(IERC20(USDC).balanceOf(MERCHANT) == 1_500_000, "unexpected merchant USDC");
        require(IERC20(USDC).balanceOf(VAULT) == 600_000, "unexpected vault assets");
        require(IERC4626(VAULT).balanceOf(PAYER) == 600_000, "unexpected payer shares");
        require(IERC20(USDC).balanceOf(ROUTER) == 0, "router retained USDC");
        require(IERC20(WMON).balanceOf(ROUTER) == 0, "router retained WMON");
        require(IERC4626(VAULT).balanceOf(ROUTER) == 0, "router retained shares");
    }
}
