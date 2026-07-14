import {
  getAddress,
  isAddress,
  isHex,
  keccak256,
  parseAbi,
  stringToHex,
  type Address,
  type Hex,
} from "viem";

export const blinkPayRouterAbi = parseAbi([
  "struct Invoice { bytes32 invoiceId; address merchant; address settlementToken; uint256 amount; uint256 expiry; uint256 nonce; uint256 chainId; bytes32 metadataHash; }",
  "function payDirect(Invoice invoice, bytes merchantSignature)",
  "function payWithSwap(Invoice invoice, bytes merchantSignature, uint256 maxSellAmount, uint256 quoteDeadline, bytes swapCallData)",
  "function payFromVault(Invoice invoice, bytes merchantSignature, uint256 maxShares)",
  "function paySplitWithVault(Invoice invoice, bytes merchantSignature, uint256 directAmount, uint256 maxShares)",
  "function paySplitWithSwap(Invoice invoice, bytes merchantSignature, uint256 directAmount, uint256 maxSellAmount, uint256 quoteDeadline, bytes swapCallData)",
  "function paidInvoices(bytes32 invoiceId) view returns (bool)",
  "function settlementAsset() view returns (address)",
  "function sellAsset() view returns (address)",
  "function swapTarget() view returns (address)",
  "function allowanceTarget() view returns (address)",
  "function vaultAsset() view returns (address)",
  "function allowedSwapSelectors(bytes4 selector) view returns (bool)",
  "event PaymentSettled(bytes32 indexed invoiceId, address indexed payer, address indexed merchant, address settlementToken, uint256 settlementAmount, uint256 merchantNonce)",
  "event VaultPaymentSettled(bytes32 indexed invoiceId, address indexed payer, address indexed vault, uint256 settlementAmount, uint256 maximumShares, uint256 sharesRedeemed)",
  "event DirectVaultSplitSettled(bytes32 indexed invoiceId, address indexed payer, address indexed vault, uint256 directAmount, uint256 vaultAmount, uint256 maximumShares, uint256 sharesRedeemed)",
  "event DirectSwapSplitSettled(bytes32 indexed invoiceId, address indexed payer, address indexed sellToken, uint256 directAmount, uint256 swapOutputAmount, uint256 maximumSellAmount, uint256 actualSellAmount, uint256 refundedSellAmount)",
]);

export const erc4626Abi = parseAbi([
  "function asset() view returns (address)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function maxWithdraw(address owner) view returns (uint256)",
]);

export const blinkPayTestnetPoolAbi = parseAbi([
  "function sellAsset() view returns (address)",
  "function settlementAsset() view returns (address)",
  "function quoteExactOutput(uint256 amountOut) view returns (uint256 amountIn)",
  "function swapExactOutput(uint256 maxSellAmount, uint256 amountOut, address recipient) returns (uint256 amountIn)",
]);

export const BLINKPAY_DOMAIN_NAME = "BlinkPay";
export const BLINKPAY_DOMAIN_VERSION = "1";

export const invoiceTypes = {
  Invoice: [
    { name: "invoiceId", type: "bytes32" },
    { name: "merchant", type: "address" },
    { name: "settlementToken", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "expiry", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "chainId", type: "uint256" },
    { name: "metadataHash", type: "bytes32" },
  ],
} as const;

export type Invoice = {
  invoiceId: Hex;
  merchant: Address;
  settlementToken: Address;
  amount: bigint;
  expiry: bigint;
  nonce: bigint;
  chainId: bigint;
  metadataHash: Hex;
};

export type SignedInvoice = {
  invoice: Invoice;
  signature: Hex;
  description: string;
};

type SerializedSignedInvoice = {
  invoice: Omit<Invoice, "amount" | "expiry" | "nonce" | "chainId"> & {
    amount: string;
    expiry: string;
    nonce: string;
    chainId: string;
  };
  signature: Hex;
  description: string;
};

export function createInvoiceMetadataHash(description: string): Hex {
  return keccak256(stringToHex(description));
}

