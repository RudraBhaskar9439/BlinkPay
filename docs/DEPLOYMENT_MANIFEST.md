# BlinkPay release-candidate deployment manifest

This manifest records the active Phase 7 deployment used by the testnet web
application. It is not a mainnet or production deployment.

## Network and build

| Field | Value |
| --- | --- |
| Network | Monad testnet |
| Chain ID | `10143` |
| Solidity | `0.8.30` |
| Optimizer | enabled, 200 runs |
| Router contract | `BlinkPaySplitRouter` |
| Deployment block | `44980259` |
| Deployment transaction | `0x32dc30befbf91acb8f343914149195c3812b1c2124754dc1b704f598a4c00f0d` |

## Addresses and immutable configuration

| Component | Address |
| --- | --- |
| Hardened BlinkPay router | `0x6054f7E75E07f5d127DceEA3b2D683959a51c9AA` |
| Router owner | `0xFd4Dd604865ECe363188CDc6D98cE30d7c1BA2B1` |
| Circle testnet USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| WMON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |
| Testnet exact-output pool | `0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3` |
| Swap target | `0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3` |
| Allowance target | `0x88a2208424bFB2D3fc4F299e92993FFe5fAFedb3` |
| Testnet ERC-4626 vault | `0xbb171586DE327A2c9BB2ea3A7D200B9A92fbeb89` |
| Allowed swap selector | `0x95bfcde8` (`swapExactOutput(uint256,uint256,address)`) |

Every value above was read independently from the deployed bytecode or its
public getters after deployment. Integrations are immutable; changing one
requires a new router deployment. The only privileged runtime control is
`setPaymentsPaused(bool)`.

## Source verification

The router was submitted to Monad's Sourcify-compatible verification service.
Verification job `3b4dda0b-0bb4-492e-9cd5-dcd8f099a74b` completed with an
`exact_match` for runtime bytecode on chain `10143` (match ID `543108`). The
service reports `creationMatch: null`, so this manifest claims exact deployed
runtime verification, not a creation-bytecode match.

## Operational checks

- Initial pause state: `false`.
- Pause transaction:
  `0xdf7a34b2e8400f501dea680c3ec83c799354e3b5e2bd2658ed58e95dc5c18baf`.
- While paused, a valid-shaped payment call reverted with `PaymentsPaused()`.
- Unpause transaction:
  `0x1a3ad717bc08790a13832b23d88be6c1a286ac21e4a77daea939d309e9949921`.
- Final independently read pause state: `false`.
- Live acceptance transaction:
  `0xb4a23e00583b366aee730f0a6cdbe11544efb1d9a129687979e9b0fa71328571`.

The labelled pool and vault are BlinkPay testnet fixtures. They must not be
represented as production liquidity or third-party protocol deployments.
