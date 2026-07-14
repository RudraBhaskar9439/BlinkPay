# Phase 0 foundation report

Completed: July 14, 2026

## Outcome

BlinkPay now has a reproducible TypeScript/Solidity monorepo and a working web
foundation that reads live Monad state. No payment contract or wallet
transaction has been implemented yet; those begin in Phase 1.

## Delivered

- pnpm workspace pinned to pnpm 11.8.0 and Node.js 22 in CI
- Next.js 16.2.10 and React 19.2.7 application
- typed Monad mainnet/testnet configuration and canonical Circle USDC addresses
- live server-side Monad status component and JSON health endpoint
- Foundry 1.7.1 project with a test-only six-decimal mock USDC
- TypeScript unit tests and Solidity contract tests
- strict linting, TypeScript, build, formatting, and test commands
- GitHub Actions quality gate
- `.env.example` with no credentials
- explicit pnpm native-build allowlist for only required dependencies

## Gate evidence

The following commands passed from the repository root:

```text
pnpm lint                 PASS
pnpm typecheck            PASS
pnpm test                 PASS — 3 TypeScript tests
pnpm build                PASS — production Next.js build
pnpm contracts:fmt        PASS
pnpm contracts:test       PASS — 4 Solidity tests
pnpm rpc:check            PASS — Monad chain ID 143 and live block
```

The manual browser acceptance test confirmed:

- the BlinkPay page title and primary heading render correctly;
- the status badge displays a block number read from Monad mainnet;
- the browser console contains no warnings or errors;
- the layout has no horizontal overflow at the tested desktop/tablet widths;
- `GET /api/network` returns HTTP 200, chain ID `143`, a live block number, and
  measured RPC latency.

## Security notes

- `MockUSDC` is explicitly test-only and must never be used as a production
  settlement token.
- No private key, deployment mnemonic, 0x key, or AI provider key is present.
- Public RPC defaults are suitable for development only; production will use a
  dedicated provider and rate-limit/error monitoring.
- Chain and token addresses are centralized in `@blinkpay/chain` and covered by
  tests so later integrations do not scatter unverified addresses through the
  application.

## Known limitations

- No wallet connection yet.
- No merchant invoice or EIP-712 signature yet.
- No BlinkPay payment router yet.
- No hosted production environment yet.
- The in-app browser used for the manual test has a minimum effective content
  width of 773 CSS pixels, so phone-width visual verification will be added to
  the browser E2E suite when that suite is introduced. Responsive CSS is
  present, but phone-width acceptance is not claimed by this phase.

## Next gate

Phase 1 implements a signed exact-USDC invoice and direct settlement:

1. Define the EIP-712 invoice domain and typed data.
2. Implement replay, expiry, chain, token, amount, and signature validation.
3. Transfer canonical settlement USDC and emit `PaymentSettled`.
4. Build merchant invoice creation and payer confirmation screens.
5. Test the complete flow with two wallets and a real explorer receipt.
