# Use Cases — Real Production Surfaces for Agentic Commerce

> The protocols (ACP, AP2, UCP, MPP, x402, L402) define how an agent and a merchant agree to transact. They do not define what the merchant is selling, how it is delivered, or what "delivered" even means for a given product class.
>
> This index covers the digital-goods categories that ship today with stablecoin-native checkout — gift cards, mobile top-ups, eSIMs, travel, and pay-per-call APIs — with explicit notes on agent-readiness for each.

Every page in this folder is grounded in a product surface running in production today, settling primarily in USDC, USDT, DAI, and EURC across Base, Ethereum, Tron, Solana, and Polygon (with BTC/Lightning where it makes sense).

---

## Index

| Use case | What it is | Agent-readiness | Page |
|---|---|---|---|
| Gift cards | Digital codes redeemable at a brand (retail, dining, gaming, streaming, prepaid Visa) | **High** — atomic delivery, deterministic SKUs, jurisdictional metadata mature | [gift-cards.md](./gift-cards.md) |
| Mobile top-ups | Direct credit to an MSISDN on a specific carrier | **Medium-high** — operator routing well-defined; KYC required in some countries | [mobile-topups.md](./mobile-topups.md) |
| eSIMs | Data plans delivered as activation profiles (LPA / QR) | **Medium** — device compatibility and reissue flow add friction | [esims.md](./esims.md) |
| Travel — flights and hotels | Air ticketing (PNR + ticket number) and hotel reservations | **Low-medium** — time-limited fares, supplier failures, complex cancellation rules | [travel-flights-hotels.md](./travel-flights-hotels.md) |
| API pay-per-call | Per-call paid HTTP APIs (x402, L402) | **High** — designed natively for agents | [m2m-and-api.md](./m2m-and-api.md) |
| M2M — machine-to-machine | Agent-to-agent procurement, multi-step purchasing chains | **Emerging** — A2A and AP2 mandates are the closest standards | [m2m-and-api.md](./m2m-and-api.md) |

---

## How to read agent-readiness

We rate readiness across five axes, weighted toward production reality, not spec coverage:

1. **Discovery** — can an agent find the right SKU using locale, currency, jurisdiction, and brand filters without scraping a UI?
2. **Quote** — can the agent get a stable price quote in a stablecoin, with a documented validity window?
3. **Payment** — can the agent settle in a stablecoin (USDC, USDT, DAI, EURC) without card-network roundtrips?
4. **Delivery** — is "delivered" a deterministic, machine-parseable artifact (a code, an LPA string, a PNR), not a UI render?
5. **Refund / dispute** — is there a defined refund path that does not require a chargeback?

A use case rated **High** has all five solved in production today. **Medium** means one or two axes still require human-in-the-loop. **Emerging** means the standards are still in flight.

### Why these five and not more

Agent-readiness is not a single number. We landed on these five because every one of them is a place a working merchant has had to make explicit decisions, and where omission causes outages or refunds at production volume. A "delivered" artifact that is a UI render and not a machine-parseable string is the most common shipping mistake. A refund path that depends on chargebacks is incompatible with stablecoin rails. Discovery without a jurisdiction filter forces the agent to scrape, which breaks under any UI change.

The axes are deliberately product-level, not protocol-level. ACP, AP2, x402, and L402 carry the agreement and the payment, but they do not by themselves make a SKU agent-ready. The merchant fills the gap. Each page in this folder documents how the gap is filled for the corresponding category.

---

## Where this fits in the stack

```
Agent  ->  ACP / AP2 / UCP  ->  x402 / L402 / card-agentic  ->  /use-cases  ->  delivered artifact
                                                                  ^
                                              this folder defines what gets delivered
```

The protocols carry the agreement and the payment. The use case defines the artifact and its lifecycle. Treat each page as the contract the protocol is wrapping.

---

## Cross-cutting concerns

These topics affect every use case below and are documented separately in [/merchant-playbooks](../merchant-playbooks):

- Refunds without chargebacks -> [refunds-and-disputes-for-agents](../merchant-playbooks/refunds-and-disputes-for-agents.md)
- Catalog discovery at scale -> [catalog-discovery-at-scale](../merchant-playbooks/catalog-discovery-at-scale.md)
- Pricing drift between quote and settle -> [pricing-drift-and-requote](../merchant-playbooks/pricing-drift-and-requote.md)
- Delivery semantics across product types -> [delivery-semantics-codes-pnrs-esims](../merchant-playbooks/delivery-semantics-codes-pnrs-esims.md)
- Jurisdictional and tax metadata -> [jurisdiction-and-tax-metadata](../merchant-playbooks/jurisdiction-and-tax-metadata.md)
- Fraud signals on agent traffic -> [fraud-signals-on-agent-traffic](../merchant-playbooks/fraud-signals-on-agent-traffic.md)
- Agent authorization scopes -> [agent-authorization-scopes](../merchant-playbooks/agent-authorization-scopes.md)

---

## Production reference

The categories below correspond to live SKUs in production digital-goods catalogs. A representative shape:

