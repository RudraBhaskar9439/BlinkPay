// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { BlinkPayTestnetPool } from "../src/BlinkPayTestnetPool.sol";
import { BlinkPayTestnetVault } from "../src/BlinkPayTestnetVault.sol";
import { BlinkPayVaultRouter } from "../src/BlinkPayVaultRouter.sol";

interface VaultRouteScriptVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploys the Phase 5 testnet vault and combined three-route router.
/// @dev Reuses the already funded BlinkPay testnet pool. The vault is a labelled test fixture.
contract DeployVaultRoute {
    VaultRouteScriptVm private constant vm =
        VaultRouteScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant CIRCLE_TESTNET_USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;
    address private constant TESTNET_WMON = 0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541;
    address private constant BLINKPAY_TESTNET_POOL = 0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3;

    event VaultRouteDeployment(address indexed vault, address indexed router, address indexed pool);

    function run() external returns (BlinkPayTestnetVault vault, BlinkPayVaultRouter router) {
        vm.startBroadcast();

        vault = new BlinkPayTestnetVault(CIRCLE_TESTNET_USDC);
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = BlinkPayTestnetPool.swapExactOutput.selector;
        router = new BlinkPayVaultRouter(
            CIRCLE_TESTNET_USDC,
            TESTNET_WMON,
            BLINKPAY_TESTNET_POOL,
            BLINKPAY_TESTNET_POOL,
            selectors,
            address(vault)
        );

        emit VaultRouteDeployment(address(vault), address(router), BLINKPAY_TESTNET_POOL);
        vm.stopBroadcast();
    }
}
