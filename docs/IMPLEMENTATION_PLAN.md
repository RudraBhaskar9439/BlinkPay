# BlinkPay implementation plan

## 1. Scope and success condition

BlinkPay succeeds when a merchant can request an exact USDC amount and a payer
can settle it on Monad using one of several real funding routes selected under
the payer's preferences.

The hackathon-critical path is:

`signed invoice -> direct pay -> exact-output swap -> route engine -> AI policy
compiler -> ERC-4626 withdrawal -> split route -> security and demo`

Borrowing, automatic delegated payments, cross-chain funding, and fiat card
rails are stretch or post-hackathon work. They must never delay the critical
path.

## 2. Non-negotiable engineering rules

1. Every phase has automated checks, a manual acceptance test, and an exit
   gate.
2. We do not advance while an exit gate is red.
3. Every displayed balance, quote, simulation, transaction, and receipt comes
   from a live RPC or a clearly labelled local test fixture.
4. The LLM may translate language into a typed policy. It may not choose
   contract addresses, construct arbitrary calldata, hold keys, or execute a
   transaction.
5. All third-party contracts and token addresses are chain-specific and
   allowlisted.
6. Mainnet transactions use small amounts until the contracts have been
   reviewed and tested on a fork.
7. The hackathon build runs on Monad testnet by default. Its testnet-only pool
   is labelled as such and is never represented as 0x or production liquidity.
8. Each completed phase ends with a tagged checkpoint or clearly named commit.

## 3. Planned repository layout

```text
BlinkPay/
  apps/
    web/                 Next.js payer and merchant app
  packages/
    contracts/           Foundry project and Solidity contracts
    planner/             Candidate generation, constraints, scoring
    chain/               Viem clients, addresses, token metadata
    ui/                  Shared UI primitives if needed
  docs/
    IMPLEMENTATION_PLAN.md
    ARCHITECTURE.md
    SECURITY.md
    DEMO.md
  .github/workflows/     CI
```

We will add directories only when their phase begins; empty architecture is not
progress.

## Phase 0 — Foundation and reproducible toolchains

### Goal

Create a clean monorepo that anyone can install, test, and run from the public
README.

### Implement

- `pnpm` workspace and pinned Node version
- Next.js/TypeScript web application
- Foundry Solidity project
- shared Monad chain configuration
- environment-variable template with no secrets
- linting, formatting, unit-test, contract-test, and build commands
- GitHub Actions for the same commands
- local mock USDC used only by contract tests

