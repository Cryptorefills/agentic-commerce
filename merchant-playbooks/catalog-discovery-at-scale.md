# Catalog Discovery at Scale

> Ranking, locale, currency, and jurisdiction filters across thousands of SKUs so an agent's "Amazon $50 US" lands on the right product, not the closest string match.

---

## Problem

An AI agent connects to a Cryptorefills MCP server and asks for "Amazon gift card US $50". Behind that string sit thousands of active SKUs across 10,500+ brands and 180+ countries. There are several "Amazon" entries — Amazon.com, Amazon.de, Amazon.co.jp, Amazon.in — each with their own currency, denomination ladder, supplier cost, regional availability, and KYC posture. There are also lookalikes: an "Amazon Prime Video" gift card, a regional reseller's "Amazon Cash" card, a closed-loop Amazon-branded business voucher. The agent doesn't know any of that. It has a string, a price, a country code from the user's session, and a settlement currency it would like to pay in. The merchant has to take that and pick the *right* SKU within a few hundred milliseconds, return it as the canonical answer, and not pick the wrong one — because if the agent buys an Amazon.de €50 card on behalf of a US customer, the customer can't redeem it and the refund problem becomes a [refunds playbook](./refunds-and-disputes-for-agents.md) problem.

Catalog discovery is the first place agentic commerce loses to ambiguity. Most demos avoid this by pre-filtering to a single SKU. Production can't.

> What works at 100 SKUs breaks at 6,000. The decisions below come from operating thousands of SKUs across 180+ countries.

---

## Why protocols don't cover this

ACP and UCP standardize the *shape* of the discovery API — `product_search`, `product_get`, the data shape of a returned product, the order lifecycle from cart to checkout. They do not standardize ranking, locale resolution, jurisdiction filtering, or how a merchant should disambiguate between near-duplicate SKUs. ACP's spec explicitly leaves catalog selection to the merchant; the protocol's job ends at "you returned a product, the agent picked it, the agent now wants to buy it." MCP's `tools/list` and Shopify's storefront MCP make a catalog *callable* but leave the merchant to decide which entries are surfaced and in what order. AP2 doesn't touch discovery at all — it's an authorization layer downstream. The result: every merchant exposing a catalog to agents has to write their own ranker, their own locale resolver, and their own jurisdiction filter, and the failure modes are the merchant's alone to absorb.

---

## Approach

We treat catalog discovery as a **defender-side** ranking problem with three filter stages and three ranking signals. Filters are hard cuts. Ranking is what's left.

### Stage 1: hard filters at quote time

Three filters reduce the candidate set before any scoring happens:

1. **Locale** — country of the redeeming user, derived from agent session metadata, billing address on the AP2 mandate, or the product's explicit `region` parameter. If the agent doesn't supply one, we refuse to rank rather than guess. Returning the wrong-region SKU is worse than returning nothing.
2. **Settlement currency** — the agent's chosen settlement asset (USDC on Base, USDT on Tron, etc.). Some SKUs are priced in the supplier's local fiat with daily-changing FX; if we can't quote in the agent's currency within a usable spread, we drop the SKU here.
3. **Jurisdiction** — the SKU's regulatory class in the user's country (gift card / monetary instrument / e-money / closed-loop voucher). KYC-required SKUs are filtered out for unverified agents. See [jurisdiction-and-tax-metadata](./jurisdiction-and-tax-metadata.md).

What we do: every SKU has `availableRegions[]`, `quotableCurrencies[]`, and `jurisdictionClass` indexed. Hard filters run as set intersections in Redis before the ranker sees the candidate list.

Why: the wrong region or wrong jurisdictional class is a refund-or-fraud event, not a ranking miss.

Tradeoff: we sometimes return zero candidates for a query that another merchant would fuzzy-match. We prefer "no result" to a wrong result for an agent that will commit funds.

### Stage 2: ranking signals (in order)

After filters, the candidates are scored on a weighted sum of:

