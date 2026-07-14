export type FundingAsset =
  | "USDC"
  | "WMON"
  | "VAULT_USDC"
  | "USDC_WMON"
  | "USDC_VAULT_USDC";
export type RouteKind =
  | "direct"
  | "exact-output-swap"
  | "erc4626-withdraw"
  | "direct-exact-output-swap"
  | "direct-erc4626-withdraw";
export type PlanStatus = "eligible" | "unavailable";
export type ConstraintStatus = "pass" | "pending" | "fail";

export type SimulationResult = {
  status: "passed" | "requires-approval" | "failed" | "not-run";
  gasEstimate?: bigint;
  reason?: string;
};

export type PortfolioSnapshot = {
  account: string;
  observedAt: bigint;
  nativeBalance: bigint;
  usdc: { balance: bigint; allowance: bigint };
  wmon: { balance: bigint; allowance: bigint };
  vault?: {
    address: string;
    shares: bigint;
    allowance: bigint;
    assets: bigint;
    maxWithdraw: bigint;
    shareDecimals: number;
  };
};

export type ConstraintResult = {
  id:
    | "invoice-active"
    | "invoice-unpaid"
    | "quote-available"
    | "quote-fresh"
    | "balance-sufficient"
    | "usdc-reserve"
    | "maximum-spend"
    | "swap-cost"
    | "vault-verified"
    | "vault-asset"
    | "vault-liquidity"
    | "split-required"
    | "simulation";
  label: string;
  status: ConstraintStatus;
  evidence: string;
};

export type RouteStep = {
  kind: "approval" | "payment";
  label: string;
  status: "satisfied" | "required" | "ready" | "blocked";
};

export type RouteCost = {
  estimatedGasUnits: bigint;
  approvalTransactions: number;
  swapCostBps: number;
  preferencePenalty: number;
  deterministicScore: number;
};

export type PaymentPlan = {
  id:
    | "direct-usdc"
    | "swap-wmon"
    | "vault-usdc"
    | "split-usdc-wmon"
    | "split-usdc-vault";
  kind: RouteKind;
  fundingAsset: FundingAsset;
  decimals: number;
  status: PlanStatus;
  rank?: number;
  requiredAmount: bigint;
  maximumSpend: bigint;
  estimatedSpend?: bigint;
  balance: bigint;
  allowance: bigint;
  approvalRequired: boolean;
  split?: {
    directAmount: bigint;
    secondaryAmount: bigint;
    directAllowance: bigint;
    secondaryAllowance: bigint;
    directApprovalRequired: boolean;
    secondaryApprovalRequired: boolean;
  };
  quoteExpiresAt?: bigint;
  simulation: SimulationResult;
  steps: RouteStep[];
  constraints: ConstraintResult[];
  rejectionReasons: string[];
  cost: RouteCost;
};

export type SwapQuoteSnapshot = {
  buyAmount: bigint;
  estimatedSellAmount: bigint;
  maxSellAmount: bigint;
  expiresAt: bigint;
  swapCostBps?: number;
};

export type PlannerInput = {
  now: bigint;
  invoiceAmount: bigint;
  invoiceExpiry: bigint;
  invoiceAlreadyPaid: boolean;
  direct: {
    balance: bigint;
    allowance: bigint;
    simulation: SimulationResult;
  };
  swap: {
    balance: bigint;
    allowance: bigint;
    quote?: SwapQuoteSnapshot;
    quoteError?: string;
    simulation: SimulationResult;
  };
  vault?: {
    balance: bigint;
    allowance: bigint;
    assetValue: bigint;
    maxWithdraw: bigint;
    previewShares: bigint;
    maxShares: bigint;
    shareDecimals: number;
    verified: boolean;
    assetMatches: boolean;
    readError?: string;
    simulation: SimulationResult;
  };
  split?: {
    swap: {
      quote?: SwapQuoteSnapshot;
      quoteError?: string;
      simulation: SimulationResult;
    };
    vault: {
      previewShares?: bigint;
      maxShares?: bigint;
      readError?: string;
      simulation: SimulationResult;
    };
  };
  preferences?: {
    preferredFundingAsset?: FundingAsset;
    maxWmonSpend?: bigint;
    minimumUsdcReserve?: bigint;
    maxSwapCostBps?: number;
  };
};

export type PlannerResult = {
  plans: PaymentPlan[];
  recommendedPlanId?: PaymentPlan["id"];
};