### Automated tests

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
forge fmt --check
forge test
```

### Manual acceptance test

- Start the web app from a fresh install.
- Open it without browser console errors.
- Read the latest Monad block number from the configured RPC.
- Confirm no private key or API key is committed.

### Exit gate

All local commands pass and CI is green on `main`.

## Phase 1 — Signed invoice and direct USDC settlement

### Goal

Prove the smallest complete product: merchant invoice to exact onchain receipt.

### Implement

- EIP-712 `Invoice` structure containing invoice ID, merchant, settlement
  token, amount, expiry, nonce, chain ID, and metadata hash
- merchant invoice creator and QR/payment link
- `BlinkPayRouter.payDirect`
- signature, expiry, token, amount, and replay validation
- exact USDC transfer and `PaymentSettled` event
- receipt page linked to a block explorer

### Contract tests

- valid invoice settles once
- invalid merchant signature reverts
- expired invoice reverts
- wrong chain, token, merchant, or amount reverts
- replay of the same invoice reverts
- insufficient allowance and balance revert
- receipt fields exactly match the invoice and payer

### Manual acceptance test

Use two wallets. Wallet A creates a small invoice; Wallet B pays it. Verify the
merchant's real USDC balance delta, the event, and the explorer link.

### Exit gate

One real end-to-end direct payment works from the hosted UI with no hardcoded
success state.

## Phase 2 — Exact-output token swap payment

### Goal

Let a payer spend a supported token while the merchant receives exactly the
invoice's USDC amount.

### Implement

- 0x Exact Buy quote service with `buyAmount` and merchant recipient
- support for one deeply liquid source token first, preferably WMON
- fixed/allowlisted 0x target and allowance contracts
- `maxSellAmount`, quote deadline, refund, and merchant balance-delta checks
- deterministic fallback error when no executable quote exists
- optional Uniswap V3 exact-output fallback only after the 0x path works

### Contract and integration tests

- merchant receives the exact invoice amount
- payer never spends above `maxSellAmount`
- unused input is refunded
- expired quote reverts
- wrong recipient, settlement token, target, or selector reverts
- malicious or malformed aggregator calldata cannot retain payer funds
- fork test executes against current Monad contracts and liquidity

### Manual acceptance test

Pay a small USDC invoice using WMON or another verified source token. Compare
the quoted maximum with the actual spend and verify the refund and receipt.

### Exit gate

Direct and swap routes both settle real invoices, and a failed swap leaves all
balances unchanged.

## Phase 3 — Portfolio discovery and deterministic route engine

### Goal

Generate, simulate, explain, and rank plans without using an LLM to make
financial or execution decisions.

### Implement

- live wallet balances and allowances
- typed `PaymentPlan`, `RouteStep`, `Constraint`, and `SimulationResult`
- candidates for direct pay and exact-output swap
- preflight `eth_call` simulation
- cost model: gas, swap cost, price impact, and preference penalties
- human-readable rejection reasons
- route comparison UI with raw evidence available

### Tests

- same inputs always produce the same eligible candidates and order
- insufficient balances eliminate a plan
- max-spend/slippage/deadline constraints reject violating plans
- stale quotes are never presented as executable
- simulation failure marks the plan unavailable
- RPC and quote failures produce recoverable UI states

### Manual acceptance test

Change wallet balances and invoice size, refresh, and confirm that available
plans and rejection reasons change using live data.

### Exit gate

The recommended route can be reproduced from the displayed costs and rules;
there is no unexplained AI score.

## Phase 4 — AI preference compiler

### Goal

Convert natural-language preferences into a strict policy consumed by the
deterministic route engine.

### Implement

- versioned JSON schema for policy output
- examples such as preserve MON, keep a USDC reserve, forbid borrowing, cap
  total cost, and prefer idle stablecoins
- schema validation and normalization
- prompt-injection-resistant separation between preferences and executable
  configuration
- deterministic default policy and graceful AI fallback
- explanation showing which policy rule accepted or rejected each route

### Tests

- representative phrases compile to expected policies
- contradictory preferences return a clarification/error state
- unknown tokens and out-of-range values are rejected
- prompt injection cannot alter addresses, chain configuration, or calldata
- malformed model output cannot reach the planner
- application remains usable when the AI provider is unavailable

### Manual acceptance test

Run the same invoice with “preserve MON” and then “preserve USDC.” Confirm that
the candidate facts remain the same but the eligible/recommended plan changes
for a visible reason.

### Exit gate

AI output can influence only documented policy fields, and every onchain
transaction still requires user review and signature.

## Phase 5 — ERC-4626 yield-position payment

### Goal

Redeem only the amount needed from one verified Monad ERC-4626 position and
settle the invoice atomically.

### Implement

- immutable allowlist containing one verified vault; the hackathon testnet gate
  uses an explicitly labelled BlinkPay ERC-4626 fixture because Euler's
  official labels contain Monad mainnet (`143`) but no Monad testnet (`10143`)
  vault list
- vault share balance, `asset`, `previewWithdraw`, `maxWithdraw`, and liquidity
  reads
- share approval/authorization flow
- `payFromVault`
- exact underlying withdrawal, settlement, refunds, and receipt
- clear unavailable state when immediate liquidity is insufficient

### Tests

- correct assets/shares conversion with rounding protection
- withdrawal never exceeds the user's limit
- insufficient `maxWithdraw` rejects the plan before signing
- non-allowlisted and wrong-underlying vaults revert
- changing share price does not underpay the merchant
- failure reverts the complete payment
- current-state Monad fork test

### Manual acceptance test

Fund a supported vault position, create a small invoice, redeem only what is
required, and verify the remaining shares and merchant USDC balance.

### Exit gate

Direct, swap, and vault routes are all real, independently tested, and visible
in the planner.

## Phase 6 — Atomic split routes

### Goal

Combine idle USDC with exactly one additional source so users do not need to
sell or redeem more than necessary.

### Implement

- `USDC + exact-output swap`
- `USDC + ERC-4626 withdrawal`
- one aggregate user maximum and per-step limits
- atomic rollback and unified receipt
- planner preference for idle USDC subject to the user's reserve

### Tests

- route uses the correct direct portion after preserving the reserve
- second source funds exactly the shortfall
- partial failure rolls back both legs
- refunds and approvals are correct
- combined cost and receipt accounting are accurate
- fuzz invoice sizes, reserves, decimals, and rounding boundaries

### Manual acceptance test

Pay an invoice larger than idle USDC using a split route. Verify that the
configured reserve remains and only the shortfall came from the second source.

### Exit gate

At least one split route completes as a single transaction and all balance
deltas match the plan.

Status: passed on July 15, 2026. The live testnet receipt combined 0.8 wallet
USDC with an exact 0.2 USDC vault withdrawal. Merchant, payer, vault, allowance,
router-residual, event, and replay deltas were independently verified at the
payment block. See `PHASE_6_REPORT.md`.

## Phase 7 — Security hardening and release candidate

### Goal

Turn the working prototype into a credible hackathon submission.

### Implement

- access-control and external-call review
- `SafeERC20`, reentrancy protection, pause mechanism, strict allowlists
- approval minimization/resetting
- explicit invariants for exact settlement, refunds, and replay protection
- fork tests pinned to documented blocks plus a latest-state smoke test
- structured errors, loading states, mobile viewport, and transaction recovery
- monitoring/logging without wallet or secret leakage
- `SECURITY.md`, threat model, deployment manifest, and verified source code

### Tests

- full unit, integration, fuzz, invariant, fork, and browser E2E suites
- fresh-clone installation test
- dependency and secret scans
- failure tests with RPC timeout, stale quote, rejected signature, and reverted
  transaction
- manual review of every privileged or configurable address

### Manual acceptance test

Run the complete three-minute demo from a clean browser session using real
wallets and small live amounts. Repeat it to prove it is not a one-off.

### Exit gate

CI is green, the hosted app works, contracts are verified, README setup is
reproducible, and the demo can be completed twice without intervention.

Status: passed on July 15, 2026 for the release-candidate scope. The hardened
router has an exact Sourcify runtime match; the full automated, invariant,
pinned-fork, browser, dependency, and secret gates pass; pause/unpause was
exercised live; and a fresh merchant-to-payer flow settled exactly 0.1 USDC
with zero router residuals and replay rejection. Public hosting and the final
incognito submission rehearsal remain Phase 8 deliverables. See
`PHASE_7_REPORT.md`.

## Phase 8 — Hackathon submission

### Goal

Make the working product understandable within three minutes.

### Implement

- concise problem/solution copy centered on the founder's personal problem
- public hosted application and repository
- mainnet or testnet contract address and deployment manifest
- architecture and security documentation
- demo script and public video under three minutes
- social post if competing for the viral prize
- screenshots and fallback explorer links

### Submission audit

- project began after the hackathon start
- no placeholder balances, quotes, or success results
- public repository has meaningful commit history
- exact setup commands work
- all required URLs are public
- every product claim appears in the live demo

### Exit gate

Submission is opened in an incognito browser and independently checked against
every Spark requirement before it is sent.

Status: UI checkpoint passed on July 15, 2026. The landing, merchant, and payer
surfaces are product-polished and mobile responsive; the full automated release
gate and browser overflow/touch checks pass. Public hosting, the demo video, and
the final incognito submission rehearsal remain open. See
`PHASE_8_REPORT.md`.

## Stretch Phase A — Borrow-to-pay

Begin only after Phase 7 is green. Select one verified live collateral/USDC
market, read protocol-native account health, enforce a user minimum health
factor, borrow the exact invoice amount, and show the resulting debt. This
requires dedicated fork, oracle-change, liquidity, authorization, and
liquidation-boundary tests.

Borrowing is omitted from the submission if the exact production market or its
configuration cannot be independently verified.

## Stretch Phase B — Preference learning

Record accepted and rejected plans and adjust documented scoring weights within
safe bounds. The learning system may rerank eligible plans; it may never make
an ineligible route executable. Do not claim reinforcement learning without
meaningful real outcome data.

## Stretch Phase C — Delegated and recurring payments

Investigate smart-account permissions and session keys only after manual
payments are secure. Enforce merchant allowlists, token limits, period limits,
revocation, expiry, and emergency cancellation. This feature must not depend on
an unsupported Monad bundler.

## 4. External dependencies to verify before integration

| Dependency | Purpose | Verification required |
| --- | --- | --- |
| Monad RPC | balances, simulation, transactions | chain ID, reliability, rate limits |
| Circle USDC | settlement asset | official address and decimals |
| 0x | exact-output swaps | Monad support, current targets, quote expiry |
| Uniswap V3 | optional swap fallback | official deployments and pool liquidity |
| Euler/Euler Earn | vault route and possible borrow route | verified vault, asset, liquidity, risk |
| AI provider | typed preference parsing | schema output, timeout, cost, fallback |
| Hosting | public web application | environment secrets and production build |

No address copied from a blog, search result, or unverified frontend is allowed
into production chain configuration.

## 5. Definition of done for every phase

A phase is complete only when:

- the implementation is committed and pushed;
- the relevant unit and integration tests pass;
- the full existing regression suite still passes;
- the manual acceptance test has been performed;
- documentation reflects what actually works;
- known limitations are written down;
- no secret, private key, or real user data is present in Git history.
