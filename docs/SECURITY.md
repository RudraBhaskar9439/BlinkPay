# BlinkPay security model

This document describes the Phase 7 release-candidate threat model. It is not
an audit, warranty, or claim that the contracts are production-ready.

## Assets and security goals

BlinkPay protects four things:

1. payer ERC-20 balances and ERC-4626 shares;
2. the exact USDC amount signed by the merchant;
3. payer-defined maximum WMON or share expenditure;
4. invoice replay state and the integrity of the onchain receipt.

The core goals are exact merchant settlement, atomic rollback, no router
custody created by a successful payment, capped secondary-source expenditure,
and one successful settlement per invoice ID.

## Trust boundaries

### Trusted by immutable configuration

- settlement USDC contract;
- supported WMON contract;
- swap target and allowance target;
- allowed swap function selectors;
- supported ERC-4626 vault.

Changing any integration requires deploying a new router. The payer can inspect
the configured addresses before approving it.

### Trusted for emergency response

The router owner can pause and unpause new payments. The owner cannot move payer
funds, change immutable integrations, forge invoices, or mark an invoice paid.
Pausing does not alter existing receipts. The current testnet owner is the
deployment account; a production deployment should use a reviewed multisig
with a documented signer and recovery policy.

### Untrusted inputs

- invoice payloads and links;
- merchant signatures until EIP-712 verification succeeds;
- payer balances and allowances until read at the current block;
- AI/model output;
- quote API responses and swap calldata;
- external token, pool, and vault return values;
- browser extensions and injected wallet errors.

The AI boundary ends at a versioned preference schema. Model output cannot set
addresses, selectors, calldata, signatures, or transaction recipients.

## Enforced invariants

1. A successful payment increases the merchant's settlement-token balance by
   exactly the signed invoice amount.
2. An invoice ID can transition from unpaid to paid at most once.
3. Failed validation, approval, swap, withdrawal, or settlement rolls back the
   paid flag and every balance change in that call.
4. A swap never spends more than `maxSellAmount`; the temporary router approval
   is reset to zero before successful completion.
5. A vault withdrawal never burns more than `maxShares` and must deliver the
   exact requested underlying amount.
6. A split requires nonzero direct and secondary legs. The secondary output is
   exactly `invoice.amount - directAmount`.
7. Direct settlement never leaves invoice funds in the router. Swap, vault,
   and split tests require zero newly retained sell, settlement, and share
   balances after success.
8. A paused router rejects every route before signature validation or token
   movement.

Forced third-party token donations may remain in the router and are deliberately
not included in payment accounting. Requiring the absolute router balance to be
zero would allow an attacker to block all payments by donating one token unit.

## Threats and mitigations

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Forged or modified invoice | EIP-712 signature binds every invoice field and router address | Merchant key compromise |
| Cross-chain or cross-router replay | Chain ID and verifying contract are signed | None within supported domain assumptions |
| Same-invoice replay | Shared `paidInvoices` mapping across all routes | Different merchant-generated invoice IDs are independent |
| Fee-on-transfer or dishonest settlement token | Exact merchant and router balance deltas | Only immutable allowlisted assets should be deployed |
| Swap target drains excess input | Exact payer pull, capped approval, selector allowlist, refund accounting, approval reset | Allowlisted target compromise can still deny service |
| Malformed or stale quote | Deadline, immutable targets, selector check, exact output, planner freshness checks | Price can move before inclusion and cause a safe revert |
| Vault share-price change | `previewWithdraw`, `maxWithdraw`, exact asset delta, payer `maxShares` | Vault can deny service or become illiquid |
| Reentrancy | `nonReentrant` on every payment entry point; checks and exact post-state validation | Malicious immutable dependencies still require review |
| Partial split execution | Both legs and settlement occur in one EVM transaction | Approval transactions remain separate |
| Prompt injection | Strict schema and executable-configuration isolation | A valid but undesired preference still requires payer review |
| Incident during demo | Owner-controlled emergency payment pause | Owner key availability and centralization |
| Malformed payment link | Strict decoder and no executable controls on invalid payload | Browser or extension compromise is outside contract scope |

## Approval policy

- The UI requests only the invoice amount, quote maximum, or buffered share
  maximum required by the selected route.
- Direct-plus-secondary routes may require two approval transactions.
- The swap router approves the immutable allowance target only during the
  payment call and resets that allowance to zero on success.
- Users should revoke unused payer-to-router allowances after abandoning a
  payment. Permit-style approvals are not implemented in this release.

## Pause and incident procedure

1. Confirm the incident using independent RPC and explorer data.
2. Call `setPaymentsPaused(true)` from the owner account.
3. Verify `paymentsPaused()` and the `PaymentsPauseUpdated` event onchain.
4. Publish the affected router address and tell users not to approve it.
5. Diagnose against a pinned fork and add a regression test.
6. Deploy a new router if an immutable dependency is affected.
7. Unpause only when the regression suite, configuration checks, and a small
   live smoke test pass.

The pause must never be used to hide an ordinary quote failure or liquidity
shortage.

## Release checklist

- immutable addresses match the deployment manifest;
- owner and pause state are independently read onchain;
- source compiles reproducibly with Solidity 0.8.30;
- unit, fuzz, stateful invariant, planner, policy, build, and browser tests pass;
- dependency audit and tracked-file secret scan are clean or documented;
- router token/share residuals are zero after the live smoke transaction;
- identical calldata replay reverts;
- known limitations remain visible in the phase report.

## Out of scope

- compromised payer, merchant, owner, browser, or wallet-extension keys;
- production guarantees for the labelled BlinkPay testnet pool and vault;
- bridges, borrowing, delegated payments, session keys, fiat rails, and
  cross-chain settlement;
- recovery of assets deliberately transferred directly to contract addresses;
- formal verification or an independent professional audit.
