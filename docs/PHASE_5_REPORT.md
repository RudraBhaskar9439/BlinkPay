# Phase 5 — ERC-4626 Vault Payment

## Outcome

Phase 5A and Phase 5B are complete. BlinkPay can discover one immutable,
allowlisted ERC-4626 position, prove its underlying asset and immediate
liquidity, rank it beside direct USDC and exact-output WMON, and atomically
redeem only the USDC required by a merchant-signed invoice.

The contracts and funded payer position are live on Monad testnet. Phase 5C is
the remaining manual gate: the payer must approve the vault shares in MetaMask
and sign one `0.1 USDC` vault-funded payment through the checkout.

## Testnet target decision

Euler vaults are ERC-4626-compatible positions, but a production integration
must start from a chain-specific verified vault list. Euler's official
[`euler-labels`](https://github.com/euler-xyz/euler-labels) repository contains
a Monad mainnet (`143`) directory and no Monad testnet (`10143`) directory as
of July 15, 2026. BlinkPay therefore does not present a Monad mainnet Euler
vault as testnet infrastructure.

The live gate uses `BlinkPayTestnetVault`, a minimal OpenZeppelin ERC-4626
fixture backed by canonical Monad testnet USDC. Its contract name, token name,
documentation, and UI all identify it as testnet-only and not an Euler vault.
The router depends only on the standard ERC-4626 interface, so the same route
can be configured with a reviewed production vault later.

## Atomic contract route

`BlinkPayVaultRouter` extends the existing direct and exact-output router, so
all three routes share one EIP-712 verifying contract and one invoice replay
mapping. Its constructor accepts exactly one vault and rejects it unless:

- the vault address contains bytecode; and
- `vault.asset()` equals the immutable settlement USDC.

For each payment, `payFromVault` enforces:

- a valid, unexpired merchant signature and unpaid invoice;
- nonzero payer `maxShares`;
- `maxWithdraw(payer) >= invoice.amount`;
- `previewWithdraw(invoice.amount) <= maxShares` before redemption;
- the observed share burn equals the vault's reported share burn;
- the observed share burn remains below the payer cap;
- the router receives exactly the invoice USDC amount; and
- the merchant balance increases by exactly that amount.

The paid flag is written before the external vault call but remains atomic: any
allowance, liquidity, share-cap, redemption, or settlement failure reverts the
flag and every balance change.

## Deterministic planner and checkout

The planner now emits `direct-usdc`, `swap-wmon`, and `vault-usdc` candidates.
The vault plan displays raw evidence for:

- router/vault allowlist equality and bytecode;
- underlying settlement-token equality;
- live share balance and allowance;
- `convertToAssets` position value;
- live `maxWithdraw` liquidity;
- current `previewWithdraw` shares;
- a 50-basis-point protected maximum-share cap; and
- onchain payment simulation or its pending-approval state.

The route is unavailable if any hard constraint fails, and its payment button
uses the same status. At execution time the checkout reads every fact again,
approves only the displayed maximum shares when required, simulates
`payFromVault`, and then asks the wallet to sign.

## Automated evidence

The vault contract suite contains nine focused tests covering:

- exact asset redemption and merchant settlement;
- share-price changes and `previewWithdraw` rounding;
- payer maximum-share caps;
- zero share caps;
- insufficient `maxWithdraw` liquidity;
- missing share allowance and atomic rollback;
- replay protection shared with the direct route;
- wrong-underlying vault rejection; and
- non-contract vault rejection.

The planner suite contains fourteen tests, including vault selection when
wallet routes are unavailable, insufficient liquidity, allowlist/asset
failure, and a protected maximum below the current preview.

The complete checkpoint passed:

```text
pnpm lint
pnpm typecheck
pnpm test       # 49 passed
pnpm build
forge fmt --check
forge test      # 43 passed
```

## Live Monad testnet evidence

Deployment configuration:

| Component | Address |
| --- | --- |
| Canonical testnet USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| Canonical testnet WMON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |
| Existing funded BlinkPay pool | `0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3` |
| Testnet ERC-4626 vault | `0xbb171586DE327A2c9BB2ea3A7D200B9A92fbeb89` |
| Three-route router | `0x029a2AE62021A11E1b2F13a386F89762eC15C915` |

Deployment transactions:

- [Deploy testnet vault](https://testnet.monadscan.com/tx/0x11a8ededb9eda1611737afeb50a5414b6ebf4c7bef6573a9dea0898fba0e4213)
- [Deploy three-route router](https://testnet.monadscan.com/tx/0xcd8b15665831eaa003579d0371b4fc65a3ebdd7036a7eb8b1c87591737191516)
- [Approve vault seed](https://testnet.monadscan.com/tx/0xf45ba29f118b4298773c4e73ef138d06a083ff86b897fb33ee189a405c58902f)
- [Deposit 1 USDC for payer shares](https://testnet.monadscan.com/tx/0xe124a08772ea89fc9c6247f1624f3cc70f95faf3d5da78d32e394b31d3e3fe76)

Independent live reads confirmed:

- both new addresses contain bytecode;
- router `vaultAsset()` equals the recorded vault;
- vault `asset()` and router `settlementAsset()` equal canonical testnet USDC;
- router `swapTarget()` remains the existing funded testnet pool;
- payer owns `1,000,000` vault shares worth `1,000,000` USDC base units;
- payer `maxWithdraw` is `1,000,000` USDC base units;
- `previewWithdraw(100,000)` is `100,000` shares; and
- the current router share allowance is zero, intentionally exercising the UI
  approval step.

The local production build and signed-invoice checkout render all three routes
without browser console errors. The live quote endpoint also returned a fresh
WMON alternative for the same `0.1 USDC` invoice, proving the new router did not
break the existing swap route.

## Remaining manual acceptance

1. In the normal browser with MetaMask, create a fresh `0.1 USDC` invoice after
   the new router configuration is loaded.
2. Open its payment link with the payer wallet
   `0x76D7D56fb21A6969E1F07B722e3c63E2c80a7cB1`.
3. Select **Analyze wallet routes** and confirm the vault position displays
   `1.0 USDC`, the vault route is eligible, and its preview/cap are visible.
4. Select **Pay from vault**, approve only the displayed share maximum, and
   sign the payment.
5. Record the receipt and independently verify merchant USDC delta, payer share
   delta, remaining position, zero router residuals, event fields, and replay
   rejection.

Phase 5 passes its exit gate only after that final wallet-signed receipt is
recorded.
