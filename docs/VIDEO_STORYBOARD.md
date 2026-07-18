# BlinkPay Spark video storyboard

| Time | Visual direction | Proof shown |
|---|---|---|
| 00:00–00:06 | Three-beat cinematic hook: exact invoice, fragmented value, safest route | Problem and product promise land before the detailed demo |
| 00:06–00:20 | Landing-page reveal with fragmented asset chips | Live product and Monad branding |
| 00:20–00:42 | Step 1: connect merchant wallet, enter amount/description/expiry, approve EIP-712 signature, share link or QR | Portable invoice is created without a custodial database |
| 00:42–01:15 | Step 2: payer opens link, connects wallet, writes preferences, applies policy, selects Analyze wallet routes | AI is advisory; deterministic planner and wallet remain authoritative |
| 01:15–01:52 | Step 3: eligible and rejected route cards animate beside payer UI; recommendation, allowance and final wallet confirmation are called out | Direct, WMON, vault, both atomic splits, and explicit failed constraints |
| 01:52–02:18 | Step 4: payment confirmation becomes a Monad receipt with balance delta and replay state | Exact USDC delta, zero retention, paid state, replay protection |
| 02:18–02:45 | Test metrics, open-source links, product CTA | 60 Solidity tests, invariants, five routes, zero custody |

The motion project lives in `apps/video`. User narration and final rendered
files stay outside Git; the timing sheet and reusable animation source remain
version-controlled.
