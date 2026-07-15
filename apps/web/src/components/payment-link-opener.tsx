"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function PaymentLinkOpener() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("Paste the link shared by the merchant.");

  function openInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = value.trim();
    if (!input) {
      setMessage("Add a BlinkPay payment link first.");
      return;
    }

    try {
      const url = new URL(input);
      const payload = url.searchParams.get("invoice");
      if (!payload) throw new Error("This link does not contain a signed invoice.");
      router.push(`/pay?invoice=${encodeURIComponent(payload)}`);
    } catch (error) {
      if (/^[A-Za-z0-9_-]+$/u.test(input)) {
        router.push(`/pay?invoice=${encodeURIComponent(input)}`);
        return;
      }
      setMessage(error instanceof Error ? error.message : "Use a valid BlinkPay payment link.");
    }
  }

  return (
    <section className="checkoutShell payEntry" aria-labelledby="open-payment-title">
      <div className="payEntryCopy">
        <p className="sectionNumber">Payer portal / Monad testnet</p>
        <h1 id="open-payment-title" className="checkoutTitle">Open a payment request.</h1>
        <p className="lede">
          Paste a BlinkPay link to verify the merchant signature, exact amount,
          expiry, and every available route before connecting your wallet.
        </p>
      </div>

      <form className="payEntryCard" onSubmit={openInvoice}>
        <div className="payEntryIcon" aria-hidden="true">↗</div>
        <div>
          <p className="cardLabel">Signed payment link</p>
          <h2>Review before you pay.</h2>
        </div>
        <label>
          <span>Payment link</span>
          <input
            type="text"
            inputMode="url"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://blinkpay…/pay?invoice=…"
            autoComplete="off"
          />
        </label>
        <button className="primaryButton" type="submit">Open secure checkout <span>→</span></button>
        <p className="formMessage" role="status">{message}</p>
        <div className="payEntryTrust">
          <span>✓ No wallet access yet</span>
          <span>✓ Signature checked first</span>
          <span>✓ Testnet only</span>
        </div>
      </form>
    </section>
  );
}