const APPROVAL_GAS_UNITS = 65_000n;
const DIRECT_GAS_UNITS = 120_000n;
const SWAP_GAS_UNITS = 400_000n;
const VAULT_GAS_UNITS = 260_000n;
const SPLIT_SWAP_GAS_UNITS = 450_000n;
const SPLIT_VAULT_GAS_UNITS = 310_000n;

export function buildPaymentPlans(input: PlannerInput): PlannerResult {
  validateInput(input);

  const plans = [
    buildDirectPlan(input),
    buildSwapPlan(input),
    buildVaultPlan(input),
    buildSplitSwapPlan(input),
    buildSplitVaultPlan(input),
  ];
  const eligiblePlans = plans
    .filter((plan) => plan.status === "eligible")
    .sort(comparePlans);

  eligiblePlans.forEach((plan, index) => {
    plan.rank = index + 1;
  });

  plans.sort((left, right) => {
    if (left.status !== right.status) return left.status === "eligible" ? -1 : 1;
    return comparePlans(left, right);
  });

  const recommended = eligiblePlans[0];
  return {
    plans,
    ...(recommended ? { recommendedPlanId: recommended.id } : {}),
  };
}

export function calculateSplitAmounts(
  invoiceAmount: bigint,
  usdcBalance: bigint,
  minimumUsdcReserve = 0n,
): { directAmount: bigint; secondaryAmount: bigint; available: boolean; reason?: string } {
  if (invoiceAmount <= 0n) throw new Error("Invoice amount must be positive");
  if (usdcBalance < 0n || minimumUsdcReserve < 0n) {
    throw new Error("Split balances cannot be negative");
  }
  const spendable = usdcBalance > minimumUsdcReserve
    ? usdcBalance - minimumUsdcReserve
    : 0n;
  const directAmount = spendable < invoiceAmount ? spendable : invoiceAmount;
  const secondaryAmount = invoiceAmount - directAmount;
  if (directAmount === 0n) {
    return {
      directAmount,
      secondaryAmount,
      available: false,
      reason: "No wallet USDC is spendable after preserving the configured reserve",
    };
  }
  if (secondaryAmount === 0n) {
    return {
      directAmount,
      secondaryAmount,
      available: false,
      reason: "Wallet USDC can fund the invoice without a secondary route",
    };
  }
  return { directAmount, secondaryAmount, available: true };
}

