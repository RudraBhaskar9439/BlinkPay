# Phase 1 signed invoice and direct settlement report

Implementation checkpoint: July 15, 2026

## Outcome

BlinkPay can now create an exact-USDC merchant invoice as EIP-712 typed data,
carry the signed invoice in a shareable link/QR, review it in the payer UI, and
settle it through a contract that enforces the signed fields and exact merchant
balance delta.

The implementation and local acceptance gates are green. The final live gate
requires deploying the router from a funded wallet and paying a tiny invoice
between two wallets on Monad. It is intentionally not marked complete until
that transaction exists on an explorer.

## Delivered

### Shared invoice protocol

- versioned `BlinkPay` / `1` EIP-712 domain
- typed invoice containing invoice ID, merchant, settlement token, amount,
  expiry, merchant nonce, chain ID, and metadata hash
- Unicode-safe base64url payment-link encoding
- strict runtime decoding and typed validation
- metadata tamper detection by comparing the description with its signed hash
- shared typed router ABI

### Payment contract

- one immutable, allowlisted settlement asset per deployment
- EOA and ERC-1271-compatible merchant signature verification
- chain, token, amount, merchant, invoice ID, expiry, and signature checks
- permanent replay protection by invoice ID
- non-reentrant checks-effects-interactions flow
- `SafeERC20.safeTransferFrom`
- merchant before/after balance check that reverts unless the exact amount
  arrives
- `PaymentSettled` receipt containing invoice, payer, merchant, asset, amount,
  and merchant nonce
- failed transfer rolls the paid flag back atomically

### Merchant interface

- injected-wallet connection and Monad network switching
- amount, description, and expiry fields
- random 32-byte invoice ID
- offchain typed-data signature
- shareable payment URL and locally generated QR code
- no server-side invoice database

### Payer interface

- strict link decoding and invalid/tampered-link state
- exact amount, merchant, description, expiry, chain, and invoice review
- local EOA signature preflight before any approval
- live balance, allowance, and replay-state preflight
- approval limited to the exact invoice amount
- direct router settlement
- final Monad explorer receipt link
- recoverable missing-wallet and transaction-error states

## Automated gate evidence

```text
pnpm lint                 PASS
pnpm typecheck            PASS
pnpm test                 PASS — 7 TypeScript tests
pnpm build                PASS — /, /merchant, /pay, /api/network
pnpm contracts:fmt        PASS
pnpm contracts:test       PASS — 15 Solidity tests
```

The 11 router-specific contract tests cover:

- exact successful settlement and receipt event
- replay rejection
- expiry rejection
- wrong-chain rejection
- wrong-token rejection
- invalid merchant signature
- invoice mutation after signing
- zero amount
- empty invoice ID
- insufficient allowance and atomic rollback
- invalid settlement-asset construction

## Manual browser acceptance

- home page showed a live Monad block and no console errors;
- merchant form rendered all fields and its unsigned state;
- missing injected wallet produced a controlled message, not an exception;
- a valid encoded invoice rendered the exact 5 USDC amount, description,
  merchant, expiry, network, and invoice ID;
- malformed invoice links rendered a stable rejection state;
- a server/browser decoding-message mismatch was found, fixed, and retested;
- all fresh retest tabs had zero console warnings/errors and no horizontal
  overflow at the tested viewport.

## Security boundary

- The merchant signs; BlinkPay never stores a merchant key.
- The payer signs approval and payment transactions directly in their wallet.
- The UI cannot change a signed field without invalidating the signature.
- A link containing a signature is not treated as proof until payment preflight
  validates it against the configured router domain.
- No deployment private key belongs in `.env`, source control, shell history,
  CI, or a hosted frontend.

## Remaining live gate

1. Import a deployer key into an encrypted Foundry keystore.
2. Fund it with enough MON for deployment gas.
3. Deploy against canonical Monad USDC.
4. Verify the contract source.
5. configure `NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS` in hosting.
6. Create a 0.01 USDC invoice with wallet A.
7. Pay it with wallet B.
8. Confirm the exact merchant balance delta, `PaymentSettled` event, paid flag,
   and public explorer receipt.

Do not begin the swap-routing phase until this live gate passes.
