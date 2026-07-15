"use client";

import {
  connectInjectedWallet,
  formatAddress,
  getErrorMessage,
  watchInjectedAccount,
} from "@/lib/wallet";
import { useEffect, useState } from "react";
import type { Address } from "viem";

export function HeaderWallet() {
  const [account, setAccount] = useState<Address>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Connect wallet");

  useEffect(() => watchInjectedAccount((nextAccount) => {
    setAccount(nextAccount);
    setMessage(nextAccount ? `Connected as ${formatAddress(nextAccount)}` : "Connect wallet");
  }), []);

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

  return (
    <button
      className={`headerWallet ${account ? "connected" : ""}`}
      type="button"
      onClick={connect}
      disabled={busy}
      title={message}
      aria-label={account ? `Wallet ${formatAddress(account)}` : message}
    >
      <span className="walletGlyph" aria-hidden="true">◈</span>
      <span>{account ? formatAddress(account) : busy ? "Connecting…" : "Connect wallet"}</span>
    </button>
  );
}
