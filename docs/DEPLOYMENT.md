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
