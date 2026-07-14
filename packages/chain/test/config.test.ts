import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import {
  MONAD_MAINNET_RPC_URL,
  MONAD_TESTNET_RPC_URL,
  monadMainnet,
  monadTestnet,
  usdcAddresses,
} from "../src";

describe("Monad configuration", () => {
  it("uses the canonical chain identifiers", () => {
    expect(monadMainnet.id).toBe(143);
    expect(monadTestnet.id).toBe(10_143);
  });

  it("uses checksummed Circle USDC addresses", () => {
    expect(getAddress(usdcAddresses.mainnet)).toBe(usdcAddresses.mainnet);
    expect(getAddress(usdcAddresses.testnet)).toBe(usdcAddresses.testnet);
  });

  it("uses HTTPS public RPC defaults", () => {
    expect(MONAD_MAINNET_RPC_URL).toMatch(/^https:\/\//);
    expect(MONAD_TESTNET_RPC_URL).toMatch(/^https:\/\//);
  });
});
