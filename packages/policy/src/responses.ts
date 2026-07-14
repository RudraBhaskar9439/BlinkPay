import type { PreferenceModelProvider } from "./index";

const POLICY_INSTRUCTIONS = `You compile a payer's natural-language preferences into the supplied BlinkPay payment policy schema.
Only interpret preferences about preserving MON, WMON, or USDC; preferred funding; a minimum USDC reserve; a maximum WMON spend; a maximum swap cost in basis points; and whether borrowing is allowed.
Never produce addresses, chain configuration, calldata, contract targets, transaction instructions, prose, or fields outside the schema.
Use base units for minimumUsdcReserveUnits (6 decimals) and wei for maxWmonSpendWei (18 decimals).
Use null for limits the payer did not request. Use AUTO when no funding asset is preferred. Default borrowingAllowed to false unless the payer explicitly allows borrowing.`;

export type ResponsesPreferenceProviderOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerName: string;
  store?: boolean;
  fetchImpl?: typeof fetch;
};

export function createResponsesPreferenceProvider({
  apiKey,
  baseUrl,
  model,
  providerName,
  store,
  fetchImpl = fetch,
}: ResponsesPreferenceProviderOptions): PreferenceModelProvider {
  if (!apiKey.trim()) throw new Error(`${providerName} API key is not configured`);
  if (!model.trim()) throw new Error(`${providerName} policy model is not configured`);
  const endpoint = `${baseUrl.replace(/\/$/u, "")}/responses`;

  return async ({ preferenceText, schema }) => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        ...(store === undefined ? {} : { store }),
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
      throw new Error(`${providerName} Responses API returned HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    return parseResponsesPolicyResponse(payload);
  };
}

export function parseResponsesPolicyResponse(payload: unknown): unknown {
  if (!isRecord(payload)) throw new Error("AI response must be an object");
  if (payload.status === "incomplete") throw new Error("AI response was incomplete");
  if (!Array.isArray(payload.output)) throw new Error("AI response contained no output");

  for (const item of payload.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (content.type === "refusal") throw new Error("AI provider refused the policy request");
      if (content.type !== "output_text" || typeof content.text !== "string") continue;
      try {
        return JSON.parse(content.text) as unknown;
      } catch {
        throw new Error("AI provider returned invalid policy JSON");
      }
    }
  }
  throw new Error("AI response contained no policy text");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