function buildSplitSwapPlan(input: PlannerInput): PaymentPlan {
  const amounts = calculateSplitAmounts(
    input.invoiceAmount,
    input.direct.balance,
    input.preferences?.minimumUsdcReserve,
  );
  const quote = input.split?.swap.quote;
  const maximumSpend = quote?.maxSellAmount ?? 0n;
  const directApprovalRequired = amounts.available
    && input.direct.allowance < amounts.directAmount;
  const secondaryApprovalRequired = amounts.available && quote !== undefined
    && input.swap.allowance < maximumSpend;
  const approvalCount = Number(directApprovalRequired) + Number(secondaryApprovalRequired);
  const terminalReason = input.invoiceAlreadyPaid
    ? "Skipped because the router reports this invoice paid"
    : input.invoiceExpiry < input.now
      ? "Skipped because the invoice has expired"
      : undefined;
  const inactiveReason = terminalReason ?? (!amounts.available ? amounts.reason : undefined);
  const constraints = commonConstraints(input);
  constraints.push(splitRequiredConstraint(amounts));
  constraints.push({
    id: "usdc-reserve",
    label: "Split preserves the configured USDC reserve",
    status: amounts.available ? "pass" : "pending",
    evidence: amounts.available
      ? `${input.direct.balance - amounts.directAmount} remains after ${amounts.directAmount} direct`
      : (amounts.reason ?? "Split is not required"),
  });
  constraints.push({
    id: "quote-available",
    label: "Exact-output quote covers only the split shortfall",
    status: inactiveReason
      ? "pending"
      : quote?.buyAmount === amounts.secondaryAmount ? "pass" : "fail",
    evidence: inactiveReason
      ?? (quote?.buyAmount === amounts.secondaryAmount
        ? `${amounts.secondaryAmount} USDC shortfall has executable calldata`
        : quote
          ? `${quote.buyAmount} quoted; ${amounts.secondaryAmount} shortfall required`
          : (input.split?.swap.quoteError ?? "No shortfall quote")),
  });
  constraints.push({
    id: "quote-fresh",
    label: "Split quote remains executable",
    status: inactiveReason || !quote ? "pending" : quote.expiresAt > input.now ? "pass" : "fail",
    evidence: inactiveReason
      ?? (quote ? `expires ${quote.expiresAt}; observed ${input.now}` : "Pending shortfall quote"),
  });
  constraints.push({
    id: "balance-sufficient",
    label: "WMON balance covers the shortfall maximum",
    status: inactiveReason || !quote
      ? "pending"
      : input.swap.balance >= maximumSpend ? "pass" : "fail",
    evidence: inactiveReason
      ?? (quote
        ? `${input.swap.balance} available; ${maximumSpend} maximum`
        : "Pending shortfall quote"),
  });
  const configuredMaximum = input.preferences?.maxWmonSpend;
  constraints.push({
    id: "maximum-spend",
    label: "Shortfall quote respects the WMON spending cap",
    status: inactiveReason || !quote
      ? "pending"
      : configuredMaximum === undefined || maximumSpend <= configuredMaximum ? "pass" : "fail",
    evidence: inactiveReason
      ?? (!quote
        ? "Pending shortfall quote"
        : configuredMaximum === undefined
          ? "No additional WMON cap configured"
          : `${maximumSpend} quoted; ${configuredMaximum} allowed`),
  });
  const maximumSwapCost = input.preferences?.maxSwapCostBps;
  if (maximumSwapCost !== undefined) {
    constraints.push({
      id: "swap-cost",
      label: "Shortfall quote respects the swap-cost cap",
      status: inactiveReason || !quote
        ? "pending"
        : quote.swapCostBps !== undefined && quote.swapCostBps <= maximumSwapCost ? "pass" : "fail",
      evidence: inactiveReason
        ?? (!quote
          ? "Pending shortfall quote"
          : quote.swapCostBps === undefined
            ? "Quote does not contain swap-cost evidence"
            : `${quote.swapCostBps} bps quoted; ${maximumSwapCost} bps allowed`),
    });
  }
  constraints.push(simulationConstraint(input.split?.swap.simulation ?? {
    status: "not-run",
    reason: "Split quote has not been requested",
  }));

  const simulation = input.split?.swap.simulation ?? { status: "not-run" as const };
  const estimatedGasUnits = (simulation.gasEstimate ?? SPLIT_SWAP_GAS_UNITS)
    + BigInt(approvalCount) * APPROVAL_GAS_UNITS;
  const swapCostBps = quote?.swapCostBps ?? 0;
  return finalizePlan({
    id: "split-usdc-wmon",
    kind: "direct-exact-output-swap",
    fundingAsset: "USDC_WMON",
    decimals: 18,
    requiredAmount: input.invoiceAmount,
    maximumSpend,
    ...(quote ? {
      estimatedSpend: quote.estimatedSellAmount,
      quoteExpiresAt: quote.expiresAt,
    } : {}),
    balance: input.swap.balance,
    allowance: input.swap.allowance,
    approvalRequired: approvalCount > 0,
    split: {
      directAmount: amounts.directAmount,
      secondaryAmount: amounts.secondaryAmount,
      directAllowance: input.direct.allowance,
      secondaryAllowance: input.swap.allowance,
      directApprovalRequired,
      secondaryApprovalRequired,
    },
    simulation,
    steps: splitSteps("WMON", directApprovalRequired, secondaryApprovalRequired, constraints),
    constraints,
    cost: buildCost(
      estimatedGasUnits,
      approvalCount,
      swapCostBps,
      preferencePenaltyFor("USDC_WMON", input),
    ),
  });
}

