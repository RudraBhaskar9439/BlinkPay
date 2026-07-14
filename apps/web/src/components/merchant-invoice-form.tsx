"use client";

import {
  buildInvoiceTypedData,
  createInvoiceMetadataHash,
  encodeSignedInvoice,
  type Invoice,
} from "@blinkpay/core";
import { usdcAddresses } from "@blinkpay/chain";
import { connectInjectedWallet, formatAddress, getConfiguredRouterAddress, getErrorMessage } from "@/lib/wallet";
import Image from "next/image";
import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { bytesToHex, parseUnits, type Address } from "viem";

type GeneratedInvoice = {
  url: string;
  qrCode: string;
  invoice: Invoice;
};

export function MerchantInvoiceForm() {
  const [account, setAccount] = useState<Address>();
  const [amount, setAmount] = useState("5.00");
  const [description, setDescription] = useState("BlinkPay demo payment");
  const [expiryMinutes, setExpiryMinutes] = useState("30");
  const [generated, setGenerated] = useState<GeneratedInvoice>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Connect the merchant wallet to sign an invoice.");

  async function connect() {
    setBusy(true);
    try {
      const wallet = await connectInjectedWallet();
      setAccount(wallet.account);
      setMessage(`Connected as ${formatAddress(wallet.account)}`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setGenerated(undefined);

    try {
      const routerAddress = getConfiguredRouterAddress();
      const wallet = await connectInjectedWallet();
      const amountInUnits = parseUnits(amount, 6);
      const minutes = Number(expiryMinutes);

      if (amountInUnits <= 0n) throw new Error("Invoice amount must be greater than zero");
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1_440) {
        throw new Error("Invoice expiry must be between 5 and 1,440 minutes");
      }
      if (!description.trim()) throw new Error("Add a short payment description");

      const randomId = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
      const timestamp = Date.now();
      const invoice: Invoice = {
        invoiceId: randomId,
        merchant: wallet.account,
        settlementToken: usdcAddresses.mainnet,
        amount: amountInUnits,
        expiry: BigInt(Math.floor(timestamp / 1_000) + minutes * 60),
        nonce: BigInt(timestamp),
        chainId: 143n,
        metadataHash: createInvoiceMetadataHash(description.trim()),
      };

      const signature = await wallet.walletClient.signTypedData({
        account: wallet.account,
        ...buildInvoiceTypedData(invoice, routerAddress),
      });
      const payload = encodeSignedInvoice({
        invoice,
        signature,
        description: description.trim(),
      });
      const url = `${window.location.origin}/pay?invoice=${payload}`;
      const qrCode = await QRCode.toDataURL(url, {
        width: 420,
        margin: 2,
        color: { dark: "#171511", light: "#f4f0e6" },
      });

      setAccount(wallet.account);
      setGenerated({ url, qrCode, invoice });
      setMessage("Invoice signed. Share the link or QR with the payer.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setMessage("Payment link copied.");
    } catch {
      setMessage("Copy failed. Select the payment link manually.");
    }
  }

  return (
    <section className="checkoutShell" aria-labelledby="invoice-title">
      <div className="checkoutIntro">
        <p className="sectionNumber">Phase 1 / Direct settlement</p>
        <h1 id="invoice-title" className="checkoutTitle">Request an exact USDC payment.</h1>
        <p className="lede">
          Your wallet signs the invoice offchain. The payer receives the amount,
          recipient, expiry, and description before approving anything.
        </p>
      </div>

      <div className="checkoutGrid">
        <form className="formCard" onSubmit={createInvoice}>
          <div className="formHeader">
            <span className="stepPill">Merchant</span>
            {account ? <code>{formatAddress(account)}</code> : null}
          </div>

          <label>
            Amount
            <span className="inputWithSuffix">
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="5.00"
                required
              />
              <strong>USDC</strong>
            </span>
          </label>

          <label>
            What is this for?
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={160}
              placeholder="Dinner, design work, rent…"
              required
            />
          </label>

          <label>
            Expires in
            <span className="inputWithSuffix">
              <input
                inputMode="numeric"
                value={expiryMinutes}
                onChange={(event) => setExpiryMinutes(event.target.value)}
                required
              />
              <strong>minutes</strong>
            </span>
          </label>

          <div className="buttonRow">
            {!account ? (
              <button className="secondaryButton" type="button" onClick={connect} disabled={busy}>
                Connect merchant wallet
              </button>
            ) : null}
            <button className="primaryButton" type="submit" disabled={busy}>
              {busy ? "Waiting for wallet…" : "Sign invoice"}
            </button>
          </div>
          <p className="formMessage" role="status">{message}</p>
        </form>

        <aside className="resultCard" aria-live="polite">
          {generated ? (
            <>
              <Image
                className="qrCode"
                src={generated.qrCode}
                width={210}
                height={210}
                alt="BlinkPay invoice QR code"
                unoptimized
              />
              <div>
                <p className="cardLabel">Signed invoice</p>
                <h2>{amount} USDC</h2>
                <p>{description}</p>
              </div>
              <input className="shareLink" readOnly value={generated.url} aria-label="Payment link" />
              <button className="secondaryButton" type="button" onClick={copyLink}>Copy payment link</button>
              <small>Invoice {generated.invoice.invoiceId.slice(0, 10)}…</small>
            </>
          ) : (
            <div className="emptyResult">
              <span>QR</span>
              <h2>Your signed invoice will appear here.</h2>
              <p>No invoice is stored on a server. The signed payload travels in the payment link.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
