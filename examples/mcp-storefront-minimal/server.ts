// Copyright 2026 Cryptorefills and contributors. Licensed under Apache-2.0. See LICENSE-CODE.

// Minimal MCP storefront. Exposes five tools to an MCP-aware agent:
//   - search_products:     filter the in-memory catalog by query/kind/category.
//   - get_product_details: return one brand row by brand_id with its products.
//   - quote:               lock a price for a product_id + quantity (10-minute window).
//   - place_order:         redeem a quote with a payment header; return delivery envelope.
//   - get_order_status:    look up a placed order, including its delivery envelope.
//
// The catalog and tool field names mirror the shape of the real public
// Cryptorefills MCP server (https://api.cryptorefills.com/mcp/http) so that
// the same agent reasoning works against either the mock or the live wrapper.
//
// Real storefronts plug into a catalog service, an FX feed, an inventory
// system, and an x402 facilitator. This file fakes all four with the
// smallest amount of code that still demonstrates the agent contract.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Safety guards. Default mode is offline, mocked, and harmless. Real-checkout
// paths are intentionally not implemented in this demo.
const MOCK_MODE = process.env.MOCK_MODE !== "false";
const REAL_CHECKOUT_ENABLED =
  process.env.ENABLE_REAL_CHECKOUT === "true" && !MOCK_MODE && Boolean(process.env.CRYPTOREFILLS_API_KEY);
if (REAL_CHECKOUT_ENABLED) {
  throw new Error("Real checkout path not implemented in this demo. Set MOCK_MODE=true.");
}

// Real Cryptorefills schema (verified against api.cryptorefills.com/mcp/http).
type Kind = "giftcard" | "mobile_recharge";
type DeliveryType = "by_email" | "by_phone";
type ProductType = "digital";

interface FaceValue {
  currency_code: "USD" | "EUR" | "BRL" | "INR";
  amount: { type: "fixed"; price: string };
}

interface Product {
  product_id: string;            // UUID, stable per SKU
  is_dynamic: boolean;           // false = fixed denomination
  denomination: string;
  localized_denomination: string;
  coin_amount: string;           // decimal string in `coin` units
  coin: "USDC" | "USDT" | "BTC" | "ETH" | "SOL" | "WLD";
  original_coin_amount: string;
  payment_method: string;        // e.g. "USDC-Base", "BTC"
  delivery_type: DeliveryType;
  product_type: ProductType;
  face_value: FaceValue;
}

interface BrandRow {
  brand_id: string;              // UUID
  brand: string;                 // display name
  family: string;                // grouping
  kind: Kind;
  category: string;              // e.g. "shopping", "games", "streaming", "mobile", "e-sim"
  country_code: string;          // ISO 3166-1 alpha-2 uppercase
  default_denomination: string;
  is_out_of_stock: boolean;
  product_type: ProductType;
  logo_url: string;
  logo_base_url: string;
  products: Product[];
}

