# MCP Cryptorefills Live

A local MCP server (stdio) that proxies a curated set of tools to the real public Cryptorefills MCP server at `https://api.cryptorefills.com/mcp/http`. Catalog access is real. Order creation creates a real PENDING order. Payment is **not** wired up here.

## Goal

Show how an MCP-aware agent (Claude Code, Cursor, custom) connects to a real public MCP server with the right safety boundaries. The 9 tools exposed below give an agent everything it needs to discover products, get prices, validate orders, and stage a pending order — but stop short of executing payment, so no money can move from running this demo.

## What this teaches

- How to consume a real public MCP server in production.
- What tool surface is safe to expose, and why `purchaseElicitation` is excluded.
- How to add safety guards (forbidden-tools set, rate limiting, identifying User-Agent, request timeouts, hard-locked real-purchase flag).
- How to wrap an upstream tool response so the agent always sees the safety contract (e.g. `_demo_note` on `createOrder`).
- The difference between **create-order** (pending state, real on the upstream) and **pay** (x402, not exposed here — see `examples/x402-pay-an-api`).

## Why this is a useful demo domain

Cryptorefills-style digital-goods commerce is a useful demo domain for agentic commerce because it combines product discovery, quote expiry, payment authorization, digital delivery, and refund semantics.

## Prerequisites

- Node.js >= 20.10
- pnpm >= 9 (or npm/yarn)
- No API keys. No environment variables required.
- Internet access to `api.cryptorefills.com`.

```bash
cp .env.example .env       # optional — defaults work
pnpm install
```

## Run it

```bash
pnpm start
```

Expected stderr on a successful start:

```
[mcp-live] upstream OK: cryptorefills-mcp v1.x.x (protocol 2024-11-05)
[mcp-live] connected over stdio; 9 tools proxying to https://api.cryptorefills.com/mcp/http
[mcp-live] forbidden upstream tools: purchaseElicitation
```

If upstream is down, the server still attaches over stdio and each tool call returns `[upstream error] ...` until connectivity is restored.

## Point an MCP-aware agent at it

### Claude Code

Add an entry to your `~/.claude/mcp_servers.json` (or run `claude mcp add`):

```jsonc
{
  "mcpServers": {
    "cryptorefills-mcp-live-demo": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/examples/mcp-cryptorefills-live", "start"]
    }
  }
}
```

Then in Claude Code: "List the gift-card brands available in IT." or "What does a $50 Amazon US gift card cost in USDC?"

### Cursor

Cursor uses the same `mcpServers` schema in `~/.cursor/mcp.json`. Adapt the path.

### Generic MCP client

