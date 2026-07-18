# BlinkPay video narration — owner recording script

Target length: **2:45**. Speak naturally and leave a short pause between
sections. Record in a quiet room as WAV, M4A, or high-quality MP3. Do not read
the headings or timestamps aloud.

## 00:00–00:20 — The problem

BlinkPay is a self-custodial payment router on Monad. A merchant asks for an
exact amount of USDC, while the payer may hold value as wallet USDC, WMON, vault
shares, or a combination of them. BlinkPay turns those fragmented assets into
one exact payment under rules the payer controls.

## 00:20–00:42 — The signed request

First, the merchant connects a wallet, enters the USDC amount, description and
expiry, then selects Sign invoice and approves the EIP-712 message. The amount,
merchant, chain, router and invoice ID are bound by that signature. BlinkPay
creates a portable payment link and QR that the merchant shares with the payer.

## 00:42–01:15 — AI with boundaries

The payer opens the link and connects a wallet on Monad Testnet. They can type
preferences such as preserve MON, keep some USDC liquid, and do not borrow.
Selecting Apply preferences converts that language into strict policy. The AI
never receives wallet addresses, calldata, quotes, or signing authority. Then
Analyze wallet routes reads live balances, allowances, vault previews, gas,
quote deadlines, router state and replay state.

## 01:15–01:52 — Five executable routes

BlinkPay compares five executable routes: direct USDC, exact-output WMON,
exact ERC-4626 redemption, and two atomic split routes. Unavailable routes stay
visible and explain which constraint failed. The payer reviews the recommended
route, selects Pay, approves only the required token allowance if prompted,
and confirms the final transaction in the wallet. The router either delivers
the signed amount exactly or the entire operation reverts.

## 01:52–02:18 — Onchain proof

After confirmation, BlinkPay shows the onchain receipt. This real Monad
Testnet transaction increased the merchant by exactly zero point one USDC,
left no new tokens in the router, and changed the invoice from unpaid to paid.
The same signed invoice cannot be used twice: replaying it reverts as already
paid.

## 02:18–02:45 — Why it matters

BlinkPay makes fragmented onchain assets feel spendable without giving an AI
custody or signing power. Sixty Solidity tests, stateful invariants, browser
tests, a pinned Monad fork, exact runtime verification, and live wallet
payments back the demo. BlinkPay is open source and live on Monad testnet.

## Recording delivery

Save the final narration as `blinkpay-narration.wav` or
`blinkpay-narration.m4a` and attach it in the Codex conversation. Do not add
wallet passwords, seed phrases, or other secrets to the recording.
