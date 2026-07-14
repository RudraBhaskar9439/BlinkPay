// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { BlinkPaySplitRouter } from "../src/BlinkPaySplitRouter.sol";
import { BlinkPayTestnetPool } from "../src/BlinkPayTestnetPool.sol";

interface SplitRouteScriptVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploys the Phase 6 five-route router against the funded pool and vault.
contract DeploySplitRoute {
    SplitRouteScriptVm private constant vm =
        SplitRouteScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant CIRCLE_TESTNET_USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;
    address private constant TESTNET_WMON = 0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541;
    address private constant BLINKPAY_TESTNET_POOL = 0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3;
    address private constant BLINKPAY_TESTNET_VAULT = 0xbb171586DE327A2c9BB2ea3A7D200B9A92fbeb89;

    event SplitRouteDeployment(address indexed router, address indexed vault, address indexed pool);

    function run() external returns (BlinkPaySplitRouter router) {
        vm.startBroadcast();

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = BlinkPayTestnetPool.swapExactOutput.selector;
        router = new BlinkPaySplitRouter(
            CIRCLE_TESTNET_USDC,
            TESTNET_WMON,
            BLINKPAY_TESTNET_POOL,
            BLINKPAY_TESTNET_POOL,
            selectors,
            BLINKPAY_TESTNET_VAULT
        );

        emit SplitRouteDeployment(address(router), BLINKPAY_TESTNET_VAULT, BLINKPAY_TESTNET_POOL);
        vm.stopBroadcast();
    }
}
