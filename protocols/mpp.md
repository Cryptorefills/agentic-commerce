# MPP — Machine Payments Protocol

## Maintainer

[Tempo](https://tempo.network) and [Stripe](https://stripe.com), co-developed for machine-to-machine settlement primitives.

## Status

**Spec stage** · public spec drafts; partner integrations under development through 2026.

- Specification published by Tempo with Stripe as launch collaborator.
- Reference samples and SDKs in development.
- No broad merchant rollout yet; treat as a forward-looking primitive rather than a production checkout target today.
- The closest production analogue for crypto-settled M2M is [x402](./x402.md); MPP overlaps with x402's territory but is positioned for a wider set of rails and a different settlement model.

## What it does

MPP defines **machine-to-machine settlement primitives** — the request, accept, settle, and reconcile shape for a transaction where both buyer and seller are software agents and there is no human checkout step. It standardizes the metadata that travels with a machine payment (purpose, scope, idempotency key, settlement venue, refund authority) so that two unaffiliated systems can settle, dispute, and reconcile without bespoke integration. MPP is rail-agnostic in the spec but the launch implementation pairs Tempo's settlement infrastructure with Stripe's processor footprint to deliver a working M2M path that includes tax, invoicing, and reporting hooks.

The category MPP addresses is real: data feeds paying for upstream APIs, fleets of inference workers paying for compute or model access, autonomous services billing each other for compose-time dependencies. These transactions are software-only; they need a settlement protocol that doesn't assume a human checkout.

## Key concepts

- **Machine payment** — a transaction initiated by software, completed by software, with no human in the synchronous loop. Distinct from human-delegated payments where a user authorized an agent (those are AP2 territory).
- **Settlement venue** — the rail and chain where value moves (a bank rail, a stablecoin chain, a card capture). MPP is intended to abstract the venue without flattening its semantics.
- **Purpose / scope** — structured metadata describing why the payment is happening, what it pays for, and what authority backs it. Travels with the payment so the receiver can reconcile and so a regulator or auditor can read intent without a side-channel lookup.
- **Idempotency key** — required, machine-generated, used to deduplicate retries across the protocol stack. Persists across the wire, the facilitator, and the receiver's ledger.
- **Refund authority** — explicit declaration of who can reverse the payment and under what conditions. Critical for M2M because there is no human "ask the customer" loop.
- **Reconciliation hook** — a standardized post-settle notification for the receiving system's books. Lets the receiver post to its general ledger without bespoke parsing.
- **Settlement proof** — a signed receipt the receiver can archive and replay. Mirrors what x402 calls `X-PAYMENT-RESPONSE`.

## How it fits

MPP sits at the **payment-protocol layer** for M2M flows where neither party is a consumer wallet. It overlaps with [x402](./x402.md) at the wire but is broader: x402 is HTTP-402 stablecoin-shaped; MPP intends to span multiple rails (bank, card, crypto). Where [ACP](./acp.md) is buyer-to-merchant and [AP2](./ap2.md) is authorization for human-delegated agents, MPP is **agent-to-agent (or agent-to-API) settlement** with no human dependency.

In practice today, production M2M flows route through x402 because it's shipped; MPP is positioned to standardize the broader space as it matures.

Stack relationship:

| Layer | Protocol | When |
|---|---|---|
| Authorization (when human is upstream) | [AP2](./ap2.md) | Always, if a human delegated authority |
| Discovery (when relevant) | [UCP](./ucp.md) / [MCP](./mcp.md) | Service-to-service catalogs |
| Wire — stablecoin, today | [x402](./x402.md) | Production paths now |
| Wire — multi-rail, future | **MPP** | When partner rollout matures |
| Wire — Lightning / BTC | [L402](./l402.md) | Micropayment / BTC-native cases |

## Glossary

- **M2M payment** — software-to-software value transfer with no human checkout step.
- **Settlement venue** — the rail/chain where money moves.
- **Purpose** — structured metadata describing why the payment exists.
- **Refund authority** — explicit declaration of who can reverse the payment.
- **Reconciliation hook** — receiver-side notification standardizing post-settle bookkeeping.
- **Idempotency key** — deduplication anchor across the entire protocol stack.
- **Settlement proof** — signed receipt the receiver can replay.

## Reference implementations

| Name | Link | Language |
|---|---|---|
| Tempo MPP spec | Tempo developer docs | n/a |
| Stripe MPP integration notes | Stripe documentation (search "machine payments") | Multi-language |
| x402 (production analogue) | [github.com/coinbase/x402](https://github.com/coinbase/x402) | TypeScript / Go |

## When to use this

- You're designing a **forward-looking M2M settlement layer** and want a rail-agnostic standard rather than a stablecoin-only path.
- Your two parties are **both Stripe-attached merchants** and you want bookkeeping and tax hooks integrated with settlement.
- You need **structured metadata** for purpose, scope, and refund authority that travels with the payment beyond a free-text memo field.
- You want a path that interoperates with **bank rails** as well as crypto, in a single protocol shape.

## When NOT to use this

- You need to ship M2M payments **today**; MPP is spec stage. Use [x402](./x402.md) for stablecoin M2M and revisit MPP when partner availability materializes.
- Your settlement is **stablecoin-only** and you're already running on Base/Ethereum/Solana/Tron — x402 is the production answer; MPP adds spec surface without immediate benefit.
- You're a **consumer-facing checkout** (human in the loop) — wrong layer; use ACP / AP2.
- You want **micropayment-grade instant settlement** (sub-cent, sub-second) — Lightning + [L402](./l402.md) is the better fit for the BTC-native slice; x402 covers the stablecoin slice.

## Defender notes

Machine payments compress the human "are you sure?" loop to zero. That is the point and the risk. Defensible MPP integrations require: hard idempotency on every retry path, signed purpose strings the receiver can verify against an out-of-band intent, monotonic clock-skew tolerance on idempotency windows, explicit per-counterparty velocity and amount caps, and a receiver-side anomaly path that quarantines and alerts on settlement metadata that doesn't match expected shape. Refund authority should be **narrowly scoped and explicit** — never inherited from a generic merchant relationship. For agent-to-agent procurement patterns, see [`/agent-playbooks/multi-agent-procurement.md`](../agent-playbooks/multi-agent-procurement.md).

## Example flow

An autonomous data pipeline agent buys a snapshot of a third-party financial dataset:

1. **Discovery** — out of band; the buyer agent already knows the seller's MPP endpoint.
2. **Quote request** — buyer asks: "Snapshot of dataset X as of timestamp T".
3. **Quote response** — seller returns: price, settlement venue (e.g. USDC on Base via x402, or EUR via SEPA), purpose hash, refund window.
4. **Authorization** — buyer's [AP2](./ap2.md) mandate (signed at agent provisioning time) is presented; seller verifies it allows this category and amount.
5. **Settlement** — payment moves on the chosen rail; settlement proof returned.
6. **Resource delivery** — dataset URL returned with time-bounded credential.
7. **Reconciliation** — both sides post to ledgers via reconciliation hooks.

If the rail is x402, steps 4–6 collapse to one HTTP exchange. If the rail is SEPA, settlement is asynchronous and the resource is gated on settlement confirmation.

## Operational notes

- **Idempotency is non-negotiable.** Machine retries are the default failure mode. Every endpoint must accept a key and return the same outcome for the same key, indefinitely (or with a stated retention).
- **Purpose strings.** Use a stable, machine-parseable taxonomy. Free-text purpose fields rot.
- **Refund authority.** State explicitly which counterparty can issue a refund and against what window. Don't inherit from generic processor terms.
- **Reconciliation cadence.** Decide whether your books reconcile on each settlement event (low-latency, high cost) or in batched windows (cheaper, more failure-mode complexity). Document the choice.
- **Failure-mode catalogue.** Network partitions, half-completed settlements, double-submits across retries. Build the catalogue before you build the production integration.
- **Audit trail.** Every machine payment should be reconstructible end-to-end from purpose → mandate → payment → settlement → reconciliation. Don't drop links in the chain.

## FAQ

**Q: Why do I need MPP if I have x402?**
You don't, if your settlement is stablecoin-only. MPP becomes useful when you need a single protocol shape spanning crypto, card, and bank rails for M2M flows.

**Q: Is MPP production-ready?**
Spec stage. Don't bet a launch on it; revisit as partner support materializes.

**Q: Does MPP replace AP2?**
No. AP2 covers authorization; MPP covers settlement. They compose.

**Q: How does refund authority work without a human?**
The MPP payment carries an explicit refund-authority claim — typically signed by the buyer at payment time, naming who can request a reversal and within what window. Without it, refunds are ad-hoc bilateral negotiation.

**Q: What's the difference between MPP and traditional B2B invoicing rails?**
B2B invoicing rails are pre-arranged: counterparties agree on terms, then settle. MPP intends to be **just-in-time** — two services that may have never transacted before can negotiate, settle, and reconcile in one pass.

## Merchant implications

Merchants accepting MPP-style M2M payments inherit identity attestation, idempotency design, and reconciliation cadence. The spec is early; production patterns lean on x402 plus AP2 today. Refund authority must be narrowly scoped and explicit at payment time, since there is no human "ask the customer" loop to recover from sloppy defaults. Failure-mode catalogues — half-completed settlements, retry storms, partition recovery — are merchant-built. See [/merchant-playbooks/](../merchant-playbooks/) for production decisions.

## References

- Tempo announcement and developer docs (Tempo newsroom, 2025)
- Stripe documentation: <https://docs.stripe.com>
- x402 (production analogue, often paired in M2M flows): <https://www.x402.org/>
- AP2 (companion authorization layer for delegated machine payments): <https://ap2-protocol.org/>
- Multi-agent procurement playbook: [`/agent-playbooks/multi-agent-procurement.md`](../agent-playbooks/multi-agent-procurement.md)
