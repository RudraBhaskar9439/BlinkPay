"use client";

import {
  activeMonadChain,
  activeMonadNetwork,
  activeWmonAddress,
  createMonadPublicClient,
} from "@blinkpay/chain";
import {
  blinkPayRouterAbi,
  buildInvoiceTypedData,
  decodeSignedInvoice,
  type Invoice,
  type SignedInvoice,
} from "@blinkpay/core";
import {
  buildPaymentPlans,
  type PaymentPlan,
  type PlannerResult,
  type PortfolioSnapshot,
  type SimulationResult,
} from "@blinkpay/planner";
import {
  DEFAULT_PAYMENT_POLICY_V1,
  explainPaymentPolicy,
  normalizePaymentPolicy,
  parsePaymentPolicyV1,
  type NormalizedPaymentPolicy,
  type PaymentPolicyV1,
  type PolicyExplanation,
  type PreferenceCompilation,
} from "@blinkpay/policy";
import {
  connectInjectedWallet,
  formatAddress,
  getConfiguredRouterAddress,
  getErrorMessage,
  watchInjectedAccount,
} from "@/lib/wallet";
import { useEffect, useState } from "react";
import {
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  isHex,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";

type ParsedPayload =
  | { ok: true; value: SignedInvoice }
  | { ok: false; error: string };

type SwapQuote = {
  sellToken: Address;
  buyAmount: bigint;
  maxSellAmount: bigint;
  estimatedSellAmount?: bigint;
  swapCostBps?: number;
  swapCallData: Hex;
  expiresAt: bigint;
};

type RouteAnalysis = PlannerResult & { portfolio: PortfolioSnapshot };

type ActivePolicy = {
  source: Extract<PreferenceCompilation, { status: "compiled" }>["source"];
  provider?: "groq" | "xai" | "openai";
  policy: PaymentPolicyV1;
  normalized: NormalizedPaymentPolicy;
  explanations: PolicyExplanation[];
  warning?: string;
};

function parsePayload(payload: string | undefined): ParsedPayload {
  if (!payload) return { ok: false, error: "This payment link does not contain an invoice." };
  try {
    return { ok: true, value: decodeSignedInvoice(payload) };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export function PayInvoice({ payload }: { payload?: string }) {
  const parsed = parsePayload(payload);
  const [account, setAccount] = useState<Address>();
  const [transactionHash, setTransactionHash] = useState<Hex>();
  const [swapQuote, setSwapQuote] = useState<SwapQuote>();
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis>();
  const [preferenceText, setPreferenceText] = useState("");
  const [activePolicy, setActivePolicy] = useState<ActivePolicy>(() => ({
    source: "deterministic",
    policy: DEFAULT_PAYMENT_POLICY_V1,
    normalized: normalizePaymentPolicy(DEFAULT_PAYMENT_POLICY_V1),
    explanations: explainPaymentPolicy(DEFAULT_PAYMENT_POLICY_V1),
  }));
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState("Safe default: no borrowing and no hidden preferences.");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Review every field before connecting your wallet.");

  useEffect(() => watchInjectedAccount((nextAccount) => {
    setAccount(nextAccount);
    setSwapQuote(undefined);
    setRouteAnalysis(undefined);
    setTransactionHash(undefined);
    setMessage(nextAccount
      ? `MetaMask account changed to ${formatAddress(nextAccount)}. Ready to preflight.`
      : "MetaMask disconnected. Connect the payer wallet to continue.");
  }), []);

  if (!parsed.ok) {
    return (
      <section className="checkoutShell errorState">
        <p className="sectionNumber">Invoice unavailable</p>
        <h1 className="checkoutTitle">This payment link is invalid.</h1>
        <p className="lede">{parsed.error}</p>
        <a className="secondaryButton buttonLink" href="/merchant">Create a new invoice</a>
      </section>
    );
  }

  const signedInvoice = parsed.value;
  const { invoice, description, signature } = signedInvoice;
  const displayAmount = formatUnits(invoice.amount, 6);
  const directPlan = routeAnalysis?.plans.find((plan) => plan.id === "direct-usdc");
  const swapPlan = routeAnalysis?.plans.find((plan) => plan.id === "swap-wmon");
  const directUnavailable = directPlan?.status === "unavailable";
  const swapUnavailable = swapPlan?.status === "unavailable";
  const expiry = new Date(Number(invoice.expiry) * 1_000).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  async function connect() {
    setBusy(true);
    try {
      const wallet = await connectInjectedWallet();
      setAccount(wallet.account);
      setMessage(`Connected as ${formatAddress(wallet.account)}. Ready to preflight.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function compilePreferences() {
    setPolicyBusy(true);
    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preferenceText }),
      });
      const value: unknown = await response.json();
      if (!response.ok) throw new Error(readPreferenceError(value));
      const nextPolicy = parsePreferenceResponse(value);
      setActivePolicy(nextPolicy);
      setRouteAnalysis(undefined);
      setTransactionHash(undefined);
      setPolicyMessage(nextPolicy.warning
        ?? "Policy compiled. Analyze again to apply it to unchanged live route facts.");
    } catch (error) {
      setPolicyMessage(getErrorMessage(error));
    } finally {
      setPolicyBusy(false);
    }
  }

  async function analyzeRoutes() {
    setBusy(true);
    setRouteAnalysis(undefined);
    setTransactionHash(undefined);

    try {
      const routerAddress = getConfiguredRouterAddress();
      if (invoice.chainId !== BigInt(activeMonadChain.id)) {
        throw new Error("Invoice is for a different chain");
      }
      const signatureValid = await verifyTypedData({
        address: invoice.merchant,
        signature,
        ...buildInvoiceTypedData(invoice, routerAddress),
      });
      if (!signatureValid) throw new Error("Merchant signature is invalid for this router");

      const wallet = await connectInjectedWallet();
      const client = createMonadPublicClient(activeMonadNetwork);
      setAccount(wallet.account);
      setMessage("Reading live balances, allowances, replay state, and quotes…");

      const [invoiceAlreadyPaid, nativeBalance, usdcBalance, usdcAllowance, wmonBalance,
        wmonAllowance] = await Promise.all([
        client.readContract({
          address: routerAddress,
          abi: blinkPayRouterAbi,
          functionName: "paidInvoices",
          args: [invoice.invoiceId],
        }),
        client.getBalance({ address: wallet.account }),
        client.readContract({
          address: invoice.settlementToken,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet.account],
        }),
        client.readContract({
          address: invoice.settlementToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [wallet.account, routerAddress],
        }),
        client.readContract({
          address: activeWmonAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet.account],
        }),
        client.readContract({
          address: activeWmonAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [wallet.account, routerAddress],
        }),
      ]);

      const now = getCurrentUnixTime();
      let quote: SwapQuote | undefined;
      let quoteError: string | undefined;
      if (!invoiceAlreadyPaid && invoice.expiry >= now) {
        try {
          quote = await fetchSwapQuote(payload, wallet.account);
          validateSwapQuote(quote, invoice);
        } catch (error) {
          quoteError = getErrorMessage(error);
        }
      } else {
        quoteError = invoiceAlreadyPaid ? "Invoice is already paid" : "Invoice has expired";
      }

      const directSimulation = await simulateDirectCandidate({
        client,
        routerAddress,
        account: wallet.account,
        signedInvoice,
        invoiceAlreadyPaid,
        now,
        balance: usdcBalance,
        allowance: usdcAllowance,
      });
      const swapSimulation = await simulateSwapCandidate({
        client,
        routerAddress,
        account: wallet.account,
        signedInvoice,
        invoiceAlreadyPaid,
        now,
        balance: wmonBalance,
        allowance: wmonAllowance,
        quote,
      });

      const portfolio: PortfolioSnapshot = {
        account: wallet.account,
        observedAt: now,
        nativeBalance,
        usdc: { balance: usdcBalance, allowance: usdcAllowance },
        wmon: { balance: wmonBalance, allowance: wmonAllowance },
      };
      const result = buildPaymentPlans({
        now,
        invoiceAmount: invoice.amount,
        invoiceExpiry: invoice.expiry,
        invoiceAlreadyPaid,
        direct: {
          balance: usdcBalance,
          allowance: usdcAllowance,
          simulation: directSimulation,
        },
        swap: {
          balance: wmonBalance,
          allowance: wmonAllowance,
          ...(quote ? {
            quote: {
              estimatedSellAmount: quote.estimatedSellAmount ?? quote.maxSellAmount,
              maxSellAmount: quote.maxSellAmount,
              expiresAt: quote.expiresAt,
              ...(quote.swapCostBps === undefined ? {} : { swapCostBps: quote.swapCostBps }),
            },
          } : { quoteError: quoteError ?? "Unable to obtain a quote" }),
          simulation: swapSimulation,
        },
        preferences: plannerPreferences(activePolicy.normalized),
      });

      setSwapQuote(quote);
      setRouteAnalysis({ ...result, portfolio });
      const recommended = result.plans.find((plan) => plan.id === result.recommendedPlanId);
      setMessage(recommended
        ? `${recommended.fundingAsset} is recommended by the displayed deterministic score.`
        : "No route currently satisfies every constraint. Review the rejection evidence.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function payDirect() {
    setBusy(true);
    setTransactionHash(undefined);

    try {
      const routerAddress = getConfiguredRouterAddress();
      if (invoice.chainId !== BigInt(activeMonadChain.id)) throw new Error("Invoice is for a different chain");

      const signatureValid = await verifyTypedData({
        address: invoice.merchant,
        signature,
        ...buildInvoiceTypedData(invoice, routerAddress),
      });
      if (!signatureValid) throw new Error("Merchant signature is invalid for this router");

      const wallet = await connectInjectedWallet();
      const client = createMonadPublicClient(activeMonadNetwork);
      setAccount(wallet.account);
      setMessage("Checking balance, replay status, and allowance…");

      const [alreadyPaid, balance, allowance] = await Promise.all([
        client.readContract({
          address: routerAddress,
          abi: blinkPayRouterAbi,
          functionName: "paidInvoices",
          args: [invoice.invoiceId],
        }),
        client.readContract({
          address: invoice.settlementToken,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet.account],
        }),
        client.readContract({
          address: invoice.settlementToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [wallet.account, routerAddress],
        }),
      ]);

      if (alreadyPaid) throw new Error("This invoice has already been paid");
      if (balance < invoice.amount) throw new Error(`You need ${displayAmount} USDC to pay this invoice`);

      if (allowance < invoice.amount) {
        setMessage(`Approve exactly ${displayAmount} USDC in your wallet…`);
        const approvalHash = await wallet.walletClient.writeContract({
          address: invoice.settlementToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress, invoice.amount],
          account: wallet.account,
          chain: activeMonadChain,
        });
        await client.waitForTransactionReceipt({ hash: approvalHash });
      }

      setMessage("Approval confirmed. Simulating the exact settlement onchain…");
      await client.estimateContractGas({
        address: routerAddress,
        abi: blinkPayRouterAbi,
        functionName: "payDirect",
        args: [invoice, signature],
        account: wallet.account,
      });

      setMessage("Preflight passed. Settle the invoice in your wallet…");
      const paymentHash = await wallet.walletClient.writeContract({
        address: routerAddress,
        abi: blinkPayRouterAbi,
        functionName: "payDirect",
        args: [invoice, signature],
        account: wallet.account,
        chain: activeMonadChain,
      });
      const receipt = await client.waitForTransactionReceipt({ hash: paymentHash });
      if (receipt.status !== "success") throw new Error("Payment transaction reverted");

      setTransactionHash(paymentHash);
      setMessage(`Paid exactly ${displayAmount} USDC. The receipt is final on Monad.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function loadWmonQuote() {
    setBusy(true);
    setSwapQuote(undefined);
    setTransactionHash(undefined);

    try {
      const routerAddress = getConfiguredRouterAddress();
      if (invoice.chainId !== BigInt(activeMonadChain.id)) {
        throw new Error("Invoice is for a different chain");
      }

      const signatureValid = await verifyTypedData({
        address: invoice.merchant,
        signature,
        ...buildInvoiceTypedData(invoice, routerAddress),
      });
      if (!signatureValid) throw new Error("Merchant signature is invalid for this router");

      const wallet = await connectInjectedWallet();
      setAccount(wallet.account);
      setMessage("Reading a server-validated exact-output quote from the testnet pool…");

      const quote = await fetchSwapQuote(payload, wallet.account);
      validateSwapQuote(quote, invoice);

      setSwapQuote(quote);
      const maximum = formatUnits(quote.maxSellAmount, 18);
      const estimate = quote.estimatedSellAmount === undefined
        ? maximum
        : formatUnits(quote.estimatedSellAmount, 18);
      setMessage(`Live quote ready: about ${estimate} WMON, capped at ${maximum} WMON.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function payWithWmon() {
    setBusy(true);
    setTransactionHash(undefined);

    try {
      if (!swapQuote) throw new Error("Request a fresh WMON quote first");
      const now = getCurrentUnixTime();
      if (swapQuote.expiresAt < now) {
        setSwapQuote(undefined);
        throw new Error("The WMON quote expired. Request a fresh quote");
      }

      const routerAddress = getConfiguredRouterAddress();
      const signatureValid = await verifyTypedData({
        address: invoice.merchant,
        signature,
        ...buildInvoiceTypedData(invoice, routerAddress),
      });
      if (!signatureValid) throw new Error("Merchant signature is invalid for this router");

      const wallet = await connectInjectedWallet();
      const client = createMonadPublicClient(activeMonadNetwork);
      setAccount(wallet.account);
      setMessage("Checking WMON balance, replay status, and router allowance…");

      const [alreadyPaid, balance, allowance] = await Promise.all([
        client.readContract({
          address: routerAddress,
          abi: blinkPayRouterAbi,
          functionName: "paidInvoices",
          args: [invoice.invoiceId],
        }),
        client.readContract({
          address: swapQuote.sellToken,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet.account],
        }),
        client.readContract({
          address: swapQuote.sellToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [wallet.account, routerAddress],
        }),
      ]);

      if (alreadyPaid) throw new Error("This invoice has already been paid");
      const maximum = formatUnits(swapQuote.maxSellAmount, 18);
      if (balance < swapQuote.maxSellAmount) {
        throw new Error(`You need up to ${maximum} WMON for this route`);
      }

      if (allowance < swapQuote.maxSellAmount) {
        setMessage(`Approve the BlinkPay router for at most ${maximum} WMON…`);
        const approvalHash = await wallet.walletClient.writeContract({
          address: swapQuote.sellToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [routerAddress, swapQuote.maxSellAmount],
          account: wallet.account,
          chain: activeMonadChain,
        });
        await client.waitForTransactionReceipt({ hash: approvalHash });
      }

      const currentTimestamp = getCurrentUnixTime();
      if (swapQuote.expiresAt < currentTimestamp) {
        setSwapQuote(undefined);
        throw new Error("The quote expired after approval. Request a fresh quote; your cap remains safe");
      }

      setMessage("Approval confirmed. Simulating the exact-output route onchain…");
      await client.estimateContractGas({
        address: routerAddress,
        abi: blinkPayRouterAbi,
        functionName: "payWithSwap",
        args: [
          invoice,
          signature,
          swapQuote.maxSellAmount,
          swapQuote.expiresAt,
          swapQuote.swapCallData,
        ],
        account: wallet.account,
      });

      setMessage("Preflight passed. Execute the exact-output route in your wallet…");
      const paymentHash = await wallet.walletClient.writeContract({
        address: routerAddress,
        abi: blinkPayRouterAbi,
        functionName: "payWithSwap",
        args: [
          invoice,
          signature,
          swapQuote.maxSellAmount,
          swapQuote.expiresAt,
          swapQuote.swapCallData,
        ],
        account: wallet.account,
        chain: activeMonadChain,
      });
      const receipt = await client.waitForTransactionReceipt({ hash: paymentHash });
      if (receipt.status !== "success") throw new Error("Swap payment transaction reverted");

      setTransactionHash(paymentHash);
      setSwapQuote(undefined);
      setMessage(`Merchant received exactly ${displayAmount} USDC from your WMON route.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="checkoutShell" aria-labelledby="pay-title">
      <div className="checkoutIntro compactIntro">
        <p className="sectionNumber">Exact USDC invoice</p>
        <h1 id="pay-title" className="checkoutTitle">Confirm before money moves.</h1>
      </div>

      <div className="paymentReview">
        <div className="amountPanel">
          <p className="cardLabel">Merchant receives exactly</p>
          <strong>{displayAmount}</strong>
          <span>USDC</span>
        </div>

        <dl className="invoiceFacts">
          <div><dt>For</dt><dd>{description}</dd></div>
          <div><dt>Merchant</dt><dd><code>{formatAddress(invoice.merchant)}</code></dd></div>
          <div><dt>Expires</dt><dd>{expiry}</dd></div>
          <div><dt>Network</dt><dd>{activeMonadChain.name}</dd></div>
          <div><dt>Invoice</dt><dd><code>{invoice.invoiceId.slice(0, 12)}…</code></dd></div>
        </dl>

        <div className="trustStrip">
          <span>✓ Merchant signature attached</span>
          <span>✓ Exact amount enforced</span>
          <span>✓ Replay protected</span>
        </div>

        <div className="buttonRow paymentActions walletRow">
          {!account ? (
            <button className="secondaryButton" type="button" onClick={connect} disabled={busy}>
              Connect payer wallet
            </button>
          ) : <code>{formatAddress(account)}</code>}
        </div>

        <section className="policyCompiler" aria-labelledby="policy-compiler-title">
          <div className="policyCompilerHeader">
            <div>
              <p className="cardLabel">Phase 4 · AI preference compiler</p>
              <h2 id="policy-compiler-title">Describe how your money should move.</h2>
            </div>
            <span className="policySource">
              {formatPolicySource(activePolicy.source, activePolicy.provider)}
            </span>
          </div>

          <label className="policyInput">
            <span>Payment preferences</span>
            <textarea
              value={preferenceText}
              onChange={(event) => setPreferenceText(event.target.value)}
              placeholder="Preserve MON, never borrow, and keep at least 5 USDC."
              maxLength={500}
            />
          </label>

          <div className="policyExamples" aria-label="Preference examples">
            <button type="button" onClick={() => setPreferenceText("Preserve MON and never borrow")}>Preserve MON</button>
            <button type="button" onClick={() => setPreferenceText("Preserve USDC and never borrow")}>Preserve USDC</button>
            <button type="button" onClick={() => setPreferenceText("Cost under 200 bps and never borrow")}>Cap swap cost</button>
          </div>

          <div className="policyActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={compilePreferences}
              disabled={policyBusy || busy}
            >
              {policyBusy ? "Compiling…" : "Compile strict policy"}
            </button>
            <p role="status">{policyMessage}</p>
          </div>

          <div className="policyRules" aria-label="Active policy rules">
            {activePolicy.explanations.map((explanation) => (
              <article key={explanation.id}>
                <strong>{explanation.label}</strong>
                <span>{explanation.effect}</span>
              </article>
            ))}
          </div>
          <p className="policyBoundary">
            The compiler can set only versioned policy fields. Addresses, chain configuration,
            calldata, quotes, and transaction signing stay outside the AI boundary.
          </p>
        </section>

        <section className="routePlanner" aria-labelledby="route-planner-title">
          <div className="routePlannerHeader">
            <div>
              <p className="cardLabel">Phase 3 · Deterministic planner</p>
              <h2 id="route-planner-title">Compare live payment evidence.</h2>
            </div>
            <button className="secondaryButton" type="button" onClick={analyzeRoutes} disabled={busy}>
              {busy ? "Analyzing…" : "Analyze wallet routes"}
            </button>
          </div>

          {routeAnalysis ? (
            <>
              <div className="portfolioEvidence" aria-label="Live wallet portfolio">
                <div><span>MON</span><strong>{formatUnits(routeAnalysis.portfolio.nativeBalance, 18)}</strong></div>
                <div><span>USDC</span><strong>{formatUnits(routeAnalysis.portfolio.usdc.balance, 6)}</strong></div>
                <div><span>WMON</span><strong>{formatUnits(routeAnalysis.portfolio.wmon.balance, 18)}</strong></div>
              </div>

              <div className="planEvidenceGrid">
                {routeAnalysis.plans.map((plan) => (
                  <article
                    className={`planEvidenceCard ${plan.id === routeAnalysis.recommendedPlanId ? "recommendedPlan" : ""}`}
                    key={plan.id}
                  >
                    <div className="planEvidenceTitle">
                      <div>
                        <span>{plan.status === "eligible" ? "Eligible" : "Unavailable"}</span>
                        <h3>{plan.fundingAsset} · {plan.kind === "direct" ? "Direct" : "Exact output"}</h3>
                      </div>
                      {plan.rank ? <strong>#{plan.rank}</strong> : null}
                    </div>

                    <dl className="planMetrics">
                      <div><dt>Balance</dt><dd>{formatPlanUnits(plan, plan.balance)}</dd></div>
                      <div><dt>Maximum</dt><dd>{formatPlanMaximum(plan)}</dd></div>
                      <div><dt>Approval</dt><dd>{formatApprovalStatus(plan)}</dd></div>
                      <div><dt>Estimated gas</dt><dd>{plan.cost.estimatedGasUnits.toString()}</dd></div>
                      <div><dt>Swap cost</dt><dd>{formatSwapCost(plan)}</dd></div>
                      <div><dt>Score</dt><dd>{plan.status === "eligible" ? plan.cost.deterministicScore : "Not ranked"}</dd></div>
                    </dl>

                    {plan.rejectionReasons.length ? (
                      <ul className="rejectionList">
                        {plan.rejectionReasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    ) : (
                      <p className="eligibleReason">
                        All hard constraints pass. Pending approval is performed before simulation.
                      </p>
                    )}

                    <details className="constraintEvidence">
                      <summary>Show raw constraint evidence</summary>
                      <ul>
                        {plan.constraints.map((constraint) => (
                          <li key={constraint.id}>
                            <strong>{constraint.status.toUpperCase()}</strong>
                            <span>{constraint.label}</span>
                            <small>{constraint.evidence}</small>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))}
              </div>
              <p className="plannerFormula">
                Score = gas ÷ 10,000 + approval penalty + swap-cost bps + preference penalty.
                Lowest eligible score wins; ties use route ID.
              </p>
            </>
          ) : (
            <p className="plannerEmpty">
              Connect the payer and analyze to read live balances, allowances, quote state, and replay status.
            </p>
          )}
        </section>

        <div className="routeGrid" aria-label="Payment routes">
          <article
            className={`routeCard ${
              routeAnalysis?.recommendedPlanId === "direct-usdc" ? "featuredRoute" : ""
            }`}
          >
            <p className="cardLabel">Route 01 · Direct</p>
            <h2>Pay from USDC</h2>
            <p>Spend exactly the invoice amount from your existing USDC balance.</p>
            <button
              className="primaryButton"
              type="button"
              onClick={payDirect}
              disabled={busy || directUnavailable}
            >
              {directUnavailable ? "Route unavailable" : busy ? "Preflighting…" : `Pay ${displayAmount} USDC`}
            </button>
          </article>

          <article
            className={`routeCard ${
              routeAnalysis?.recommendedPlanId === "swap-wmon" ? "featuredRoute" : ""
            }`}
          >
            <p className="cardLabel">Route 02 · Exact buy</p>
            <h2>Pay from WMON</h2>
            <p>The testnet pool delivers exactly {displayAmount} USDC. Unspent WMON returns atomically.</p>
            {swapQuote ? (
              <div className="quoteFacts">
                <span>Maximum spend</span>
                <strong>{formatUnits(swapQuote.maxSellAmount, 18)} WMON</strong>
                {swapQuote.estimatedSellAmount !== undefined ? (
                  <small>Estimated {formatUnits(swapQuote.estimatedSellAmount, 18)} WMON</small>
                ) : null}
              </div>
            ) : null}
            <div className="routeActions">
              <button className="secondaryButton" type="button" onClick={loadWmonQuote} disabled={busy}>
                {swapQuote ? "Refresh quote" : "Get live WMON quote"}
              </button>
              {swapQuote ? (
                <button
                  className="primaryButton"
                  type="button"
                  onClick={payWithWmon}
                  disabled={busy || swapUnavailable}
                >
                  {swapUnavailable ? "Route unavailable" : "Pay with WMON"}
                </button>
              ) : null}
            </div>
          </article>
        </div>

        <p className="formMessage" role="status">{message}</p>
        {transactionHash ? (
          <a
            className="receiptLink"
            href={`${activeMonadChain.blockExplorers.default.url}/tx/${transactionHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View onchain receipt ↗
          </a>
        ) : null}
      </div>
    </section>
  );
}

type MonadPublicClient = ReturnType<typeof createMonadPublicClient>;

async function fetchSwapQuote(payload: string | undefined, payer: Address): Promise<SwapQuote> {
  if (!payload) throw new Error("Invoice payload is unavailable");
  const response = await fetch("/api/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoicePayload: payload, payer }),
  });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(readQuoteError(value));
  return parseSwapQuote(value);
}

function validateSwapQuote(quote: SwapQuote, invoice: Invoice): void {
  if (quote.sellToken !== getAddress(activeWmonAddress)) {
    throw new Error("Quote sell token is not canonical WMON");
  }
  if (quote.buyAmount !== invoice.amount) throw new Error("Quote changed the invoice amount");
  if (quote.expiresAt > invoice.expiry) throw new Error("Quote outlives the signed invoice");
}

async function simulateDirectCandidate(input: {
  client: MonadPublicClient;
  routerAddress: Address;
  account: Address;
  signedInvoice: SignedInvoice;
  invoiceAlreadyPaid: boolean;
  now: bigint;
  balance: bigint;
  allowance: bigint;
}): Promise<SimulationResult> {
  const { invoice, signature } = input.signedInvoice;
  if (input.invoiceAlreadyPaid || invoice.expiry < input.now || input.balance < invoice.amount) {
    return { status: "not-run" };
  }
  if (input.allowance < invoice.amount) return { status: "requires-approval" };

  try {
    const gasEstimate = await input.client.estimateContractGas({
      address: input.routerAddress,
      abi: blinkPayRouterAbi,
      functionName: "payDirect",
      args: [invoice, signature],
      account: input.account,
    });
    return { status: "passed", gasEstimate };
  } catch (error) {
    return { status: "failed", reason: getErrorMessage(error) };
  }
}

async function simulateSwapCandidate(input: {
  client: MonadPublicClient;
  routerAddress: Address;
  account: Address;
  signedInvoice: SignedInvoice;
  invoiceAlreadyPaid: boolean;
  now: bigint;
  balance: bigint;
  allowance: bigint;
  quote?: SwapQuote;
}): Promise<SimulationResult> {
  const { invoice, signature } = input.signedInvoice;
  const quote = input.quote;
  if (
    input.invoiceAlreadyPaid || invoice.expiry < input.now || !quote
      || quote.expiresAt <= input.now || input.balance < quote.maxSellAmount
  ) {
    return { status: "not-run" };
  }
  if (input.allowance < quote.maxSellAmount) return { status: "requires-approval" };

  try {
    const gasEstimate = await input.client.estimateContractGas({
      address: input.routerAddress,
      abi: blinkPayRouterAbi,
      functionName: "payWithSwap",
      args: [
        invoice,
        signature,
        quote.maxSellAmount,
        quote.expiresAt,
        quote.swapCallData,
      ],
      account: input.account,
    });
    return { status: "passed", gasEstimate };
  } catch (error) {
    return { status: "failed", reason: getErrorMessage(error) };
  }
}

function formatPlanUnits(plan: PaymentPlan, amount: bigint): string {
  const decimals = plan.fundingAsset === "USDC" ? 6 : 18;
  return `${formatUnits(amount, decimals)} ${plan.fundingAsset}`;
}

function plannerPreferences(policy: NormalizedPaymentPolicy) {
  return {
    ...(policy.preferredFundingAsset
      ? { preferredFundingAsset: policy.preferredFundingAsset }
      : {}),
    ...(policy.minimumUsdcReserve === undefined
      ? {}
      : { minimumUsdcReserve: policy.minimumUsdcReserve }),
    ...(policy.maxWmonSpend === undefined ? {} : { maxWmonSpend: policy.maxWmonSpend }),
    ...(policy.maxSwapCostBps === undefined
      ? {}
      : { maxSwapCostBps: policy.maxSwapCostBps }),
  };
}

function parsePreferenceResponse(value: unknown): ActivePolicy {
  if (!isRecord(value) || value.status !== "compiled") {
    throw new Error("Preference service returned an invalid response");
  }
  const source = requirePolicySource(value.source);
  const policy = parsePaymentPolicyV1(value.policy);
  return {
    source,
    ...(value.provider === undefined ? {} : { provider: requirePolicyProvider(value.provider) }),
    policy,
    normalized: normalizePaymentPolicy(policy),
    explanations: explainPaymentPolicy(policy),
    ...(typeof value.warning === "string" ? { warning: value.warning } : {}),
  };
}

function requirePolicySource(
  value: unknown,
): Extract<PreferenceCompilation, { status: "compiled" }>["source"] {
  if (value !== "deterministic" && value !== "model"
    && value !== "deterministic-fallback" && value !== "safe-default") {
    throw new Error("Preference service returned an invalid source");
  }
  return value;
}

function requirePolicyProvider(value: unknown): NonNullable<ActivePolicy["provider"]> {
  if (value !== "groq" && value !== "xai" && value !== "openai") {
    throw new Error("Preference service returned an invalid provider");
  }
  return value;
}

function formatPolicySource(
  source: ActivePolicy["source"],
  provider: ActivePolicy["provider"],
): string {
  const providerLabel = provider === "groq"
    ? "Groq"
    : provider === "xai" ? "Grok (xAI)" : provider === "openai" ? "OpenAI" : "AI";
  if (source === "model") {
    return provider === "groq"
      ? "Groq compiled · JSON validated"
      : `${providerLabel} compiled · schema verified`;
  }
  if (source === "deterministic-fallback") {
    return `${providerLabel} offline · deterministic fallback`;
  }
  if (source === "safe-default") return "Safe default policy";
  return "Deterministic compiler";
}

function readPreferenceError(value: unknown): string {
  if (!isRecord(value)) return "Preference compiler returned an invalid error";
  if (typeof value.error === "string") return value.error;
  if (typeof value.message === "string") {
    const issues = Array.isArray(value.issues)
      ? value.issues.filter((issue): issue is string => typeof issue === "string")
      : [];
    return issues.length ? `${value.message}: ${issues.join("; ")}` : value.message;
  }
  return "Preference compiler rejected the request";
}

function formatPlanMaximum(plan: PaymentPlan): string {
  return hasExecutableQuote(plan) ? formatPlanUnits(plan, plan.maximumSpend) : "Not quoted";
}

function formatApprovalStatus(plan: PaymentPlan): string {
  if (!hasExecutableQuote(plan)) return "Not applicable";
  return plan.approvalRequired ? "Required" : "Already sufficient";
}

function formatSwapCost(plan: PaymentPlan): string {
  return hasExecutableQuote(plan) ? `${plan.cost.swapCostBps} bps` : "Not quoted";
}

function hasExecutableQuote(plan: PaymentPlan): boolean {
  return plan.kind !== "exact-output-swap" || plan.quoteExpiresAt !== undefined;
}

function parseSwapQuote(value: unknown): SwapQuote {
  if (!isRecord(value)) throw new Error("Quote response has an invalid shape");

  const sellToken = requireQuoteAddress(value.sellToken, "sellToken");
  const swapCallData = requireQuoteHex(value.swapCallData, "swapCallData");
  const buyAmount = requireQuoteBigInt(value.buyAmount, "buyAmount");
  const maxSellAmount = requireQuoteBigInt(value.maxSellAmount, "maxSellAmount");
  const expiresAt = requireQuoteBigInt(value.expiresAt, "expiresAt");
  const estimatedSellAmount = value.estimatedSellAmount === undefined
    ? undefined
    : requireQuoteBigInt(value.estimatedSellAmount, "estimatedSellAmount");
  const swapCostBps = value.swapCostBps === undefined
    ? undefined
    : requireQuoteNonnegativeInteger(value.swapCostBps, "swapCostBps");

  return {
    sellToken,
    swapCallData,
    buyAmount,
    maxSellAmount,
    ...(estimatedSellAmount === undefined ? {} : { estimatedSellAmount }),
    ...(swapCostBps === undefined ? {} : { swapCostBps }),
    expiresAt,
  };
}

function readQuoteError(value: unknown): string {
  if (isRecord(value) && typeof value.error === "string") return value.error;
  return "Unable to create a WMON quote";
}

function requireQuoteAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value, { strict: true })) {
    throw new Error(`Quote ${field} is invalid`);
  }
  return getAddress(value);
}

function requireQuoteHex(value: unknown, field: string): Hex {
  if (typeof value !== "string" || !isHex(value, { strict: true })) {
    throw new Error(`Quote ${field} is invalid`);
  }
  return value;
}

function requireQuoteBigInt(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    throw new Error(`Quote ${field} is invalid`);
  }
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new Error(`Quote ${field} must be positive`);
  return parsed;
}

function requireQuoteNonnegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Quote ${field} is invalid`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCurrentUnixTime(): bigint {
  return BigInt(Math.floor(Date.now() / 1_000));
}
