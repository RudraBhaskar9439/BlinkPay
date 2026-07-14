# BlinkPay

BlinkPay is an AI-assisted payment compiler on Monad. A merchant requests an
exact USDC amount; BlinkPay finds a valid way to fund it from the payer's idle
tokens or supported DeFi positions while enforcing the payer's constraints.

The first release is a self-custodial, onchain checkout—not a Visa or
Mastercard product. The payer always reviews and signs the transaction, and the
AI never signs transactions or invents executable calldata.

## Target demo

1. A merchant creates a signed exact-USDC invoice and shares its link or QR.
2. BlinkPay reads the payer's real Monad balances and supported positions.
3. The payer describes preferences such as "keep my MON and never borrow."
4. Deterministic code quotes, simulates, filters, and ranks real payment plans.
5. The payer signs one plan.
6. The merchant receives the exact USDC amount and an onchain receipt is
   emitted.

## Initial payment routes

- Direct USDC payment
- Exact-output token-to-USDC swap
- ERC-4626 vault withdrawal to USDC
- Split payment using idle USDC plus one additional source

Borrow-to-pay, delegated payments, cross-chain funding, and card rails are not
part of the critical MVP.

## Development method

BlinkPay is being built in test-gated phases. We do not begin the next phase
until the current phase's automated checks and manual acceptance test pass.
See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Current status

- [x] Phase 0A: repository and implementation plan
- [ ] Phase 0B: application and contract toolchains
- [ ] Phase 1: signed invoice and direct USDC settlement

## Network

- Monad mainnet chain ID: `143`
- Monad testnet chain ID: `10143`
- Native Monad mainnet USDC:
  `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`
- Native Monad testnet USDC:
  `0x534b2f3A21130d7a60830c2Df862319e593943A3`

Contract and integration addresses will be kept in version-controlled chain
configuration and independently verified before use.

## Safety principles

- Self-custodial: the user signs every MVP payment.
- Exact settlement: a route reverts unless the invoice is satisfied.
- Allowlisted integrations only.
- User-defined maximum spend, slippage, and deadlines.
- AI produces structured preferences, never transaction targets or calldata.
- Real RPC data and real simulations; no hardcoded success states.
- Mainnet testing uses deliberately tiny values.

## License

License selection will be completed before the public hackathon submission.
