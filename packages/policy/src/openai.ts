import type { PreferenceModelProvider } from "./index";

export const DEFAULT_OPENAI_POLICY_MODEL = "gpt-5.6-luna";

const POLICY_INSTRUCTIONS = `You compile a payer's natural-language preferences into the supplied BlinkPay payment policy schema.
Only interpret preferences about preserving MON, WMON, or USDC; preferred funding; a minimum USDC reserve; a maximum WMON spend; a maximum swap cost in basis points; and whether borrowing is allowed.
Never produce addresses, chain configuration, calldata, contract targets, transaction instructions, prose, or fields outside the schema.
Use base units for minimumUsdcReserveUnits (6 decimals) and wei for maxWmonSpendWei (18 decimals).
Use null for limits the payer did not request. Use AUTO when no funding asset is preferred. Default borrowingAllowed to false unless the payer explicitly allows borrowing.`;

export type OpenAiPreferenceProviderOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export function createOpenAiPreferenceProvider({
  apiKey,
  model = DEFAULT_OPENAI_POLICY_MODEL,
  fetchImpl = fetch,
}: OpenAiPreferenceProviderOptions): PreferenceModelProvider {
  if (!apiKey.trim()) throw new Error("OpenAI API key is not configured");
  if (!model.trim()) throw new Error("OpenAI policy model is not configured");

  return async ({ preferenceText, schema }) => {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          { role: "system", content: POLICY_INSTRUCTIONS },
          { role: "user", content: preferenceText },
        ],
        max_output_tokens: 500,
        text: {
          format: {
            type: "json_schema",
            name: "blinkpay_payment_policy_v1",
            schema,
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI Responses API returned HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    return parseOpenAiPolicyResponse(payload);
  };
}

export function parseOpenAiPolicyResponse(payload: unknown): unknown {
  if (!isRecord(payload)) throw new Error("OpenAI response must be an object");
  if (payload.status === "incomplete") throw new Error("OpenAI response was incomplete");
  if (!Array.isArray(payload.output)) throw new Error("OpenAI response contained no output");

  for (const item of payload.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (content.type === "refusal") throw new Error("OpenAI refused the policy request");
      if (content.type !== "output_text" || typeof content.text !== "string") continue;
      try {
        return JSON.parse(content.text) as unknown;
      } catch {
        throw new Error("OpenAI returned invalid policy JSON");
      }
    }
  }
  throw new Error("OpenAI response contained no policy text");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
