export type PolicyAsset = "MON" | "USDC" | "WMON";
export type FundingPreference = "AUTO" | "USDC" | "WMON";

export type PaymentPolicyV1 = {
  version: 1;
  preserveAssets: PolicyAsset[];
  preferredFundingAsset: FundingPreference;
  minimumUsdcReserveUnits: string | null;
  maxWmonSpendWei: string | null;
  maxSwapCostBps: number | null;
  borrowingAllowed: boolean;
};

export type NormalizedPaymentPolicy = {
  version: 1;
  preserveAssets: PolicyAsset[];
  preferredFundingAsset?: "USDC" | "WMON";
  minimumUsdcReserve?: bigint;
  maxWmonSpend?: bigint;
  maxSwapCostBps?: number;
  borrowingAllowed: boolean;
};

export type PolicyExplanation = {
  id: string;
  label: string;
  effect: string;
};

export type PreferenceCompilation =
  | {
    status: "compiled";
    source: "deterministic" | "model" | "deterministic-fallback" | "safe-default";
    policy: PaymentPolicyV1;
    normalized: NormalizedPaymentPolicy;
    explanations: PolicyExplanation[];
    warning?: string;
  }
  | {
    status: "clarification";
    message: string;
    issues: string[];
  };

export type PreferenceModelRequest = {
  preferenceText: string;
  schema: typeof paymentPolicyV1JsonSchema;
};

export type PreferenceModelProvider = (request: PreferenceModelRequest) => Promise<unknown>;

const MAX_PREFERENCE_LENGTH = 500;
const MAX_USDC_RESERVE_UNITS = 1_000_000_000n * 1_000_000n;
const MAX_WMON_SPEND_WEI = 1_000_000_000n * 10n ** 18n;
const EXECUTABLE_CONFIGURATION_PATTERN = /(?:0x[a-f0-9]{8,}|calldata|chain\s*id|contract\s+address|router\s+address|swap\s+target|function\s+selector|ignore\s+(?:all\s+)?previous|system\s+prompt)/iu;
const UNKNOWN_ASSET_PATTERN = /\b(?:ETH|WETH|BTC|WBTC|DAI|USDT|SOL)\b/u;

export const DEFAULT_PAYMENT_POLICY_V1: PaymentPolicyV1 = Object.freeze({
  version: 1,
  preserveAssets: [],
  preferredFundingAsset: "AUTO",
  minimumUsdcReserveUnits: null,
  maxWmonSpendWei: null,
  maxSwapCostBps: null,
  borrowingAllowed: false,
});

export const paymentPolicyV1JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "preserveAssets",
    "preferredFundingAsset",
    "minimumUsdcReserveUnits",
    "maxWmonSpendWei",
    "maxSwapCostBps",
    "borrowingAllowed",
  ],
  properties: {
    version: { type: "integer", const: 1 },
    preserveAssets: {
      type: "array",
      items: { type: "string", enum: ["MON", "USDC", "WMON"] },
      maxItems: 3,
    },
    preferredFundingAsset: { type: "string", enum: ["AUTO", "USDC", "WMON"] },
    minimumUsdcReserveUnits: {
      anyOf: [{ type: "string", pattern: "^(0|[1-9][0-9]*)$" }, { type: "null" }],
    },
    maxWmonSpendWei: {
      anyOf: [{ type: "string", pattern: "^(0|[1-9][0-9]*)$" }, { type: "null" }],
    },
    maxSwapCostBps: {
      anyOf: [{ type: "integer", minimum: 0, maximum: 10_000 }, { type: "null" }],
    },
    borrowingAllowed: { type: "boolean" },
  },
} as const;

