import { describe, expect, it, vi } from "vitest";
import { paymentPolicyV1JsonSchema } from "../src";
import {
  createGroqPreferenceProvider,
  parseGroqPolicyResponse,
} from "../src/groq";

const VALID_POLICY = {
  version: 1,
  preserveAssets: ["MON"],
  preferredFundingAsset: "USDC",
  minimumUsdcReserveUnits: null,
  maxWmonSpendWei: null,
  maxSwapCostBps: null,
  borrowingAllowed: false,
};

describe("Groq preference adapter", () => {
  it("uses JSON Object Mode and includes the policy schema in static instructions", async () => {
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(VALID_POLICY) } }],
      }), { status: 200 });
    });
    const provider = createGroqPreferenceProvider({
      apiKey: "test-key",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      fetchImpl,
    });

    await expect(provider({
      preferenceText: "Preserve MON",
      schema: paymentPolicyV1JsonSchema,
    })).resolves.toEqual(VALID_POLICY);
    expect(capturedUrl).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(capturedBody).toMatchObject({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_completion_tokens: 500,
    });
    const messages = capturedBody.messages as Array<Record<string, unknown>>;
    expect(messages[0]?.content).toContain(JSON.stringify(paymentPolicyV1JsonSchema));
    expect(messages[1]).toEqual({ role: "user", content: "Preserve MON" });
    expect(JSON.stringify(capturedBody)).not.toMatch(/0x[a-f0-9]{8,}/iu);
  });

  it("rejects unsafe base URLs before sending a key", () => {
    expect(() => createGroqPreferenceProvider({
      apiKey: "test-key",
      baseUrl: "http://api.groq.com/openai/v1",
    })).toThrow("credential-free HTTPS");
    expect(() => createGroqPreferenceProvider({
      apiKey: "test-key",
      baseUrl: "https://user:password@api.groq.com/openai/v1",
    })).toThrow("credential-free HTTPS");
  });

  it("rejects refusals, missing content, and malformed JSON", () => {
    expect(() => parseGroqPolicyResponse({
      choices: [{ message: { refusal: "No", content: null } }],
    })).toThrow("refused");
    expect(() => parseGroqPolicyResponse({ choices: [] })).toThrow("no choices");
    expect(() => parseGroqPolicyResponse({
      choices: [{ message: { content: "{" } }],
    })).toThrow("invalid policy JSON");
  });

  it("does not expose an upstream error body", async () => {
    const provider = createGroqPreferenceProvider({
      apiKey: "test-key",
      fetchImpl: async () => new Response("sensitive upstream detail", { status: 429 }),
    });
    await expect(provider({
      preferenceText: "Preserve MON",
      schema: paymentPolicyV1JsonSchema,
    })).rejects.toThrow("HTTP 429");
    await expect(provider({
      preferenceText: "Preserve MON",
      schema: paymentPolicyV1JsonSchema,
    })).rejects.not.toThrow("sensitive upstream detail");
  });
});
