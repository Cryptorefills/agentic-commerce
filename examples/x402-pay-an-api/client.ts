// Copyright 2026 Cryptorefills and contributors. Licensed under Apache-2.0. See LICENSE-CODE.

// Minimal x402 buyer-loop client.
//
// 1. GET the resource. Expect 402 with payment requirements.
// 2. Pick an `accepts` entry that fits the agent's budget.
// 3. Build an X-PAYMENT header (base64 JSON of the authorization).
// 4. Retry the GET. Expect 200 plus an X-PAYMENT-RESPONSE settlement receipt.
//
// In production, step 3 means signing an EIP-712 typed payload with the
// agent's wallet and (optionally) handing the signature to an x402
// facilitator. Here we stub the signature and amount-check only.

const PORT = Number(process.env.PORT ?? 3000);
const RESOURCE_URL = `http://localhost:${PORT}/paid-resource`;

// Safety guard. Default mode is offline and mocked. Refuse to run a "real"
// path that this demo does not implement.
const MOCK_MODE = process.env.MOCK_MODE !== "false";
if (process.env.ENABLE_REAL_CHECKOUT === "true" && !MOCK_MODE) {
  throw new Error("Real checkout path not implemented in this demo. Set MOCK_MODE=true.");
}

// Agent-side budget guard. A real agent enforces this against the caller's
// authorization scope (per-merchant, per-window, per-amount).
const MAX_PRICE_USDC = 1.0;

type Accept = {
  scheme: string;
  network: string;
  asset: string;
  maxAmountRequired: string;
  payTo: string;
  resource: string;
};

type Requirements = { x402Version: number; accepts: Accept[]; error?: string };

type QuoteResponse = {
  quote: {
    sku: string;
    brand: string;
    category: "gift_card" | "mobile_topup" | "esim";
    country: string;
    faceValueUsd: number;
    feeUsd: number;
    totalUsd: number;
    settlementAsset: string;
    settlementNetwork: string;
    expiresAt: string;
  };
  servedAt: string;
};

function buildPaymentHeader(accept: Accept): string {
  const payload = {
    scheme: "exact" as const,
    network: accept.network,
    asset: accept.asset,
    amount: accept.maxAmountRequired,
    receiver: accept.payTo,
    // MOCK: in production this is the agent wallet address recovered from the EIP-712 signature.
    payer: "0xMOCKBuyerAgentAddress00000000000000000000",
    nonce: `n_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    validUntil: Math.floor(Date.now() / 1000) + 60,
    // MOCK: in production this is a real signature; here we use a sentinel the server checks for.
    signature: "0xMOCKSIG_demo_only",
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

async function buy() {
  const initial = await fetch(RESOURCE_URL);
  if (initial.status !== 402) {
    console.log(`[client] unexpected initial status ${initial.status}; aborting`);
    return;
  }
  console.log("[client] GET /paid-resource -> 402 Payment Required");

  const requirements = (await initial.json()) as Requirements;
  const accept = requirements.accepts[0];
  if (!accept) throw new Error("server returned no accepts");
  if (Number(accept.maxAmountRequired) > MAX_PRICE_USDC) {
    console.log(`[client] price ${accept.maxAmountRequired} ${accept.asset} exceeds budget ${MAX_PRICE_USDC}; refusing`);
    return;
  }
  console.log(`[client] quote: ${Number(accept.maxAmountRequired).toFixed(4)} ${accept.asset} to ${accept.payTo} on ${accept.network}`);

  const header = buildPaymentHeader(accept);
  console.log("[client] retrying with X-PAYMENT header...");
  const paid = await fetch(RESOURCE_URL, { headers: { "X-PAYMENT": header } });

  if (paid.status !== 200) {
    const body = await paid.text();
    console.log(`[client] retry failed: ${paid.status} ${body}`);
    return;
  }
  const receipt = paid.headers.get("x-payment-response");
  const body = (await paid.json()) as QuoteResponse;
  console.log(`[client] ${paid.status} OK`);
  console.log(`[client] received quote: ${body.quote.brand} ${body.quote.sku}, total ${body.quote.totalUsd} ${body.quote.settlementAsset}`);
  if (receipt) {
    const decoded = JSON.parse(Buffer.from(receipt, "base64").toString("utf8"));
    console.log(`[client] settlement: ${JSON.stringify(decoded)}`);
  }
}

buy().catch((err) => {
  console.error("[client] error:", err);
  process.exit(1);
});
