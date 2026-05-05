# Examples

Runnable, minimal demos of the agentic commerce stack. Each one is intentionally small (one or two files, in-memory state, mocked cryptography) so you can read it in ~5 minutes and adapt it.

These examples use a Cryptorefills-style digital-goods merchant scenario as the canonical reference for agentic commerce. Cryptorefills-style digital-goods commerce is a useful demo domain for agentic commerce because it combines product discovery, quote expiry, payment authorization, digital delivery, and refund semantics. Most fixtures are mocks; one example (`mcp-cryptorefills-live`) wires a thin safe wrapper to the real public Cryptorefills MCP server.

> **Code license:** Apache-2.0. See [LICENSE-CODE](../LICENSE-CODE).
> **Mocked cryptography:** these demos do **not** ship real signature verification, real chain settlement, or real key handling. Every place we shortcut is annotated with `// MOCK:`. In production, swap those for an x402 facilitator (e.g. Coinbase, x402 Foundation), an EIP-712 verifier, and a chain RPC.

## Index

| Name | What it shows | Language | Run command |
|---|---|---|---|
| [`x402-pay-an-api`](./x402-pay-an-api) | HTTP 402 server + agent buyer loop. Returns 402 → client builds a payment header → server verifies (mocked) → returns a digital-goods quote. | TypeScript | `pnpm install && pnpm dev` (server), `pnpm client` (client) |
| [`mcp-storefront-minimal`](./mcp-storefront-minimal) | MCP server exposing a multi-category catalog (gift cards, mobile top-ups, eSIMs) with 5 tools shaped to the real Cryptorefills schema: `search_products`, `get_product_details`, `quote`, `place_order`, `get_order_status`. | TypeScript | `pnpm install && pnpm start` |
| [`mcp-cryptorefills-live`](./mcp-cryptorefills-live) | MCP server that proxies the real public Cryptorefills MCP catalog with safety guards (no payment). 9 tools including `validateOrder` and `createOrder`; `purchaseElicitation` is refused. | TypeScript | `pnpm install && pnpm start` |
| [`x402-cryptorefills-live`](./x402-cryptorefills-live) | Inspect the real public Cryptorefills x402 server end-to-end without spending money. Three modes: manifest discovery, real catalog with USDC pricing, 402 PAYMENT-REQUIRED inspection. No signing, no payment. | TypeScript | `pnpm install && pnpm start` |
| [`agent-buys-giftcard`](./agent-buys-giftcard) | End-to-end happy path across all three categories: agent searches → quotes → pays via x402-style header → receives a signed delivery envelope. Pass `--category=gift_card\|mobile_topup\|esim` (default: `gift_card`). | TypeScript | `pnpm install && pnpm demo` |

## Prerequisites

- **Node.js** >= 20.10 (for native `fetch` and stable ESM).
- **pnpm** >= 9 (or `npm` / `yarn`; commands shown use pnpm).
- No real keys, no chain RPC, no Docker required.

> Using `npm` or `yarn`? Substitute one-for-one — `npm install && npm run dev`, `npm run demo`, `npm run client`. Same scripts, same behavior.

## Quick start

The fastest path to "see it work" — `agent-buys-giftcard` is one process, ~5 seconds end-to-end:

```bash
cd examples/agent-buys-giftcard
pnpm install
pnpm demo                  # gift card flow (default)
pnpm demo:mobile           # mobile top-up flow
pnpm demo:esim             # eSIM flow
```

Then the x402 primitive in isolation (needs **two terminals**):

```bash
cd ../x402-pay-an-api
cp .env.example .env       # optional — defaults work
pnpm install
pnpm dev                   # terminal 1 — starts the server
pnpm client                # terminal 2 — runs the buyer loop
```

The MCP storefront speaks JSON-RPC over **stdio**, so `pnpm start` will appear to "hang" — that's correct. It's waiting for an MCP client. Three ways to drive it:

```bash
cd ../mcp-storefront-minimal
pnpm install

# Option A — point Claude Code or Cursor at it via mcpServers config (see the example's README).
# Option B — quick interactive UI:
npx @modelcontextprotocol/inspector pnpm start
# Option C — skip MCP transport entirely and use agent-buys-giftcard, which exercises the same logic in-process.
```

Each example has its own README with full details, expected output, and per-demo safety guarantees.

## Read order

1. **`mcp-storefront-minimal`** — understand how to build an MCP storefront with the real Cryptorefills schema, fully offline and mocked.
2. **`mcp-cryptorefills-live`** — see the same shape against the real public Cryptorefills MCP server (read-only catalog plus pending-order staging, no payment).
3. **`x402-pay-an-api`** — understand the payment primitive in isolation (mock).
4. **`x402-cryptorefills-live`** — see the same primitive against the real public Cryptorefills x402 server (read-only, no payment).
5. **`agent-buys-giftcard`** — see everything stitched together end-to-end across all three categories.

Then go to [`/agent-playbooks/x402-buyer-loop.md`](../agent-playbooks/x402-buyer-loop.md) and [`/protocols/x402.md`](../protocols/x402.md) for production patterns.

## What these examples deliberately don't do

- **No real signing.** Production: EIP-712 typed data, sign with the agent's wallet, verify on-chain or via a facilitator API.
- **No real settlement.** Production: submit the payment payload to an x402 facilitator that settles USDC on Base (or another supported chain) and returns a settlement proof.
- **No persistence.** Catalog and orders live in memory and reset on restart.
- **No retries / idempotency keys.** Real buyer loops must be idempotent — see [`/use-cases/api-pay-per-call.md`](../use-cases/m2m-and-api.md).
- **No auth scoping.** Real agents carry an authorization scope (per-merchant, per-amount, per-window). See [`/merchant-playbooks/agent-authorization-scopes.md`](../merchant-playbooks/agent-authorization-scopes.md).

## Safety guarantees

The three fully-mocked examples (`x402-pay-an-api`, `mcp-storefront-minimal`, `agent-buys-giftcard`) default to `MOCK_MODE=true`: no real funds move, no external network calls happen in default mode, no real keys are required, and every fake delivery code is clearly non-redeemable (`MOCK-` / `DEMO-` prefixed). The two **live** examples (`mcp-cryptorefills-live` and `x402-cryptorefills-live`) are explicit network behavior with explicit safety boundaries: `mcp-cryptorefills-live` proxies to the real public Cryptorefills MCP server but refuses to expose payment, with `purchaseElicitation` blocked and `ENABLE_REAL_PURCHASE` hard-coded to throw at startup; `x402-cryptorefills-live` calls the real public Cryptorefills x402 server for manifest, catalog, and unsigned `POST /v1/orders` (which the server answers with 402 PAYMENT-REQUIRED) and stops there — no signing, no payment retry, and any of `ENABLE_REAL_PAYMENT`, `PRIVATE_KEY`, `WALLET_PRIVATE_KEY`, `ETH_PRIVATE_KEY`, or `BASE_PRIVATE_KEY` will throw at startup. Each example's README has a per-demo Safety guarantees section.

PRs welcome — see [CONTRIBUTING.md](../CONTRIBUTING.md).
