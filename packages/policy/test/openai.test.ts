import { describe, expect, it, vi } from "vitest";
import { paymentPolicyV1JsonSchema } from "../src";
import {
  createOpenAiPreferenceProvider,
  parseOpenAiPolicyResponse,
} from "../src/openai";

const VALID_POLICY = {
  version: 1,
  preserveAssets: ["USDC"],
  preferredFundingAsset: "WMON",
  minimumUsdcReserveUnits: null,
  maxWmonSpendWei: null,
  maxSwapCostBps: null,
  borrowingAllowed: false,
};

describe("OpenAI preference adapter", () => {
  it("sends only policy text and the strict schema to the Responses API", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({
        status: "completed",
        output: [{
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(VALID_POLICY) }],
        }],
      }), { status: 200 });
    });
    const provider = createOpenAiPreferenceProvider({
      apiKey: "test-key",
      model: "test-model",
      fetchImpl,
    });

    await expect(provider({
      preferenceText: "Preserve USDC",
      schema: paymentPolicyV1JsonSchema,
    })).resolves.toEqual(VALID_POLICY);

    expect(capturedUrl).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "test-model",
      store: false,
      max_output_tokens: 500,
      text: {
        format: {
          type: "json_schema",
          name: "blinkpay_payment_policy_v1",
          strict: true,
          schema: paymentPolicyV1JsonSchema,
        },
      },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).toContain("Preserve USDC");
    expect(serialized).not.toMatch(/0x[a-f0-9]{8,}/iu);
    expect(serialized).not.toContain("chainId");
    expect(body.input).toEqual(expect.arrayContaining([
      { role: "user", content: "Preserve USDC" },
    ]));
  });

  it("rejects refusals, incomplete responses, and invalid JSON", () => {
    expect(() => parseOpenAiPolicyResponse({
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }],
    })).toThrow("refused");
    expect(() => parseOpenAiPolicyResponse({ status: "incomplete", output: [] }))
      .toThrow("incomplete");
    expect(() => parseOpenAiPolicyResponse({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "{" }] }],
    })).toThrow("invalid policy JSON");
  });

  it("does not include an upstream response body in HTTP errors", async () => {
    const provider = createOpenAiPreferenceProvider({
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
