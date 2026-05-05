# Agent Authorization Scopes

## Problem

A user delegating purchasing authority to an agent does not delegate the same authority for every basket. An agent that is allowed to refill a $20 mobile top-up monthly is not, by the same gesture, allowed to buy a $5,000 international flight, a high-value gift card brand the user has never bought, or any product at all from a different merchant. Without explicit scope encoding, the merchant has only two crude options: trust everything the agent presents, or interactively reconfirm with the human at every transaction. Neither scales. The merchant defender's job is to require, validate, and enforce a structured scope on every agent-initiated purchase, ideally signed by the user (or the user's wallet) and reviewable by both parties before it executes. This page is the reference for how to design that scope, where it lives, how it is verified, and what to do when the scope conflicts with the requested order.

> The scope schema below is what a merchant needs to encode regardless of whether AP2 is the credential carrier or not — the credential format moves, the enforcement obligations don't.

## Why protocols don't fully cover this

AP2 is the closest. Its mandate model defines a verifiable digital credential the user signs to authorize an agent to act in defined ways, and the protocol provides primitives for cart mandates, intent mandates, and refresh. That is the right abstraction. Two practical gaps remain. First, AP2 mandates are payment-agnostic by design — the schema does not prescribe merchant-side scope semantics (per-merchant allow lists, per-category caps, per-window velocity), only the credential envelope. Second, ecosystem support outside Google's reference implementations is still maturing in 2026; many production deployments need a fallback for agents that have not yet adopted AP2. ACP and UCP do not address user-to-agent authorization. x402 and L402 are payment primitives with no scope vocabulary. The merchant must define the scope schema, accept it across the protocols their counterparties use, and enforce it consistently.

## Approach

Design scopes as **structured, signed, verifiable** authorization objects with several independent dimensions, validated on every request, with refresh and revocation paths.

### Scope dimensions

A scope is the conjunction of multiple constraints. Any single failed dimension denies the order.

- **Per-merchant.** Allow-list of merchants (by stable identifier — domain, DID, registered merchant ID). Default deny.
- **Per-amount.** Single-transaction cap and aggregate cap over a window. Both required; either alone is exploitable.
- **Per-window.** Time window for the aggregate cap (1 hour, 24 hours, 30 days). Sliding or calendar — pick one and document it.
- **Per-category.** Allow-list of product categories (gift cards, mobile top-ups, eSIMs, travel, subscriptions, APIs). Categories are stable enums; do not allow free-form strings.
- **Per-recipient.** For products with a recipient distinct from the buyer (gift cards to a friend, top-ups to a phone number), the allowed recipient identifiers.
- **Per-asset / per-chain.** Settlement asset and chain the user has authorized. Limits exposure if a single chain becomes unsafe.
- **Validity window.** Not-before / not-after timestamps. Mandates expire.

### Worked example — bounded gift-card scope

A user signs an EIP-712 mandate authorizing an agent to buy gift cards from the merchant up to $100 per order, $500 per rolling 7-day window, in the categories `giftcard` and `mobile_topup`, settled in USDC on Base, valid for 90 days. The agent submits an order for a $90 gift card on day 5; the merchant validates the mandate, increments the rolling counter to $90, and authorizes the order. On day 5 the agent submits a $20 mobile top-up; counter increments to $110. On day 7 the agent attempts a $120 hotel booking; the merchant denies — both the per-order cap is breached and the `travel` category is not in scope.

### Mandate refresh

Long-lived agents need ongoing authorization. Refresh is a *new mandate*, not an extension of the old one — the user re-signs, the merchant re-validates, and the prior mandate is superseded with an explicit pointer. Never allow silent extension. Set refresh windows generously enough that legitimate agents can roll without user-visible interruption (e.g., refresh prompted at 75% of validity), and never allow a refresh to *expand* scope without a fresh user signature.

### Revocation

Revocation must be:

- **Initiated by the user** — the human can pull authorization at any time, regardless of the agent's state.
- **Instant on the merchant side** — once the merchant receives the revocation, no further orders against that mandate succeed, even if the agent is still presenting it.
- **Verifiable** — the revocation itself is signed; the merchant must be able to prove which mandate was revoked when, in case of dispute.
- **Reachable by stable identifier** — the user does not need to know the mandate's full content to revoke it; revoking by mandate ID or by agent identity must work.

Cache the revocation list; refresh on a short cadence; check on every authorization.

### Encoding and signing

Use EIP-712 (typed structured data) for EVM-rooted user wallets, AP2 mandate envelopes for AP2-aware ecosystems, and equivalent signed-JSON-with-issuer-key for everything else. The schema below is the *merchant's* internal canonical form — incoming mandates from any protocol are normalized into it on ingress.

### Verification on every request

The merchant validates on every request, not at session start:

1. Signature against the issuer key (resolved via JWKS, on-chain registry, or DID document).
2. `notBefore` / `notAfter` against current time, with a small clock skew tolerance.
3. `notInRevocationList` against the cached revocation feed.
4. Order parameters (merchant, amount, category, recipient, asset, chain) against the scope.
5. Cumulative spend in window via atomic counter increment, with the increment rolled back on order failure.

