# Multi-Agent Procurement

## Goal

Let a purchasing agent delegate part of a task to a specialist agent over A2A — for example, "find the cheapest valid eSIM for Italy and buy it" — with the delegation bounded by an AP2 mandate and the resulting purchase settled in stablecoin over x402.

## Prerequisites

- Two agents you control or trust:
  - **Purchaser** — owns the user relationship, holds the user-signed AP2 intent mandate, makes the delegation decision.
  - **Specialist** — has domain expertise (catalog search, price comparison, jurisdictional checks) and will call the merchant on the purchaser's behalf.
- A2A transport between the two agents. See the [A2A protocol homepage](https://a2a-protocol.org/) and Google's reference SDK.
- An AP2 mandate the purchaser holds (issued by the user). See [ap2-mandate-flow](./ap2-mandate-flow.md).
- An x402-capable wallet and stablecoin funding (USDC on Base by default). See [x402-buyer-loop](./x402-buyer-loop.md).
- A merchant that verifies AP2 mandates and accepts x402 settlement. The merchant must be able to inspect the *attestation chain* — user → purchaser → specialist — not just the final caller.

## Pattern

A2A carries the request between agents. AP2 carries the bound (who-may-do-what-for-whom). x402 carries the settlement. Each layer enforces a different invariant.

```
User                Purchaser              Specialist               Merchant
 │                       │                       │                       │
 │── intent mandate ────▶│                       │                       │
 │   (AP2-signed)        │                       │                       │
 │                       │── delegation ────────▶│                       │
 │                       │   (A2A + scoped       │                       │
 │                       │    cart mandate)      │                       │
 │                       │                       │── search/quote ──────▶│
 │                       │                       │◀── quote ─────────────│
 │                       │                       │── HTTP GET ──────────▶│
 │                       │                       │◀── 402 + reqs ────────│
 │                       │                       │── X-PAYMENT ─────────▶│
 │                       │                       │   + AP2 attestations  │
 │                       │                       │◀── 200 + delivery ────│
 │                       │◀── result ────────────│                       │
 │◀── receipt ───────────│                       │                       │
```

The merchant verifies, in order: x402 signature, AP2 cart-mandate scope, the chain of attestations from user to the calling agent. Any link missing or out of scope → 402 with a reason code.

## Code / illustrative envelope

The cart mandate the purchaser issues to the specialist (illustrative; align with the live AP2 spec):

```json
{
  "type": "ap2.cart_mandate.v1",
  "id": "mnd_cart_01HXYABC7K",
  "issuer": { "type": "agent", "did": "did:web:purchaser.example.com" },
  "delegated_from": "mnd_01HXY9Z1K4P7Q2",
  "subject": { "type": "agent", "did": "did:web:esim-specialist.example.com" },
  "scope": {
    "merchant_allow": ["did:web:cryptorefills.com"],
    "category_allow": ["esim"],
    "country_allow":  ["IT"],
    "max_amount": { "asset": "USDC", "chain": "base", "value": "20.00" }
  },
  "nbf": 1745798400,
  "exp": 1745802000,
  "nonce": "0x4f1c...22ab",
  "signature": "0x..."
}
```

The specialist's call to the merchant attaches both mandates plus the x402 payment header:

```ts
import { wrapFetchWithPayment } from "x402-fetch";
import { specialistAccount } from "./wallet";
import { intentMandate, cartMandate } from "./mandates";

const payFetch = wrapFetchWithPayment(fetch, specialistAccount, {
  maxValue: 20_000_000n, // 20 USDC ceiling, mirrors cart mandate
});

const res = await payFetch("https://api.cryptorefills.com/v1/orders", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "AP2-Attestations": JSON.stringify([intentMandate, cartMandate]),
  },
  body: JSON.stringify({ sku: "esim_it_5gb_30d", quote_id: "q_01HXY..." }),
});
```

For a step-by-step run-through, pair this playbook with [/examples/agent-buys-giftcard](../examples/agent-buys-giftcard) (single-agent baseline) and add a delegation hop on top.

## Pitfalls

- **Attestation chain not verified end-to-end.** A merchant that checks only the immediate caller's signature is blind to delegation. A compromised specialist can present a forged "purchaser" delegation. Bound: the merchant must verify every link from the user signature to the final caller, and check that each parent mandate covers the child's scope.
- **Scope expansion at delegation.** Purchaser holds `country_allow: ["IT", "DE"]` and issues a cart mandate with `country_allow: ["FR"]`. Bound: child scope ⊆ parent scope, enforced both at issuance and at verification.
- **Identity verification weak.** A2A endpoints reachable on the open internet without DID-based auth invite agent impersonation. Bound: pin agent DIDs, require signed envelopes, rotate keys.
- **Replay across delegations.** A specialist re-uses a cart mandate on a second order. Bound: cart mandates are single-use; merchant tracks `id` in a seen-set with TTL ≥ `exp`.
- **Settlement-leg key on the wrong agent.** If both purchaser and specialist hold the user's wallet key, blast radius doubles. Bound: only the calling agent (specialist) holds a payment key, and that key is funded only up to the cart-mandate ceiling.
- **No revocation propagation.** User revokes the parent intent mandate; the specialist still holds an unexpired cart mandate. Bound: merchant checks revocation status of the *entire chain*, not just the leaf.
- **Untrusted-input prompt injection across A2A.** The specialist sees catalog text from the merchant; if it's rendered into the purchaser's reasoning, an attacker-controlled product description can hijack delegation. Bound: A2A messages between agents must strip rendered content into a typed payload (price, sku, country) — never free-form prose.
- **Receipts not chained.** The user can't audit "who actually bought this" if the receipt only shows the specialist. Bound: receipts include the full attestation chain — see [/merchant-playbooks/receipts-and-proof-of-purchase.md](../merchant-playbooks/receipts-and-proof-of-purchase.md).

## When to use

- The task spans capabilities one agent shouldn't own — separation of concerns between a domain specialist and a user-facing purchaser improves both reasoning quality and security posture.
- You're building an agent marketplace where third-party specialist agents bid on tasks issued by purchaser agents.
- Procurement spans multiple merchants and you want a single user signature to govern the whole campaign within tight scopes.

## When NOT to use

- One agent can complete the task. Adding delegation adds attack surface; YAGNI applies.
- The specialist is untrusted and you can't verify its DID. Without identity, A2A is just untrusted RPC.
- The merchant doesn't validate AP2 attestation chains. Without merchant-side enforcement, the bound is theatrical.

## References

- [A2A protocol homepage](https://a2a-protocol.org/) — agent-to-agent transport, message envelope, capability discovery.
- [Google Agentic Commerce A2A on GitHub](https://github.com/google-agentic-commerce/A2A) — reference SDK and sample agents.
- [AP2 protocol homepage](https://ap2-protocol.org/) — mandate types, delegation, revocation.
- [x402.org](https://x402.org/) — settlement protocol used on the merchant leg.
- [/protocols/a2a.md](../protocols/a2a.md), [/protocols/ap2.md](../protocols/ap2.md), [/protocols/x402.md](../protocols/x402.md) — repo protocol pages.
- [/agent-playbooks/ap2-mandate-flow.md](./ap2-mandate-flow.md) and [/agent-playbooks/x402-buyer-loop.md](./x402-buyer-loop.md) — the building blocks this playbook composes.
