"use client";

import {
  createMonadPublicClient,
  monadMainnet,
  wmonAddresses,
} from "@blinkpay/chain";
import {
  blinkPayRouterAbi,
  buildInvoiceTypedData,
  decodeSignedInvoice,
  type SignedInvoice,
} from "@blinkpay/core";
import {
  connectInjectedWallet,
  formatAddress,
  getConfiguredRouterAddress,
  getErrorMessage,
} from "@/lib/wallet";
import { useState } from "react";
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
  swapCallData: Hex;
  expiresAt: bigint;
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Review every field before connecting your wallet.");

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

  async function payDirect() {
    setBusy(true);
    setTransactionHash(undefined);

    try {
      const routerAddress = getConfiguredRouterAddress();
      if (invoice.chainId !== BigInt(monadMainnet.id)) throw new Error("Invoice is for a different chain");

      const signatureValid = await verifyTypedData({
        address: invoice.merchant,
        signature,
        ...buildInvoiceTypedData(invoice, routerAddress),
      });
      if (!signatureValid) throw new Error("Merchant signature is invalid for this router");

      const wallet = await connectInjectedWallet();
      const client = createMonadPublicClient("mainnet");
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
          chain: monadMainnet,
        });
        await client.waitForTransactionReceipt({ hash: approvalHash });
      }

      setMessage("Approval confirmed. Settle the invoice in your wallet…");
      const paymentHash = await wallet.walletClient.writeContract({
        address: routerAddress,
        abi: blinkPayRouterAbi,
        functionName: "payDirect",
        args: [invoice, signature],
        account: wallet.account,
        chain: monadMainnet,
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
      if (invoice.chainId !== BigInt(monadMainnet.id)) {
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
      setMessage("Requesting a server-validated exact-output WMON quote…");

      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoicePayload: payload, payer: wallet.account }),
      });
      const value: unknown = await response.json();
      if (!response.ok) throw new Error(readQuoteError(value));

      const quote = parseSwapQuote(value);
      if (quote.sellToken !== getAddress(wmonAddresses.mainnet)) {
        throw new Error("Quote sell token is not canonical WMON");
      }
      if (quote.buyAmount !== invoice.amount) throw new Error("Quote changed the invoice amount");
      if (quote.expiresAt > invoice.expiry) throw new Error("Quote outlives the signed invoice");

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
      const client = createMonadPublicClient("mainnet");
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
          chain: monadMainnet,
        });
        await client.waitForTransactionReceipt({ hash: approvalHash });
      }

      const currentTimestamp = getCurrentUnixTime();
      if (swapQuote.expiresAt < currentTimestamp) {
        setSwapQuote(undefined);
        throw new Error("The quote expired after approval. Request a fresh quote; your cap remains safe");
      }

      setMessage("Approval confirmed. Execute the exact-output route in your wallet…");
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
        chain: monadMainnet,
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
          <div><dt>Network</dt><dd>Monad mainnet</dd></div>
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

        <div className="routeGrid" aria-label="Payment routes">
          <article className="routeCard">
            <p className="cardLabel">Route 01 · Direct</p>
            <h2>Pay from USDC</h2>
            <p>Spend exactly the invoice amount from your existing USDC balance.</p>
            <button className="primaryButton" type="button" onClick={payDirect} disabled={busy}>
              {busy ? "Preflighting…" : `Pay ${displayAmount} USDC`}
            </button>
          </article>

          <article className="routeCard featuredRoute">
            <p className="cardLabel">Route 02 · Exact buy</p>
            <h2>Pay from WMON</h2>
            <p>The merchant still gets exactly {displayAmount} USDC. Unspent WMON returns atomically.</p>
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
                <button className="primaryButton" type="button" onClick={payWithWmon} disabled={busy}>
                  Pay with WMON
                </button>
              ) : null}
            </div>
          </article>
        </div>

        <p className="formMessage" role="status">{message}</p>
        {transactionHash ? (
          <a
            className="receiptLink"
            href={`${monadMainnet.blockExplorers.default.url}/tx/${transactionHash}`}
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

  return {
    sellToken,
    swapCallData,
    buyAmount,
    maxSellAmount,
    estimatedSellAmount,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCurrentUnixTime(): bigint {
  return BigInt(Math.floor(Date.now() / 1_000));
}
