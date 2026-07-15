# Phase 2 exact-output WMON payment report

Implementation checkpoint: July 15, 2026

## Outcome

BlinkPay now has a locally verified exact-output swap route. A payer can request
a server-side 0x Exact Buy quote for WMON, approve a hard maximum to the
BlinkPay router, and execute one atomic transaction in which the merchant must
receive exactly the signed invoice's USDC amount. Unspent WMON is returned to
the payer and every failure rolls back the invoice flag and all token movement.

This is the Phase 2 implementation checkpoint, not the live exit gate. A 0x API
key, a deployment-matched current swap target/selector allowlist, a Monad fork
test, and a small live WMON payment are still required.

## Current integration evidence

- 0x Swap API lists Monad mainnet chain ID `143` as supported.
- 0x documents Exact Buy through the `buyAmount` parameter and returns
  `maxSellAmount` for the payer's hard cap.
- canonical Monad WMON at
  `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` has live bytecode and reports
  symbol `WMON` with 18 decimals.
- 0x AllowanceHolder at
  `0x0000000000001fF3684f28c67538d4D072C22734` has live Monad bytecode.

Primary references:

- https://docs.0x.org/docs/introduction/supported-chains
- https://docs.0x.org/docs/introduction/faq
- https://docs.0x.org/docs/0x-swap-api/guides/swap-tokens-with-0x-swap-api
- https://docs.0x.org/docs/0x-swap-api/additional-topics/how-to-set-your-token-allowances

## Delivered

### Atomic swap router

- `BlinkPaySwapRouter` extends the direct-payment router, so both routes share
  invoice validation and replay protection.
- immutable settlement token, WMON sell token, swap target, and allowance
  target per deployment
- constructor-fixed selector allowlist
- exact signed invoice output enforced against the router and merchant balance
  deltas
- payer-controlled `maxSellAmount`
- quote deadline bounded by the invoice expiry
- transient router-to-AllowanceHolder approval cleared after execution
- same-transaction refund of all unused WMON from this payment
- no native MON value forwarded to aggregator calldata
- `PaymentSettled` plus `SwapPaymentSettled` receipt events
- full rollback when the quote fails, underpays, redirects output, is stale, or
  contains an unapproved selector

### Server-only 0x boundary

- exact-buy request uses `buyAmount` equal to the signed USDC invoice amount
- router is both quote taker and recipient; payer is `txOrigin`
- API key exists only in a server route header
- quote parser validates sell token, buy token, output amount, maximum input,
  allowance target, swap target, calldata selector, and zero native value
- only sanitized executable fields reach the browser
- missing configuration and malformed requests produce deterministic JSON
  errors

### Payer experience

- direct USDC and exact-buy WMON appear as distinct routes
- WMON is a two-stage flow: get a live quote, then explicitly confirm payment
- estimated and maximum WMON spend are shown separately
- payer approves the BlinkPay router, never the 0x Settler
- approval is limited to the displayed quote maximum
- stale quotes are rejected before payment submission
- successful payment links to the Monad transaction receipt

## Automated gate evidence

```text
pnpm lint                 PASS
pnpm typecheck            PASS
pnpm test                 PASS — 16 TypeScript tests
pnpm build                PASS — includes POST /api/quote
pnpm contracts:fmt        PASS
pnpm contracts:test       PASS — 28 Solidity tests
```

The 13 swap-router tests cover:

- exact merchant output, actual input spend, and refund
- transient allowance cleanup
- zero maximum input
- stale quote and quote deadline beyond invoice expiry
- malformed calldata and unapproved selector
- aggregator failure rollback
- aggregator attempts to exceed the maximum input
- underpayment rollback
- redirected-output attack rollback
- insufficient payer allowance rollback
- replay protection shared between direct and swap routes
- invalid constructor selector configuration

The eight 0x quote tests cover:

- valid allowlisted exact-buy parsing
- changed output rejection
- unapproved spender, target, and selector rejection
- unexpected native-value rejection
- unavailable-liquidity rejection
- server-header-only API key handling
- sanitized deterministic API failures

## Manual acceptance evidence

- payer page displays the signed five-USDC fixture correctly
- direct USDC and WMON route cards render together without horizontal overflow
  at the tested browser width
- the WMON action fails visibly and safely when deployment configuration is
  absent
- invalid quote JSON returns HTTP 400
- missing deployment configuration returns HTTP 503

No live price, transaction, or success state was fabricated.

## Remaining live gate

1. Complete Phase 1B deployment and direct two-wallet payment.
2. Create a server-only 0x API key.
3. Obtain a fresh Monad WMON-to-USDC exact-buy probe quote.
4. independently verify its AllowanceHolder, swap target bytecode, and selector.
5. deploy `BlinkPaySwapRouter` with exactly that fixed configuration.
6. configure the server and hosted UI with the same values.
7. run the contract tests against a current Monad fork and live 0x calldata.
8. pay a small invoice from WMON and record maximum, actual spend, refund,
   merchant USDC delta, events, and explorer receipt.
9. prove a deliberately expired/failed route leaves every balance unchanged.

Only after these steps may the Phase 2 exit gate be marked complete.
