# Phase 4 — AI Preference Compiler

## Outcome

Phase 4A and Phase 4B are implemented. Payer language is compiled into a
versioned payment policy, strictly validated, normalized into planner inputs,
and displayed as deterministic rules. Server-only Groq, xAI, and OpenAI
adapters can compile phrases that are outside the local parser while preserving
the same validation boundary. If the provider is missing, unavailable, refuses,
returns incomplete output, or returns malformed output, BlinkPay remains usable
through a deterministic fallback or the safe default policy.

The final Phase 4C wallet acceptance matrix remains open. It requires the payer
to analyze the same fresh invoice once with **Preserve MON** and once with
**Preserve USDC**, then confirm that route facts stay unchanged while only the
documented preference rule and recommendation change.

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

The repository quality gate is `pnpm check`. The production build includes the
server-only `/api/preferences` endpoint.

## Phase 4C manual acceptance

1. Add the Groq key locally as `LLM_API_KEY` or `GROQ_API_KEY`. Keep the supplied
   `LLM_BASE_URL` and `LLM_MODEL` values. Never paste or commit the key.
2. Create one fresh `0.1 USDC` invoice and open it with the payer wallet.
3. Choose **Preserve MON**, compile the policy, and analyze wallet routes.
4. Record balances, maximums, gas, swap cost, eligibility, scores, and rank.
5. Choose **Preserve USDC**, compile, and analyze the same unpaid invoice again.
6. Confirm the recorded route facts are unchanged, the visible preference rule
   changes, and the recommendation switches from direct USDC to WMON when both
   routes remain eligible.
7. Confirm no wallet signature request occurs during compilation or analysis.

Once this matrix is captured, Phase 4 passes its exit gate: AI output influences
only documented policy fields, and every onchain transaction still requires
explicit wallet review and signature.
