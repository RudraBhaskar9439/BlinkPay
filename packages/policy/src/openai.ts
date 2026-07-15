import type { PreferenceModelProvider } from "./index";
import {
  createResponsesPreferenceProvider,
  parseResponsesPolicyResponse,
} from "./responses";

export const DEFAULT_OPENAI_POLICY_MODEL = "gpt-5.6-luna";

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
  return createResponsesPreferenceProvider({
    apiKey,
    baseUrl: "https://api.openai.com/v1",
    model,
    providerName: "OpenAI",
    store: false,
    fetchImpl,
  });
}

export function parseOpenAiPolicyResponse(payload: unknown): unknown {
  return parseResponsesPolicyResponse(payload);
}
