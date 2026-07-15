// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { BlinkPayTestnetPool } from "../src/BlinkPayTestnetPool.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

interface PoolVm {
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
}

contract BlinkPayTestnetPoolTest {
    PoolVm private constant vm = PoolVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant SELL_RESERVE = 1_000_000_000;
    uint256 private constant SETTLEMENT_RESERVE = 2_000_000_000;
    uint256 private constant BUY_AMOUNT = 10_000_000;

    MockUSDC private sellToken;
    MockUSDC private settlementToken;
    BlinkPayTestnetPool private pool;
    address private payer = address(0xB0B);

    function setUp() public {
        sellToken = new MockUSDC();
        settlementToken = new MockUSDC();
        pool = new BlinkPayTestnetPool(address(sellToken), address(settlementToken), 30);

        sellToken.mint(address(pool), SELL_RESERVE);
        settlementToken.mint(address(pool), SETTLEMENT_RESERVE);
        sellToken.mint(payer, SELL_RESERVE);
        vm.prank(payer);
        sellToken.approve(address(pool), type(uint256).max);
    }

    function testQuoteUsesConstantProductAndFee() public view {
        uint256 expected =
            (SELL_RESERVE * BUY_AMOUNT * 10_000) / ((SETTLEMENT_RESERVE - BUY_AMOUNT) * 9_970) + 1;
        require(pool.quoteExactOutput(BUY_AMOUNT) == expected, "quote mismatch");
    }

    function testSwapsForExactOutput() public {
        uint256 quoted = pool.quoteExactOutput(BUY_AMOUNT);

        vm.prank(payer);
        uint256 spent = pool.swapExactOutput(quoted, BUY_AMOUNT, payer);

        require(spent == quoted, "wrong spend");
        require(settlementToken.balanceOf(payer) == BUY_AMOUNT, "output not exact");
        require(sellToken.balanceOf(payer) == SELL_RESERVE - quoted, "input balance wrong");
        require(sellToken.balanceOf(address(pool)) == SELL_RESERVE + quoted, "reserve not updated");
    }

    function testRejectsQuoteAtOrAboveReserve() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPayTestnetPool.InsufficientLiquidity.selector,
                SETTLEMENT_RESERVE,
                SETTLEMENT_RESERVE
            )
        );
        pool.quoteExactOutput(SETTLEMENT_RESERVE);
    }

    function testRejectsSpendAbovePayerMaximum() public {
        uint256 quoted = pool.quoteExactOutput(BUY_AMOUNT);
        vm.expectRevert(
            abi.encodeWithSelector(
                BlinkPayTestnetPool.MaximumSellExceeded.selector, quoted - 1, quoted
            )
        );
        vm.prank(payer);
        pool.swapExactOutput(quoted - 1, BUY_AMOUNT, payer);
    }

    function testOnlyOwnerCanWithdrawLiquidity() public {
        vm.expectRevert(BlinkPayTestnetPool.NotOwner.selector);
        vm.prank(payer);
        pool.withdraw(address(settlementToken), payer, BUY_AMOUNT);

        pool.withdraw(address(settlementToken), payer, BUY_AMOUNT);
        require(settlementToken.balanceOf(payer) == BUY_AMOUNT, "withdraw failed");
    }
}
