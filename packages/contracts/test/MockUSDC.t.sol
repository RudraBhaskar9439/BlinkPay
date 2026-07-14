// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { MockUSDC } from "../src/MockUSDC.sol";

contract TokenSpender {
    function pull(MockUSDC token, address owner, address receiver, uint256 amount) external {
        token.transferFrom(owner, receiver, amount);
    }
}

contract MockUSDCTest {
    MockUSDC private token;
    TokenSpender private spender;
    address private constant RECEIVER = address(0xBEEF);

    function setUp() public {
        token = new MockUSDC();
        spender = new TokenSpender();
    }

    function testMetadataUsesUSDCDecimals() public view {
        require(token.decimals() == 6, "wrong decimals");
        require(keccak256(bytes(token.symbol())) == keccak256("mUSDC"), "wrong symbol");
    }

    function testMintAndTransfer() public {
        token.mint(address(this), 10_000_000);
        token.transfer(RECEIVER, 2_500_000);

        require(token.balanceOf(address(this)) == 7_500_000, "wrong sender balance");
        require(token.balanceOf(RECEIVER) == 2_500_000, "wrong receiver balance");
        require(token.totalSupply() == 10_000_000, "wrong supply");
    }

    function testApproveAndTransferFrom() public {
        token.mint(address(this), 4_000_000);
        token.approve(address(spender), 1_500_000);
        spender.pull(token, address(this), RECEIVER, 1_500_000);

        require(token.balanceOf(RECEIVER) == 1_500_000, "pull failed");
        require(token.allowance(address(this), address(spender)) == 0, "allowance not spent");
    }

    function testTransferRejectsInsufficientBalance() public {
        (bool success,) = address(token).call(abi.encodeCall(MockUSDC.transfer, (RECEIVER, 1)));
        require(!success, "transfer should revert");
    }
}