function buildSplitVaultPlan(input: PlannerInput): PaymentPlan {
  const amounts = calculateSplitAmounts(
    input.invoiceAmount,
    input.direct.balance,
    input.preferences?.minimumUsdcReserve,
  );
  const vault = input.vault;
  const splitVault = input.split?.vault;
  const maximumSpend = splitVault?.maxShares ?? 0n;
  const directApprovalRequired = amounts.available
    && input.direct.allowance < amounts.directAmount;
  const secondaryApprovalRequired = amounts.available && vault !== undefined
    && maximumSpend > 0n && vault.allowance < maximumSpend;
  const approvalCount = Number(directApprovalRequired) + Number(secondaryApprovalRequired);
  const terminalReason = input.invoiceAlreadyPaid
    ? "Skipped because the router reports this invoice paid"
    : input.invoiceExpiry < input.now
      ? "Skipped because the invoice has expired"
      : undefined;
  const inactiveReason = terminalReason ?? (!amounts.available ? amounts.reason : undefined);
  const constraints = commonConstraints(input);
  constraints.push(splitRequiredConstraint(amounts));
  constraints.push({
    id: "usdc-reserve",
    label: "Split preserves the configured USDC reserve",
    status: amounts.available ? "pass" : "pending",
    evidence: amounts.available
      ? `${input.direct.balance - amounts.directAmount} remains after ${amounts.directAmount} direct`
      : (amounts.reason ?? "Split is not required"),
  });
  constraints.push({
    id: "vault-verified",
    label: "Vault is the router's allowlisted ERC-4626 position",
    status: inactiveReason ? "pending" : vault?.verified ? "pass" : "fail",
    evidence: inactiveReason
      ?? (vault?.verified
        ? "Configured vault matches the router's immutable vault"
        : (vault?.readError ?? splitVault?.readError ?? "Configured vault could not be verified")),
  });
  constraints.push({
    id: "vault-asset",
    label: "Vault underlying asset matches invoice USDC",
    status: inactiveReason || !vault?.verified
      ? "pending"
      : vault.assetMatches ? "pass" : "fail",
    evidence: inactiveReason
      ?? (!vault?.verified
        ? "Pending verified vault"
        : vault.assetMatches ? "vault.asset() equals settlement token" : "Vault asset mismatch"),
  });
  constraints.push({
    id: "vault-liquidity",
    label: "Vault maxWithdraw covers the split shortfall",
    status: inactiveReason || !vault?.verified
      ? "pending"
      : vault.maxWithdraw >= amounts.secondaryAmount ? "pass" : "fail",
    evidence: inactiveReason
      ?? (!vault?.verified
        ? "Pending verified vault"
        : `${vault.maxWithdraw} withdrawable; ${amounts.secondaryAmount} shortfall`),
  });
  constraints.push({
    id: "balance-sufficient",
    label: "Vault shares cover the protected shortfall maximum",
    status: inactiveReason || !vault?.verified || maximumSpend === 0n
      ? "pending"
      : vault.balance >= maximumSpend ? "pass" : "fail",
    evidence: inactiveReason
      ?? (!vault?.verified || maximumSpend === 0n
        ? (splitVault?.readError ?? "Pending shortfall preview")
        : `${vault.balance} shares available; ${maximumSpend} maximum`),
  });
  constraints.push({
    id: "maximum-spend",
    label: "Share cap covers the shortfall preview",
    status: inactiveReason || !vault?.verified
      ? "pending"
      : splitVault?.previewShares === undefined
        ? "fail"
        : maximumSpend >= splitVault.previewShares && splitVault.previewShares > 0n ? "pass" : "fail",
    evidence: inactiveReason
      ?? (splitVault?.previewShares === undefined
        ? (splitVault?.readError ?? "Pending shortfall preview")
        : `${splitVault.previewShares} previewed; ${maximumSpend} maximum`),
  });
  constraints.push(simulationConstraint(splitVault?.simulation ?? {
    status: "not-run",
    reason: splitVault?.readError ?? "Split vault preview has not run",
  }));

  const simulation = splitVault?.simulation ?? { status: "not-run" as const };
  const estimatedGasUnits = (simulation.gasEstimate ?? SPLIT_VAULT_GAS_UNITS)
    + BigInt(approvalCount) * APPROVAL_GAS_UNITS;
  return finalizePlan({
    id: "split-usdc-vault",
    kind: "direct-erc4626-withdraw",
    fundingAsset: "USDC_VAULT_USDC",
    decimals: vault?.shareDecimals ?? 18,
    requiredAmount: input.invoiceAmount,
    maximumSpend,
    ...(splitVault?.previewShares === undefined
      ? {}
      : { estimatedSpend: splitVault.previewShares }),
    balance: vault?.balance ?? 0n,
    allowance: vault?.allowance ?? 0n,
    approvalRequired: approvalCount > 0,
    split: {
      directAmount: amounts.directAmount,
      secondaryAmount: amounts.secondaryAmount,
      directAllowance: input.direct.allowance,
      secondaryAllowance: vault?.allowance ?? 0n,
      directApprovalRequired,
      secondaryApprovalRequired,
    },
    simulation,
    steps: splitSteps(
      "VAULT_USDC",
      directApprovalRequired,
      secondaryApprovalRequired,
      constraints,
    ),
    constraints,
    cost: buildCost(
      estimatedGasUnits,
      approvalCount,
      0,
      preferencePenaltyFor("USDC_VAULT_USDC", input),
    ),
  });
}

