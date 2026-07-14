# Phase 4 — AI Preference Compiler

## Outcome

Phase 4A and Phase 4B are implemented. Payer language is compiled into a
versioned payment policy, strictly validated, normalized into planner inputs,
and displayed as deterministic rules. Server-only Groq, xAI, and OpenAI
adapters can compile phrases that are outside the local parser while preserving
the same validation boundary. If the provider is missing, unavailable, refuses,
returns incomplete output, or returns malformed output, BlinkPay remains usable
through a deterministic fallback or the safe default policy.

Phase 4C is complete. The payer analyzed the same fresh invoice once with
**Preserve MON** and once with **Preserve USDC**. Live balances, quote evidence,
gas assumptions, eligibility, and swap cost remained unchanged while the
documented preference penalty and recommendation switched routes.

## Versioned policy

`PaymentPolicyV1` is the only model-controlled object:

```text
version: 1
preserveAssets: MON | USDC | WMON[]
preferredFundingAsset: AUTO | USDC | WMON
minimumUsdcReserveUnits: integer string | null
maxWmonSpendWei: integer string | null
maxSwapCostBps: integer 0..10000 | null
borrowingAllowed: boolean
```

All fields are required and additional fields are forbidden. Base-unit strings
are bounded before conversion to `bigint`; duplicate or unsupported assets,
invalid enums, missing fields, extra fields, and out-of-range values are
rejected before planner normalization.

## AI safety boundary

The server sends only the preference text, static compiler instructions, and
the JSON schema to the model. It does not send wallet addresses, balances,
chain IDs, contract addresses, router targets, selectors, calldata, signatures,
or transaction authority.

Before the model is called, local checks reject contradictory rules,
unsupported assets, prompt instructions, addresses, calldata, chain
configuration, and executable targets. After the model returns, the complete
object is parsed again by BlinkPay's strict validator. Explanations are produced
from the validated policy by deterministic code; model prose is never rendered
or used as a score.

The preferred configured provider is Groq. `LLM_API_KEY` (or `GROQ_API_KEY`),
`LLM_BASE_URL`, and `LLM_MODEL` configure it. The demo configuration uses
`https://api.groq.com/openai/v1` and `llama-3.3-70b-versatile`.

That Llama model supports JSON Object Mode, not provider-enforced JSON Schema.
BlinkPay therefore includes the schema in static compiler instructions, parses
the returned JSON, and applies the same strict local validator used for every
provider. The UI labels this path **Groq compiled · JSON validated**, avoiding a
false claim that Groq enforced the schema. Groq's current model page documents
the model's [JSON Object Mode capability](https://console.groq.com/docs/model/llama-3.3-70b-versatile),
and its [OpenAI compatibility guide](https://console.groq.com/docs/openai)
documents the configured base URL.

Groq has announced that `llama-3.3-70b-versatile` will be shut down for free and
developer-tier users on August 16, 2026. Its documented replacements are
`openai/gpt-oss-120b` or `qwen/qwen3.6-27b`. BlinkPay keeps the model in an
environment variable so migration requires no code change. xAI and OpenAI
Responses API adapters remain supported behind their provider-specific keys.
All keys are server-only. Without a provider key, the API uses the deterministic
compiler.

## Planner effects

Validated policies can influence only documented planner inputs:

- preferred funding changes the visible deterministic preference penalty;
- a minimum USDC reserve rejects direct payment when the post-payment balance
  would fall below the reserve;
- a maximum WMON spend rejects quotes above the payer's cap;
- a maximum swap cost rejects quotes above the requested basis-point cap; and
- borrowing remains unavailable because no borrowing candidate exists in the
  MVP route allowlist.

Policy changes never alter candidate balances, allowances, quote amounts, pool
evidence, gas estimates, replay state, calldata, or contract addresses.

## Automated evidence

The policy suite covers representative preservation phrases, reserve/spend/cost
normalization, contradictions, unsupported assets, bounds, executable
configuration attempts, additional model fields, malformed model output,
provider failure, strict Responses API request construction, Groq JSON Object
Mode construction, refusal, incomplete output, invalid JSON, unsafe base URLs,
sanitized upstream HTTP errors, and provider-specific endpoint/configuration
behavior.

The planner suite additionally proves that a USDC reserve can reject the direct
route and that a swap-cost cap can reject the WMON route. Existing deterministic
ranking, replay, expiry, quote, balance, and simulation tests continue to pass.

The live API smoke gate passed for:

- `Preserve MON and never borrow` → USDC preference;
- `Preserve USDC and never borrow` → WMON preference;
- contradictory preservation/funding rules → HTTP 422 clarification; and
- executable configuration/prompt injection text → HTTP 422 rejection.

The authenticated Groq gate passed on July 15, 2026 using the configured
`llama-3.3-70b-versatile` model. `Preserve USDC and never borrow` returned a
model-sourced policy that preserves USDC, prefers WMON, and forbids borrowing.
A combined `0.25 USDC` reserve, `0.01 WMON` maximum, and `200 bps` cost cap
returned the exact normalized base-unit values without inventing preservation
rules.

The first authenticated run exposed a semantic defect despite valid JSON: the
model initially returned `AUTO` for **Preserve USDC** and treated numeric caps as
preservation requests. Static compiler rules were clarified, and BlinkPay now
cross-checks model output against deterministic semantics whenever the local
parser recognizes the phrase. A schema-valid disagreement is rejected and
falls back to the deterministic policy. The corrected authenticated runs passed
with `source: model` and no fallback warning.

The repository quality gate is `pnpm check`. The production build includes the
server-only `/api/preferences` endpoint.

## Phase 4C manual acceptance

The matrix passed on Monad testnet on July 15, 2026 with the same unpaid `0.1
USDC` invoice and payer wallet:

- Live facts stayed fixed at `1.282351092315835636 MON`, `0.8 USDC`, and
  `0.048986859568604804 WMON`. The WMON maximum stayed
  `0.001039017113929055`, direct and swap gas estimates stayed `185000` and
  `465000`, and swap cost stayed `132 bps`.
- **Preserve MON** preferred direct USDC. Direct ranked `#1` at score `28`; WMON
  ranked `#2` at score `1188`.
- **Preserve USDC** preferred WMON. The corrected rerun switched WMON to `#1`
  at score `188` and direct USDC to `#2` at score `1028` without changing any
  candidate fact or hard constraint.
- Compilation and analysis requested no wallet signature and submitted no
  transaction.

Phase 4 passes its exit gate: AI output influences only documented policy
fields, every model policy is validated and semantically cross-checked, and
every onchain transaction still requires explicit wallet review and signature.
