// Copyright 2026 Cryptorefills and contributors. Licensed under Apache-2.0. See LICENSE-CODE.

// End-to-end demo: a buying agent searches a (mock) multi-category
// digital-goods catalog (gift cards, mobile top-ups, eSIMs), locks a quote,
// builds an x402-style payment header, settles via a (mock) facilitator, and
// receives a signed delivery envelope.
//
// The catalog and tool field names mirror the shape of the real public
// Cryptorefills MCP server (https://api.cryptorefills.com/mcp/http) so
// production lift just swaps the local functions for MCP tool calls.
//
// Everything is in-process so the narrative stays linear. Production lifts
// out four boundaries:
//   1. storefront -> real MCP server (see ../mcp-storefront-minimal or ../mcp-cryptorefills-live).
//   2. payment -> real EIP-712 signature with an agent wallet.
//   3. facilitator -> Coinbase / x402 Foundation facilitator API.
//   4. receipt -> real signing key bound to the merchant identity.
//
// Run with `pnpm demo` (default category: gift_card) or pass
// `--category=mobile_topup` / `--category=esim`.

// Safety guards. Default mode is offline, mocked, and harmless. Real-checkout
// paths are intentionally not implemented in this demo.
const MOCK_MODE = process.env.MOCK_MODE !== "false";

// CLI category alias maps to (kind, optional category) in the production schema.
type CategoryAlias = "gift_card" | "mobile_topup" | "esim";
type Kind = "giftcard" | "mobile_recharge";
type DeliveryType = "by_email" | "by_phone";
type ProductType = "digital";

interface FaceValue {
  currency_code: "USD" | "EUR" | "BRL" | "INR";
  amount: { type: "fixed"; price: string };
}

interface Product {
  product_id: string;
  is_dynamic: boolean;
  denomination: string;
  localized_denomination: string;
  coin_amount: string;
  coin: "USDC" | "USDT" | "BTC" | "ETH" | "SOL" | "WLD";
  payment_method: string;
  delivery_type: DeliveryType;
  product_type: ProductType;
  face_value: FaceValue;
}

interface BrandRow {
  brand_id: string;
  brand: string;
  family: string;
  kind: Kind;
  category: string;
  country_code: string;
  default_denomination: string;
  is_out_of_stock: boolean;
  product_type: ProductType;
  logo_url: string;
  products: Product[];
}

interface Quote {
  quoteId: string;
  product_id: string;
  brand_id: string;
  quantity: number;
  totalUsd: number;
  settlementAsset: "USDC";
  settlementNetwork: "base-sepolia";
  expiresAt: string;
}

interface GiftCardEnvelope {
  type: "gift_card_code";
  product_id: string;
  brand_id: string;
  brand: string;
  denomination: string;
  face_value: FaceValue;
  delivery_type: DeliveryType;
  code: string;
  expiresAt: string;
}
interface MobileTopupEnvelope {
  type: "mobile_topup_confirmation";
  product_id: string;
  brand_id: string;
  brand: string;
  country_code: string;
  denomination: string;
  face_value: FaceValue;
  delivery_type: DeliveryType;
  confirmationId: string;
  msisdnLast4: string;
  processedAt: string;
}
interface EsimEnvelope {
  type: "esim_lpa";
  product_id: string;
  brand_id: string;
  brand: string;
  denomination: string;
  face_value: FaceValue;
  delivery_type: DeliveryType;
  activationCode: string;
  expiresAt: string;
}
type DeliveryEnvelope = GiftCardEnvelope | MobileTopupEnvelope | EsimEnvelope;

