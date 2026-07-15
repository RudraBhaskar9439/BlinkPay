# Phase 3 — Deterministic Route Engine

## Outcome

Phase 3A adds a deterministic planner that discovers the payer's supported
funding routes, evaluates hard constraints, estimates route costs, and exposes
the raw evidence used to rank the eligible plans. The planner never accepts
addresses or calldata from an AI model.

Phase 3A implementation and the Phase 3B live wallet acceptance matrix are
complete. Fresh invoices with different amounts changed eligibility, rejection
reasons, and ranking reproducibly from the displayed balances and quote data.

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
and the browser console reports no errors. The separate MetaMask acceptance
matrix below supplied the wallet-enabled evidence unavailable in the isolated
test browser.

## Phase 3B manual acceptance

The matrix passed on Monad testnet on July 15, 2026 with payer
`0x76D7D56fb21A6969E1F07B722e3c63E2c80a7cB1`:

1. **0.1 USDC invoice, both assets sufficient.** Direct USDC ranked first with
   score `28`. WMON exact output ranked second with a `0.001039017113929055`
   WMON maximum, `132` bps swap cost, and score `1188`.
2. **1 USDC invoice, USDC insufficient.** The `0.9` USDC balance rejected the
   direct route. WMON remained eligible with a `0.011440862602814306` maximum
   and became the only recommendation.
3. **4 USDC invoice, both assets insufficient.** Direct rejected `0.9 < 4`
   USDC. WMON rejected balance `0.048986859568604804` below maximum
   `0.069033001467828689`. Neither route was recommended, and both payment
   actions were disabled.
4. **Paid-invoice replay.** A fresh `0.1` USDC direct payment reduced the live
   payer balance from `0.9` to `0.8` USDC. Re-analysis of the same signed link
   read the router's paid flag, rejected both routes, and disabled both payment
   actions.

Testing also exposed and fixed two presentation defects before the gate closed:
unavailable routes no longer leave payment buttons enabled, and terminal
invoice states no longer report unevaluated quote dependencies as secondary
failures. Dependent checks are marked pending/not applicable, and unavailable
plans are not ranked.

The same displayed inputs now reproduce the same eligibility, costs, and route
order with no unexplained model score. Phase 3 passes its exit gate.
