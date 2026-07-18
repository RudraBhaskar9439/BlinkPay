# BlinkPay wallet walkthrough capture

Record this in regular Chrome because the Codex in-app browser cannot display
the MetaMask extension. Use a fresh 0.10 USDC invoice so the whole flow is easy
to read in the final video.

## Before recording

- Set browser zoom to 90% or 100% and close unrelated tabs.
- Hide bookmarks, notifications, seed phrases, passwords, API keys and private
  terminal windows.
- Select Monad Testnet in MetaMask.
- Prepare the merchant and payer accounts, but never reveal their private keys.
- Start a macOS selected-window recording with `Command + Shift + 5`.

## Clip A — merchant creates the request

1. Open `https://blink-pay-web.vercel.app/merchant`.
2. Connect the merchant wallet.
3. Enter `0.10` USDC, a short description, and a 30-minute expiry.
4. Select **Sign invoice**.
5. Approve the EIP-712 signature in MetaMask.
6. Hold for two seconds on the QR and payment-link result.
7. Copy the payment link without displaying clipboard history.

## Clip B — payer completes the payment

1. Open the copied link in the payer browser profile.
2. Connect the payer wallet on Monad Testnet.
3. Enter a preference such as `Preserve MON and keep 0.05 USDC liquid. Do not borrow.`
4. Select **Apply preferences**, then **Analyze wallet routes**.
5. Scroll slowly through eligible and unavailable routes so their evidence is
   readable.
6. Select the recommended route.
7. If MetaMask requests a token approval, confirm only the displayed exact
   amount and verify the spender is the deployed BlinkPay router:
   `0x6054f7E75E07f5d127DceEA3b2D683959a51c9AA`.
8. Approve the final payment transaction.
9. Hold on the successful receipt, then open its Monadscan link.

## Delivery

Attach the original `.mov` recording to the Codex conversation. Do not trim or
compress it; the final edit will crop pauses, wallet popups and loading time to
fit the three-minute hackathon limit.