1. **Brand-match score** — exact match on canonical brand alias (we maintain a brand alias graph: "Amazon US" → `brand:amazon` + `region:US`). Token-level matching with regional disambiguators is a hard signal, not a tiebreaker.
2. **Supplier health** — rolling 24h success rate, average fulfillment latency, and current inventory depth from the supplier's webhook feed. A supplier at 99.7% success with < 2s median fulfillment outranks a cheaper supplier at 96% / 8s.
3. **Price (cost to the user, in the agent's settlement currency)** — applied last. We don't lead with price because for digital goods the cheapest match is often the most-failure-prone supplier, and an agent that gets a failed delivery on a $50 card costs us more than the 30bps we saved.
4. **Popularity** — last-7-day order count for the SKU in the user's region. Tiebreaker only.

Why this ordering: the dominant failure mode for agents is buying the wrong SKU, not paying too much for the right one. We optimize first for *correctness*, then *reliability*, then *price*. A human can re-evaluate price; an agent that committed funds to a wrong SKU 800ms ago cannot.

Tradeoff: we sometimes show a slightly more expensive but more reliable SKU. For high-volume B2B procurement an inverted weighting may be correct.

### Schema sketch

```json
{
  "query": "Amazon gift card US $50",
  "agentContext": {
    "userRegion": "US",
    "settlementAsset": "USDC",
    "settlementChain": "base",
    "kycLevel": "none"
  },
  "candidates": [
    {
      "skuId": "amazon-us-50-usd",
      "brand": "amazon",
      "brandAliases": ["amazon", "amazon.com", "amazon us"],
      "region": "US",
      "denomination": { "amount": 50, "currency": "USD" },
      "jurisdictionClass": "gift-card",
      "kycRequired": false,
      "supplierId": "supplier-acme",
      "supplierHealth": { "successRate24h": 0.997, "p50LatencyMs": 1800 },
      "quotableCurrencies": ["USDC", "USDT", "DAI", "USD"],
      "popularityRank7d": 3,
      "rankScore": 0.94
    }
  ],
  "policy": {
    "filterOrder": ["locale", "settlementCurrency", "jurisdiction"],
    "rankWeights": { "brandMatch": 0.45, "supplierHealth": 0.30, "price": 0.20, "popularity": 0.05 }
  }
}
```

The `policy` block is returned in the response so the agent (and the calling team) can audit *why* a particular SKU was ranked first. We treat ranker transparency as a defender-side requirement: if an agent picks a SKU we ranked, we want a paper trail of the inputs.

---

## Edge cases

- **Multi-region brands with one global wallet.** Amazon, Apple, Steam — the same brand sells separate regional SKUs but the user might genuinely accept any. Default to the user's region; expose the others only if the agent explicitly asks for "any region" or `acceptedRegions[]` on the query.
- **Ambiguous query strings.** "Apple $50" matches Apple gift card (US) and Apple Music subscription credit (UK). When brand-match is tied across two SKUs from different jurisdictional classes, we return both and force the agent to pick. Silent disambiguation is worse than asking.
- **Supplier health flapping.** A supplier's success rate drops to 90% mid-quote-window. We re-score on every quote rather than caching ranker output longer than 60s. Prevents an agent from getting a stale "best" SKU that has since gone soft.
- **Denomination not on the supplier's ladder.** Agent asks for `$37`. Most suppliers support a fixed ladder (10, 25, 50, 100). We do not silently round up. We return the nearest two valid denominations and let the agent choose.
- **Localized brand names.** "carrefour" in France vs "carrefour" in Argentina vs "carrefour" in Brazil — same brand, different SKU. Region filter handles this; the brand alias graph collapses the variants.
- **Closed-loop voucher mistaken for an open-loop card.** A "Starbucks card" is closed-loop in the US and an e-money instrument in some EU countries. Jurisdictional class filter catches this; brand-match alone would not.
- **Empty candidate set after filters.** We return an explicit `noMatch` with the filter that eliminated the last candidate, so the agent can relax exactly one constraint instead of re-querying blindly.

---

## When to use this

- You expose a catalog of more than ~500 SKUs to agents.
- You operate across more than one country or jurisdiction.
- You settle in stablecoin and need to quote in the agent's chosen settlement asset.
- Your suppliers have non-uniform reliability and you can observe per-supplier health.
- An agent picking the wrong SKU costs you a refund, a delivery failure, or a regulatory question.

---

## When NOT to use this

- Single-region, single-currency catalog with fewer than ~50 SKUs. A flat search is sufficient; this playbook is overkill.
- Catalogs where every SKU has identical reliability and identical jurisdiction (e.g. an internal API marketplace where all calls go through one billing account). Skip supplier-health weighting.
- Use cases where the agent's user is the merchant's regulated counterparty (B2B procurement) and the legal contract pre-selects suppliers — ranking should follow contract, not health metrics.
- Lightning-only or x402-only single-API marketplaces where there is one product and discovery is just `pay-or-don't`. Use the [x402 buyer loop](../agent-playbooks/x402-buyer-loop.md) directly.

---

## References

- **ACP — Agentic Commerce Protocol** spec, product search and product retrieval surfaces · [agentic-commerce-protocol/agentic-commerce-protocol](https://github.com/agentic-commerce-protocol)
- **UCP — Universal Commerce Protocol**, Shopify storefront discovery surface · [shopify.dev](https://shopify.dev)
- **MCP — Model Context Protocol**, `tools/list` and tool description conventions · [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Stripe ACP integration guide**, catalog and product expectations · [docs.stripe.com](https://docs.stripe.com)
- **Circle USDC multichain availability**, for `quotableCurrencies[]` configuration · [developers.circle.com](https://developers.circle.com)
- Related playbooks: [pricing-drift-and-requote](./pricing-drift-and-requote.md), [jurisdiction-and-tax-metadata](./jurisdiction-and-tax-metadata.md), [agent-authorization-scopes](./agent-authorization-scopes.md).

---

## Changelog

- **2026-04-28** — initial publication.
