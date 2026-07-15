// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/// @title BlinkPayTestnetVault
/// @notice Testnet-only ERC-4626 fixture used to exercise vault-funded payments.
/// @dev This contract is not an Euler vault and must never be presented as a production yield vault.
contract BlinkPayTestnetVault is ERC4626 {
    error InvalidVaultAsset();

    constructor(address asset_)
        ERC20("BlinkPay Testnet USDC Vault", "bpTEST-USDC")
        ERC4626(IERC20(asset_))
    {
        if (asset_ == address(0) || asset_.code.length == 0) revert InvalidVaultAsset();
    }
}
