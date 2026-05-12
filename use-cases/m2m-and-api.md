# Machine-to-machine commerce and pay-per-call APIs

> Two surfaces, one architecture. Pay-per-call APIs are the most concrete, production-ready shape of agent-as-buyer commerce today; bilateral machine-to-machine (M2M) procurement is the same pattern generalized to agent-to-agent transactions. Both lean on stablecoin settlement, both surface the same defender-side questions — idempotency, attestation, authorization caps, dispute paths — and both are where the agentic stack pays off relative to card-network commerce. We treat them together because the protocols, the failure modes, and the production controls overlap by design.

**Agent-readiness:** Pay-per-call is **High** — documented protocols, working libraries, well-understood failure modes. Bilateral M2M is **Emerging** — primitives exist (A2A, AP2, x402, MCP) and combine credibly, but end-to-end production examples across organizational boundaries are still rare.

---

## Pay-per-call APIs

### Overview

Pay-per-call inverts subscription billing: instead of paying for time, the agent pays per unit of work. A single inference, a search query, a vector lookup, a data row, a model render — each is priced and settled at call time. No prior account, no API key, no credit relationship; settlement is in stablecoin and granular to the unit of work.

Two protocols dominate, both following the same shape: an unauthenticated request returns a payment challenge, the client settles, and a proof is presented on retry.

| Attribute | Description |
|---|---|
| `endpoint` | The HTTP endpoint being paid for |
| `unit` / `unit_price` | Unit of work and price per unit, in stablecoin |
| `chain` | Settlement chain (Base, Ethereum, Polygon, Solana, Tron) |
| `payment_facilitator` | Where to settle (or direct on-chain) |
| `idempotency_key` | Client-provided key to deduplicate retries |
| `quote_validity_seconds` | How long the price is held |

### x402 patterns

The x402 flow (Coinbase + x402 Foundation; v2 launched late 2025; Stripe integrated on Base in early 2026):

1. **Initial request.** Client calls the endpoint normally. Server returns `HTTP 402 Payment Required` with a JSON challenge body containing `paymentRequirements` (price, asset, network, recipient, optional facilitator).
2. **Client decides.** The agent checks the price against budget and policy. If acceptable, it crafts a payment proof.
3. **Settle.** The agent submits a signed payment to the named facilitator (or directly on-chain).
4. **Retry.** The agent re-issues the original request with the `X-Payment` header carrying the proof.
5. **Serve.** The server validates the proof, debits the held amount, and returns the response.

Key properties: USDC on Base is the production default (Ethereum, Polygon, Arbitrum, Solana support exists or is rolling); the facilitator pattern abstracts chain interactions; sub-cent pricing is feasible on Base; Stripe-on-Base means x402 revenue can land in standard merchant flows. See [/protocols/x402.md](../protocols/x402.md) for the full reference.

### L402 patterns

The L402 flow (Lightning Labs, LSAT-derived):

1. **Initial request.** Server returns `HTTP 402` with `WWW-Authenticate: L402 macaroon=..., invoice=...`.
2. **Pay invoice.** Client pays the Lightning invoice; receives a preimage.
3. **Retry.** Client retries with `Authorization: L402 <macaroon>:<preimage>`.
4. **Serve.** Server validates the macaroon + preimage and returns the response.

L402 is BTC-native with sub-second finality and sub-cent fees. Macaroons can carry caveats — restrictions on the credential (expiry, scope, count) — useful for one-shot or session-bound auth. Toolkits include Fewsats and Aperture. For BTC settlement or absolute lowest per-call fees, L402 fits. For stablecoin-denominated SaaS-style APIs, x402 is the broader fit.

### Idempotency keys

Per-call billing requires idempotency. A network failure between settle and serve can produce a payment without a response or a response without a payment. The defender's rule: **every billable call carries a client-provided idempotency key**, and the server stores the response keyed against it for a defined window.

- **Client-generated.** Typically a UUID or a hash derived from the request body.
- **Bound to the call, not the agent.** Same agent + same endpoint with two different keys is two billable calls.
- **Replayable within window.** Within the idempotency window (commonly 24 hours), retry with the same key + same payment proof returns the cached response without rebilling.
- **Required by the server.** Servers should reject calls without an idempotency key.

Independent of x402 vs. L402; both rely on it for production reliability.

### Cost ceilings

An agent paying per call is a cost surface that, without ceilings, runs away. Ceilings live at three layers:

1. **Per-call ceiling.** Agent rejects any `paymentRequirements` whose total exceeds a per-call max. Cheap and effective.
2. **Per-window ceiling.** Total spend across a rolling window. Implemented in the agent's policy engine — not the merchant's job.
3. **Per-mandate ceiling.** Under an AP2 mandate or equivalent, the mandate's `cap_per_period` is the hard ceiling. Once exceeded, the agent must pause and re-authorize.

