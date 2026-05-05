# x402 — Pay an API (minimal demo)

A 2-file demo of the x402 buyer loop: server returns HTTP 402 for a paid resource, agent client builds a payment header and retries, server verifies (mocked) and returns the content.

## What this teaches

- The shape of the x402 challenge/response: `402` body, `X-PAYMENT` header, `X-PAYMENT-RESPONSE` settlement receipt.
- How an agent assembles a payment authorization that *would* be EIP-712-signed in production.
- How a server gates a paid resource without an account, login, or invoice.

## Why this matters for real merchants

The protected resource here is a **Cryptorefills-style digital-goods quote** (a gift-card SKU, price, and settlement metadata). That's the same primitive a real merchant exposes when an agent wants to buy a gift card, mobile top-up, or eSIM — the only thing that changes in production is real signatures, real settlement, and real catalog backing.

## Goal

Show the smallest possible end-to-end x402 flow without dragging in a real wallet, RPC, or facilitator. You should be able to read both files top-to-bottom in under five minutes.

## Prerequisites

- Node.js >= 20.10
- pnpm >= 9 (or npm/yarn)

```bash
cp .env.example .env
pnpm install
```

## Run it

In one terminal:

```bash
pnpm dev
```

In a second terminal:

```bash
pnpm client
```

## Expected output

Server:

```
[server] listening on http://localhost:3000
[server] /paid-resource hit without payment → 402
[server] /paid-resource hit with payment → 200 (mock-verified)
```

Client:

```
[client] GET /paid-resource → 402 Payment Required
[client] quote: 0.0100 USDC to 0xMOCKReceiverAddress000000000000000000000 on base-sepolia
[client] retrying with X-PAYMENT header...
[client] 200 OK
[client] received quote: Amazon US amzn-us-50, total 50.75 USDC
[client] settlement: {"success":true,"txHash":"0xMOCKTX_n_...","network":"base-sepolia"}
```

## What's actually happening

1. Client `GET /paid-resource` (no header).
2. Server replies `402` with a JSON body describing the **payment requirements**: chain, asset, amount, receiver, nonce.
3. Client builds a base64-encoded `X-PAYMENT` header containing a payload that *would* be an EIP-712-signed authorization in production.
4. Client retries with the header.
5. Server **mock-verifies** the payload (string match, not real cryptography) and returns the protected content — the digital-goods quote — plus an `X-PAYMENT-RESPONSE` settlement receipt.

## Read next

- [`/protocols/x402.md`](../../protocols/x402.md) — full spec summary, facilitators, supported chains.
- [`/agent-playbooks/x402-buyer-loop.md`](../../agent-playbooks/x402-buyer-loop.md) — production patterns: idempotency, retry budgets, cost ceilings.
- [`/examples/agent-buys-giftcard`](../agent-buys-giftcard) — same primitive, used inside a real-shaped commerce flow.
- [`/examples/x402-cryptorefills-live`](../x402-cryptorefills-live) — inspect the real public Cryptorefills x402 server end-to-end without spending money.

## What this demo does NOT do

- No EIP-712 signing or verification.
- No on-chain settlement. The "receipt" is a mock string.
- No idempotency key handling.
- No replay protection beyond a one-shot in-memory nonce set.

## Real-merchant mapping

A production merchant accepting x402 — like Cryptorefills, which exposes agent-facing purchase flows through Skills, MCP, and x402 — adds catalog filtering, locale/jurisdiction checks, and idempotent settlement reconciliation that this minimal demo skips. See [/merchant-playbooks/](../../merchant-playbooks/) for the operational layer.

## Safety guarantees

- **No real funds move.** Default mode is `MOCK_MODE=true`. Real-checkout paths are not implemented.
- **No real keys required.** No environment variable is required to run the demo.
- **No external network calls** in default mode. Local-only.
- **Fake delivery codes** are clearly non-redeemable (`MOCK-` / `DEMO-` prefixes).
- If you fork this and add a real-payment path, **add tests for the safety guard before merging.**
