// Copyright 2026 Cryptorefills and contributors. Licensed under Apache-2.0. See LICENSE-CODE.

// Cryptorefills live MCP wrapper. Local stdio MCP server that proxies a
// curated set of tools to the real public Cryptorefills MCP server.
// Read-only catalog access PLUS validateOrder and createOrder (which create
// pending orders that require subsequent x402 payment to actually settle —
// payment is NOT exposed here).
//
// The forbidden-tools set is the safety boundary. purchaseElicitation is
// excluded because its stateful nature can lead to an autonomous payment
// loop without explicit per-step confirmation.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { callUpstream, initializeUpstream } from "./upstream-client.js";

// Safety guard: this demo intentionally refuses to wire up real payment.
// Setting ENABLE_REAL_PURCHASE=true is a no-op other than throwing here.
const ENABLE_REAL_PURCHASE = process.env.ENABLE_REAL_PURCHASE === "true";
if (ENABLE_REAL_PURCHASE) {
  throw new Error(
    "[safety] ENABLE_REAL_PURCHASE=true is set but autonomous purchase is not implemented in this demo. " +
      "Real purchase requires x402 payment plumbing not exposed here. See https://github.com/cryptorefills/agents.",
  );
}

// Tools that this demo refuses to expose even though the upstream supports them.
// purchaseElicitation: stateful, can lead to autonomous payment loops without per-step confirmation.
const FORBIDDEN_TOOLS: ReadonlySet<string> = new Set(["purchaseElicitation"]);

const server = new McpServer({ name: "cryptorefills-mcp-live-demo", version: "0.1.0" });

// Helper: register a thin proxy tool with safety guard. Returns the upstream payload
// stringified into the MCP content field.
function registerProxyTool(
  name: string,
  title: string,
  description: string,
  inputSchema: Record<string, z.ZodTypeAny>,
): void {
  if (FORBIDDEN_TOOLS.has(name)) {
    throw new Error(`refusing to register forbidden tool: ${name}`);
  }
  server.registerTool(
    name,
    { title, description, inputSchema },
    async (args: Record<string, unknown>) => {
      try {
        const result = await callUpstream(name, args);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown upstream error";
        return { isError: true, content: [{ type: "text" as const, text: `[upstream error] ${msg}` }] };
      }
    },
  );
}

// ---- Read-only catalog tools (7) — safe, no money movement ----

registerProxyTool(
  "getCurrencies",
  "Get supported cryptocurrencies",
  "Fetch the supported cryptocurrencies and their suspension status from the live Cryptorefills catalog.",
  {},
);

registerProxyTool(
  "listBrands",
  "List brands by country",
  "Fetch available gift-card and mobile top-up brands for a country (ISO 3166-1 alpha-2).",
  {
    country_code: z.string().length(2),
    cid: z.string().optional(),
    promo_code: z.string().optional(),
  },
);

registerProxyTool(
  "listProductsForCountry",
  "List products by country",
  "List all products in a country, optionally filtered by brand, family, coin, or payment method.",
  {
    country_code: z.string().length(2),
    brand_name: z.string().optional(),
    family_name: z.string().optional(),
    coin: z.string().optional(),
    payment_method: z.string().optional(),
    lang: z.string().optional(),
    promo_code: z.string().optional(),
  },
);

registerProxyTool(
  "searchProducts",
  "Search products by text",
  "Search products by free-text query across brands and categories in a given country.",
  {
    country_code: z.string().length(2),
    q: z.string(),
    lang: z.string().optional(),
  },
);

registerProxyTool(
  "getProductPrice",
  "Price a range product",
  "Get pricing for a range-based product where the customer selects face value within the product's min/max range.",
  {
    brand_name: z.string(),
    country_code: z.string().length(2),
    face_value: z.number().positive(),
    coin: z.string(),
    promo_code: z.string().optional(),
  },
);

registerProxyTool(
  "getPaymentViasWithCurrencies",
  "Get payment methods",
  "Fetch supported payment methods and their currency/network combinations.",
  {},
);

registerProxyTool(
  "getOrderStatus",
  "Get order status",
  "Retrieve the status and details of a previously submitted order by its order_id.",
  { order_id: z.string() },
);

// ---- Validate-and-stage-order tools (2) — POST but no payment in this demo ----
// validateOrder: pre-flight only, never commits.
// createOrder: creates a PENDING order; without a separate x402 payment step the order expires.
//   This demo does NOT expose payment plumbing; createOrder responses are wrapped with a clear note.

registerProxyTool(
  "validateOrder",
  "Validate a potential order",
  "Pre-flight validation against business rules. No commit, no payment, no order created.",
  { body: z.unknown() },
);

server.registerTool(
  "createOrder",
  {
    title: "Create a pending order",
    description:
      "Submit a new order to the live Cryptorefills catalog. The order is created in a PENDING state and will expire if not paid via x402. THIS DEMO DOES NOT EXECUTE PAYMENT — see the demo README for production payment plumbing.",
    inputSchema: { body: z.unknown() },
  },
  async ({ body }) => {
    try {
      const result = await callUpstream("createOrder", { body });
      const wrapped = {
        _demo_note:
          "This demo does NOT execute payment. The order above is PENDING and will expire if not paid via x402. See examples/x402-pay-an-api for the payment primitive and https://github.com/cryptorefills/agents for the production Skill.",
        upstream_result: result,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(wrapped, null, 2) }] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown upstream error";
      return { isError: true, content: [{ type: "text" as const, text: `[upstream error] ${msg}` }] };
    }
  },
);

async function main(): Promise<void> {
  // Validate connectivity at startup. We do not fail fast — the agent should still be
  // able to attach and receive a clean [upstream error] response per tool call until
  // upstream is reachable.
  try {
    const info = await initializeUpstream();
    console.error(`[mcp-live] upstream OK: ${info.name} v${info.version} (protocol ${info.protocolVersion})`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`[mcp-live] WARNING: upstream initialize failed: ${msg}`);
    console.error(`[mcp-live] tools will return [upstream error] until connectivity is restored.`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const endpoint = process.env.CRYPTOREFILLS_MCP_URL ?? "https://api.cryptorefills.com/mcp/http";
  console.error(`[mcp-live] connected over stdio; 9 tools proxying to ${endpoint}`);
  console.error(`[mcp-live] forbidden upstream tools: ${[...FORBIDDEN_TOOLS].join(", ")}`);
}

main().catch((err) => {
  console.error("[mcp-live] fatal:", err);
  process.exit(1);
});