export function compilePreferenceText(preferenceText: string): PreferenceCompilation {
  const text = preferenceText.trim();
  if (text.length > MAX_PREFERENCE_LENGTH) {
    return clarification("Preference is too long", [
      `Use at most ${MAX_PREFERENCE_LENGTH} characters`,
    ]);
  }
  if (EXECUTABLE_CONFIGURATION_PATTERN.test(text)) {
    return clarification("Preferences cannot modify executable configuration", [
      "Remove addresses, calldata, chain configuration, selectors, and prompt instructions",
    ]);
  }
  const unknownAsset = text.match(UNKNOWN_ASSET_PATTERN)?.[0];
  if (unknownAsset) {
    return clarification("Unsupported asset in preference", [
      `${unknownAsset} is not a supported BlinkPay funding asset`,
    ]);
  }
  if (!text) return compiled(DEFAULT_PAYMENT_POLICY_V1, "deterministic");

  const preserveMon = /\b(?:preserve|save|keep|avoid\s+spending)\s+(?:my\s+)?(?:MON|WMON)\b/iu.test(text);
  const preserveUsdc = /\b(?:preserve|save|keep|avoid\s+spending)\s+(?:my\s+)?USDC\b/iu.test(text);
  const preferUsdc = /\b(?:prefer|use)\s+(?:my\s+)?USDC\b|\bprefer\s+(?:idle\s+)?stablecoins?\b/iu.test(text);
  const preferWmon = /\b(?:prefer|use)\s+(?:my\s+)?WMON\b/iu.test(text);
  const forbidsBorrowing = /\b(?:never|do\s+not|don['’]?t)\s+borrow\b|\bforbid\s+borrowing\b/iu.test(text);
  const allowsBorrowing = /\b(?:allow|permit)\s+borrowing\b/iu.test(text);

  const issues: string[] = [];
  if (preserveMon && preserveUsdc) {
    issues.push("Preserving both USDC and MON leaves no preferred current funding route");
  }
  if (forbidsBorrowing && allowsBorrowing) {
    issues.push("Borrowing is both allowed and forbidden");
  }

  const impliedPreference = preserveMon ? "USDC" : preserveUsdc ? "WMON" : undefined;
  const explicitPreference = preferUsdc ? "USDC" : preferWmon ? "WMON" : undefined;
  if (preferUsdc && preferWmon) issues.push("Both USDC and WMON are preferred");
  if (impliedPreference && explicitPreference && impliedPreference !== explicitPreference) {
    issues.push("The preservation rule conflicts with the preferred funding asset");
  }
  if (issues.length) return clarification("Preferences conflict", issues);

  let minimumUsdcReserveUnits: string | null = null;
  let maxWmonSpendWei: string | null = null;
  let maxSwapCostBps: number | null = null;
  let numericError: string | undefined;

  const reserveMatch = text.match(/\b(?:keep|leave|maintain)\s+(?:at\s+least\s+)?(\d+(?:\.\d+)?)\s*USDC\b/iu);
  if (reserveMatch?.[1]) {
    try {
      minimumUsdcReserveUnits = parseDecimalUnits(reserveMatch[1], 6, MAX_USDC_RESERVE_UNITS).toString();
    } catch (error) {
      numericError = getErrorMessage(error);
    }
  }

  const wmonCapMatch = text.match(/\b(?:spend|use)\s+(?:no\s+more\s+than|at\s+most|max(?:imum)?(?:\s+of)?)\s+(\d+(?:\.\d+)?)\s*WMON\b/iu);
  if (wmonCapMatch?.[1]) {
    try {
      maxWmonSpendWei = parseDecimalUnits(wmonCapMatch[1], 18, MAX_WMON_SPEND_WEI).toString();
    } catch (error) {
      numericError = getErrorMessage(error);
    }
  }

  const costMatch = text.match(/\b(?:cost|fees?|slippage)\s+(?:under|below|at\s+most|max(?:imum)?)\s+(\d+)\s*(?:bps|basis\s+points?)\b/iu);
  if (costMatch?.[1]) {
    const value = Number(costMatch[1]);
    if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) {
      numericError = "Swap cost must be between 0 and 10,000 basis points";
    } else {
      maxSwapCostBps = value;
    }
  }
  if (numericError) return clarification("Preference value is out of range", [numericError]);

  const preserveAssets: PolicyAsset[] = [];
  if (preserveMon) preserveAssets.push("MON");
  if (preserveUsdc) preserveAssets.push("USDC");
  const preferredFundingAsset = explicitPreference ?? impliedPreference ?? "AUTO";
  const recognized = preserveAssets.length > 0 || explicitPreference !== undefined
    || forbidsBorrowing || allowsBorrowing || reserveMatch !== null
    || wmonCapMatch !== null || costMatch !== null;

  if (!recognized) {
    return clarification("Preference needs clarification", [
      "Try preserve MON, preserve USDC, keep 5 USDC, spend at most 0.02 WMON, or cost under 200 bps",
    ]);
  }

  return compiled({
    version: 1,
    preserveAssets,
    preferredFundingAsset,
    minimumUsdcReserveUnits,
    maxWmonSpendWei,
    maxSwapCostBps,
    borrowingAllowed: allowsBorrowing && !forbidsBorrowing,
  }, "deterministic");
}

export async function compilePreferenceWithModel(
  preferenceText: string,
  provider: PreferenceModelProvider,
): Promise<PreferenceCompilation> {
  const inputCheck = compilePreferenceText(preferenceText);
  if (inputCheck.status === "clarification"
    && inputCheck.message !== "Preference needs clarification") {
    return inputCheck;
  }

  try {
    const output = await provider({ preferenceText, schema: paymentPolicyV1JsonSchema });
    return compiled(parsePaymentPolicyV1(output), "model");
  } catch (error) {
    const deterministic = compilePreferenceText(preferenceText);
    if (deterministic.status === "compiled") {
      return {
        ...deterministic,
        source: "deterministic-fallback",
        warning: `AI provider unavailable or invalid: ${getErrorMessage(error)}`,
      };
    }
    return {
      ...compiled(DEFAULT_PAYMENT_POLICY_V1, "safe-default"),
      warning: `AI provider unavailable or invalid: ${getErrorMessage(error)}`,
    };
  }
}

export function parsePaymentPolicyV1(value: unknown): PaymentPolicyV1 {
  if (!isRecord(value)) throw new Error("Policy output must be an object");
  const expectedKeys = Object.keys(paymentPolicyV1JsonSchema.properties).sort();
  const actualKeys = Object.keys(value).sort();
  if (expectedKeys.join("|") !== actualKeys.join("|")) {
    throw new Error("Policy output contains missing or unsupported fields");
  }
  if (value.version !== 1) throw new Error("Policy version must be 1");
  if (!Array.isArray(value.preserveAssets)) throw new Error("preserveAssets must be an array");
  const preserveAssets = value.preserveAssets.map((asset) => requirePolicyAsset(asset));
  if (new Set(preserveAssets).size !== preserveAssets.length) {
    throw new Error("preserveAssets must not contain duplicates");
  }
  const preferredFundingAsset = requireFundingPreference(value.preferredFundingAsset);
  const minimumUsdcReserveUnits = requireNullableUnitString(
    value.minimumUsdcReserveUnits,
    "minimumUsdcReserveUnits",
    MAX_USDC_RESERVE_UNITS,
  );
  const maxWmonSpendWei = requireNullableUnitString(
    value.maxWmonSpendWei,
    "maxWmonSpendWei",
    MAX_WMON_SPEND_WEI,
  );
  const maxSwapCostBps = requireNullableBps(value.maxSwapCostBps);
  if (typeof value.borrowingAllowed !== "boolean") {
    throw new Error("borrowingAllowed must be a boolean");
  }
  return {
    version: 1,
    preserveAssets,
    preferredFundingAsset,
    minimumUsdcReserveUnits,
    maxWmonSpendWei,
    maxSwapCostBps,
    borrowingAllowed: value.borrowingAllowed,
  };
}

export function normalizePaymentPolicy(policy: PaymentPolicyV1): NormalizedPaymentPolicy {
  const validated = parsePaymentPolicyV1(policy);
  return {
    version: 1,
    preserveAssets: [...validated.preserveAssets],
    ...(validated.preferredFundingAsset === "AUTO"
      ? {}
      : { preferredFundingAsset: validated.preferredFundingAsset }),
    ...(validated.minimumUsdcReserveUnits === null
      ? {}
      : { minimumUsdcReserve: BigInt(validated.minimumUsdcReserveUnits) }),
    ...(validated.maxWmonSpendWei === null
      ? {}
      : { maxWmonSpend: BigInt(validated.maxWmonSpendWei) }),
    ...(validated.maxSwapCostBps === null
      ? {}
      : { maxSwapCostBps: validated.maxSwapCostBps }),
    borrowingAllowed: validated.borrowingAllowed,
  };
}

export function explainPaymentPolicy(policy: PaymentPolicyV1): PolicyExplanation[] {
  const normalized = normalizePaymentPolicy(policy);
  const explanations: PolicyExplanation[] = [];
  for (const asset of normalized.preserveAssets) {
    explanations.push({
      id: `preserve-${asset.toLowerCase()}`,
      label: `Preserve ${asset}`,
      effect: asset === "USDC"
        ? "Prefer WMON funding so idle USDC remains untouched."
        : "Prefer USDC funding so MON-linked liquidity remains untouched.",
    });
  }
  if (normalized.minimumUsdcReserve !== undefined) {
    explanations.push({
      id: "minimum-usdc-reserve",
      label: "Keep a USDC reserve",
      effect: `Direct payment must leave at least ${normalized.minimumUsdcReserve} base units.`,
    });
  }
  if (normalized.maxWmonSpend !== undefined) {
    explanations.push({
      id: "maximum-wmon-spend",
      label: "Cap WMON spend",
      effect: `Reject quotes above ${normalized.maxWmonSpend} wei.`,
    });
  }
  if (normalized.maxSwapCostBps !== undefined) {
    explanations.push({
      id: "maximum-swap-cost",
      label: "Cap swap cost",
      effect: `Reject swap cost above ${normalized.maxSwapCostBps} bps.`,
    });
  }
  explanations.push({
    id: "borrowing",
    label: normalized.borrowingAllowed ? "Borrowing allowed" : "Borrowing forbidden",
    effect: normalized.borrowingAllowed
      ? "Borrowing may be considered only if a future allowlisted route exists."
      : "Borrowing candidates are forbidden.",
  });
  if (!explanations.some((item) => item.id.startsWith("preserve-"))
    && normalized.preferredFundingAsset) {
    explanations.push({
      id: "preferred-funding-asset",
      label: `Prefer ${normalized.preferredFundingAsset}`,
      effect: `Apply the deterministic preference penalty to the other funding asset.`,
    });
  }
  return explanations;
}

function compiled(
  policy: PaymentPolicyV1,
  source: Extract<PreferenceCompilation, { status: "compiled" }>["source"],
): Extract<PreferenceCompilation, { status: "compiled" }> {
  const validated = parsePaymentPolicyV1(policy);
  return {
    status: "compiled",
    source,
    policy: validated,
    normalized: normalizePaymentPolicy(validated),
    explanations: explainPaymentPolicy(validated),
  };
}

function clarification(message: string, issues: string[]): PreferenceCompilation {
  return { status: "clarification", message, issues };
}

function parseDecimalUnits(value: string, decimals: number, maximum: bigint): bigint {
  if (!/^\d+(?:\.\d+)?$/u.test(value)) throw new Error("Amount must be a positive decimal");
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error(`Amount supports at most ${decimals} decimals`);
  const units = BigInt(whole) * 10n ** BigInt(decimals)
    + BigInt(fraction.padEnd(decimals, "0") || "0");
  if (units > maximum) throw new Error("Amount exceeds the supported policy range");
  return units;
}

function requirePolicyAsset(value: unknown): PolicyAsset {
  if (value !== "MON" && value !== "USDC" && value !== "WMON") {
    throw new Error("preserveAssets contains an unsupported asset");
  }
  return value;
}

function requireFundingPreference(value: unknown): FundingPreference {
  if (value !== "AUTO" && value !== "USDC" && value !== "WMON") {
    throw new Error("preferredFundingAsset is invalid");
  }
  return value;
}

function requireNullableUnitString(
  value: unknown,
  field: string,
  maximum: bigint,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/u.test(value)) {
    throw new Error(`${field} must be a base-10 integer string or null`);
  }
  if (BigInt(value) > maximum) throw new Error(`${field} exceeds the supported range`);
  return value;
}

function requireNullableBps(value: unknown): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < 0 || value > 10_000) {
    throw new Error("maxSwapCostBps must be an integer from 0 to 10,000 or null");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown provider error";
}