A request that passes all five becomes an authorized order, recorded with the mandate ID so the [receipt](./receipts-and-proof-of-purchase.md) can carry it.

## Schema sketch

```typescript
type AgentScope = {
  scopeId: string;                      // stable, used for revocation
  version: '1';
  issuedAt: string;                     // ISO-8601
  notBefore: string;
  notAfter: string;

  user: {
    id: string;                         // stable user identifier
    address: string;                    // wallet bound to mandate
    attestationLevel: 'self' | 'kyc-light' | 'kyc-full';
  };

  agent: {
    operatorId: string;                 // 'openai', 'anthropic', etc.
    agentId: string;                    // operator-scoped agent identifier
    publicKey?: string;                 // for agent-side signature checks
  };

  merchants: { allow: string[] } | { any: true };  // domain or DID

  amount: {
    perOrderMaxUsd: string;             // single-transaction cap
    perWindow: {
      windowSeconds: number;
      maxUsd: string;
      maxOrders: number;
    };
  };

  categories: ('giftcard' | 'mobile_topup' | 'esim'
              | 'travel' | 'subscription' | 'api')[];

  recipients?: {
    allow: { type: 'phone' | 'address' | 'email'; value: string }[];
  };

  settlement: {
    assets: string[];                   // ['USDC', 'USDT', ...]
    chains: string[];                   // ['base', 'tron', ...]
  };

  signature: {
    alg: 'EIP-712' | 'AP2-mandate' | 'JWS-ES256';
    value: string;
    issuerKey: string;                  // public key or DID
  };

  supersedes?: string;                  // prior scopeId on refresh
};
```

### Operational metrics

- Mandate-validation latency at p50 / p99.
- Mandate-rejection rate by reason (expired, scope, revoked, signature, counter).
- Mandates per active user — high counts indicate either legitimate multi-agent setups or abuse.
- Refresh-vs-revoke ratio per agent operator.
- Time-to-revocation propagation across edge caches.

## Edge cases

- **Mandate expired during checkout.** Quote was issued under a valid mandate; settlement attempt arrives after expiry. Deny with a typed reason and prompt the agent to obtain a fresh mandate. Do not honor stale signatures.
- **Aggregate cap exceeded mid-basket.** A multi-item basket where individual items pass the per-order cap but the basket total breaches the per-window aggregate. Deny the basket atomically; do not partially fulfill.
- **Race between two concurrent orders against the same mandate.** Both individually within scope, jointly out of scope. Use a server-side counter with an atomic increment per mandate; reject the second.
- **Revocation arriving mid-settlement.** Settlement transaction has been broadcast but not confirmed. Treat the revocation as effective for *future* orders only; the in-flight settlement either confirms (and is delivered) or fails (and is voided). Document this so neither party expects revocation to claw back a confirmed transaction.
- **Cross-merchant mandate.** A mandate that authorizes "any merchant" is exploitable; require either an allow-list or a category-and-amount-bounded any-merchant grant.
- **Refresh expanding scope.** A refresh request increases the per-order cap. Treat as a *new* mandate requiring fresh signature; never inherit signatures across scope changes.
- **Recipient validation.** Gift card to "anyone@email.com" is too broad; bind to a specific address or to a recipient-list mandate. Phone-number top-ups: lock to a specific MSISDN unless explicitly broader.
- **Agent identity rotation.** The agent operator rotates per-session keys. The mandate must bind to a *stable* operator identity, not the rotating session key, or rotation invisibly invalidates the mandate.
- **Chain or asset becoming unsafe mid-mandate.** A stablecoin issuer freezes the address; the chain pauses. Merchant pauses orders against that asset/chain even within scope; the user must update the mandate.

## When to use

- Any agent-driven checkout where the user is not in the loop for each transaction.
- Any subscription or recurring-purchase pattern delegated to an agent.
- Any agent with multi-merchant reach where per-merchant trust differs.
- Any catalog mixing low-risk and high-risk SKUs where uniform authorization is unsafe.

## When NOT to use

- Fully interactive flows where the user signs each transaction directly — the scope reduces to a single authorization and the schema is overkill.
- Closed-loop M2M deployments with contractual scope between two known parties — use the contract.
- Internal-only flows behind authenticated tenancy where the agent has no autonomous spending authority.

## References

- Google AP2 specification — <https://github.com/google-agentic-commerce/AP2>
- AP2 mandate types and verification — <https://github.com/google-agentic-commerce/AP2/tree/main/specifications>
- EIP-712: typed structured data hashing and signing — <https://eips.ethereum.org/EIPS/eip-712>
- W3C Verifiable Credentials Data Model — <https://www.w3.org/TR/vc-data-model-2.0/>
- Decentralized Identifiers (DIDs) — <https://www.w3.org/TR/did-core/>
- OAuth 2.0 Rich Authorization Requests (RFC 9396) — <https://datatracker.ietf.org/doc/html/rfc9396>
- OpenID Federation — <https://openid.net/specs/openid-federation-1_0.html>
- ACP merchant-of-record extension drafts — <https://github.com/agentic-commerce-protocol/agentic-commerce-protocol>
