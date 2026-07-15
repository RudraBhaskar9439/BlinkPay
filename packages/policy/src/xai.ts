import type { PreferenceModelProvider } from "./index";
import { createResponsesPreferenceProvider } from "./responses";

export const DEFAULT_XAI_POLICY_MODEL = "grok-4.3";

export type XaiPreferenceProviderOptions = {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export function createXaiPreferenceProvider({
  apiKey,
  model = DEFAULT_XAI_POLICY_MODEL,
  fetchImpl = fetch,
}: XaiPreferenceProviderOptions): PreferenceModelProvider {
  return createResponsesPreferenceProvider({
    apiKey,
    baseUrl: "https://api.x.ai/v1",
    model,
    providerName: "xAI",
    fetchImpl,
  });
}
