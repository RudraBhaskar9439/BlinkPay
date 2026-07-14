# Phase 3 — Deterministic Route Engine

## Outcome

Phase 3A adds a deterministic planner that discovers the payer's supported
funding routes, evaluates hard constraints, estimates route costs, and exposes
the raw evidence used to rank the eligible plans. The planner never accepts
addresses or calldata from an AI model.

The implementation is complete. Phase 3B remains the manual wallet acceptance
gate: analyze fresh invoices with different live balances and confirm that the
displayed eligibility, rejection reasons, and ranking change reproducibly.

## Supported candidates

The first planner release generates two typed candidates:

1. Direct USDC settlement.
2. Exact-output WMON-to-USDC settlement through the allowlisted BlinkPay
   testnet pool.

Each `PaymentPlan` contains its funding asset, route kind, balance, allowance,
maximum spend, estimated spend, approval requirement, steps, simulation
result, constraint evidence, rejection reasons, cost components, status, and
rank.

## Live evidence

Clicking **Analyze wallet routes** reads the following state for the connected
payer on Monad testnet:

- native MON, USDC, and WMON balances;
- USDC and WMON allowances for the deployed BlinkPay router;
- the router's paid-invoice replay flag;
- invoice expiry and signed amount;
- a server-validated exact-output quote, including its deadline and maximum;
- pool reserves used to calculate the WMON swap-cost estimate; and
- an onchain gas preflight whenever the existing allowance permits a complete
  simulation.

When approval is still required, simulation is explicitly marked pending. The
payment flow performs the preflight immediately after approval and before the
wallet is asked to submit the settlement transaction.

## Constraints

The planner rejects a candidate when any hard constraint fails:

- invoice already paid;
- invoice expired;
- quote unavailable or stale;
- insufficient funding balance;
- quoted WMON maximum above the configured cap; or
- onchain simulation reverted.

Every failure includes a human-readable reason and its raw numeric or onchain
evidence. Quote/RPC failures leave the unaffected route available and make the
failed candidate recoverable through a fresh analysis.

## Deterministic ranking

Only eligible plans are ranked. The displayed score is:

```text
floor(estimated gas units / 10,000)
+ approval transactions * 10
+ swap cost in basis points
+ preference penalty
```

The default funding preference is USDC. A non-preferred route receives a
`1,000`-point penalty. An explicit future policy may choose WMON instead. The
lowest score wins; equal scores use the stable route ID as the tie-breaker.
There is no hidden model score.

This formula is intentionally simple for the testnet demo. It is auditable and
reproducible, but it does not yet convert gas to USDC or use an external price
oracle.

## Automated evidence

The planner test suite covers:

- identical input produces identical plans, scores, and order;
- insufficient USDC removes the direct candidate;
- a WMON maximum above policy removes the swap candidate;
- stale quotes are never executable;
- a reverted simulation makes the candidate unavailable;
- quote/RPC failure produces a recoverable unavailable swap candidate;
- explicit WMON preference changes ranking without changing eligibility; and
- a paid invoice rejects both candidates.

Repository typechecking, linting, unit tests, contract tests, and production
build are run through `pnpm check`.

## Browser evidence

The payment page was inspected with a fresh signed test invoice at desktop and
mobile widths. The deterministic planner and both payment routes render in the
accessibility tree, the mobile page scrolls through the complete route list,
and the browser console reports no errors. A wallet-enabled manual run is still
required because the isolated test browser has no injected EVM wallet.

## Phase 3B manual acceptance

For each case, create a fresh invoice and click **Analyze wallet routes** with
the payer wallet connected:

1. Payer has enough USDC and WMON: both routes are eligible and the displayed
   score selects the recommendation.
2. Payer has less USDC than the invoice: direct is unavailable and its balance
   evidence explains why.
3. Payer has less WMON than the quote maximum: WMON is unavailable and its
   balance evidence explains why.
4. Pay one invoice, then analyze its original link again: both routes are
   unavailable because the router reports it paid.

The exit gate passes when the same displayed inputs reproduce the same costs,
eligibility, and route order, with no unexplained score.