function splitRequiredConstraint(
  amounts: ReturnType<typeof calculateSplitAmounts>,
): ConstraintResult {
  return {
    id: "split-required",
    label: "A nonzero direct contribution and secondary shortfall are both required",
    status: amounts.available ? "pass" : "fail",
    evidence: amounts.available
      ? `${amounts.directAmount} direct; ${amounts.secondaryAmount} secondary`
      : (amounts.reason ?? "Split is unavailable"),
  };
}

function buildVaultPlan(input: PlannerInput): PaymentPlan {
  const vault = input.vault;
  const terminalReason = input.invoiceAlreadyPaid
    ? "Skipped because the router reports this invoice paid"
    : input.invoiceExpiry < input.now
      ? "Skipped because the invoice has expired"
      : undefined;
  const maximumSpend = vault?.maxShares ?? 0n;
  const approvalRequired = vault !== undefined && vault.allowance < maximumSpend;
  const constraints = commonConstraints(input);
  constraints.push({
    id: "vault-verified",
    label: "Vault is the router's allowlisted ERC-4626 position",
    status: terminalReason ? "pending" : vault?.verified ? "pass" : "fail",
    evidence: terminalReason
      ?? (vault?.verified
        ? "Configured vault matches the router's immutable vault"
        : (vault?.readError ?? "Configured vault could not be verified")),
  });
  constraints.push({
    id: "vault-asset",
    label: "Vault underlying asset matches invoice USDC",
    status: terminalReason || !vault?.verified
      ? "pending"
      : vault.assetMatches ? "pass" : "fail",
    evidence: terminalReason
      ?? (!vault?.verified
        ? "Pending verified vault"
        : vault.assetMatches ? "vault.asset() equals settlement token" : "Vault asset mismatch"),
  });
  constraints.push({
    id: "vault-liquidity",
    label: "Vault maxWithdraw covers the invoice",
    status: terminalReason || !vault?.verified
      ? "pending"
      : vault.maxWithdraw >= input.invoiceAmount ? "pass" : "fail",
    evidence: terminalReason
      ?? (!vault?.verified
        ? "Pending verified vault"
        : `${vault.maxWithdraw} withdrawable; ${input.invoiceAmount} required`),
  });
  constraints.push({
    id: "balance-sufficient",
    label: "Vault share balance covers the protected maximum",
    status: terminalReason || !vault?.verified
      ? "pending"
      : maximumSpend > 0n && vault.balance >= maximumSpend ? "pass" : "fail",
    evidence: terminalReason
      ?? (!vault?.verified
        ? "Pending verified vault"
        : `${vault.balance} shares available; ${maximumSpend} maximum`),
  });
  constraints.push({
    id: "maximum-spend",
    label: "Share cap covers the current preview",
    status: terminalReason || !vault?.verified
      ? "pending"
      : vault.previewShares > 0n && maximumSpend >= vault.previewShares ? "pass" : "fail",
    evidence: terminalReason
      ?? (!vault?.verified
        ? "Pending verified vault"
        : `${vault.previewShares} previewed; ${maximumSpend} maximum`),
  });
  constraints.push(simulationConstraint(vault?.simulation ?? {
    status: "not-run",
    reason: vault?.readError ?? "Vault has not been discovered",
  }));

  const estimatedGasUnits = simulationGas(
    vault?.simulation ?? { status: "not-run" },
    VAULT_GAS_UNITS,
    approvalRequired,
  );
  const preferencePenalty = preferencePenaltyFor("VAULT_USDC", input);
  const cost = buildCost(estimatedGasUnits, approvalRequired, 0, preferencePenalty);

  return finalizePlan({
    id: "vault-usdc",
    kind: "erc4626-withdraw",
    fundingAsset: "VAULT_USDC",
    decimals: vault?.shareDecimals ?? 18,
    requiredAmount: input.invoiceAmount,
    maximumSpend,
    ...(vault ? { estimatedSpend: vault.previewShares } : {}),
    balance: vault?.balance ?? 0n,
    allowance: vault?.allowance ?? 0n,
    approvalRequired,
    simulation: vault?.simulation ?? { status: "not-run" },
    steps: approvalAndPaymentSteps("VAULT_USDC", approvalRequired, constraints),
    constraints,
    cost,
  });
}