**Defender framing.** Cost ceilings are not throttles imposed on the agent — they protect the principal from unbounded delegation. An agent that respects them is acting as a fiduciary.

### Quota management

Some pay-per-call services layer quota on top of price:

- **Soft quota.** First N calls in a window at price P; beyond that, price rises or service degrades.
- **Hard quota.** Service refuses calls beyond a per-window cap regardless of payment.
- **Burst credit.** Short burst of free or cheap calls allowed to seed adoption, then standard price applies.

For agents: read the quota model from provider docs or a `quota` field in `paymentRequirements`; track consumption locally; on `429 Too Many Requests` even after settling, back off rather than retry against the same payment proof.

### References

- x402 spec: <https://x402.gitbook.io/>
- x402 protocol page: [/protocols/x402.md](../protocols/x402.md)
- L402 (Lightning Labs): <https://docs.lightning.engineering/the-lightning-network/l402>
- L402 protocol page: [/protocols/l402.md](../protocols/l402.md)
- Worked example (x402 buyer/seller): [/examples/x402-pay-an-api](../examples/x402-pay-an-api)

---

## Machine-to-machine commerce

### Overview

M2M commerce is what the rest of this repo composes into. A buyer agent, acting under a principal's mandate, locates a seller agent, negotiates terms, settles in stablecoin, and receives an artifact (data, an API call, a fulfilled physical or digital order). The buyer agent may itself be a seller to a higher agent, producing chains that resemble traditional procurement.

Concrete shapes that exist today:

- **Agent-to-API procurement.** Buyer pays an x402-protected API via stablecoin. The "seller" is the API. Well-supported (see the section above).
- **Agent-to-merchant procurement.** Buyer purchases a digital good (gift card, eSIM, top-up, flight) from a merchant exposing a catalog through MCP, ACP, or UCP. Cryptorefills operates this surface today.
- **Agent-to-agent procurement.** Buyer contracts with a seller agent for a bespoke deliverable (research report, code change, translated document). The genuinely emerging surface — the seller is itself an autonomous service.
- **Multi-step orchestration.** Buyer decomposes a goal into sub-goals and procures each from a different seller, possibly fanning out and reconciling.

| Attribute | Description |
|---|---|
| `buyer_agent_id` / `seller_agent_id` | Cryptographic identities (DID, x509 hash, or platform-issued) |
| `principal_id` | The human or organizational principal the buyer represents |
| `mandate` | Authorization the buyer carries (typically AP2-style) |
| `attestation_chain` | Signed claims about the buyer (capability, KYC, reputation) |
| `delivery_proof` | Cryptographic proof of delivery (signed artifact, transcript hash) |
| `dispute_path` | Pre-agreed escalation path on dispute |

### Agent-to-agent procurement

The shape under current standards:

1. **Discovery.** Buyer locates a seller via a registry, referral, or A2A directory. Seller publishes a capability descriptor.
2. **Quote.** Buyer requests a quote for a specific task. Seller returns price, expected deliverable, delivery window.
3. **Authorization.** Buyer presents a mandate (AP2 or equivalent) covering the price and the seller. Seller verifies the mandate against the buyer's principal.
4. **Commit.** Both sides agree to terms. Buyer either pre-pays into escrow, posts an x402-style proof on completion, or operates under a session payment grant.
5. **Execute.** Seller performs the task.
6. **Deliver.** Seller returns the deliverable plus a signed delivery proof.
7. **Settle.** Payment is released — directly to the seller (x402-style) or via escrow release.
8. **Receipt.** Both sides retain signed receipts for audit.

At every step, both agents must be able to back out before settlement. Mandate revocation, escrow refund, and time-bounded quotes are the safety rails.

**Production reality.** Most "agent-to-agent" interactions today are agent-to-API or agent-to-merchant. True bilateral agent-to-agent procurement at scale is still mostly demos and pilots. The protocols (A2A, AP2) are landing; the trust infrastructure is the bottleneck.

### Attestation chains

For agents to transact with agents, both sides need verifiable claims about the other:

- **Identity.** Who is this agent? What key signs its messages?
- **Capability.** What is it authorized to do? Is the mandate valid and unrevoked?
- **Reputation.** Has it delivered before? Are there prior disputes?
- **Compliance.** KYC/AML where required? Sanctioned?

A typical chain:

1. **Principal attestation.** Principal (human or org) signs: "I authorize agent X to spend up to Y for purpose Z within window W."
2. **Platform attestation.** Hosting platform signs: "Agent X is operated under our trust framework, current as of T."
3. **Capability attestation.** Third-party attester signs: "Agent X has demonstrated capability C."
4. **Reputation attestation.** Registry signs: "Agent X has completed N prior tasks with M disputes."

Each attestation is independently verifiable; the counterparty decides which are required. AP2's verifiable digital credentials are the most concrete current example. **No single attestation is sufficient.** A multi-attestation chain raises the cost of impersonation and aligns with how human procurement uses multiple trust signals.

