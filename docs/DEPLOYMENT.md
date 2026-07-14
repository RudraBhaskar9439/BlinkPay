# BlinkPay router deployment

This procedure deploys the direct-settlement router. Use a dedicated deployer
wallet with only the MON required for deployment.

## 1. Prerequisites

- Foundry 1.7.1
- a funded Monad deployer address
- canonical Monad USDC:
  `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`
- a reliable Monad RPC URL

Never paste a private key into source code, `.env`, CI, chat, or a command-line
flag that will remain in shell history.

## 2. Import an encrypted Foundry keystore

```bash
cast wallet import blinkpay-deployer --interactive
```

Enter the private key and a new keystore password only in Foundry's interactive
prompt. Record the resulting deployer address separately.

## 3. Run the regression gate

```bash
pnpm install --frozen-lockfile
pnpm check
```

Deployment stops if any check is red.

## 4. Deploy

From `packages/contracts`:

```bash
forge create src/BlinkPayRouter.sol:BlinkPayRouter \
  --rpc-url https://rpc.monad.xyz \
  --account blinkpay-deployer \
  --constructor-args 0x754704Bc059F8C67012fEd69BC8A327a5aafb603 \
  --broadcast
```

Confirm the displayed chain, deployer, constructor argument, and estimated gas
before unlocking the keystore.

Save the deployment transaction and contract address in a deployment manifest;
do not rely on terminal history as the record.

## 5. Verify and configure

Verify the exact source/compiler configuration using Monad's official contract
verification guide. Then configure the hosted web application:

```text
NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS=<verified router address>
NEXT_PUBLIC_MONAD_RPC_URL=<production RPC URL>
```

The router address is public. RPC credentials embedded in a
`NEXT_PUBLIC_*` variable are also public, so use a browser-safe restricted key
or keep a private RPC behind a server endpoint.

## 6. Live smoke test

- Use a merchant and payer wallet that are separate from the deployer.
- Use a 0.01 USDC invoice.
- Check the typed-data domain says BlinkPay version 1, chain 143, and the newly
  verified router.
- Confirm the payer approval is exactly 0.01 USDC unless an existing allowance
  is already sufficient.
- Confirm the merchant receives exactly 0.01 USDC.
- Attempting to pay the same invoice again must revert as already paid.
- Save the payment transaction URL for the Phase 1 report and demo evidence.

## 7. Exact-output swap deployment

Do this only after the direct-payment smoke test passes. The swap deployment
adds four independently verified integration values:

- WMON: `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A`
- 0x AllowanceHolder:
  `0x0000000000001fF3684f28c67538d4D072C22734`
- the current `transaction.to` returned by a fresh 0x Monad Exact Buy quote
- the first four bytes of the returned `transaction.data`

The 0x swap target can be redeployed. Never copy it from a blog post, an old
demo, or a previous deployment. Obtain a fresh probe quote through the official
API, independently check that the target has Monad bytecode, and record the
quote response and verification time.

```bash
cast code <CURRENT_0X_SWAP_TARGET> --rpc-url https://rpc.monad.xyz
cast code 0x0000000000001fF3684f28c67538d4D072C22734 \
  --rpc-url https://rpc.monad.xyz
```

Deploy the swap router with one fixed target and the exact set of selectors
accepted for the demo route:

```bash
forge create src/BlinkPaySwapRouter.sol:BlinkPaySwapRouter \
  --rpc-url https://rpc.monad.xyz \
  --account blinkpay-deployer \
  --constructor-args \
    0x754704Bc059F8C67012fEd69BC8A327a5aafb603 \
    0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A \
    <CURRENT_0X_SWAP_TARGET> \
    0x0000000000001fF3684f28c67538d4D072C22734 \
    '[<ALLOWED_SELECTOR>]' \
  --broadcast
```

Configure the server with the exact same deployment values:

```text
NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS=<SWAP_ROUTER_ADDRESS>
ZEROX_API_KEY=<SERVER_ONLY_KEY>
ZEROX_SWAP_TARGET=<CURRENT_0X_SWAP_TARGET>
ZEROX_SWAP_SELECTORS=<SELECTOR_1,SELECTOR_2_IF_REQUIRED>
```

`ZEROX_API_KEY` must never be exposed through a `NEXT_PUBLIC_*` variable. The
browser approves WMON only to the BlinkPay router. The BlinkPay router grants a
transaction-scoped maximum to AllowanceHolder and clears it after the swap.

For the live gate, use a tiny invoice and save evidence for the quote maximum,
actual WMON spend, refund, exact merchant USDC delta, both settlement events,
and explorer transaction. Then repeat with an expired quote and confirm all
balances and the paid flag remain unchanged.
