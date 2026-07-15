# BlinkPay demo script — 2 minutes 45 seconds

Record at 1080p with the browser zoom at 100%. Keep the Monad explorer open in
a second tab. Do not reveal private keys, API keys, wallet seed phrases, or
terminal environment values.

## 0:00–0:20 — The personal problem

**Screen:** BlinkPay landing page, desktop width.

**Say:**

> A merchant wants exactly USDC, but I often hold value across wallet tokens
> and yield positions. Today I have to inspect balances, swap or withdraw, and
> still make sure the merchant receives the exact amount. BlinkPay compiles that
> workflow into one self-custodial payment on Monad.

## 0:20–0:42 — Create the request

**Screen:** Open **Create invoice**, connect the merchant wallet, enter `0.10`
USDC and a short description, then sign.

**Say:**

> The merchant signs a portable EIP-712 invoice. The amount, merchant, expiry,
> chain, router, and invoice ID are bound by the signature. The resulting link
> and QR contain the invoice, not a custodial database record.

## 0:42–1:15 — Express intent and inspect live evidence

**Screen:** Open the payment link in a mobile-size or incognito window, connect
the payer, enter `keep my MON and keep 0.05 USDC liquid`, and analyze routes.

**Say:**

> The AI only converts natural language into this strict preference policy. It
> has no access to addresses, calldata, quotes, or signing. Deterministic code
> reads current balances, allowances, vault previews, quote deadlines, gas,
> router pause state, and replay state. Ineligible routes stay visible with the
> exact failed constraint.

## 1:15–1:52 — Compare and pay

**Screen:** Scroll through the ranked cards and select the recommended eligible
route. Show the exact maximum and wallet approval, then sign the payment.

**Say:**

> BlinkPay supports five real routes: direct USDC, exact-output WMON, exact
> ERC-4626 redemption, and two atomic split routes. The payer reviews a capped
> transaction in their wallet. The router either delivers the signed USDC
> amount exactly or the whole transaction reverts.

## 1:52–2:18 — Prove it onchain

**Screen:** Open the receipt, then the hardened acceptance transaction on
Monadscan.

**Say:**

> This is a real Monad testnet receipt. The merchant gained exactly 0.1 USDC,
> the payer redeemed exactly 0.1 vault shares, the router retained zero new
> tokens, and the invoice changed from unpaid to paid. Replaying the same
> calldata reverts as already paid.

## 2:18–2:45 — Why it matters

**Screen:** Return to the architecture or landing safety section.

**Say:**

> BlinkPay makes fragmented onchain assets feel spendable without giving an AI
> custody or signing power. Sixty Solidity tests, stateful invariants, browser
> tests, a pinned Monad fork, exact runtime verification, and live wallet
> payments back the demo. It is open source and live on Monad testnet.

## Recording checklist

- Keep the final video under 3:00; target 2:45.
- Use a fresh, unpaid invoice so replay protection does not block the demo.
- Pre-fund the payer and merchant with only the small testnet amounts needed.
- Close notifications and hide browser extensions unrelated to the flow.
- Upload publicly and add the URL to [SUBMISSION.md](SUBMISSION.md).
