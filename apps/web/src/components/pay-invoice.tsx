"use client";

import { createMonadPublicClient, monadMainnet } from "@blinkpay/chain";
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
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";

type ParsedPayload =
  | { ok: true; value: SignedInvoice }
  | { ok: false; error: string };

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

  async function pay() {
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

        <div className="buttonRow paymentActions">
          {!account ? (
            <button className="secondaryButton" type="button" onClick={connect} disabled={busy}>
              Connect payer wallet
            </button>
          ) : <code>{formatAddress(account)}</code>}
          <button className="primaryButton" type="button" onClick={pay} disabled={busy}>
            {busy ? "Preflighting…" : `Pay ${displayAmount} USDC`}
          </button>
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