function buildDirectPlan(input: PlannerInput): PaymentPlan {
  const approvalRequired = input.direct.allowance < input.invoiceAmount;
  const constraints = commonConstraints(input);
  constraints.push({
    id: "balance-sufficient",
    label: "USDC balance covers the invoice",
    status: input.direct.balance >= input.invoiceAmount ? "pass" : "fail",
    evidence: `${input.direct.balance} available; ${input.invoiceAmount} required`,
  });
  const minimumReserve = input.preferences?.minimumUsdcReserve;
  if (minimumReserve !== undefined) {
    const postPaymentBalance = input.direct.balance >= input.invoiceAmount
      ? input.direct.balance - input.invoiceAmount
      : 0n;
    constraints.push({
      id: "usdc-reserve",
      label: "Direct payment preserves the USDC reserve",
      status: postPaymentBalance >= minimumReserve ? "pass" : "fail",
      evidence: `${postPaymentBalance} remains; ${minimumReserve} required by policy`,
    });
  }
  constraints.push(simulationConstraint(input.direct.simulation));

  const estimatedGasUnits = simulationGas(
    input.direct.simulation,
    DIRECT_GAS_UNITS,
    approvalRequired,
  );
  const preferencePenalty = preferencePenaltyFor("USDC", input);
  const cost = buildCost(estimatedGasUnits, approvalRequired, 0, preferencePenalty);

  return finalizePlan({
    id: "direct-usdc",
    kind: "direct",
    fundingAsset: "USDC",
    decimals: 6,
    requiredAmount: input.invoiceAmount,
    maximumSpend: input.invoiceAmount,
    balance: input.direct.balance,
    allowance: input.direct.allowance,
    approvalRequired,
    simulation: input.direct.simulation,
    steps: approvalAndPaymentSteps("USDC", approvalRequired, constraints),
    constraints,
    cost,
  });
}

function buildSwapPlan(input: PlannerInput): PaymentPlan {
  const quote = input.swap.quote;
  const maximumSpend = quote?.maxSellAmount ?? 0n;
  const approvalRequired = quote !== undefined && input.swap.allowance < maximumSpend;
  const terminalReason = input.invoiceAlreadyPaid
    ? "Skipped because the router reports this invoice paid"
    : input.invoiceExpiry < input.now
      ? "Skipped because the invoice has expired"
      : undefined;
  const constraints = commonConstraints(input);
  constraints.push({
    id: "quote-available",
    label: "Executable exact-output quote is available",
    status: terminalReason
      ? "pending"
      : quote?.buyAmount === input.invoiceAmount ? "pass" : "fail",
    evidence: terminalReason
      ?? (quote?.buyAmount === input.invoiceAmount
        ? "Pool returned executable calldata for the exact invoice amount"
        : quote
          ? `${quote.buyAmount} quoted; ${input.invoiceAmount} required`
          : (input.swap.quoteError ?? "No quote")),
  });
  constraints.push({
    id: "quote-fresh",
    label: "Quote remains executable",
    status: terminalReason || !quote
      ? "pending"
      : quote.expiresAt > input.now ? "pass" : "fail",
    evidence: terminalReason
      ?? (quote ? `expires ${quote.expiresAt}; observed ${input.now}` : "Pending executable quote"),
  });
  constraints.push({
    id: "balance-sufficient",
    label: "WMON balance covers the maximum",
    status: terminalReason || !quote
      ? "pending"
      : input.swap.balance >= maximumSpend ? "pass" : "fail",
    evidence: terminalReason
      ?? (quote
        ? `${input.swap.balance} available; ${maximumSpend} maximum`
        : "Pending executable quote"),
  });

  const configuredMaximum = input.preferences?.maxWmonSpend;
  constraints.push({
    id: "maximum-spend",
    label: "Quote respects the WMON spending cap",
    status: terminalReason || !quote
      ? "pending"
      : configuredMaximum === undefined || maximumSpend <= configuredMaximum ? "pass" : "fail",
    evidence: terminalReason
      ?? (!quote
        ? "Pending executable quote"
        : configuredMaximum === undefined
          ? "No additional WMON cap configured"
          : `${maximumSpend} quoted; ${configuredMaximum} allowed`),
  });
  const maximumSwapCost = input.preferences?.maxSwapCostBps;
  if (maximumSwapCost !== undefined) {
    constraints.push({
      id: "swap-cost",
      label: "Quote respects the swap-cost cap",
      status: terminalReason || !quote
        ? "pending"
        : quote.swapCostBps === undefined
          ? "fail"
          : quote.swapCostBps <= maximumSwapCost ? "pass" : "fail",
      evidence: terminalReason
        ?? (!quote
          ? "Pending executable quote"
          : quote.swapCostBps === undefined
            ? "Quote does not contain swap-cost evidence"
            : `${quote.swapCostBps} bps quoted; ${maximumSwapCost} bps allowed`),
    });
  }
  constraints.push(simulationConstraint(input.swap.simulation));

  const swapCostBps = quote?.swapCostBps ?? 0;
  const estimatedGasUnits = simulationGas(
    input.swap.simulation,
    SWAP_GAS_UNITS,
    approvalRequired,
  );
  const preferencePenalty = preferencePenaltyFor("WMON", input);
  const cost = buildCost(
    estimatedGasUnits,
    approvalRequired,
    swapCostBps,
    preferencePenalty,
  );

  return finalizePlan({
    id: "swap-wmon",
    kind: "exact-output-swap",
    fundingAsset: "WMON",
    decimals: 18,
    requiredAmount: input.invoiceAmount,
    maximumSpend,
    ...(quote ? {
      estimatedSpend: quote.estimatedSellAmount,
      quoteExpiresAt: quote.expiresAt,
    } : {}),
    balance: input.swap.balance,
    allowance: input.swap.allowance,
    approvalRequired,
    simulation: input.swap.simulation,
    steps: approvalAndPaymentSteps("WMON", approvalRequired, constraints),
    constraints,
    cost,
  });
}

