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
- [x] Phase 0B: application and contract toolchains
- [x] Phase 1A: signed invoice and direct USDC implementation
- [x] Phase 1B: live Monad testnet deployment and two-wallet smoke test
- [x] Phase 2A: exact-output WMON-to-USDC implementation
- [x] Phase 2B: testnet pool and exact-output router integration
- [x] Phase 2C: deploy and fund verified testnet liquidity
- [x] Phase 2D: complete direct and WMON wallet-to-wallet payments
- [x] Phase 3A: deterministic portfolio discovery and route engine
- [x] Phase 3B: live wallet planner acceptance matrix
- [x] Phase 4A: strict natural-language policy compiler and planner constraints
- [x] Phase 4B: isolated Groq/xAI/OpenAI policy adapters with safe fallback
- [x] Phase 4C: live wallet preference-switch acceptance matrix

The foundation gate passed on July 14, 2026. See
[docs/PHASE_0_REPORT.md](docs/PHASE_0_REPORT.md) for its evidence and known
limitations.

The live testnet gate passed on July 15, 2026: separate merchant and payer
wallets settled one direct USDC invoice and one exact-output WMON invoice, with
onchain balance, event, refund, zero-custody, and replay checks.

The Phase 3 implementation now reads live balances, allowances, quote state,
and replay state; simulates executable routes; and displays deterministic costs,
constraints, rejection evidence, and ranking. See
[docs/PHASE_3_REPORT.md](docs/PHASE_3_REPORT.md) for the scoring model and the
completed manual wallet matrix.

Phase 4 compiles payer language into a versioned, strictly validated policy.
Only documented policy fields reach the planner; executable configuration and
transaction construction remain outside the AI boundary. See
[docs/PHASE_4_REPORT.md](docs/PHASE_4_REPORT.md) for the schema, threat boundary,
fallback behavior, authenticated Groq evidence, and completed wallet gate.

## Local development

Prerequisites:

- Node.js 22 (Node.js 20.9 or newer is supported)
- pnpm 11.8.0
- Foundry 1.7.1

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm check
pnpm rpc:check
pnpm dev
```

Open `http://localhost:3000`. The foundation screen reads the current Monad
testnet block through the server, so an offline or incorrect RPC is visible
instead of being presented as a successful connection.

## Workspace

```text
apps/web/                  Next.js application
packages/chain/            Monad clients, addresses, and configuration tests
packages/core/             EIP-712 invoice types, encoding, ABI, and tests
packages/contracts/        Foundry contracts and Solidity tests
packages/planner/          Typed deterministic discovery, filtering, and ranking
packages/policy/           Strict preference schema, compiler, and AI adapter
docs/                      Architecture and phase evidence
.github/workflows/ci.yml   Reproducible quality gate
```

Phase 1 implementation evidence is recorded in
[docs/PHASE_1_REPORT.md](docs/PHASE_1_REPORT.md). The remaining deployment gate
is described in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

The current deployment, funding, and two-wallet acceptance gate is in
[docs/TESTNET_LIVE_GATE.md](docs/TESTNET_LIVE_GATE.md). The 0x mainnet adapter
remains documented in [docs/PHASE_2_REPORT.md](docs/PHASE_2_REPORT.md).

## Network

- Monad mainnet chain ID: `143`
- Monad testnet chain ID: `10143`
- Native Monad mainnet USDC:
  `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`
- Native Monad testnet USDC:
  `0x534b2f3A21130d7a60830c2Df862319e593943A3`
- Monad testnet WMON:
  `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541`

The verified testnet deployment is:

- BlinkPay pool: `0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3`
- BlinkPay router: `0x23f655e41F135d9b2FEfD7173342A8c30DF01e2f`

These addresses are kept in version-controlled chain configuration and checked
against their immutable onchain settings before the quote service uses them.

## Safety principles

- Self-custodial: the user signs every MVP payment.
- Exact settlement: a route reverts unless the invoice is satisfied.
- Allowlisted integrations only.
- User-defined maximum spend, slippage, and deadlines.
- AI produces structured preferences, never transaction targets or calldata.
- Real RPC data and real simulations; no hardcoded success states.
- Testnet-only liquidity is clearly labelled and never represented as 0x.

## License

License selection will be completed before the public hackathon submission.
