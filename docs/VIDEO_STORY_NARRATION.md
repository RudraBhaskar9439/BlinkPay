# BlinkPay animated story — owner narration

Target length: **2:55**. Speak naturally at roughly 122 words per minute and
leave the short pauses shown by the scene changes. Do not read the headings or
timestamps aloud.

## 00:00–00:09 — The payment gap

A merchant asks for exactly one USDC. The payer has only zero point eight in
their wallet. The rest is spread across other assets.

## 00:09–00:35 — Merchant creates the request

With BlinkPay, the merchant connects a wallet, enters one USDC, adds a
description and expiry, then signs the invoice. The EIP-712 signature binds the
amount, merchant, chain, router, expiry and unique invoice ID. This happens
offchain, so creating the request costs no gas. BlinkPay produces a portable
payment link and a real scannable QR code.

## 00:35–00:50 — Payer scans on mobile

The payer scans the code with a phone. The signed payment request opens
immediately, showing the merchant, amount and purpose before the payer connects
a wallet.

## 00:50–01:20 — AI converts intent into policy

BlinkPay reads the wallet's live state: zero point eight USDC, vault shares
worth zero point nine USDC, and WMON. A direct payment is short by zero point
two. The payer says: preserve WMON, use wallet USDC first, and do not borrow.
AI translates that language into strict policy. It never receives signing
authority. The deterministic planner then analyzes executable routes against
live balances, quotes, allowances and contract state.

## 01:20–01:55 — Deterministic route planning

Five routes are simulated. Direct USDC cannot cover the invoice. WMON is
available, but the payer asked to preserve it. Paying entirely from the vault
would redeem more than necessary. The winning route is an atomic split: zero
point eight USDC from the wallet, plus exactly zero point two USDC redeemed
from the vault. Every rejected route remains visible with its constraint
evidence. The plan either delivers exactly one USDC, or the entire transaction
reverts.

## 01:55–02:20 — Payer confirms

The payer reviews the exact split and the protected maximum number of vault
shares. BlinkPay prepares the router call, but only the wallet can approve it.
The AI cannot sign or move funds. One confirmation executes both payment legs
atomically on Monad, with no partial result possible.

## 02:20–02:41 — Real onchain proof

This is the real testnet receipt, using paySplitWithVault in block forty-four
million, nine hundred seventy-four thousand, five hundred twenty-six. Zero
point eight USDC came from the wallet, zero point two from the vault, and the
merchant received exactly one USDC. The router retained nothing, and replaying
the invoice is blocked.

## 02:41–02:55 — Close

BlinkPay makes fragmented onchain assets spendable without giving AI custody.
The merchant asks for USDC. The payer pays from what they own. Live on Monad
testnet and open source.

## Recording delivery

Record in a quiet room and send a WAV, M4A, or high-quality MP3. Name it
`story-narration.wav` when possible. Do not include wallet passwords, seed
phrases, or other secrets in the recording.