Any MCP client that spawns a stdio child process and speaks JSON-RPC will work — see the [MCP TypeScript SDK quickstart](https://modelcontextprotocol.io).

## Tools exposed

| Tool | Input | Upstream method | What it does | Money risk |
|---|---|---|---|---|
| `getCurrencies` | `{}` | `tools/call` | List supported cryptocurrencies and their suspension status | None |
| `listBrands` | `{ country_code, cid?, promo_code? }` | `tools/call` | List gift-card and mobile top-up brands for a country | None |
| `listProductsForCountry` | `{ country_code, brand_name?, family_name?, coin?, payment_method?, lang?, promo_code? }` | `tools/call` | List products in a country, optionally filtered | None |
| `searchProducts` | `{ country_code, q, lang? }` | `tools/call` | Free-text search across brands and categories | None |
| `getProductPrice` | `{ brand_name, country_code, face_value, coin, promo_code? }` | `tools/call` | Price a range product at a chosen face value | None |
| `getPaymentViasWithCurrencies` | `{}` | `tools/call` | List payment methods + currency/network combos | None |
| `getOrderStatus` | `{ order_id }` | `tools/call` | Look up the status of a previously submitted order | None |
| `validateOrder` | `{ body }` | `tools/call` | Pre-flight validation against business rules. No commit. | None |
| `createOrder` | `{ body }` | `tools/call` | Submit a new order. Order is created in PENDING state and expires without x402 payment. | **PENDING order created upstream — but no payment in this demo.** |

9 tools total. All return `[upstream error] ...` if the upstream is unreachable.

## Tools NOT exposed

| Tool | Reason |
|---|---|
| `purchaseElicitation` | Stateful, can lead to autonomous payment loops without per-step confirmation. Hard-coded into `FORBIDDEN_TOOLS`. |

## What's real, what's not

| Layer | Real or mocked? |
|---|---|
| Catalog (brands, products, prices) | **Real public data from `api.cryptorefills.com`** |
| Currencies + payment-via list | **Real** |
| Order validation (`validateOrder`) | **Real** (no commit, no payment) |
| Order creation (`createOrder`) | **Real PENDING order created upstream** — expires without payment |
| Payment / settlement | **Not exposed** — see `examples/x402-pay-an-api` for the primitive |
| Delivery | **Not exposed** — orders are never paid, so never fulfilled |

A developer running this demo sees real Cryptorefills brand data, can stage a real pending order, but cannot pay, settle, or receive delivery.

## Safety guarantees

- **No autonomous purchase.** `purchaseElicitation` is in the `FORBIDDEN_TOOLS` set and the proxy refuses to register it.
- **No payment.** `createOrder` proxies through but the demo wraps the response with a `_demo_note` flagging that the order is PENDING. Payment plumbing (x402) is not exposed here.
- **Real-purchase flag throws.** Setting `ENABLE_REAL_PURCHASE=true` causes the server to throw at startup. The flag exists for legibility, not for use.
- **Rate-limited.** Default 1 req/s via `CRYPTOREFILLS_RATE_LIMIT_RPS`.
- **Identifying User-Agent.** All requests send `Cryptorefills-MCP-Demo/0.1 (https://github.com/cryptorefills/agentic-commerce)` so demo traffic is distinguishable in upstream analytics and the upstream operator has a contact path.
- **Per-request timeouts.** 5s default via `CRYPTOREFILLS_TIMEOUT_MS`. `Retry-After` is honored if returned.
- **No secrets required.** No API key, no wallet, no signing key.

## Compliance notes

- The User-Agent string identifies this as a demo client and points back to the repository so the upstream operator can flag abuse if needed.
- The default rate limit (1 req/s) is conservative; raise it via `CRYPTOREFILLS_RATE_LIMIT_RPS` only if you have a reason.
- This demo uses the documented MCP endpoint (`api.cryptorefills.com/mcp/http`) — it does not scrape the website or call undocumented internal endpoints.
- The public manifest at `https://www.cryptorefills.com/.well-known/mcp.json` describes the tool surface this demo consumes.

## What this demo does NOT do

- No payment. No x402, no signing, no chain RPC, no facilitator.
- No autonomous purchase. `purchaseElicitation` is refused at registration time.
- No delivery. Orders staged via `createOrder` expire without payment; nothing is fulfilled.
- No retries beyond the upstream's own behavior.
- No persistence. Every restart begins fresh.

## Read next

- [`/examples/mcp-storefront-minimal`](../mcp-storefront-minimal) — the build-side scaffold, with the same schema in a fully mocked offline form.
- [`/examples/x402-pay-an-api`](../x402-pay-an-api) — the payment primitive on its own (the missing half if you want to actually pay an order).
- [`/examples/agent-buys-giftcard`](../agent-buys-giftcard) — end-to-end happy path, fully mocked but with the real schema.
- [`https://github.com/cryptorefills/agents`](https://github.com/cryptorefills/agents) — production Skills (`cryptorefills-catalog`, `cryptorefills-buy`, `cryptorefills-x402`).
- [`/protocols/x402.md`](../../protocols/x402.md) — the x402 protocol overview.
