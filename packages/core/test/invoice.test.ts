import { getAddress, hashTypedData, keccak256, stringToHex, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import {
  BLINKPAY_DOMAIN_NAME,
  BLINKPAY_DOMAIN_VERSION,
  buildInvoiceTypedData,
  createInvoiceMetadataHash,
  decodeSignedInvoice,
  encodeSignedInvoice,
  type Invoice,
  type SignedInvoice,
} from "../src";

const router = getAddress("0x1111111111111111111111111111111111111111");

function fixture(): SignedInvoice {
  const description = "Design work — July ✨";
  const invoice: Invoice = {
    invoiceId: keccak256(stringToHex("invoice-1")),
    merchant: getAddress("0x2222222222222222222222222222222222222222"),
    settlementToken: getAddress("0x754704Bc059F8C67012fEd69BC8A327a5aafb603"),
    amount: 12_500_000n,
    expiry: 1_800_000_000n,
    nonce: 7n,
    chainId: 143n,
    metadataHash: createInvoiceMetadataHash(description),
  };

  return {
    invoice,
    description,
    signature: `0x${"11".repeat(65)}` as Hex,
  };
}

describe("invoice typed data", () => {
  it("uses the expected BlinkPay signing domain", () => {
    const typedData = buildInvoiceTypedData(fixture().invoice, router);

    expect(typedData.domain).toEqual({
      name: BLINKPAY_DOMAIN_NAME,
      version: BLINKPAY_DOMAIN_VERSION,
      chainId: 143,
      verifyingContract: router,
    });
    expect(typedData.primaryType).toBe("Invoice");
    expect(hashTypedData(typedData)).toMatch(/^0x[\da-f]{64}$/u);
  });

  it("round-trips a signed invoice with unicode metadata", () => {
    const value = fixture();
    expect(decodeSignedInvoice(encodeSignedInvoice(value))).toEqual(value);
  });

  it("rejects a description that was changed after signing", () => {
    const payload = encodeSignedInvoice(fixture());
    const padding = "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(payload.replaceAll("-", "+").replaceAll("_", "/") + padding);
    const serialized = JSON.parse(json) as { description: string };
    serialized.description = "Changed payment";
    const tampered = btoa(JSON.stringify(serialized))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, "");

    expect(() => decodeSignedInvoice(tampered)).toThrow(
      "Invoice description does not match its signed metadata hash",
    );
  });

  it("rejects malformed payloads", () => {
    expect(() => decodeSignedInvoice("not+base64"))
      .toThrow("Invoice payload is not valid base64url");
    expect(() => decodeSignedInvoice("not-valid"))
      .toThrow("Invoice payload is not valid base64url");
  });
});