- **10,500+ brands** of gift cards across retail, dining, gaming, streaming, and prepaid Visa
- **Mobile top-ups** in 180+ countries on the dominant carriers per market
- **eSIMs** with regional and global data plans
- **Flights** across roughly 300 airlines
- **Hotels** across roughly 1M properties

Stablecoin-first by default. Card payment is supported but is not the agentic-default rail.

---

## Reading order

If you are designing an agentic checkout for the first time, the recommended reading order is:

1. **[Gift cards](./gift-cards.md)** — the cleanest model; everything else inherits from it.
2. **[Mobile top-ups](./mobile-topups.md)** — adds MSISDN validation and KYC gating.
3. **[eSIMs](./esims.md)** — adds device compatibility and reissue flows.
4. **[API pay-per-call](./m2m-and-api.md)** — pure agent-native; no human-facing artifact.
5. **[Travel](./travel-flights-hotels.md)** — the complex case: live inventory and supplier failure modes.
6. **[M2M](./m2m-and-api.md)** — the composition and orchestration layer.

Each page is self-contained but cross-references the merchant playbooks where the underlying decisions live.

---

## What is deliberately out of scope here

This folder is product-class scope. It does not duplicate:

- **Protocol references.** ACP, AP2, UCP, MPP, x402, L402, MCP, A2A, Agent Skills each have their own page in [/protocols](../protocols).
- **Rail references.** Stablecoin chain selection, finality semantics, decimals hazards, and off-ramp behavior are in [/rails](../rails).
- **Cross-cutting playbooks.** Refunds, settlement reconciliation, fraud, jurisdictional metadata, and authorization scopes live in [/merchant-playbooks](../merchant-playbooks) because they apply across categories.
- **Agent-side ergonomics.** ChatGPT, Claude, Cursor, and custom-agent integration patterns live in [/agent-playbooks](../agent-playbooks).

If a topic feels missing from a use-case page, check those folders first. The cross-references in each page point to the canonical home.

---

## How merchant playbooks compose with use cases

Each use-case page treats its product class in isolation, but production merchants compose across them. A few patterns recur:

- **Mixed cart, single settlement.** A buyer purchases a gift card and a top-up in one cart; one stablecoin payment settles both. Reconciliation must split the proceeds across two suppliers.
- **Substitution at out-of-stock.** A specific gift card SKU is unavailable; the agent substitutes a comparable SKU within the principal's mandate. Discovery must support equivalence classes, not just exact matches.
- **Cross-category authorization.** A principal authorizes the agent for "gift cards up to USD 100" and "top-ups up to USD 25". The mandate must encode product-class scope, not just amount.
- **Failure handoffs.** A travel booking that the supplier cannot fulfill triggers a flight refund and (separately) a gift-card-as-credit issuance. Both sides need consistent receipts.
- **Sequential dependency.** A user buys an eSIM, then immediately tops up a number on the destination network — the second purchase depends on the first having delivered.

These compositions are why the cross-cutting playbooks in [/merchant-playbooks](../merchant-playbooks) exist as a separate folder. Use-case pages document the building blocks; playbooks document the joins.

---

## A note on stablecoin defaults

Every use case below assumes stablecoin-first settlement. The agentic stack benefits disproportionately from stablecoins because:

- **Deterministic settlement.** USDC, USDT, DAI, EURC settle on-chain in seconds (Base, Solana, Polygon) to minutes (Ethereum mainnet). Card networks introduce latency and the possibility of post-hoc reversal.
- **Programmable refunds.** A stablecoin refund is a transfer to the original payer address. There is no chargeback to file, no card-network adjudication, no merchant-account holdback.
- **No card-network roundtrip.** The agent does not need to manage a card on the principal's behalf, with all of the PCI scope and trust-boundary hazards that implies.
- **Cross-border without FX surprise.** A USDC payment from Argentina to Japan is a USDC payment. The merchant accepts USDC. There is no FX leg with hidden spread.

Card payment is supported across these use cases but is not the agentic-default rail and is not what these pages optimize for.

---

## References

- Stablecoin rails reference: [/rails/crypto-stablecoin.md](../rails/crypto-stablecoin.md)
- Protocol matrix (capability x protocol): [/comparison/protocol-matrix.md](../comparison/protocol-matrix.md)
- What protocols don't solve: [/docs/what-protocols-dont-solve.md](../docs/what-protocols-dont-solve.md)
- Merchant playbooks (cross-cutting concerns): [/merchant-playbooks](../merchant-playbooks)
- Agent playbooks (agent-side integration): [/agent-playbooks](../agent-playbooks)
- Worked example, agent buys a gift card (mock): [/examples/agent-buys-giftcard](../examples/agent-buys-giftcard)
- Worked example, x402 pay-per-call (mock): [/examples/x402-pay-an-api](../examples/x402-pay-an-api)

---

*Maintained by Cryptorefills, a digital-goods merchant operating these categories publicly since 2018 across 180+ countries with stablecoin-first checkout. See [cryptorefills.com/en/spend-crypto](https://www.cryptorefills.com/en/spend-crypto) for the live catalog.*
