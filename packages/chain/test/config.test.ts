import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import {
  MONAD_MAINNET_RPC_URL,
  MONAD_TESTNET_RPC_URL,
  activeMonadChain,
  activeMonadNetwork,
  activeUsdcAddress,
  activeWmonAddress,
  monadMainnet,
  monadTestnet,
  usdcAddresses,
  wmonAddresses,
  zeroExAllowanceHolderAddresses,
} from "../src";

describe("Monad configuration", () => {
  it("uses the canonical chain identifiers", () => {
    expect(monadMainnet.id).toBe(143);
    expect(monadTestnet.id).toBe(10_143);
  });

  it("defaults the application to Monad testnet", () => {
    expect(activeMonadNetwork).toBe("testnet");
    expect(activeMonadChain.id).toBe(monadTestnet.id);
    expect(activeUsdcAddress).toBe(usdcAddresses.testnet);
    expect(activeWmonAddress).toBe(wmonAddresses.testnet);
  });

  it("uses checksummed Circle USDC addresses", () => {
    expect(getAddress(usdcAddresses.mainnet)).toBe(usdcAddresses.mainnet);
    expect(getAddress(usdcAddresses.testnet)).toBe(usdcAddresses.testnet);
  });

  it("uses checksummed WMON and 0x integration addresses", () => {
    expect(getAddress(wmonAddresses.mainnet)).toBe(wmonAddresses.mainnet);
    expect(getAddress(wmonAddresses.testnet)).toBe(wmonAddresses.testnet);
    expect(getAddress(zeroExAllowanceHolderAddresses.mainnet))
      .toBe(zeroExAllowanceHolderAddresses.mainnet);
  });

  it("uses HTTPS public RPC defaults", () => {
    expect(MONAD_MAINNET_RPC_URL).toMatch(/^https:\/\//);
    expect(MONAD_TESTNET_RPC_URL).toMatch(/^https:\/\//);
  });
});