// MOCK: production catalog has 10,500+ brands sourced from supplier APIs.
// These 10 SKUs across 8 brands are stable demo fixtures.
const CATALOG: readonly BrandRow[] = [
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
    logo_base_url: "https://cdn.cryptorefills.com/logos_v2",
    products: [
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd001",
        is_dynamic: false,
        denomination: "$25",
        localized_denomination: "$25",
        coin_amount: "25.05",
        coin: "USDC",
        original_coin_amount: "25.05",
        payment_method: "USDC-Base",
        delivery_type: "by_email",
        product_type: "digital",
        face_value: { currency_code: "USD", amount: { type: "fixed", price: "25.00" } },
      },
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd002",
        is_dynamic: false,
        denomination: "$50",
        localized_denomination: "$50",
        coin_amount: "50.075",
        coin: "USDC",
        original_coin_amount: "50.075",
        payment_method: "USDC-Base",
        delivery_type: "by_email",
        product_type: "digital",
        face_value: { currency_code: "USD", amount: { type: "fixed", price: "50.00" } },
      },
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd003",
        is_dynamic: false,
        denomination: "$100",
        localized_denomination: "$100",
        coin_amount: "100.10",
        coin: "USDC",
        original_coin_amount: "100.10",
        payment_method: "USDC-Base",
        delivery_type: "by_email",
        product_type: "digital",
        face_value: { currency_code: "USD", amount: { type: "fixed", price: "100.00" } },
      },
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
    logo_base_url: "https://cdn.cryptorefills.com/logos_v2",
    products: [
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd004",
        is_dynamic: false,
        denomination: "$20",
        localized_denomination: "$20",
        coin_amount: "20.05",
        coin: "USDC",
        original_coin_amount: "20.05",
        payment_method: "USDC-Base",
        delivery_type: "by_email",
        product_type: "digital",
        face_value: { currency_code: "USD", amount: { type: "fixed", price: "20.00" } },
      },
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
    logo_base_url: "https://cdn.cryptorefills.com/logos_v2",
    products: [
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd005",
        is_dynamic: false,
        denomination: "$10",
        localized_denomination: "$10",
        coin_amount: "10.025",
        coin: "USDC",
        original_coin_amount: "10.025",
        payment_method: "USDC-Base",
        delivery_type: "by_email",
        product_type: "digital",
        face_value: { currency_code: "USD", amount: { type: "fixed", price: "10.00" } },
      },
    ],
  },
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
    logo_base_url: "https://cdn.cryptorefills.com/logos_v2",
    products: [
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd006",
        is_dynamic: false,
        denomination: "$10",
        localized_denomination: "$10",
        coin_amount: "10.05",
        coin: "USDC",
        original_coin_amount: "10.05",
        payment_method: "USDC-Base",
        delivery_type: "by_phone",
        product_type: "digital",
        face_value: { currency_code: "USD", amount: { type: "fixed", price: "10.00" } },
      },
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
    logo_base_url: "https://cdn.cryptorefills.com/logos_v2",
    products: [
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd007",
        is_dynamic: false,
        denomination: "R$20",
        localized_denomination: "R$20",
        coin_amount: "4.075",
        coin: "USDC",
        original_coin_amount: "4.075",
        payment_method: "USDC-Base",
        delivery_type: "by_phone",
        product_type: "digital",
        face_value: { currency_code: "BRL", amount: { type: "fixed", price: "20.00" } },
      },
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
    logo_base_url: "https://cdn.cryptorefills.com/logos_v2",
    products: [
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd008",
        is_dynamic: false,
        denomination: "₹400",
        localized_denomination: "₹400",
        coin_amount: "5.025",
        coin: "USDC",
        original_coin_amount: "5.025",
        payment_method: "USDC-Base",
        delivery_type: "by_phone",
        product_type: "digital",
        face_value: { currency_code: "INR", amount: { type: "fixed", price: "400.00" } },
      },
    ],
  },
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
    logo_base_url: "https://cdn.cryptorefills.com/logos_v2",
    products: [
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd009",
        is_dynamic: false,
        denomination: "€8",
        localized_denomination: "€8",
        coin_amount: "8.05",
        coin: "USDC",
        original_coin_amount: "8.05",
        payment_method: "USDC-Base",
        delivery_type: "by_email",
        product_type: "digital",
        face_value: { currency_code: "EUR", amount: { type: "fixed", price: "8.00" } },
      },
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
    logo_base_url: "https://cdn.cryptorefills.com/logos_v2",
    products: [
      {
        product_id: "0cbbacb6-4820-4463-945e-914295fcd010",
        is_dynamic: false,
        denomination: "$25",
        localized_denomination: "$25",
        coin_amount: "25.075",
        coin: "USDC",
        original_coin_amount: "25.075",
        payment_method: "USDC-Base",
        delivery_type: "by_email",
        product_type: "digital",
        face_value: { currency_code: "USD", amount: { type: "fixed", price: "25.00" } },
      },
    ],
  },
] as const;

interface Quote {
  quoteId: string;
  product_id: string;
  brand_id: string;
  quantity: number;
  totals: { faceValueUsd: number; feeUsd: number; totalUsd: number; settlementAsset: "USDC"; settlementNetwork: "base-sepolia" };
  expiresAt: string;
}

const quotes = new Map<string, Quote>();
const orders = new Map<string, { quote: Quote; placedAt: string; deliveryEnvelope: unknown }>();

const QUOTE_TTL_MS = 10 * 60 * 1000;
const FEE_BPS = 50; // 50 bps default mock fee on top of face value

function shortId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function findProduct(productId: string): { brand: BrandRow; product: Product } | undefined {
  for (const brand of CATALOG) {
    const product = brand.products.find((p) => p.product_id === productId);
    if (product) return { brand, product };
  }
  return undefined;
}

