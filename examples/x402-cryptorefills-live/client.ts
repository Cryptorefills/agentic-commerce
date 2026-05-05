// Copyright 2026 Cryptorefills and contributors. Licensed under Apache-2.0. See LICENSE-CODE.

// x402 Cryptorefills Live — inspect the real public x402 server end-to-end
// without spending money. Three modes:
//
//   MODE=manifest    (default) fetch /.well-known/x402.json, print details.
//   MODE=catalog               + GET /v1/brands, GET /v1/catalog. Real price_usdc.
//   MODE=inspect-402           + POST /v1/orders (no signature) → parse 402, print
//                                what payment WOULD be required. Never signs.
//                                Never submits a payment retry.
//
// SAFETY: no wallet code, no EIP-3009 signing, no payment submission.
// FORBIDDEN_REAL_PAYMENT_VARS throw at startup if any are set.

import { fetchManifest, listBrands, getCatalog, postOrderForInspection, UPSTREAM_INFO } from "./upstream-client.js";

// Hard-fail at startup if any payment-adjacent env var is set. Treats ANY of
// these as "the user is trying to wire up payment" and refuses to run.
const FORBIDDEN_REAL_PAYMENT_VARS = [
  "ENABLE_REAL_PAYMENT",
  "PRIVATE_KEY",
  "WALLET_PRIVATE_KEY",
  "ETH_PRIVATE_KEY",
  "BASE_PRIVATE_KEY",
];

for (const v of FORBIDDEN_REAL_PAYMENT_VARS) {
  if (process.env[v]) {
    throw new Error(
      `[safety] env var '${v}' is set, but real payment is not implemented in this demo. ` +
      `This demo deliberately stops at PAYMENT-REQUIRED inspection. ` +
      `For production payment plumbing, see https://github.com/cryptorefills/agents.`,
    );
  }
}

type Mode = "manifest" | "catalog" | "inspect-402";

const MODE: Mode = (() => {
  const v = (process.env.MODE ?? "manifest") as Mode;
  if (v !== "manifest" && v !== "catalog" && v !== "inspect-402") {
    throw new Error(`MODE must be one of: manifest, catalog, inspect-402. got "${v}"`);
  }
  return v;
})();

const COUNTRY = (process.env.COUNTRY ?? "us").toLowerCase();
const BRAND = process.env.BRAND ?? "Amazon.com";

function banner(line: string): void {
  console.log(`\n=== ${line} ===`);
}

async function runManifest(): Promise<void> {
  banner("manifest");
  const r = await fetchManifest();
  if (r.status !== 200) {
    console.log(`[live] manifest fetch failed: ${r.status}`);
    return;
  }
  console.log(`[live] upstream OK (${UPSTREAM_INFO.baseUrl}, UA=${UPSTREAM_INFO.userAgent})`);
  console.log(JSON.stringify(r.body, null, 2));
}

async function runCatalog(): Promise<void> {
  await runManifest();
  banner(`brands country_code=${COUNTRY}`);
  const brandsRes = await listBrands(COUNTRY);
  if (brandsRes.status !== 200) {
    console.log(`[live] /v1/brands failed: ${brandsRes.status} ${JSON.stringify(brandsRes.body)}`);
    return;
  }
  const brands = Array.isArray(brandsRes.body) ? brandsRes.body : [];
  console.log(`[live] received ${brands.length} brands. First 5:`);
  console.log(JSON.stringify(brands.slice(0, 5), null, 2));

  banner(`catalog brand_name=${BRAND}`);
  const catRes = await getCatalog(COUNTRY, BRAND);
  if (catRes.status !== 200) {
    console.log(`[live] /v1/catalog failed: ${catRes.status} ${JSON.stringify(catRes.body)}`);
    return;
  }
  const catalog = Array.isArray(catRes.body) ? catRes.body : [];
  console.log(`[live] received ${catalog.length} products for ${BRAND}. First 3:`);
  console.log(JSON.stringify(catalog.slice(0, 3), null, 2));
}

async function runInspect402(): Promise<void> {
  await runCatalog();
  banner("POST /v1/orders (no signature) — expecting 402 PAYMENT-REQUIRED");

  // Build a minimal order body. We deliberately use placeholder fields so the
  // server's validator is the only thing that determines whether we get 402
  // or 400. We never submit PAYMENT-SIGNATURE.
  const orderBody = {
    items: [
      {
        // The product_id below is illustrative. In production this would be a
        // real product_id from the catalog response above.
        product_id: "00000000-0000-0000-0000-000000000000",
        quantity: 1,
      },
    ],
    email: "demo@example.com",
    country_code: COUNTRY,
  };

  const res = await postOrderForInspection(orderBody);
  console.log(`[live] HTTP ${res.status}`);

  // PAYMENT-REQUIRED can be returned via header (per manifest) or in body.
  const paymentRequiredHeader = res.headers.get("PAYMENT-REQUIRED") ?? res.headers.get("payment-required");
  if (paymentRequiredHeader) {
    console.log("[live] PAYMENT-REQUIRED header (decoded):");
    try {
      const decoded = JSON.parse(Buffer.from(paymentRequiredHeader, "base64url").toString("utf8"));
      console.log(JSON.stringify(decoded, null, 2));
    } catch {
      console.log(paymentRequiredHeader);
    }
  }

  console.log("[live] response body:");
  console.log(JSON.stringify(res.body, null, 2));

  console.log(
    "\n[live] STOP. This demo does not sign, does not submit PAYMENT-SIGNATURE, " +
    "and does not move USDC. To pay, see https://github.com/cryptorefills/agents.",
  );
}

async function main(): Promise<void> {
  console.log(`[live] mode=${MODE} country=${COUNTRY} brand=${BRAND}`);
  console.log(`[live] rate_limit=${UPSTREAM_INFO.rateLimitRps}rps timeout=${UPSTREAM_INFO.timeoutMs}ms`);
  if (MODE === "manifest") return runManifest();
  if (MODE === "catalog") return runCatalog();
  if (MODE === "inspect-402") return runInspect402();
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : "unknown error";
  console.error(`[live] fatal: ${msg}`);
  process.exit(1);
});