function commonConstraints(input: PlannerInput): ConstraintResult[] {
  return [
    {
      id: "invoice-unpaid",
      label: "Invoice has not been paid",
      status: input.invoiceAlreadyPaid ? "fail" : "pass",
      evidence: input.invoiceAlreadyPaid ? "Router reports paid" : "Router reports unpaid",
    },
    {
      id: "invoice-active",
      label: "Invoice has not expired",
      status: input.invoiceExpiry >= input.now ? "pass" : "fail",
      evidence: `expires ${input.invoiceExpiry}; observed ${input.now}`,
    },
  ];
}

function simulationConstraint(simulation: SimulationResult): ConstraintResult {
  if (simulation.status === "failed") {
    return {
      id: "simulation",
      label: "Onchain preflight succeeds",
      status: "fail",
      evidence: simulation.reason ?? "Simulation reverted",
    };
  }
  if (simulation.status === "passed") {
    return {
      id: "simulation",
      label: "Onchain preflight succeeds",
      status: "pass",
      evidence: simulation.gasEstimate
        ? `eth_call passed; estimated ${simulation.gasEstimate} gas`
        : "eth_call passed",
    };
  }
  return {
    id: "simulation",
    label: "Onchain preflight succeeds",
    status: "pending",
    evidence: simulation.status === "requires-approval"
      ? "Preflight runs immediately after approval"
      : "Preflight has not run",
  };
}

function approvalAndPaymentSteps(
  asset: FundingAsset,
  approvalRequired: boolean,
  constraints: ConstraintResult[],
): RouteStep[] {
  const blocked = constraints.some((constraint) => constraint.status === "fail");
  return [
    {
      kind: "approval",
      label: `Approve ${asset === "VAULT_USDC" ? "vault shares" : asset} maximum`,
      status: approvalRequired ? "required" : "satisfied",
    },
    {
      kind: "payment",
      label: "Simulate and settle exact invoice",
      status: blocked ? "blocked" : "ready",
    },
  ];
}

function splitSteps(
  secondaryAsset: "WMON" | "VAULT_USDC",
  directApprovalRequired: boolean,
  secondaryApprovalRequired: boolean,
  constraints: ConstraintResult[],
): RouteStep[] {
  const blocked = constraints.some((constraint) => constraint.status === "fail");
  return [
    {
      kind: "approval",
      label: "Approve direct USDC contribution",
      status: directApprovalRequired ? "required" : "satisfied",
    },
    {
      kind: "approval",
      label: secondaryAsset === "VAULT_USDC"
        ? "Approve vault share maximum"
        : "Approve WMON maximum",
      status: secondaryApprovalRequired ? "required" : "satisfied",
    },
    {
      kind: "payment",
      label: "Atomically settle both funding legs",
      status: blocked ? "blocked" : "ready",
    },
  ];
}