function priceUsd(product: Product): number {
  // For demo purposes treat coin_amount as USD-equivalent for USDC.
  return Number(product.coin_amount);
}

function buildQuote(productId: string, quantity: number): Quote {
  const found = findProduct(productId);
  if (!found) throw new Error(`unknown product_id: ${productId}`);
  if (quantity < 1 || quantity > 10) throw new Error("quantity out of range (1-10)");
  const unitUsd = priceUsd(found.product);
  const faceValueUsd = unitUsd * quantity;
  const feeUsd = (faceValueUsd * FEE_BPS) / 10_000;
  const quote: Quote = {
    quoteId: shortId("qt"),
    product_id: productId,
    brand_id: found.brand.brand_id,
    quantity,
    totals: { faceValueUsd, feeUsd, totalUsd: faceValueUsd + feeUsd, settlementAsset: "USDC", settlementNetwork: "base-sepolia" },
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
  };
  quotes.set(quote.quoteId, quote);
  return quote;
}

// MOCK: production verifies an EIP-712-signed x402 payment header against the
// quote's totalUsd and settlement network, then submits to a facilitator.
function verifyPaymentHeader(header: string, quote: Quote): true | string {
  if (typeof header !== "string" || header.length < 16) return "header missing or too short";
  try {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as { amount?: string; asset?: string; network?: string };
    if (decoded.asset !== quote.totals.settlementAsset) return "wrong asset";
    if (decoded.network !== quote.totals.settlementNetwork) return "wrong network";
    if (Number(decoded.amount) < quote.totals.totalUsd) return "amount below quote";
    return true;
  } catch {
    return "malformed payment header";
  }
}