const CATALOG: readonly BrandRow[] = [
  // Gift cards
  {
    brand_id: "11111111-1111-4111-8111-111111111111",
    brand: "Amazon",
    family: "Amazon",
    kind: "giftcard",
    category: "shopping",
    country_code: "US",
    default_denomination: "$50",
    is_out_of_stock: false,
    product_type: "digital",
    logo_url: "https://cdn.cryptorefills.com/logos_v2/amazon.png",
    products: [
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd001", is_dynamic: false, denomination: "$25",  localized_denomination: "$25",  coin_amount: "25.05",  coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_email", product_type: "digital", face_value: { currency_code: "USD", amount: { type: "fixed", price: "25.00" } } },
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd002", is_dynamic: false, denomination: "$50",  localized_denomination: "$50",  coin_amount: "50.075", coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_email", product_type: "digital", face_value: { currency_code: "USD", amount: { type: "fixed", price: "50.00" } } },
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd003", is_dynamic: false, denomination: "$100", localized_denomination: "$100", coin_amount: "100.10", coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_email", product_type: "digital", face_value: { currency_code: "USD", amount: { type: "fixed", price: "100.00" } } },
    ],
  },
  {
    brand_id: "22222222-2222-4222-8222-222222222222",
    brand: "Steam",
    family: "Steam",
    kind: "giftcard",
    category: "games",
    country_code: "US",
    default_denomination: "$20",
    is_out_of_stock: false,
    product_type: "digital",
    logo_url: "https://cdn.cryptorefills.com/logos_v2/steam.png",
    products: [
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd004", is_dynamic: false, denomination: "$20", localized_denomination: "$20", coin_amount: "20.05", coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_email", product_type: "digital", face_value: { currency_code: "USD", amount: { type: "fixed", price: "20.00" } } },
    ],
  },
  {
    brand_id: "33333333-3333-4333-8333-333333333333",
    brand: "Spotify",
    family: "Spotify",
    kind: "giftcard",
    category: "streaming",
    country_code: "US",
    default_denomination: "$10",
    is_out_of_stock: false,
    product_type: "digital",
    logo_url: "https://cdn.cryptorefills.com/logos_v2/spotify.png",
    products: [
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd005", is_dynamic: false, denomination: "$10", localized_denomination: "$10", coin_amount: "10.025", coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_email", product_type: "digital", face_value: { currency_code: "USD", amount: { type: "fixed", price: "10.00" } } },
    ],
  },
  // Mobile top-ups
  {
    brand_id: "44444444-4444-4444-8444-444444444444",
    brand: "AT&T",
    family: "AT&T",
    kind: "mobile_recharge",
    category: "mobile",
    country_code: "US",
    default_denomination: "$10",
    is_out_of_stock: false,
    product_type: "digital",
    logo_url: "https://cdn.cryptorefills.com/logos_v2/att.png",
    products: [
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd006", is_dynamic: false, denomination: "$10", localized_denomination: "$10", coin_amount: "10.05", coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_phone", product_type: "digital", face_value: { currency_code: "USD", amount: { type: "fixed", price: "10.00" } } },
    ],
  },
  {
    brand_id: "55555555-5555-4555-8555-555555555555",
    brand: "Vivo",
    family: "Vivo",
    kind: "mobile_recharge",
    category: "mobile",
    country_code: "BR",
    default_denomination: "R$20",
    is_out_of_stock: false,
    product_type: "digital",
    logo_url: "https://cdn.cryptorefills.com/logos_v2/vivo.png",
    products: [
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd007", is_dynamic: false, denomination: "R$20", localized_denomination: "R$20", coin_amount: "4.075", coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_phone", product_type: "digital", face_value: { currency_code: "BRL", amount: { type: "fixed", price: "20.00" } } },
    ],
  },
  {
    brand_id: "66666666-6666-4666-8666-666666666666",
    brand: "Jio",
    family: "Jio",
    kind: "mobile_recharge",
    category: "mobile",
    country_code: "IN",
    default_denomination: "₹400",
    is_out_of_stock: false,
    product_type: "digital",
    logo_url: "https://cdn.cryptorefills.com/logos_v2/jio.png",
    products: [
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd008", is_dynamic: false, denomination: "₹400", localized_denomination: "₹400", coin_amount: "5.025", coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_phone", product_type: "digital", face_value: { currency_code: "INR", amount: { type: "fixed", price: "400.00" } } },
    ],
  },
  // eSIMs
  {
    brand_id: "77777777-7777-4777-8777-777777777777",
    brand: "Travel eSIM EU 7-day",
    family: "eSIM",
    kind: "mobile_recharge",
    category: "e-sim",
    country_code: "EU",
    default_denomination: "€8",
    is_out_of_stock: false,
    product_type: "digital",
    logo_url: "https://cdn.cryptorefills.com/logos_v2/esim.png",
    products: [
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd009", is_dynamic: false, denomination: "€8", localized_denomination: "€8", coin_amount: "8.05", coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_email", product_type: "digital", face_value: { currency_code: "EUR", amount: { type: "fixed", price: "8.00" } } },
    ],
  },
  {
    brand_id: "88888888-8888-4888-8888-888888888888",
    brand: "Travel eSIM US 30-day",
    family: "eSIM",
    kind: "mobile_recharge",
    category: "e-sim",
    country_code: "US",
    default_denomination: "$25",
    is_out_of_stock: false,
    product_type: "digital",
    logo_url: "https://cdn.cryptorefills.com/logos_v2/esim.png",
    products: [
      { product_id: "0cbbacb6-4820-4463-945e-914295fcd010", is_dynamic: false, denomination: "$25", localized_denomination: "$25", coin_amount: "25.075", coin: "USDC", payment_method: "USDC-Base", delivery_type: "by_email", product_type: "digital", face_value: { currency_code: "USD", amount: { type: "fixed", price: "25.00" } } },
    ],
  },
];

