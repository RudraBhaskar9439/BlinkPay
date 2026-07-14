import { describe, expect, it } from "vitest";
import { buildPaymentPlans, type PlannerInput } from "../src";

const NOW = 1_000n;

function input(overrides: Partial<PlannerInput> = {}): PlannerInput {
  return {
    now: NOW,
    invoiceAmount: 100_000n,
    invoiceExpiry: NOW + 1_800n,
    invoiceAlreadyPaid: false,
    direct: {
      balance: 900_000n,
      allowance: 0n,
      simulation: { status: "requires-approval" },
    },
    swap: {
      balance: 50_000_000_000_000_000n,
      allowance: 0n,
      quote: {
        estimatedSellAmount: 1_013_140_431_395_196n,
        maxSellAmount: 1_018_206_133_552_172n,
        expiresAt: NOW + 180n,
        swapCostBps: 131,
      },
      simulation: { status: "requires-approval" },
    },
    ...overrides,
  };
}

describe("deterministic payment planner", () => {
  it("returns the same order and score for identical inputs", () => {
    expect(buildPaymentPlans(input())).toEqual(buildPaymentPlans(input()));
    expect(buildPaymentPlans(input()).recommendedPlanId).toBe("direct-usdc");
  });

  it("rejects direct payment when USDC is insufficient", () => {
    const result = buildPaymentPlans(input({
      direct: { balance: 99_999n, allowance: 0n, simulation: { status: "requires-approval" } },
    }));
    const direct = result.plans.find((plan) => plan.id === "direct-usdc");
    expect(direct?.status).toBe("unavailable");
    expect(direct?.rejectionReasons.join(" ")).toContain("USDC balance");
    expect(result.recommendedPlanId).toBe("swap-wmon");
  });

  it("rejects a quote above the configured WMON cap", () => {
    const result = buildPaymentPlans(input({ preferences: { maxWmonSpend: 1n } }));
    const swap = result.plans.find((plan) => plan.id === "swap-wmon");
    expect(swap?.status).toBe("unavailable");
    expect(swap?.rejectionReasons.join(" ")).toContain("spending cap");
  });

  it("never presents stale quotes as executable", () => {
    const base = input();
    const result = buildPaymentPlans({
      ...base,
      swap: {
        ...base.swap,
        quote: { ...base.swap.quote!, expiresAt: NOW },
      },
    });
    const swap = result.plans.find((plan) => plan.id === "swap-wmon");
    expect(swap?.status).toBe("unavailable");
    expect(swap?.rejectionReasons.join(" ")).toContain("Quote remains executable");
  });

  it("marks a simulation failure unavailable with its reason", () => {
    const base = input();
    const result = buildPaymentPlans({
      ...base,
      direct: {
        ...base.direct,
        allowance: base.invoiceAmount,
        simulation: { status: "failed", reason: "execution reverted" },
      },
    });
    const direct = result.plans.find((plan) => plan.id === "direct-usdc");
    expect(direct?.status).toBe("unavailable");
    expect(direct?.rejectionReasons.join(" ")).toContain("execution reverted");
  });

  it("returns a recoverable unavailable swap plan when quoting fails", () => {
    const base = input();
    const result = buildPaymentPlans({
      ...base,
      swap: {
        balance: base.swap.balance,
        allowance: base.swap.allowance,
        quoteError: "Pool RPC unavailable",
        simulation: { status: "not-run" },
      },
    });
    const swap = result.plans.find((plan) => plan.id === "swap-wmon");
    expect(swap?.status).toBe("unavailable");
    expect(swap?.rejectionReasons.join(" ")).toContain("Pool RPC unavailable");
    expect(swap?.rejectionReasons).toHaveLength(1);
    expect(swap?.constraints.filter((constraint) => constraint.status === "pending"))
      .toHaveLength(4);
    expect(result.recommendedPlanId).toBe("direct-usdc");
  });

  it("honors an explicit WMON preference without changing eligibility facts", () => {
    const result = buildPaymentPlans(input({
      preferences: { preferredFundingAsset: "WMON" },
    }));
    expect(result.recommendedPlanId).toBe("swap-wmon");
    expect(result.plans.every((plan) => plan.status === "eligible")).toBe(true);
  });

  it("rejects direct payment when it would consume the required USDC reserve", () => {
    const result = buildPaymentPlans(input({
      preferences: { minimumUsdcReserve: 850_000n },
    }));
    const direct = result.plans.find((plan) => plan.id === "direct-usdc");
    expect(direct?.status).toBe("unavailable");
    expect(direct?.rejectionReasons.join(" ")).toContain("USDC reserve");
    expect(result.recommendedPlanId).toBe("swap-wmon");
  });

  it("rejects a swap above the policy cost cap", () => {
    const result = buildPaymentPlans(input({ preferences: { maxSwapCostBps: 100 } }));
    const swap = result.plans.find((plan) => plan.id === "swap-wmon");
    expect(swap?.status).toBe("unavailable");
    expect(swap?.rejectionReasons.join(" ")).toContain("131 bps quoted; 100 bps allowed");
  });

  it("rejects both routes after the invoice has been paid", () => {
    const result = buildPaymentPlans(input({ invoiceAlreadyPaid: true }));
    expect(result.recommendedPlanId).toBeUndefined();
    expect(result.plans.every((plan) => plan.status === "unavailable")).toBe(true);
    expect(result.plans.find((plan) => plan.id === "swap-wmon")?.rejectionReasons)
      .toEqual(["Invoice has not been paid: Router reports paid"]);
  });
});
