// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { BlinkPaySwapRouter } from "../src/BlinkPaySwapRouter.sol";
import { BlinkPayTestnetPool } from "../src/BlinkPayTestnetPool.sol";

interface ScriptVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice Deploys the testnet-only pool and its paired BlinkPay router.
/// @dev Run with Monad testnet RPC and an encrypted Foundry account.
contract DeployTestnet {
    ScriptVm private constant vm =
        ScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant CIRCLE_TESTNET_USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;
    address private constant TESTNET_WMON = 0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541;
    uint256 private constant FEE_BPS = 30;

    event TestnetDeployment(address indexed pool, address indexed router);

    function run() external returns (BlinkPayTestnetPool pool, BlinkPaySwapRouter router) {
        vm.startBroadcast();

        pool = new BlinkPayTestnetPool(TESTNET_WMON, CIRCLE_TESTNET_USDC, FEE_BPS);
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = BlinkPayTestnetPool.swapExactOutput.selector;
        router = new BlinkPaySwapRouter(
            CIRCLE_TESTNET_USDC, TESTNET_WMON, address(pool), address(pool), selectors
        );

        emit TestnetDeployment(address(pool), address(router));
        vm.stopBroadcast();
    }
}
