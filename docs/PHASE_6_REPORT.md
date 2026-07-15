# Phase 6 report — atomic split routes

Phase 6 passed its automated and live Monad testnet gates on July 15, 2026.

## Outcome

BlinkPay can now settle one signed exact-USDC invoice from two payer-controlled
sources in one atomic router call:

- direct wallet USDC plus an exact ERC-4626 withdrawal; or
- direct wallet USDC plus an exact-output WMON swap.

The deterministic planner calculates the direct contribution from spendable
USDC after preserving the configured reserve. The secondary leg is always the
exact remaining invoice shortfall. A split is not offered when either leg
would be zero.

## Contract invariants

`BlinkPaySplitRouter` enforces the following properties:

1. The direct amount is nonzero and strictly smaller than the invoice amount.
2. The vault or swap output equals `invoice.amount - directAmount`.
3. The merchant receives the signed invoice amount exactly.
4. The vault share cap or WMON maximum is enforced onchain.
5. The shared invoice ID is marked paid only when the complete call succeeds.
6. A failure in either funding leg rolls back the direct transfer, secondary
   transfer, merchant settlement, and replay state.
7. The router retains no settlement tokens, sell tokens, or vault shares after
   successful execution.

## Automated evidence

- 52 Solidity tests pass, including nine split-specific settlement, rollback,
  cap, allowance, incorrect-output, and replay tests.
- 18 deterministic planner tests pass, including reserve-aware contribution,
  exact-shortfall quote validation, and redundant-split rejection.
- 53 TypeScript package tests pass across chain, core, planner, policy, and 0x
  packages.
- ESLint, TypeScript, the production Next.js build, and `forge fmt --check`
  pass.

## Monad testnet deployment

| Component | Address |
| --- | --- |
| Phase 6 five-route router | `0x7d6cECbDfD0359887e34ce89c15a313f37c1Fa1B` |
| Testnet ERC-4626 vault | `0xbb171586DE327A2c9BB2ea3A7D200B9A92fbeb89` |
| Testnet exact-output pool | `0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3` |
| Circle testnet USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| WMON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |

Router deployment transaction:
`0xe57eb5e9b6f1903b5d32481c57a0e7bd9e6e9a4da5d54d0e369c44dc52fefb2d`.

The deployed router's immutable settlement asset, sell asset, swap target,
allowance target, vault, and allowed selector were checked against the
version-controlled configuration before the live gate.

## Live atomic split acceptance

Transaction:
`0xc6af11ffcf78c61575832936db84bdfb1c05fe456f2a4e93b6463286e286a4a2`

- Block: `44974526`
- Status: success
- Payer: `0x76D7D56fb21A6969E1F07B722e3c63E2c80a7cB1`
- Merchant: `0xD1A199076f5BA0Da38E190D05D60A19a092061d2`
- Invoice ID:
  `0xda0610eec6ef16f77a4b907f113d2c075f5590fd8d53697ac22a80228bff1e4d`
- Signed invoice amount: `1.0 USDC`
- Direct contribution: `0.8 USDC`
- Vault shortfall: `0.2 USDC`
- Protected vault maximum: `0.201 shares`
- Actual shares redeemed: `0.2 shares`
- Gas used: `302441`

### Independently queried balance deltas

The following values were read at blocks `44974525` and `44974526`:

| State | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Payer wallet USDC | 0.8 | 0 | -0.8 |
| Payer vault shares | 0.9 | 0.7 | -0.2 |
| Vault assets | 0.9 USDC | 0.7 USDC | -0.2 USDC |
| Merchant USDC | 0.4 | 1.4 | +1.0 |
| Router USDC | 0 | 0 | 0 |
| Router vault shares | 0 | 0 | 0 |
| Payer USDC allowance | 0.8 | 0 | -0.8 |
| Payer vault allowance | 0.201 | 0.001 | -0.2 |

The receipt contains both `PaymentSettled` and `DirectVaultSplitSettled`. The
split event records `800000` direct units, `200000` vault units, a `201000`
maximum, and `200000` shares redeemed.

Calling the router again with the identical transaction calldata reverts with
`InvoiceAlreadyPaid(invoiceId)`, confirming shared replay protection.

## Known limitations

- Token approvals are separate wallet transactions before the single atomic
  payment transaction.
- The testnet vault and pool are controlled BlinkPay fixtures, not production
  DeFi liquidity.
- The direct-plus-vault route completed the live gate. The direct-plus-WMON
  route is covered by contract tests, live quotes, planner evidence, and
  simulation, but has not yet been used for a second live split receipt.
- Phase 7 still needs fuzz/invariant expansion, source verification, security
  review, approval hardening, and browser E2E coverage.

