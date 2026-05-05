// Copyright 2026 Cryptorefills and contributors. Licensed under Apache-2.0. See LICENSE-CODE.

// Minimal x402 server. Returns HTTP 402 for /paid-resource until the request
// carries a valid X-PAYMENT header, then returns the protected content (a
// digital-goods quote shaped like a real merchant's catalog response) plus a
// mock settlement receipt in X-PAYMENT-RESPONSE.
//
// The shape of the 402 body, the X-PAYMENT header (base64 JSON), and the
// X-PAYMENT-RESPONSE header mirror the real x402 spec; the cryptography is
// stubbed. See // MOCK: comments for the boundaries.

import express, { type Request, type Response } from "express";

const PORT = Number(process.env.PORT ?? 3000);
const RECEIVER = process.env.MOCK_RECEIVER_ADDRESS ?? "0xMOCKReceiverAddress000000000000000000000";
const NETWORK = process.env.MOCK_NETWORK ?? "base-sepolia";
const ASSET = process.env.MOCK_ASSET ?? "USDC";
const PRICE = process.env.MOCK_PRICE ?? "0.01";

// Safety guards. Default mode is offline, mocked, and harmless. Real-checkout
// paths are intentionally not implemented in this demo.
const MOCK_MODE = process.env.MOCK_MODE !== "false";
const REAL_CHECKOUT_ENABLED =
  process.env.ENABLE_REAL_CHECKOUT === "true" && !MOCK_MODE && Boolean(process.env.CRYPTOREFILLS_API_KEY);
if (REAL_CHECKOUT_ENABLED) {
  throw new Error("Real checkout path not implemented in this demo. Set MOCK_MODE=true.");
}

// One-shot nonce set. Production: use a TTL'd store (Redis) and bind nonces
// to (payer, resource, expiry) so a replay across resources is rejected.
const usedNonces = new Set<string>();

type PaymentPayload = {
  scheme: "exact";
  network: string;
  asset: string;
  amount: string;
  receiver: string;
  payer: string;
  nonce: string;
  validUntil: number;
  // MOCK: in production this is an EIP-712 signature over the typed payment authorization.
  signature: string;
};

function buildRequirements(resource: string) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        asset: ASSET,
        maxAmountRequired: PRICE,
        resource,
        payTo: RECEIVER,
        description: "Access to the protected demo resource.",
        mimeType: "application/json",
        maxTimeoutSeconds: 60,
      },
    ],
  };
}

function verifyPayment(headerValue: string, resource: string): { ok: true; payload: PaymentPayload } | { ok: false; reason: string } {
  let payload: PaymentPayload;
  try {
    payload = JSON.parse(Buffer.from(headerValue, "base64").toString("utf8")) as PaymentPayload;
  } catch {
    return { ok: false, reason: "malformed X-PAYMENT header" };
  }
  if (payload.network !== NETWORK || payload.asset !== ASSET) return { ok: false, reason: "wrong network or asset" };
  if (payload.receiver !== RECEIVER) return { ok: false, reason: "receiver mismatch" };
  if (Number(payload.amount) < Number(PRICE)) return { ok: false, reason: "amount below price" };
  if (payload.validUntil < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
  if (usedNonces.has(payload.nonce)) return { ok: false, reason: "nonce already used" };
  // MOCK: in production, verify the EIP-712 signature here against payload.payer,
  // and submit the authorization to an x402 facilitator that settles on-chain.
  if (!payload.signature.startsWith("0xMOCKSIG")) return { ok: false, reason: "bad mock signature" };
  usedNonces.add(payload.nonce);
  return { ok: true, payload };
}

const app = express();

app.get("/paid-resource", (req: Request, res: Response) => {
  const resource = `http://localhost:${PORT}${req.originalUrl}`;
  const header = req.header("x-payment");
  if (!header) {
    console.log("[server] /paid-resource hit without payment -> 402");
    res.status(402).json(buildRequirements(resource));
    return;
  }
  const result = verifyPayment(header, resource);
  if (!result.ok) {
    console.log(`[server] /paid-resource rejected: ${result.reason}`);
    res.status(402).json({ ...buildRequirements(resource), error: result.reason });
    return;
  }
  // MOCK: real facilitators return a settlement transaction hash here.
  const settlementReceipt = Buffer.from(JSON.stringify({ success: true, txHash: `0xMOCKTX_${result.payload.nonce}`, network: NETWORK })).toString("base64");
  res.setHeader("X-PAYMENT-RESPONSE", settlementReceipt);
  console.log("[server] /paid-resource hit with payment -> 200 (mock-verified)");
  res.json({
    // MOCK: production returns this from the merchant's catalog/quote service.
    quote: {
      sku: "amzn-us-50",
      brand: "Amazon US",
      category: "gift_card",
      country: "US",
      faceValueUsd: 50,
      feeUsd: 0.75,
      totalUsd: 50.75,
      settlementAsset: "USDC",
      settlementNetwork: NETWORK,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
    servedAt: new Date().toISOString(),
  });
});

app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