// DEMO-CODE-NOT-REDEEMABLE
// Every code, confirmation ID, and LPA URL produced below is a demo placeholder
// with a `MOCK-` or `DEMO-` prefix. Never replace these mock values with real
// ones without wiring a real fulfillment path AND adding tests for the safety
// guard at the top of this file.
function fulfill(quote: Quote): unknown {
  const found = findProduct(quote.product_id)!;
  const { brand, product } = found;
  const brandSlug = brand.brand.toUpperCase().replace(/\W+/g, "").slice(0, 4);
  const tail = `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  if (brand.kind === "giftcard") {
    // MOCK: production calls the supplier API to draw a real code from inventory.
    return {
      type: "gift_card_code",
      product_id: product.product_id,
      brand_id: brand.brand_id,
      brand: brand.brand,
      denomination: product.denomination,
      face_value: product.face_value,
      delivery_type: product.delivery_type,
      quantity: quote.quantity,
      code: `MOCK-${brandSlug}-${tail}`,
      expiresAt: oneYear,
    };
  }

  if (brand.category === "e-sim") {
    // MOCK: production returns a real LPA activation string from the eSIM provider.
    return {
      type: "esim_lpa",
      product_id: product.product_id,
      brand_id: brand.brand_id,
      brand: brand.brand,
      denomination: product.denomination,
      face_value: product.face_value,
      delivery_type: product.delivery_type,
      quantity: quote.quantity,
      activationCode: `LPA:1$DEMO-NOT-REDEEMABLE.${brandSlug}.${tail}`,
      expiresAt: oneYear,
    };
  }

  // mobile_recharge / mobile
  // MOCK: production calls the carrier API; returns a confirmation reference.
  return {
    type: "mobile_topup_confirmation",
    product_id: product.product_id,
    brand_id: brand.brand_id,
    brand: brand.brand,
    country_code: brand.country_code,
    denomination: product.denomination,
    face_value: product.face_value,
    delivery_type: product.delivery_type,
    quantity: quote.quantity,
    confirmationId: `MOCK-CONF-${brandSlug}-${tail}`,
    msisdnLast4: "XXXX",
    processedAt: new Date().toISOString(),
  };
}

const server = new McpServer({ name: "cryptorefills-storefront-demo", version: "0.1.0" });

server.registerTool(
  "search_products",
  {
    title: "Search products",
    description: "Filter the catalog by free-text query (brand), maximum face-value-equivalent in USD, kind (giftcard|mobile_recharge), and/or category (shopping|games|streaming|mobile|e-sim).",
    inputSchema: {
      query: z.string().optional(),
      maxPriceUsd: z.number().positive().optional(),
      kind: z.enum(["giftcard", "mobile_recharge"]).optional(),
      category_filter: z.enum(["shopping", "games", "streaming", "mobile", "e-sim"]).optional(),
      country_code: z.string().length(2).optional(),
    },
  },
  async ({ query, maxPriceUsd, kind, category_filter, country_code }) => {
    const q = query?.toLowerCase().trim() ?? "";
    const cc = country_code?.toUpperCase();
    const results = CATALOG
      .filter((b) => (q ? b.brand.toLowerCase().includes(q) || b.family.toLowerCase().includes(q) : true))
      .filter((b) => (kind ? b.kind === kind : true))
      .filter((b) => (category_filter ? b.category === category_filter : true))
      .filter((b) => (cc ? b.country_code === cc : true))
      .map((b) => ({
        ...b,
        products: maxPriceUsd ? b.products.filter((p) => priceUsd(p) <= maxPriceUsd) : b.products,
      }))
      .filter((b) => b.products.length > 0);
    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
  },
);

server.registerTool(
  "get_product_details",
  {
    title: "Get product details",
    description: "Return a single brand row by brand_id with all of its products. Pass product_id to filter to a single SKU.",
    inputSchema: { brand_id: z.string().uuid().optional(), product_id: z.string().uuid().optional() },
  },
  async ({ brand_id, product_id }) => {
    if (product_id) {
      const found = findProduct(product_id);
      if (!found) return { isError: true, content: [{ type: "text", text: `unknown product_id: ${product_id}` }] };
      return { content: [{ type: "text", text: JSON.stringify({ ...found.brand, products: [found.product] }, null, 2) }] };
    }
    if (brand_id) {
      const brand = CATALOG.find((b) => b.brand_id === brand_id);
      if (!brand) return { isError: true, content: [{ type: "text", text: `unknown brand_id: ${brand_id}` }] };
      return { content: [{ type: "text", text: JSON.stringify(brand, null, 2) }] };
    }
    return { isError: true, content: [{ type: "text", text: "must provide brand_id or product_id" }] };
  },
);

server.registerTool(
  "quote",
  {
    title: "Quote a purchase",
    description: "Lock a price for a product_id and quantity. Returns a quoteId valid for 10 minutes.",
    inputSchema: { product_id: z.string().uuid(), quantity: z.number().int().min(1).max(10).default(1) },
  },
  async ({ product_id, quantity }) => {
    const quote = buildQuote(product_id, quantity);
    return { content: [{ type: "text", text: JSON.stringify(quote, null, 2) }] };
  },
);

server.registerTool(
  "place_order",
  {
    title: "Place an order",
    description: "Redeem a quote with a base64 x402-style payment header. Returns a delivery envelope on success.",
    inputSchema: { quoteId: z.string(), paymentHeader: z.string() },
  },
  async ({ quoteId, paymentHeader }) => {
    const quote = quotes.get(quoteId);
    if (!quote) return { isError: true, content: [{ type: "text", text: `unknown quoteId: ${quoteId}` }] };
    if (Date.parse(quote.expiresAt) < Date.now()) return { isError: true, content: [{ type: "text", text: "quote expired" }] };
    const verified = verifyPaymentHeader(paymentHeader, quote);
    if (verified !== true) return { isError: true, content: [{ type: "text", text: `payment rejected: ${verified}` }] };
    const orderId = shortId("ord");
    const deliveryEnvelope = fulfill(quote);
    orders.set(orderId, { quote, placedAt: new Date().toISOString(), deliveryEnvelope });
    quotes.delete(quoteId);
    return { content: [{ type: "text", text: JSON.stringify({ order_id: orderId, status: "fulfilled", deliveryEnvelope }, null, 2) }] };
  },
);

server.registerTool(
  "get_order_status",
  {
    title: "Get order status",
    description: "Return the current state of a placed order, including the delivery envelope if fulfilled.",
    inputSchema: { order_id: z.string() },
  },
  async ({ order_id }) => {
    const order = orders.get(order_id);
    if (!order) return { isError: true, content: [{ type: "text", text: `unknown order_id: ${order_id}` }] };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { order_id, status: "fulfilled", placedAt: order.placedAt, deliveryEnvelope: order.deliveryEnvelope },
            null,
            2,
          ),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stderr is the only safe place to log over a stdio MCP transport.
  console.error("[mcp-storefront] connected over stdio; tools: search_products, get_product_details, quote, place_order, get_order_status");
}

main().catch((err) => {
  console.error("[mcp-storefront] fatal:", err);
  process.exit(1);
});
