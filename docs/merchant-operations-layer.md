# The merchant operations layer

The merchant operations layer is the surface of agentic commerce that protocols leave to merchants: catalog, quote, pay, deliver, refund, reconcile. It is the production-side surface that turns a protocol-level agreement into a delivered good — and the surface where every agent purchase actually succeeds or fails.

## What it includes

- **Catalog** — discovery, ranking, locale, currency, and jurisdiction filtering at the SKU level. The merchant's eligibility model decides which products an agent is allowed to see and quote for a given user. See [catalog-discovery-at-scale](../merchant-playbooks/catalog-discovery-at-scale.md).
- **Quote** — pricing held for a defined window, with explicit drift, expiry, and re-quote semantics. The merchant decides what a quote guarantees and what happens between quote and settle. See [pricing-drift-and-requote](../merchant-playbooks/pricing-drift-and-requote.md).
- **Pay** — accepting value across rails (stablecoin, Lightning, card, bank) with idempotency, authorization scopes, and rail-specific finality. See [agent-authorization-scopes](../merchant-playbooks/agent-authorization-scopes.md).
- **Deliver** — turning "paid" into "delivered" with semantics specific to the good: a redemption code, a PNR, an eSIM activation profile, an API capability, a physical parcel. See [delivery-semantics-codes-pnrs-esims](../merchant-playbooks/delivery-semantics-codes-pnrs-esims.md).
- **Refund** — refund logic lives entirely on the merchant when the rail has no chargeback (stablecoin) and partially on the merchant when it does (cards). Per-product, per-rail refund flows are operational, not protocol-level. See [refunds-and-disputes-for-agents](../merchant-playbooks/refunds-and-disputes-for-agents.md).
- **Reconcile** — one ledger across multiple chains, multiple stablecoins, card rails, and bank rails, with per-chain finality gating. See [multi-chain-settlement-reconciliation](../merchant-playbooks/multi-chain-settlement-reconciliation.md).

Adjacent operational concerns — fraud signals on agent traffic, jurisdictional and tax metadata, signed receipts — sit inside the same layer. See the [merchant-playbooks index](../merchant-playbooks/README.md) for the full set.

## Why it matters

Without this layer the protocols don't transact. ACP standardizes the checkout exchange; AP2 standardizes mandates; x402 standardizes payment-on-HTTP. None of them standardize what a SKU is, when a quote drifts, what "delivered" means for an eSIM versus a flight PNR, how a partial gift card refund is processed, or how five-chain settlement reconciles to one ledger. The protocols assume a merchant who handles all of that.

The layer doesn't generalize across merchants. Every merchant operates a variant — different catalog scope, different jurisdictional rules, different supplier integrations, different rail mix, different refund semantics. The patterns generalize; the specifics do not. This is also why the layer is where production differs from demos: a demo can hard-code a single SKU, a single currency, a single chain, and a single delivery type, and still appear to work end-to-end. Production can do none of those things.

## Reference model

The README's [Production merchant reference model](../README.md#production-merchant-reference-model) section is a concrete example of what this layer can look like in practice: agent runtimes, MCP context, Agent Skills, ACP-style commerce semantics, x402 as primary payment rail with cards as fallback, multi-stablecoin and multi-chain settlement, and a locale × currency × jurisdiction eligibility model at quote time. That model is portable to any merchant integrating agent-facing checkout; the specific choices are based on patterns operated by Cryptorefills.

## Read next

- [Merchant playbooks](../merchant-playbooks/README.md) — the operational patterns, written down.
- [What protocols don't solve](./what-protocols-dont-solve.md) — full gap analysis.
- [The agentic commerce stack](./agentic-commerce-stack.md) — where this layer sits.
- [Protocol matrix](../comparison/protocol-matrix.md) — capability by protocol.
- [Glossary](./glossary.md) and [FAQ](./faq.md) — terms and recurring questions.

## Maintainer

Maintained by Cryptorefills, a digital-goods merchant operating publicly since 2018 across 180+ countries, with stablecoin-first checkout. 10,500+ brands.