const VALID_CATEGORIES: readonly CategoryAlias[] = ["gift_card", "mobile_topup", "esim"] as const;
const CATEGORY_ARG = (process.argv.find((a) => a.startsWith("--category="))?.split("=")[1] ?? "gift_card") as CategoryAlias;
if (!VALID_CATEGORIES.includes(CATEGORY_ARG)) {
  console.error(`[demo] unknown category: ${CATEGORY_ARG}. Valid: ${VALID_CATEGORIES.join(", ")}`);
  process.exit(1);
}

// Map CLI alias -> production schema filters.
function categoryFilter(alias: CategoryAlias): { kind: Kind; category?: string } {
  if (alias === "gift_card") return { kind: "giftcard" };
  if (alias === "mobile_topup") return { kind: "mobile_recharge", category: "mobile" };
  return { kind: "mobile_recharge", category: "e-sim" };
}

function priceUsd(product: Product): number {
  return Number(product.coin_amount);
}

interface SearchHit { brand: BrandRow; product: Product }

// MOCK: in production these are MCP tool calls over stdio, not local functions.
function searchProducts(alias: CategoryAlias, query?: string): SearchHit[] {
  const { kind, category } = categoryFilter(alias);
  const q = query?.toLowerCase() ?? "";
  const hits: SearchHit[] = [];
  for (const brand of CATALOG) {
    if (brand.kind !== kind) continue;
    if (category && brand.category !== category) continue;
    if (q && !brand.brand.toLowerCase().includes(q) && !brand.family.toLowerCase().includes(q)) continue;
    for (const product of brand.products) hits.push({ brand, product });
  }
  return hits;
}

function findProduct(productId: string): SearchHit | undefined {
  for (const brand of CATALOG) {
    const product = brand.products.find((p) => p.product_id === productId);
    if (product) return { brand, product };
  }
  return undefined;
}

