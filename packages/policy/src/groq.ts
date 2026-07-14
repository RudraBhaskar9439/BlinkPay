import type { PreferenceModelProvider } from "./index";
import { POLICY_INSTRUCTIONS } from "./responses";

export const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_GROQ_POLICY_MODEL = "llama-3.3-70b-versatile";

export type GroqPreferenceProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export function createGroqPreferenceProvider({
  apiKey,
  baseUrl = DEFAULT_GROQ_BASE_URL,
  model = DEFAULT_GROQ_POLICY_MODEL,
  fetchImpl = fetch,
}: GroqPreferenceProviderOptions): PreferenceModelProvider {
  if (!apiKey.trim()) throw new Error("Groq API key is not configured");
  if (!model.trim()) throw new Error("Groq policy model is not configured");
  const endpoint = groqChatCompletionsEndpoint(baseUrl);

  return async ({ preferenceText, schema }) => {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `${POLICY_INSTRUCTIONS}\nReturn exactly one JSON object matching this schema. Do not wrap it in Markdown:\n${JSON.stringify(schema)}`,
          },
          { role: "user", content: preferenceText },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_completion_tokens: 500,
      }),
    });

    if (!response.ok) throw new Error(`Groq Chat Completions API returned HTTP ${response.status}`);
    const payload: unknown = await response.json();
    return parseGroqPolicyResponse(payload);
  };
}

export function parseGroqPolicyResponse(payload: unknown): unknown {
  if (!isRecord(payload) || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    throw new Error("Groq response contained no choices");
  }
  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) {
    throw new Error("Groq response contained no message");
  }
  if (typeof choice.message.refusal === "string" && choice.message.refusal) {
    throw new Error("Groq refused the policy request");
  }
  if (typeof choice.message.content !== "string") {
    throw new Error("Groq response contained no policy text");
  }
  try {
    return JSON.parse(choice.message.content) as unknown;
  } catch {
    throw new Error("Groq returned invalid policy JSON");
  }
}

function groqChatCompletionsEndpoint(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Groq base URL is invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Groq base URL must be a credential-free HTTPS URL");
  }
  return `${url.toString().replace(/\/$/u, "")}/chat/completions`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