function finalizePlan(
  plan: Omit<PaymentPlan, "status" | "rejectionReasons">,
): PaymentPlan {
  const rejectionReasons = plan.constraints
    .filter((constraint) => constraint.status === "fail")
    .map((constraint) => `${constraint.label}: ${constraint.evidence}`);
  return {
    ...plan,
    status: rejectionReasons.length === 0 ? "eligible" : "unavailable",
    rejectionReasons,
  };
}

function simulationGas(
  simulation: SimulationResult,
  fallback: bigint,
  approvalRequired: boolean,
): bigint {
  const paymentGas = simulation.gasEstimate ?? fallback;
  return paymentGas + (approvalRequired ? APPROVAL_GAS_UNITS : 0n);
}

function preferencePenaltyFor(asset: FundingAsset, input: PlannerInput): number {
  const preferred = input.preferences?.preferredFundingAsset ?? "USDC";
  if (asset === "USDC_WMON") return preferred === "USDC" || preferred === "WMON" ? 100 : 1_000;
  if (asset === "USDC_VAULT_USDC") return preferred === "USDC" ? 100 : 1_000;
  if (asset === "VAULT_USDC") return preferred === "USDC" ? 250 : 1_000;
  return asset === preferred ? 0 : 1_000;
}

function buildCost(
  estimatedGasUnits: bigint,
  approvals: boolean | number,
  swapCostBps: number,
  preferencePenalty: number,
): RouteCost {
  const approvalTransactions = typeof approvals === "number"
    ? approvals
    : approvals ? 1 : 0;
  const gasScore = Number(estimatedGasUnits / 10_000n);
  return {
    estimatedGasUnits,
    approvalTransactions,
    swapCostBps,
    preferencePenalty,
    deterministicScore: gasScore + approvalTransactions * 10 + swapCostBps + preferencePenalty,
  };
}

function comparePlans(left: PaymentPlan, right: PaymentPlan): number {
  const scoreDifference = left.cost.deterministicScore - right.cost.deterministicScore;
  return scoreDifference === 0 ? left.id.localeCompare(right.id) : scoreDifference;
}

function validateInput(input: PlannerInput): void {
  if (input.now < 0n) throw new Error("Planner time cannot be negative");
  if (input.invoiceAmount <= 0n) throw new Error("Invoice amount must be positive");
  if (input.invoiceExpiry <= 0n) throw new Error("Invoice expiry must be positive");
  if (input.direct.balance < 0n || input.direct.allowance < 0n) {
    throw new Error("Direct balances cannot be negative");
  }
  if (input.swap.balance < 0n || input.swap.allowance < 0n) {
    throw new Error("Swap balances cannot be negative");
  }
  if (input.vault && [
    input.vault.balance,
    input.vault.allowance,
    input.vault.assetValue,
    input.vault.maxWithdraw,
    input.vault.previewShares,
    input.vault.maxShares,
  ].some((value) => value < 0n)) {
    throw new Error("Vault facts cannot be negative");
  }
  if (input.vault
    && (!Number.isSafeInteger(input.vault.shareDecimals)
      || input.vault.shareDecimals < 0
      || input.vault.shareDecimals > 36)) {
    throw new Error("Vault share decimals must be an integer from 0 to 36");
  }
  if ((input.preferences?.minimumUsdcReserve ?? 0n) < 0n) {
    throw new Error("USDC reserve cannot be negative");
  }
  const maxSwapCostBps = input.preferences?.maxSwapCostBps;
  if (maxSwapCostBps !== undefined
    && (!Number.isSafeInteger(maxSwapCostBps) || maxSwapCostBps < 0 || maxSwapCostBps > 10_000)) {
    throw new Error("Swap-cost cap must be an integer from 0 to 10,000 bps");
  }
  if (input.swap.quote?.maxSellAmount !== undefined && input.swap.quote.maxSellAmount <= 0n) {
    throw new Error("Swap maximum must be positive");
  }
  if (input.swap.quote?.estimatedSellAmount !== undefined
    && input.swap.quote.estimatedSellAmount <= 0n) {
    throw new Error("Swap estimate must be positive");
  }
  if ((input.swap.quote?.swapCostBps ?? 0) < 0) {
    throw new Error("Swap cost cannot be negative");
  }
}
