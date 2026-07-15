# Phase 7 report — security hardening and release candidate

Phase 7 passed its release-candidate gate on July 15, 2026.

## Outcome

BlinkPay now has a hardened five-route testnet deployment with an explicit
security model, emergency payment pause, stricter token accounting, expanded
automated and browser coverage, exact deployed-runtime verification, and a
fresh live payment receipt.

AI remains outside the executable security boundary. It may compile payer text
into a versioned preference policy, but cannot choose addresses, selectors,
calldata, signatures, or transaction recipients. Deterministic code verifies,
simulates, filters, and ranks every executable route.

## Hardening changes

- `Ownable` emergency pause with an emitted audit event; every route rejects
  before signature validation or token movement while paused.
- pause-aware planner constraints and a final onchain pause check before any UI
  approval request;
- exact sell-token funding delta checks in addition to existing settlement,
  refund, cap, deadline, selector, and allowance-reset checks;
- minimized payer approvals for direct, WMON, vault, and split routes;
- malformed invoice links expose no executable controls;
- mobile overflow, loading, no-wallet, and safe-failure browser coverage;
- a written threat model, incident procedure, approval policy, and deployment
  manifest.

See `SECURITY.md` for trust boundaries, threats, invariants, and residual risk.

## Automated evidence

The final local release gate produced the following evidence:

- 60 Solidity tests pass, including direct, exact-output swap, ERC-4626,
  atomic-split, pause, exact-funding, adversarial rollback, fuzz, invariant,
  integration, and pinned Monad fork coverage;
- arbitrary direct-plus-vault boundaries run with 512 fuzz cases;
- three stateful invariants each run for 128 sequences at depth 64: 24,576
  handler calls total with zero reverts;
- 54 TypeScript tests pass: chain 6, core 4, planner 19, policy 17, and quote
  adapter 8;
- 7 Playwright release tests pass and 1 desktop run is intentionally skipped
  because it is the mobile-only overflow case;
- ESLint, TypeScript, production Next.js build, `forge fmt --check`, and
  `forge lint` pass;
- `BlinkPaySplitRouter` runtime size is 10,905 bytes, below the EIP-170 limit;
- `pnpm audit --prod --audit-level moderate` reports no known vulnerabilities
  after pinning patched PostCSS `8.5.19`;
- tracked-file and complete Git-history secret-pattern scans are clean.

The pinned fork test recreates Monad testnet block `44982723` and verifies the
active router's immutable integrations, pause state, accepted invoice state,
merchant/payer/vault balances, and zero router residuals.

## Hardened testnet deployment

| Component | Address |
| --- | --- |
| Hardened five-route router | `0x6054f7E75E07f5d127DceEA3b2D683959a51c9AA` |
| Testnet ERC-4626 vault | `0xbb171586DE327A2c9BB2ea3A7D200B9A92fbeb89` |
| Testnet exact-output pool | `0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3` |
| Circle testnet USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| WMON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |

Deployment transaction:
`0x32dc30befbf91acb8f343914149195c3812b1c2124754dc1b704f598a4c00f0d`.
The transaction succeeded at block `44980259`. The settlement asset, sell
asset, swap target, allowance target, vault, allowed selector, owner, runtime
bytecode, and initial pause state were independently read after deployment.

Sourcify reports an exact runtime match on chain `10143` (match ID `543108`,
verification job `3b4dda0b-0bb4-492e-9cd5-dcd8f099a74b`). See
`DEPLOYMENT_MANIFEST.md` for the complete immutable configuration and the
creation-match qualification.

## Live emergency-pause drill

The owner paused the deployed router in transaction
`0xdf7a34b2e8400f501dea680c3ec83c799354e3b5e2bd2658ed58e95dc5c18baf`.
An independent read returned `paymentsPaused = true`, and a valid-shaped
payment call reverted with `PaymentsPaused()` before execution.

The owner then unpaused it in transaction
`0x1a3ad717bc08790a13832b23d88be6c1a286ac21e4a77daea939d309e9949921`.
The final independent read returned `paymentsPaused = false`.

## Live hardened payment acceptance

Transaction:
`0xb4a23e00583b366aee730f0a6cdbe11544efb1d9a129687979e9b0fa71328571`

- Block: `44982723`
- Status: success
- Route: exact ERC-4626 vault redemption
- Payer: `0x76D7D56fb21A6969E1F07B722e3c63E2c80a7cB1`
- Merchant: `0xD1A199076f5BA0Da38E190D05D60A19a092061d2`
- Invoice ID:
  `0xe76a313ceda0bd16d477466976c7f67ce3bb8f5c7ebcc96f018eb502d8b40bd0`
- Signed invoice amount: `0.1 USDC`
- Protected maximum: `0.1005 vault shares`
- Actual shares redeemed: `0.1 vault shares`
- Gas used: `277918`

### Independently queried state deltas

The following values were read at blocks `44982722` and `44982723`:

| State | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Payer wallet USDC | 0 | 0 | 0 |
| Payer vault shares | 0.7 | 0.6 | -0.1 |
| Vault USDC assets | 0.7 | 0.6 | -0.1 |
| Merchant USDC | 1.4 | 1.5 | +0.1 |
| Payer vault allowance | 0.1005 | 0.0005 | -0.1 |
| Router USDC | 0 | 0 | 0 |
| Router WMON | 0 | 0 | 0 |
| Router vault shares | 0 | 0 | 0 |
| Invoice paid flag | false | true | recorded once |

The receipt contains `PaymentSettled` and `VaultPaymentSettled`. Both record
the same invoice, payer, and exact `100000` settlement units; the vault event
also records the `100500` maximum and `100000` shares redeemed.

Calling the hardened router again with the identical calldata reverted with
selector `0x0bd84c19`, which is `InvoiceAlreadyPaid(bytes32)`. This independently
confirms replay protection on the active deployment.

## Known limitations

- This is a tested hackathon release candidate, not an independent professional
  audit, formal verification result, or production-readiness claim.
- The testnet owner is a single deployment account. A production pause owner
  should be a reviewed multisig with recovery and incident procedures.
- The pool and vault are labelled BlinkPay fixtures, not production DeFi
  liquidity.
- Payer approvals are separate wallet transactions. Permit-style approvals and
  abandoned-approval revocation are not implemented.
- Sourcify reports an exact runtime match but no creation-bytecode match.
- Browser tests cover release behavior without automating a real wallet
  extension; the live wallet transaction supplies that acceptance evidence.
- Public hosting, final demo recording, and incognito submission rehearsal are
  Phase 8 work.