export function buildInvoiceTypedData(invoice: Invoice, verifyingContract: Address) {
  return {
    domain: {
      name: BLINKPAY_DOMAIN_NAME,
      version: BLINKPAY_DOMAIN_VERSION,
      chainId: Number(invoice.chainId),
      verifyingContract,
    },
    types: invoiceTypes,
    primaryType: "Invoice" as const,
    message: invoice,
  };
}

export function encodeSignedInvoice(value: SignedInvoice): string {
  assertSignedInvoice(value);

  const serialized: SerializedSignedInvoice = {
    invoice: {
      ...value.invoice,
      amount: value.invoice.amount.toString(),
      expiry: value.invoice.expiry.toString(),
      nonce: value.invoice.nonce.toString(),
      chainId: value.invoice.chainId.toString(),
    },
    signature: value.signature,
    description: value.description,
  };

  const bytes = new TextEncoder().encode(JSON.stringify(serialized));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function decodeSignedInvoice(payload: string): SignedInvoice {
  if (!/^[A-Za-z0-9_-]+$/u.test(payload)) {
    throw new Error("Invoice payload is not valid base64url");
  }

  const padding = "=".repeat((4 - (payload.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(payload.replaceAll("-", "+").replaceAll("_", "/") + padding);
  } catch {
    throw new Error("Invoice payload is not valid base64url");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Invoice payload is not valid JSON");
  }

  if (!isRecord(parsed) || !isRecord(parsed.invoice)) {
    throw new Error("Invoice payload has an invalid shape");
  }

  const invoice = parsed.invoice;
  const value: SignedInvoice = {
    invoice: {
      invoiceId: requireBytes32(invoice.invoiceId, "invoiceId"),
      merchant: requireAddress(invoice.merchant, "merchant"),
      settlementToken: requireAddress(invoice.settlementToken, "settlementToken"),
      amount: requirePositiveBigInt(invoice.amount, "amount"),
      expiry: requirePositiveBigInt(invoice.expiry, "expiry"),
      nonce: requireUnsignedBigInt(invoice.nonce, "nonce"),
      chainId: requirePositiveBigInt(invoice.chainId, "chainId"),
      metadataHash: requireBytes32(invoice.metadataHash, "metadataHash"),
    },
    signature: requireHex(parsed.signature, "signature"),
    description: requireString(parsed.description, "description"),
  };

  assertSignedInvoice(value);
  return value;
}

export function assertSignedInvoice(value: SignedInvoice): void {
  if (createInvoiceMetadataHash(value.description) !== value.invoice.metadataHash) {
    throw new Error("Invoice description does not match its signed metadata hash");
  }

  if (value.invoice.amount <= 0n) throw new Error("Invoice amount must be positive");
  if (value.invoice.expiry <= 0n) throw new Error("Invoice expiry must be positive");
  if (value.invoice.chainId <= 0n) throw new Error("Invoice chain ID must be positive");
  if (!isHex(value.signature) || value.signature.length < 4) {
    throw new Error("Invoice signature is invalid");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value;
}

function requireAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value, { strict: true })) {
    throw new Error(`${field} must be a valid address`);
  }
  return getAddress(value);
}

function requireHex(value: unknown, field: string): Hex {
  if (typeof value !== "string" || !isHex(value, { strict: true })) {
    throw new Error(`${field} must be valid hex`);
  }
  return value;
}

function requireBytes32(value: unknown, field: string): Hex {
  const hex = requireHex(value, field);
  if (hex.length !== 66) throw new Error(`${field} must be 32 bytes`);
  return hex;
}

function requireUnsignedBigInt(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    throw new Error(`${field} must be an unsigned integer`);
  }
  return BigInt(value);
}

function requirePositiveBigInt(value: unknown, field: string): bigint {
  const result = requireUnsignedBigInt(value, field);
  if (result <= 0n) throw new Error(`${field} must be positive`);
  return result;
}
