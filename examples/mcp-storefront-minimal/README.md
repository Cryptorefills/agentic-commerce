# MCP Storefront — Minimal

A minimal Model Context Protocol (MCP) server that exposes a multi-category digital-goods catalog (gift cards, mobile top-ups, eSIMs) to MCP-aware agents (Claude Code, Cursor, custom).

The catalog field names mirror the shape of the real public Cryptorefills MCP server (`https://api.cryptorefills.com/mcp/http`) so the same agent reasoning works against either. For a working live demo against that real server, see [`/examples/mcp-cryptorefills-live`](../mcp-cryptorefills-live/).

## Goal

Show the smallest believable storefront an agent can browse and buy from over MCP, using the production Cryptorefills schema. Catalog and orders are in-memory; the "payment" is a mocked x402-style header check on the order side.

The server name is `cryptorefills-storefront-demo`; the tool surface (5 tools) is shaped to match the [`cryptorefills/agents`](https://github.com/cryptorefills/agents) Skills repo so the same agent reasoning works against either.

## Catalog

Each row in the catalog is a **brand row** that mirrors the production schema:

| Field | Type | Example |
|---|---|---|
| `brand_id` | UUID | `11111111-1111-4111-8111-111111111111` |
| `brand` | string | `"Amazon"` |
| `family` | string | `"Amazon"` |
| `kind` | `"giftcard"` \| `"mobile_recharge"` | `"giftcard"` |
| `category` | string | `"shopping"`, `"games"`, `"streaming"`, `"mobile"`, `"e-sim"` |
| `country_code` | ISO 3166-1 alpha-2 | `"US"`, `"BR"`, `"IN"`, `"EU"` |
| `default_denomination` | string | `"$50"`, `"R$20"` |
| `is_out_of_stock` | boolean | `false` |
| `product_type` | `"digital"` | `"digital"` |
| `logo_url` | string | `"https://cdn.cryptorefills.com/logos_v2/amazon.png"` |
| `products` | `Product[]` | array of SKUs |

Each `Product` is one purchasable SKU:

| Field | Type | Example |
|---|---|---|
| `product_id` | UUID | `0cbbacb6-4820-4463-945e-914295fcd002` |
| `is_dynamic` | boolean | `false` (fixed denomination) |
| `denomination` | string | `"$50"` |
| `localized_denomination` | string | `"$50"` |
| `coin_amount` | decimal string | `"50.075"` |
| `coin` | `"USDC"` \| `"USDT"` \| `"BTC"` \| ... | `"USDC"` |
| `payment_method` | string | `"USDC-Base"` |
| `delivery_type` | `"by_email"` \| `"by_phone"` | `"by_email"` |
| `face_value` | `{ currency_code, amount }` | `{ "currency_code": "USD", "amount": { "type": "fixed", "price": "50.00" } }` |

## Categories

| `kind` | `category` examples | `delivery_type` | Fulfillment envelope |
|---|---|---|---|
| `giftcard` | `shopping`, `games`, `streaming` | `by_email` | `gift_card_code` (with redeemable code) |
| `mobile_recharge` | `mobile` | `by_phone` | `mobile_topup_confirmation` (confirmationId + msisdnLast4) |
| `mobile_recharge` | `e-sim` | `by_email` | `esim_lpa` (LPA activation string) |

## Prerequisites

- Node.js >= 20.10
- pnpm >= 9 (or npm/yarn)
- An MCP-aware client (optional — you can also drive it from another script)

```bash
cp .env.example .env
pnpm install
```

## Run it

```bash
pnpm start
```

The server speaks MCP over stdio. It will sit waiting for JSON-RPC messages on stdin.

## Point an MCP-aware agent at it

### Claude Code

Add an entry to your `~/.claude/mcp_servers.json` (or run `claude mcp add`):

```jsonc
{
  "mcpServers": {
    "cryptorefills-storefront-demo": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/examples/mcp-storefront-minimal", "start"]
    }
  }
}
```

Then in Claude Code: "Search for a $50 gift card and place an order."

### Cursor

Cursor uses the same `mcpServers` schema in `~/.cursor/mcp.json`. Adapt the path.

### Generic MCP client

Any MCP client that can spawn a stdio child process and speak JSON-RPC will work — see the [MCP TypeScript SDK quickstart](https://modelcontextprotocol.io).

## Available tools

| Tool | Input | Returns | Merchant playbook |
|---|---|---|---|
| `search_products` | `{ query?, maxPriceUsd?, kind?, category_filter?, country_code? }` | Array of brand rows with their matching products | [catalog-discovery-at-scale](../../merchant-playbooks/catalog-discovery-at-scale.md) |
| `get_product_details` | `{ brand_id?, product_id? }` | One brand row (filtered to a single product if `product_id` given) | [catalog-discovery-at-scale](../../merchant-playbooks/catalog-discovery-at-scale.md) |
| `quote` | `{ product_id, quantity? }` | `{ quoteId, product_id, brand_id, quantity, totals, expiresAt }` (10-minute TTL) | [agent-authorization-scopes](../../merchant-playbooks/agent-authorization-scopes.md) |
| `place_order` | `{ quoteId, paymentHeader }` | `{ order_id, status: "fulfilled", deliveryEnvelope }` | [delivery-semantics-codes-pnrs-esims](../../merchant-playbooks/delivery-semantics-codes-pnrs-esims.md) |
| `get_order_status` | `{ order_id }` | `{ order_id, status, placedAt, deliveryEnvelope }` | [receipts-and-proof-of-purchase](../../merchant-playbooks/receipts-and-proof-of-purchase.md) |

The catalog is hardcoded with 10 SKUs across 8 brands: Amazon US ($25/$50/$100), Steam ($20), Spotify ($10), AT&T ($10), Vivo BR (R$20 / BRL face value), Jio IN (₹400 / INR face value), Travel eSIM EU 7-day (€8 / EUR), Travel eSIM US 30-day ($25).

## Use this as a scaffold for a real merchant

The shape of these 5 tools mirrors the [`cryptorefills/agents`](https://github.com/cryptorefills/agents) Skills repo (`cryptorefills-catalog`, `cryptorefills-buy`, `cryptorefills-x402`). If you're standing up your own digital-goods MCP server, fork this file and replace the in-memory catalog and `fulfill()` with calls to your supplier, your inventory system, and your x402 facilitator.

For a live demo wired against the real public Cryptorefills MCP server (catalog read-only plus validate/create-pending-order, no payment), see [`/examples/mcp-cryptorefills-live`](../mcp-cryptorefills-live/).

## Expected output

When an agent runs the gift-card flow, `place_order` returns something like:

```json
{
  "order_id": "ord_aBcD1234",
  "status": "fulfilled",
  "deliveryEnvelope": {
    "type": "gift_card_code",
    "product_id": "0cbbacb6-4820-4463-945e-914295fcd002",
    "brand_id": "11111111-1111-4111-8111-111111111111",
    "brand": "Amazon",
    "denomination": "$50",
    "face_value": { "currency_code": "USD", "amount": { "type": "fixed", "price": "50.00" } },
    "delivery_type": "by_email",
    "code": "MOCK-AMZN-XXXX-XXXX",
    "expiresAt": "2027-04-28T..."
  }
}
```

For a `mobile_recharge` / `mobile` SKU the envelope contains `confirmationId` + `msisdnLast4: "XXXX"`. For an `e-sim` SKU it contains `activationCode: "LPA:1$DEMO-NOT-REDEEMABLE..."`.

## Read next

- [`/examples/mcp-cryptorefills-live`](../mcp-cryptorefills-live) — the same tool surface but proxied to the real public Cryptorefills MCP server.
- [`/examples/agent-buys-giftcard`](../agent-buys-giftcard) — drives this storefront end-to-end with a mocked x402 payment, across all three categories.
- [`/protocols/mcp.md`](../../protocols/mcp.md) — MCP overview.
- [`/agent-playbooks/cursor-mcp.md`](../../agent-playbooks/agent-runtimes.md) — Cursor + MCP storefront patterns.

## What this demo does NOT do

- No real catalog backend, no inventory, no FX, no jurisdictional gating — see [`/merchant-playbooks/catalog-discovery-at-scale.md`](../../merchant-playbooks/catalog-discovery-at-scale.md) for the production shape.
- No real payment verification — `paymentHeader` only has to be present and well-formed.
- No persistence — every restart resets the order ledger.

## Real-merchant mapping

A production MCP storefront — like the agent-facing surface this is modelled on — handles catalog scale (10,500+ brands), per-SKU jurisdictional metadata, multi-currency quoting, and signed receipts that this minimal demo doesn't model. See [/merchant-playbooks/catalog-discovery-at-scale.md](../../merchant-playbooks/catalog-discovery-at-scale.md) and [/merchant-playbooks/receipts-and-proof-of-purchase.md](../../merchant-playbooks/receipts-and-proof-of-purchase.md).

## Safety guarantees

- **No real funds move.** Default mode is `MOCK_MODE=true`. Real-checkout paths are not implemented.
- **No real keys required.** No environment variable is required to run the demo.
- **No external network calls** in default mode. Local-only.
- **Fake delivery codes** are clearly non-redeemable (`MOCK-` / `DEMO-` prefixes).
- If you fork this and add a real-payment path, **add tests for the safety guard before merging.**