function quote(productId: string, quantity: number): Quote {
  const found = findProduct(productId);
  if (!found) throw new Error(`unknown product_id: ${productId}`);
  const totalUsd = priceUsd(found.product) * quantity;
  return {
    quoteId: `qt_${Math.random().toString(36).slice(2, 10)}`,
    product_id: productId,
    brand_id: found.brand.brand_id,
    quantity,
    totalUsd,
    settlementAsset: "USDC",
    settlementNetwork: "base-sepolia",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

function buildPaymentHeader(q: Quote, payerAddress: string): string {
  const payload = {
    scheme: "exact",
    network: q.settlementNetwork,
    asset: q.settlementAsset,
    amount: q.totalUsd.toFixed(2),
    receiver: "0xMOCKReceiverAddress000000000000000000000",
    payer: payerAddress,
    nonce: `n_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    validUntil: Math.floor(Date.now() / 1000) + 60,
    // MOCK: in production this is an EIP-712 signature; here we use a sentinel.
    signature: "0xMOCKSIG_demo_only",
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// MOCK: in production this calls an x402 facilitator (e.g. Coinbase) which
// submits the authorization on-chain and returns a settlement tx hash.
function settle(headerB64: string): { success: boolean; txHash: string } {
  const decoded = JSON.parse(Buffer.from(headerB64, "base64").toString("utf8")) as { nonce: string };
  return { success: true, txHash: `0xMOCKTX_${decoded.nonce}` };
}

// DEMO-CODE-NOT-REDEEMABLE — never replace these mock codes with real ones
// without a real fulfillment path. Every value below is `MOCK-` / `DEMO-`
// prefixed so it can never be confused with a real redeemable code.
function deliver(q: Quote): DeliveryEnvelope {
  const found = findProduct(q.product_id)!;
  const { brand, product } = found;
  const brandSlug = brand.brand.toUpperCase().replace(/\W+/g, "").slice(0, 4);
  const tail = `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  if (brand.kind === "giftcard") {
    return {
      type: "gift_card_code",
      product_id: product.product_id,
      brand_id: brand.brand_id,
      brand: brand.brand,
      denomination: product.denomination,
      face_value: product.face_value,
      delivery_type: product.delivery_type,
      code: `MOCK-${brandSlug}-${tail}`,
      expiresAt: oneYear,
    };
  }
  if (brand.category === "e-sim") {
    return {
      type: "esim_lpa",
      product_id: product.product_id,
      brand_id: brand.brand_id,
      brand: brand.brand,
      denomination: product.denomination,
      face_value: product.face_value,
      delivery_type: product.delivery_type,
      activationCode: `LPA:1$DEMO-NOT-REDEEMABLE.${brandSlug}.${tail}`,
      expiresAt: oneYear,
    };
  }
  // mobile_recharge / mobile
  return {
    type: "mobile_topup_confirmation",
    product_id: product.product_id,
    brand_id: brand.brand_id,
    brand: brand.brand,
    country_code: brand.country_code,
    denomination: product.denomination,
    face_value: product.face_value,
    delivery_type: product.delivery_type,
    confirmationId: `MOCK-CONF-${brandSlug}-${tail}`,
    msisdnLast4: "XXXX",
    processedAt: new Date().toISOString(),
  };
}

// MOCK: in production this is signed with the merchant's key (e.g. ed25519 over a canonical encoding).
function signReceipt(receipt: object): string {
  return `0xMOCKSIG_receipt_${Buffer.from(JSON.stringify(receipt)).length.toString(16)}`;
}

function describeDelivery(envelope: DeliveryEnvelope): string {
  if (envelope.type === "gift_card_code") return `code ${envelope.code} (${envelope.delivery_type})`;
  if (envelope.type === "mobile_topup_confirmation") return `confirmationId ${envelope.confirmationId}, msisdn ****${envelope.msisdnLast4}`;
  return `eSIM ${envelope.activationCode}`;
}

function pickHit(alias: CategoryAlias, candidates: readonly SearchHit[]): SearchHit {
  if (alias === "gift_card") {
    return candidates.find((h) => h.product.face_value.amount.price === "50.00") ?? candidates[0]!;
  }
  return candidates[0]!;
}

async function run() {
  if (!MOCK_MODE) {
    throw new Error("Real checkout path not implemented in this demo. Set MOCK_MODE=true.");
  }

  const log = (step: number, name: string, detail: string) => console.log(`[demo] step ${step}/5  ${name.padEnd(8)} -> ${detail}`);

  // 1. Discovery — agent finds candidate products in the chosen category.
  const matches = searchProducts(CATEGORY_ARG);
  log(1, "search", `${matches.length} ${CATEGORY_ARG} products available`);

  // 2. Quote — agent locks a price for the chosen product.
  const chosen = pickHit(CATEGORY_ARG, matches);
  const q = quote(chosen.product.product_id, 1);
  log(2, "quote", `${q.quoteId}  total ${q.totalUsd.toFixed(2)} ${q.settlementAsset} on ${q.settlementNetwork}`);

  // 3. Pay — agent assembles an x402-style header.
  const payerAddress = "0xMOCKBuyerAgentAddress00000000000000000000";
  const header = buildPaymentHeader(q, payerAddress);
  log(3, "pay", `X-PAYMENT header built (${q.totalUsd.toFixed(2)} ${q.settlementAsset}, signed: mock)`);

  // 4. Settle — facilitator confirms.
  const settlement = settle(header);
  if (!settlement.success) throw new Error("settlement failed");
  log(4, "settle", `facilitator returned txHash ${settlement.txHash}`);

  // 5. Delivery — supplier returns the category-appropriate envelope.
  const envelope = deliver(q);
  log(5, "deliver", describeDelivery(envelope));

  // Final receipt — the artifact a real merchant signs and an agent stores.
  const orderId = `ord_${Math.random().toString(36).slice(2, 10)}`;
  const receipt = {
    version: "cr-receipt/1",
    order_id: orderId,
    placedAt: new Date().toISOString(),
    payer: payerAddress,
    merchant: { name: "Cryptorefills (demo)", url: "https://www.cryptorefills.com" },
    merchantSurfaces: ["Skills", "MCP", "x402"] as const,
    line: { product_id: chosen.product.product_id, brand_id: chosen.brand.brand_id, brand: chosen.brand.brand, kind: chosen.brand.kind, category: chosen.brand.category, denomination: chosen.product.denomination, face_value: chosen.product.face_value, quantity: q.quantity },
    payment: { asset: q.settlementAsset, network: q.settlementNetwork, amount: q.totalUsd.toFixed(2), txHash: settlement.txHash },
    delivery: envelope,
  };
  const signed = { ...receipt, signature: signReceipt(receipt) };

  console.log("\n=== signed receipt ===");
  console.log(JSON.stringify(signed, null, 2));
}

run().catch((err) => {
  console.error("[demo] failed:", err);
  process.exit(1);
});