### Identity

Agent identity is unsettled. Three patterns exist in the wild:

1. **Decentralized identifiers (DIDs).** Self-sovereign identifier the agent controls. Cross-platform but ecosystem support is uneven.
2. **Platform-issued identity.** Hosting platform issues an identifier. Easy within the platform; cross-platform requires bridging.
3. **x509 / web PKI.** Standard certificate chains. Mature but heavyweight for agent-scale.

The pragmatic stance for production today: support multiple identity formats and verify the format expected by the counterparty. AP2 mandates carry an identity verifiable by its issuer — the most concrete cross-platform pattern in flight.

**Stablecoin payment as identity reinforcement.** A signed payment from a known wallet to a known address is itself a strong identity claim — the wallet's controller proved possession of the key. For low-value M2M, this is often sufficient on its own.

### References

- A2A protocol (Google): <https://github.com/a2aproject/A2A>
- AP2 mandates: <https://github.com/google-agentic-commerce/AP2>
- Multi-agent procurement playbook: [/agent-playbooks/multi-agent-procurement.md](../agent-playbooks/multi-agent-procurement.md)
- Receipts and proof of purchase: [/merchant-playbooks/receipts-and-proof-of-purchase.md](../merchant-playbooks/receipts-and-proof-of-purchase.md)

---

## Shared patterns

Both surfaces share the same defender-side architecture. The protocol-layer mechanisms used for pay-per-call generalize directly to agent-to-agent procurement.

**Stablecoin settlement.** USDC on Base is the agentic default; EURC for euro-denominated flows; USDT on Tron is widely held. Chains with seconds-finality (Base, Solana) suit fast loops; Ethereum mainnet finality is too slow for high-throughput micro-procurement. See [/rails/crypto-stablecoin.md](../rails/crypto-stablecoin.md).

**Idempotency and replay safety.** Every billable interaction — a single API call or a multi-step procurement — needs a client-provided idempotency key. Mandates need nonces and tight expiries. Reusing a payment proof, macaroon, or mandate after its window invites double-charge or replay attacks.

**Authorization caps.** AP2 mandates apply identically to per-call ceilings and to multi-step procurement budgets. The mandate's `cap_per_period` is the hard ceiling at both layers; the agent's policy engine enforces per-call and per-window ceilings beneath it. See [/merchant-playbooks/agent-authorization-scopes.md](../merchant-playbooks/agent-authorization-scopes.md).

**Receipt parity.** Both sides retain signed, machine-parseable receipts with the same content. A multi-step M2M chain produces a graph of receipts, and reconstructing it post-hoc requires consistent identifiers (task ID, mandate ID, payment hash) at every link.

**Reconciliation.** Server-side billable calls — whether for an API or a delivered artifact — reconcile against on-chain settlements. See [/merchant-playbooks/multi-chain-settlement-reconciliation.md](../merchant-playbooks/multi-chain-settlement-reconciliation.md).

**Common pitfalls across both surfaces.** Trusting price/capability fields without policy verification; settling against the wrong chain; skipping the named facilitator; mandate replay without nonce/expiry; over-broad mandates; no documented dispute path; ignoring sanctions on cross-border flows; treating reputation as a trump card rather than one signal.

**Defender framing.** Cost ceilings, attestation requirements, idempotency keys, and dispute paths are not friction imposed on the agent — they are the controls that let a principal delegate safely. An agent that respects them is acting as a fiduciary.

---

## References

- x402 spec: <https://x402.gitbook.io/>
- L402 (Lightning Labs): <https://docs.lightning.engineering/the-lightning-network/l402>
- A2A protocol (Google): <https://github.com/a2aproject/A2A>
- AP2 mandates: <https://github.com/google-agentic-commerce/AP2>
- Fewsats (L402 toolkits): <https://fewsats.com/>
- x402 protocol page: [/protocols/x402.md](../protocols/x402.md)
- L402 protocol page: [/protocols/l402.md](../protocols/l402.md)
- Stablecoin rails: [/rails/crypto-stablecoin.md](../rails/crypto-stablecoin.md)
- Agent authorization scopes: [/merchant-playbooks/agent-authorization-scopes.md](../merchant-playbooks/agent-authorization-scopes.md)
- Multi-chain settlement reconciliation: [/merchant-playbooks/multi-chain-settlement-reconciliation.md](../merchant-playbooks/multi-chain-settlement-reconciliation.md)
- Receipts and proof of purchase: [/merchant-playbooks/receipts-and-proof-of-purchase.md](../merchant-playbooks/receipts-and-proof-of-purchase.md)
- Multi-agent procurement playbook: [/agent-playbooks/multi-agent-procurement.md](../agent-playbooks/multi-agent-procurement.md)
- Worked example (x402): [/examples/x402-pay-an-api](../examples/x402-pay-an-api)
