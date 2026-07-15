# Spark submission — BlinkPay

## Required fields

**Name:** BlinkPay

**Description:** AI-assisted, self-custodial payment routing that settles an
exact USDC invoice from a payer's wallet tokens or supported DeFi positions on
Monad.

**Problem:** When someone asks me to pay a specific stablecoin amount, my value
is often fragmented across wallet USDC, wrapped native tokens, and yield
positions. I have to inspect balances, preserve the assets I care about,
manually swap or withdraw, and verify the recipient received exactly what they
requested. That makes a simple payment feel like a DeFi operation.

**Solution:** A merchant signs an exact-USDC invoice and shares a link or QR.
BlinkPay reads the payer's live Monad state and compiles preferences such as
“preserve MON” into a strict policy. Deterministic code then filters, simulates,
and ranks five executable routes. The payer reviews and signs the chosen route;
the router settles the merchant exactly, returns unused input, retains no new
payment funds, and records replay protection onchain.

**Project URL:** https://blink-pay-web.vercel.app

**GitHub repo:** https://github.com/RudraBhaskar9439/BlinkPay

**Category:** Monad Testnet

**Contract address:**
`0x6054f7E75E07f5d127DceEA3b2D683959a51c9AA`

**Contract explorer:**
https://testnet.monadscan.com/address/0x6054f7E75E07f5d127DceEA3b2D683959a51c9AA

**Demo video:** _Add the public URL after recording the script in
[DEMO_SCRIPT.md](DEMO_SCRIPT.md)._

**Post URL:** _Optional unless entering the Most Viral Solution prize._

## Live proof

- Hardened ERC-4626 payment:
  https://testnet.monadscan.com/tx/0xb4a23e00583b366aee730f0a6cdbe11544efb1d9a129687979e9b0fa71328571
- Atomic wallet-USDC + vault payment:
  https://testnet.monadscan.com/tx/0xc6af11ffcf78c61575832936db84bdfb1c05fe456f2a4e93b6463286e286a4a2
- Exact-output WMON payment:
  https://testnet.monadscan.com/tx/0xaa4ecc49fa5cc6c3e334eb97cd4e3e989d8d93484ac1606b6dbaf5b0d78d2107
- Direct USDC payment:
  https://testnet.monadscan.com/tx/0x6eb45b5e0c76bf852dc0cef44b94d63a59f89a638b9d0d847d5349651cc94b44

## Differentiators

- real, current balances and simulations rather than placeholder success data;
- AI is useful but structurally outside the transaction security boundary;
- exact-output and exact-withdrawal semantics protect both payer and merchant;
- five routes share one signed invoice and one replay-protection domain;
- unavailable routes show constraint evidence instead of disappearing;
- testnet contracts are explicitly labelled as BlinkPay fixtures.
