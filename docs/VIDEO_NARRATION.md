# BlinkPay video narration — owner recording script

Target length: **2:45**. Speak naturally and leave a short pause between
sections. Record in a quiet room as WAV, M4A, or high-quality MP3. Do not read
the headings or timestamps aloud.

## 00:00–00:20 — The problem

A merchant wants exactly USDC, but my value is often split across wallet
tokens and yield positions. Today I have to inspect balances, swap or withdraw,
and still make sure the merchant receives the exact amount. BlinkPay compiles
that workflow into one self-custodial payment on Monad.

## 00:20–00:42 — The signed request

The merchant signs a portable EIP-712 invoice. The amount, merchant, expiry,
chain, router, and invoice ID are bound by the signature. The resulting link
and QR contain the invoice—not a custodial database record.

## 00:42–01:15 — AI with boundaries

The AI only converts natural language into a strict preference policy. It has
no access to addresses, calldata, quotes, or signing. Deterministic code reads
current balances, allowances, vault previews, quote deadlines, gas, router
pause state, and replay state. Ineligible routes stay visible with the exact
failed constraint.

## 01:15–01:52 — Five executable routes

BlinkPay supports five real routes: direct USDC, exact-output WMON, exact
ERC-4626 redemption, and two atomic split routes. Every candidate is simulated
and constrained before ranking. The payer reviews a capped transaction in
their wallet. The router either delivers the signed USDC amount exactly, or the
whole transaction reverts.

## 01:52–02:18 — Onchain proof

This is a real Monad testnet receipt. The merchant gained exactly zero point
one USDC, the payer redeemed exactly zero point one vault shares, the router
retained zero new tokens, and the invoice changed from unpaid to paid.
Replaying the same calldata reverts as already paid.

## 02:18–02:45 — Why it matters

BlinkPay makes fragmented onchain assets feel spendable without giving an AI
custody or signing power. Sixty Solidity tests, stateful invariants, browser
tests, a pinned Monad fork, exact runtime verification, and live wallet
payments back the demo. BlinkPay is open source and live on Monad testnet.

## Recording delivery

Save the final narration as `blinkpay-narration.wav` or
`blinkpay-narration.m4a` and attach it in the Codex conversation. Do not add
wallet passwords, seed phrases, or other secrets to the recording.
