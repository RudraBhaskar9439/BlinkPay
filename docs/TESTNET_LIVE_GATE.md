# Monad testnet live gate

BlinkPay's hackathon deployment runs entirely on Monad testnet (`10143`). The
direct route uses Circle testnet USDC. The WMON route uses a clearly labelled,
testnet-only BlinkPay constant-product pool because 0x Swap API does not serve
Monad testnet. The production 0x adapter remains in the repository for a future
mainnet deployment.

## Verified configuration

| Item | Value |
| --- | --- |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | `https://testnet.monadscan.com` |
| Circle testnet USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| Testnet WMON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |
| Merchant | `0xD1A199076f5BA0Da38E190D05D60A19a092061d2` |
| Payer | `0x76D7D56fb21A6969E1F07B722e3c63E2c80a7cB1` |
| Deployer | `0xFd4Dd604865ECe363188CDc6D98cE30d7c1BA2B1` |

Public addresses are safe to commit. Private keys and API keys are not.

## 1. Import the deployer securely

Do not put a private key in `.env` and do not paste it into a shell command.
Import it into Foundry's encrypted keystore from an interactive prompt:

```bash
cast wallet import blinkpay-deployer --interactive
cast wallet address --account blinkpay-deployer
```

The second command must print the configured deployer address above. Stop if it
does not match.

## 2. Obtain test assets

The deployer already has enough testnet MON for deployment. Request Circle
testnet USDC for the deployer from `https://faucet.circle.com/`, selecting Monad
testnet. The payer needs WMON for the swap test and optionally USDC for the
direct-route test.

Wrap a small amount of MON into WMON from each wallet that needs WMON. For the
encrypted deployer account:

```bash
cast send 0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541 "deposit()" \
  --value 1ether --account blinkpay-deployer \
  --rpc-url https://testnet-rpc.monad.xyz
```

For the payer, call `deposit()` on the same WMON contract from the browser
wallet, or import that wallet into its own encrypted keystore. Never reuse the
deployer account name for a different wallet.

## 3. Deploy the paired contracts

```bash
cd packages/contracts
forge script script/DeployTestnet.s.sol:DeployTestnet \
  --rpc-url https://testnet-rpc.monad.xyz \
  --account blinkpay-deployer \
  --broadcast
```

Record the emitted `pool` and `router` addresses and confirm both have bytecode
on the explorer. The pool owner must be the deployer address.

## 4. Fund the testnet pool

Start with small demo liquidity, for example `1 WMON` and `100 USDC`. Transfer
both tokens directly to the deployed pool:

```bash
cast send 0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541 \
  "transfer(address,uint256)" <POOL_ADDRESS> 1000000000000000000 \
  --account blinkpay-deployer --rpc-url https://testnet-rpc.monad.xyz

cast send 0x534b2f3A21130d7a60830c2Df862319e593943A3 \
  "transfer(address,uint256)" <POOL_ADDRESS> 100000000 \
  --account blinkpay-deployer --rpc-url https://testnet-rpc.monad.xyz
```

The pool price is determined by these reserve balances. This example starts at
`100 USDC / WMON`; it is demo pricing, not a market oracle.

## 5. Configure the application

Keep the secrets in the root `.env`. Add these non-secret values after deploy:

```dotenv
NEXT_PUBLIC_MONAD_NETWORK=testnet
NEXT_PUBLIC_MONAD_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_BLINKPAY_ROUTER_ADDRESS=<ROUTER_ADDRESS>
NEXT_PUBLIC_BLINKPAY_TESTNET_POOL_ADDRESS=<POOL_ADDRESS>
```

The 0x API key is not used by the testnet route. It remains server-only for the
future mainnet path.

## 6. Automated gate

```bash
pnpm check
pnpm rpc:check
```

Both commands must pass before the wallet test.

## 7. Wallet-to-wallet gate

1. Run `pnpm dev` and open the merchant screen.
2. Connect the merchant wallet and create a `0.10 USDC` invoice.
3. Open the payment link in the payer wallet.
4. Test direct payment only if the payer has Circle testnet USDC.
5. For the WMON route, request a fresh quote, approve only the displayed cap,
   and pay before its 30-second deadline.
6. Confirm on the explorer that the merchant USDC balance increased by exactly
   `100000` units, the invoice is marked paid, and the router retains no WMON or
   USDC.
7. Try the same invoice again and confirm replay protection rejects it.

The phase exits only after these observations come from live testnet
transactions. A local green test is necessary but is not the live gate.
