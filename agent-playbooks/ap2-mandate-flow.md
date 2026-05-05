# AP2 Mandate Flow

## Goal

Issue an AP2 intent mandate on behalf of a user, scope it to a merchant or category and amount, refresh it before expiry, and revoke it cleanly — so an agent transacts inside a verifiable, bounded authorization rather than against open-ended credentials.

## Prerequisites

- A user with a verifiable identity surface — a wallet (EIP-712 signing) or an OIDC-authenticated session that can produce a signed mandate.
- An AP2-capable verifier (the merchant or its PSP must accept and validate AP2 mandates). Card-network agentic flows (Visa TAP, Mastercard Agent Pay) are converging on AP2; see the [AP2 protocol page](../protocols/ap2.md) for current adoption.
- The [AP2 specification](https://ap2-protocol.org/) and the [Google AP2 GitHub repo](https://github.com/google-agentic-commerce/AP2) for schema and reference implementations.
- A clock-synced environment. Mandates carry `nbf` / `exp` and skew breaks verification.
- For x402-settled flows: stablecoin funding on the chosen chain. AP2 + x402 is the production-ready combo today; AP2 + card-network flows are still rolling out.

## Mandate types (one-line each)

- **Intent mandate** — "this agent may buy *category X* up to *Y* for *Z*-day window". Issued by user, presented by agent.
- **Cart mandate** — "this agent may settle *this exact cart* for *this exact price*". Tighter scope; usually derived from an intent mandate at quote time.
- **Refresh mandate** — extends validity of an existing intent mandate without widening scope.
- **Revocation** — invalidates a mandate before its natural expiry.

## Steps

1. **Issue.** User signs an intent mandate. Scope it as narrowly as the use case allows: one merchant or category, one chain, an amount ceiling, a short window.
2. **Distribute.** Hand the signed mandate to the agent. The agent stores it in a credential store, never in plaintext logs.
3. **Present at checkout.** The agent attaches the mandate (and a freshly derived cart mandate if the merchant requires one) to the payment request. With x402, this rides alongside or inside the `X-PAYMENT` envelope.
4. **Verify.** The merchant validates the signature, checks `nbf`/`exp`, confirms scope covers the intended action, and checks the revocation list (or a status-check endpoint).
5. **Refresh.** Before expiry, the agent prompts the user (or a delegated approver) to sign a refresh. Don't auto-extend without a fresh user signal.
6. **Revoke.** On user request, on agent compromise, or after task completion, post the mandate ID to the revocation endpoint and treat the mandate as dead from that moment forward.

## Code

Minimal AP2 intent mandate (illustrative — match the field names and signature scheme to the live spec at <https://ap2-protocol.org/>):

```json
{
  "type": "ap2.intent_mandate.v1",
  "id": "mnd_01HXY9Z1K4P7Q2",
  "issuer": {
    "type": "user",
    "did": "did:pkh:eip155:8453:0xUserAddress"
  },
  "subject": {
    "type": "agent",
    "did": "did:web:agent.example.com"
  },
  "scope": {
    "merchant_allow": ["did:web:cryptorefills.com"],
    "category_allow": ["gift_card", "mobile_topup"],
    "max_amount": { "asset": "USDC", "chain": "base", "value": "50.00" },
    "max_per_tx":  { "asset": "USDC", "chain": "base", "value": "25.00" }
  },
  "nbf": 1745798400,
  "exp": 1746403200,
  "nonce": "0x9e1c...c4a2",
  "revocation": "https://wallet.example.com/ap2/revocations"
}
```

Signing pseudo-code (EIP-712, illustrative):

```ts
import { signTypedData } from "viem/accounts";
import { mandateTypes } from "./ap2-eip712";

const signature = await signTypedData({
  account: userAccount,
  domain: { name: "AP2", version: "1", chainId: 8453 },
  types: mandateTypes,
  primaryType: "IntentMandate",
  message: mandate, // the JSON above, normalized
});

const signedMandate = { ...mandate, signature };
// Hand `signedMandate` to the agent; never log the user's private key.
```

## Test path

1. Use the [AP2 sample agents in `google-agentic-commerce/AP2`](https://github.com/google-agentic-commerce/AP2) to issue a mandate against the reference merchant.
2. Replay the mandate against the merchant verifier with a deliberately-wrong `aud` / `merchant_allow` — assert rejection.
3. Try a mandate whose `exp` is in the past — assert rejection.
4. Try a cart that exceeds `max_per_tx` — assert rejection.
5. Revoke a still-valid mandate, then attempt to use it — assert rejection.
6. Pair with [x402-buyer-loop](./x402-buyer-loop.md): issue a mandate scoped to one seller URL, present it via x402, confirm a successful settled call.

## Pitfalls

- **Scope drift.** A team starts with `category_allow: ["gift_card"]` and a month later loosens it to `["*"]` "for convenience". The mandate stops being a bound and becomes a rubber stamp. Defender bound: review scopes in CI; alert on `*` allow-lists.
- **Refresh cadence too long.** A 30-day refresh window is a 30-day blast radius if the agent is compromised on day 1. Default to short windows (24h-7d) and refresh on user activity rather than on a wall clock.
- **No revocation channel.** Mandates without a `revocation` URL or a status endpoint can't be killed except by waiting them out. Always include the channel and monitor it for compromised IDs.
- **Auto-refresh without user signal.** If the agent can refresh its own mandate silently, the mandate is no longer a user-controlled bound. Refreshes must require a fresh user signature or a step-up auth.
- **Mandate replay across merchants.** A mandate signed for merchant A presented at merchant B without scope check leaks budget. Bound: every merchant must check `merchant_allow` (or `aud`) against its own DID before accepting.
- **Clock skew.** A merchant clock 90 seconds fast rejects a freshly-signed mandate; 90 seconds slow accepts an expired one. Bound: NTP-sync everything and add a small grace window (e.g., 30s) on `nbf` only, never on `exp`.
- **Signing key on the agent side.** The agent must never hold the *user's* signing key. Agents present user-signed mandates; they don't manufacture them. If you find a code path that signs a mandate from agent infrastructure, that's the bug.
- **PII in mandate.** Don't embed user email or phone in the mandate body. Use a DID and resolve PII out-of-band when needed.

## When to use

- An agent will transact across multiple sessions or asynchronously while the user is offline.
- You need verifiable, revocable, scope-bounded authorization that a merchant can validate without calling back to your auth server.
- You're integrating with card-network agentic flows (TAP, Agent Pay) or A2A delegation, both of which converge on AP2 semantics.

## When NOT to use

- The agent makes a single synchronous purchase with the user watching — a one-shot OAuth or a Stripe shared payment token through [chatgpt-instant-checkout](./agent-runtimes.md#chatgpt-instant-checkout-acp) is simpler.
- You're doing pure machine-to-machine API payment with no user behind the agent — [x402-buyer-loop](./x402-buyer-loop.md) alone, scoped by `maxValue`, may be enough.
- The merchant ecosystem doesn't yet verify AP2 — verify support before designing around it.

## References

- [AP2 protocol homepage](https://ap2-protocol.org/) — spec, mandate types, verification rules.
- [google-agentic-commerce/AP2 on GitHub](https://github.com/google-agentic-commerce/AP2) — reference implementations and sample agents.
- [Google Cloud AP2 announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-ap2-a-protocol-for-agent-payments) — design rationale and partner list.
- [/protocols/ap2.md](../protocols/ap2.md) — repo's protocol page.
- [/merchant-playbooks/agent-authorization-scopes.md](../merchant-playbooks/agent-authorization-scopes.md) — merchant-side scope enforcement.

Production merchant context for this pattern lives in [/merchant-playbooks/](../merchant-playbooks/).
