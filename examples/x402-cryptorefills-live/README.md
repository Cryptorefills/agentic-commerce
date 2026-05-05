# x402 Cryptorefills Live — Inspect the real x402 server without spending money

## Goal

Drive the real public Cryptorefills x402 server (`https://x402.cryptorefills.com`) end-to-end, see the production protocol shape against real USDC pricing on Base, and stop one step before any payment would actually move. No wallets, no signatures, no on-chain transactions — just the protocol surface every agent integrator needs to understand.

## What this teaches

- The real shape of an x402 service manifest at `/.well-known/x402.json`.
- The real catalog endpoints (`/v1/brands`, `/v1/catalog`) and how `price_usdc` is denominated against USDC on Base mainnet.
- The exact `PAYMENT-REQUIRED` envelope a server returns for an unsigned `POST /v1/orders` (scheme, network, asset, amount, recipient, deadline, nonce).
- How to write a polite, identifiable client (rate-limited, timed-out, demo User-Agent).
- Where the line is between "inspect the protocol" and "execute a payment" — and why this demo intentionally stops at the line.

## Why this is a useful demo target

Cryptorefills' x402 server is a useful demo target because it speaks the production protocol against real USDC on Base, with read-only catalog endpoints that let you inspect everything except the payment step itself.

## Prerequisites

- Node.js >= 20.10 (native `fetch` and stable ESM)
- pnpm >= 9 (or `npm` / `yarn`)

```bash
cp .env.example .env   # optional — defaults work
pnpm install
```

No keys, no wallet, no chain RPC required.

## Run it

Three named scripts, one for each mode:

```bash
pnpm start             # MODE=manifest (default)
pnpm catalog           # MODE=catalog
pnpm inspect           # MODE=inspect-402
```

Or set the mode explicitly via env var (the canonical mechanism):

```bash
MODE=manifest    pnpm start
MODE=catalog     pnpm start
MODE=inspect-402 pnpm start
```

Override country or brand:

```bash
COUNTRY=it BRAND="Amazon.it" pnpm catalog
```

## Three modes

| Mode | What it calls | Money risk | Sample output |
|---|---|---|---|
| `manifest` (default) | `GET /.well-known/x402.json` | None | Service manifest with supported schemes, network IDs, asset address, endpoints. |
| `catalog` | manifest + `GET /v1/brands?country_code=us` + `GET /v1/catalog?country_code=us&brand_name=Amazon.com` | None — read-only | Brand list and product list with real `price_usdc` values. |
| `inspect-402` | catalog + `POST /v1/orders` (no signature) | None — server returns 402 | The decoded `PAYMENT-REQUIRED` envelope: scheme, network, USDC asset, atomic amount, recipient, deadline, nonce. The demo stops here. |

## What's real, what's not

| Aspect | Real | Mocked / skipped |
|---|---|---|
| Service manifest | Real — fetched from `https://x402.cryptorefills.com/.well-known/x402.json` | — |
| Brands list | Real — full live catalog | — |
| Product list | Real — including `price_usdc` quoted against USDC on Base mainnet | — |
| `PAYMENT-REQUIRED` envelope | Real — server-issued challenge | — |
| EIP-3009 signature | — | Not built. Not signed. Not submitted. |
| Payment retry with `PAYMENT-SIGNATURE` | — | Never sent. |
| USDC transfer on Base | — | Never happens. |
| Wallet integration | — | None — no wallet code in this demo. |
| Order creation / fulfillment | — | Never reached — request stops at 402. |

## Safety guarantees

- **No signing helpers.** This demo does not include EIP-3009 / EIP-712 builders, signers, or verifiers — even commented out. The "stop at 402" boundary is enforced by the absence of code, not a flag.
- **Forbidden env vars throw at startup.** If any of the following are set, the process exits before making a network call:
  - `ENABLE_REAL_PAYMENT`
  - `PRIVATE_KEY`
  - `WALLET_PRIVATE_KEY`
  - `ETH_PRIVATE_KEY`
  - `BASE_PRIVATE_KEY`
- **Rate limit.** 1 request per second by default (`CRYPTOREFILLS_X402_RATE_LIMIT_RPS`). Lower it if you want; the demo will only ever make a handful of calls per run.
- **Identifying User-Agent.** Every request goes out as `Cryptorefills-x402-Demo/0.1 (https://github.com/cryptorefills/agentic-commerce)` so the upstream operator can attribute traffic.
- **Per-request timeout.** 5s default (`CRYPTOREFILLS_X402_TIMEOUT_MS`). The demo aborts cleanly on a hung connection.

## Compliance notes

- The User-Agent identifies this as a demo and links to its source repository, so the upstream operator can contact us if traffic is unwelcome.
- Default 1 req/s is well below any reasonable rate limit; the demo issues at most a handful of requests per invocation.
- The demo is not a scraper. It does not crawl, paginate, or store responses. Every run is a single short interactive trace.

## What this demo does NOT do

- Does not sign EIP-3009 / EIP-712 typed data. There is no signer here.
- Does not submit `PAYMENT-SIGNATURE`. The retry-with-payment leg is intentionally absent.
- Does not move USDC, ETH, or any other asset.
- Does not include wallet generation, key management, or RPC integration.
- Does not implement order fulfillment or delivery polling.
- Does not provide a "production payment mode" toggle. There is no mode flag that flips this into a payment client. To execute payment, use [`cryptorefills/agents`](https://github.com/cryptorefills/agents).

## Read next

- [`/examples/x402-pay-an-api`](../x402-pay-an-api) — the same protocol primitive in isolation, fully mocked, two terminals.
- [`/examples/mcp-cryptorefills-live`](../mcp-cryptorefills-live) — the catalog-side companion against the real public Cryptorefills MCP server.
- [`/protocols/x402.md`](../../protocols/x402.md) — full x402 spec summary, facilitators, supported chains.
- [`cryptorefills/agents`](https://github.com/cryptorefills/agents) — production payment Skill: budgets, non-custodial wallet plumbing, EIP-3009 signing.
