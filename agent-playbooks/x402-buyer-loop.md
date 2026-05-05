# x402 Buyer Loop

## Goal

Implement the buyer side of x402: an agent calls a paid HTTP resource, receives `402 Payment Required` with a payment requirements envelope, builds a signed `X-PAYMENT` header that authorizes a stablecoin transfer (USDC on Base by default), and retries the request with the header attached — receiving `200 OK` and the resource on success.

## Prerequisites

- A funded EVM wallet with **USDC on Base** (chain ID 8453). Base Sepolia (84532) for testing.
- The wallet's private key in an env var (`BUYER_PRIVATE_KEY`). For production, use a KMS-backed signer or a non-custodial agent wallet — never a plaintext key in long-running infrastructure.
- Node 20+, `viem` 2.x, and the official `x402-fetch` client (or the lower-level `x402` package).
- The seller URL you intend to call. The seller must speak x402 v1 (Coinbase reference implementation, Cloudflare Agents SDK, or Stripe-on-Base).
- Read access to <https://x402.org/> and the [Coinbase x402 documentation](https://docs.cdp.coinbase.com/x402/welcome).

## Steps

1. Make the unauthenticated request. Expect `402` with a JSON body containing `accepts: PaymentRequirements[]` (one entry per supported scheme/chain/asset).
2. Pick the entry that matches your wallet (e.g., `scheme: "exact"`, `network: "base"`, `asset: USDC`).
3. Build a payment payload conforming to the chosen scheme — typically an EIP-3009 `transferWithAuthorization` signed with the buyer key, encoding the resource URL, expiry, and nonce.
4. Base64-encode the payment payload and attach it as the `X-PAYMENT` header.
5. Retry the request. The seller verifies the signature, settles on-chain (or relays through a facilitator), and returns the resource plus an `X-PAYMENT-RESPONSE` header with the settlement transaction hash.
6. Persist the tx hash, the resource hash, and the nonce — that triple is your proof-of-purchase. See [/merchant-playbooks/receipts-and-proof-of-purchase.md](../merchant-playbooks/receipts-and-proof-of-purchase.md).

## Code

```ts
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY as `0x${string}`);

// Wrap fetch: on 402, the wrapper signs and retries automatically.
// maxValue caps how much this client will ever authorize, in atomic units (USDC = 6 decimals).
const payFetch = wrapFetchWithPayment(fetch, account, {
  maxValue: 1_000_000n, // 1.00 USDC ceiling per call
});

async function callPaidApi(url: string): Promise<unknown> {
  const res = await payFetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`paid call failed: ${res.status} ${await res.text()}`);
  }
  const txHash = res.headers.get("X-PAYMENT-RESPONSE-TX");
  console.log(`settled tx=${txHash}`);
  return res.json();
}

await callPaidApi("https://api.example.com/v1/premium-resource");
```

For a runnable end-to-end (server + client + facilitator) see [/examples/x402-pay-an-api](../examples/x402-pay-an-api).

## Test path

1. Run the seller from `/examples/x402-pay-an-api` against Base Sepolia. Fund the buyer with testnet USDC from a Coinbase faucet.
2. Hit the endpoint with raw `curl` first — confirm the 402 body contains a valid `PaymentRequirements`.
3. Run the buyer client; confirm one settled tx on Sepolia and a 200 response.
4. Re-run the same request with the *same* nonce — the seller must reject with 402 to prove replay protection works.
5. Set `maxValue` below the seller's price and confirm the wrapper refuses to sign rather than overpaying.
6. Tamper with `payTo` mid-flow: capture the 402, mutate the recipient address, replay — the buyer must refuse to sign against the mutated requirements.
7. Run the same buyer against a Polygon-only seller without changing chain configuration — assert the buyer aborts before signing rather than silently switching networks.

## Inspecting the 402 envelope

A typical x402 v1 `402` body (illustrative — confirm field names against <https://x402.org/>):

```json
{
  "x402_version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "maxAmountRequired": "1000",
      "payTo": "0xMerchantAddress",
      "resource": "https://api.example.com/v1/premium-resource",
      "description": "Premium feed, per-call",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 60
    }
  ],
  "error": "X-PAYMENT header is required"
}
```

The `asset` is a contract address, not a symbol. Resolve and cache `decimals()` for the asset on the buyer side; never trust a server-supplied "decimals" field.

## Pitfalls

- **Wrong chain selected.** A facilitator that supports Base will silently fail (or settle on the wrong chain) if the buyer signs against Polygon. Always match `network` from the seller's `accepts` entry exactly. Defender bound: assert `requirements.network === expectedChain` before signing.
- **Idempotency / nonce reuse.** Retrying after a transient network error can cause double-settlement if you reuse the nonce against a *different* request. Bound: derive the nonce from `hash(resource_url + intent_id)`, not from a counter.
- **`maxValue` ceiling not set.** A misbehaving or compromised seller can declare a price far above the resource's market value. The agent will pay it. Bound: always pass `maxValue`, and set it from the agent's per-task budget — see the AP2 mandate scope in [ap2-mandate-flow](./ap2-mandate-flow.md).
- **Decimals confusion.** USDC on Base is 6 decimals; native ETH is 18. Quoting `1_000_000_000_000_000_000n` for "$1" overpays by 1e12. Hardcode the asset's decimals from the on-chain `decimals()` call, not from the symbol.
- **Plaintext keys in long-running infra.** A single leaked key drains the wallet. Bound: use a KMS-backed signer (AWS KMS, Turnkey, Coinbase Smart Wallet, Privy) and rotate.
- **Retry storms.** A flaky seller can return 402 indefinitely. Bound: cap retries at 1, exponential-backoff at the orchestration layer, and surface persistent 402 to the caller as a *non-payment* error.
- **Resource not bound to payment.** If the seller's `payTo` field changes between the 402 and your signature, you pay the wrong recipient. Bound: pin the full requirements object client-side and refuse if any field shifts on retry.

## When to use

- An agent needs to call paid APIs (data feeds, inference, scraping, search) and you want HTTP-native settlement with deterministic finality.
- Machine-to-machine purchases where neither side wants to maintain accounts, API keys, or rate-limit tiers.
- You need on-chain proof of every paid call for reconciliation or audit.

## When NOT to use

- The buyer is a human at a checkout — use [chatgpt-instant-checkout](./agent-runtimes.md#chatgpt-instant-checkout-acp) or a hosted card flow. x402 is an agent rail.
- The seller is a Lightning-native API — use [L402](../protocols/l402.md) instead. x402 is EVM-stablecoin-shaped; L402 is BTC-Lightning-shaped.
- You need recurring authorization (daily, monthly). x402 is per-call. Pair it with an [AP2 mandate](./ap2-mandate-flow.md) to bound recurring spend.

## References

- [x402.org](https://x402.org/) — protocol homepage, spec, schemes.
- [Coinbase x402 documentation](https://docs.cdp.coinbase.com/x402/welcome) — reference facilitator, client SDK, schemes.
- [x402 GitHub organization](https://github.com/coinbase/x402) — `x402-fetch`, `x402` packages, server middleware.
- [/protocols/x402.md](../protocols/x402.md) — repo's protocol page.
- [/examples/x402-pay-an-api](../examples/x402-pay-an-api) — runnable seller + buyer.

For a real merchant endpoint that reflects these patterns end-to-end, see [/use-cases/](../use-cases/) and [/merchant-playbooks/](../merchant-playbooks/).
