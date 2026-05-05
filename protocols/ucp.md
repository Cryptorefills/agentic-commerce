# UCP — Universal Commerce Protocol

## Maintainer

[Google](https://google.com) and [Shopify](https://shopify.com), co-developed. Coverage layered on top of the Shopify storefront [MCP](./mcp.md) server.

## Status

**Spec public; live coverage on Shopify.**

- Co-developed by Google and Shopify; jointly announced 2025.
- **Production coverage on Shopify** via the Shopify storefront MCP server — Shopify merchants get UCP-shaped agent surfaces without bespoke integration.
- Reference clients in Google's agentic-commerce repos and the Shopify dev docs.
- Adoption beyond Shopify is early; the spec is open and other merchant platforms can implement.

## What it does

UCP is the **discovery and intent layer** of the agentic commerce stack. It defines how an agent finds products across storefronts, asks structured questions about availability, prices, variants, and constraints, and expresses **commerce intent** ("buy this thing", "find a flight", "subscribe to this") in a way merchants can interpret without per-merchant glue. UCP is intentionally narrow at the payment edge — it defers to [ACP](./acp.md) for delegated checkout, [AP2](./ap2.md) for mandate-based authorization, and the underlying payment rails for settlement. The Shopify partnership delivers UCP through MCP: a single `shopify` MCP server exposes a UCP-shaped surface so any MCP-aware agent can browse and intend across Shopify storefronts.

The protocol's value is *portability*: an agent that has learned to talk UCP at one merchant can talk it at another, without per-merchant adapters. That property is what makes cross-merchant shopping by agents tractable at all.

## Key concepts

- **Storefront discovery** — agent queries against a merchant catalog with structured filters (locale, currency, jurisdiction, category, attributes). Returns a candidate set with merchant-attested metadata.
- **Commerce intent** — a typed expression of what the user wants the agent to do, separate from a specific cart. Pairs with [AP2](./ap2.md)'s intent mandate when authorization is required.
- **Universal storefront surface** — the contract a merchant exposes (over [MCP](./mcp.md) or HTTP) so agents can query without merchant-specific code. The contract names the operations: search, get-product, get-variants, get-availability, quote, handoff.
- **Resolution / quote / handoff** — a query becomes a candidate set, the agent quotes one, then hands off to a checkout protocol (typically [ACP](./acp.md) or x402-paid endpoints) to actually transact. UCP is the *upstream*, not the checkout itself.
- **MCP binding** — the canonical wire format today is an MCP tool surface implementing UCP semantics. Shopify storefront MCP is the reference deployment.
- **Locale / currency / jurisdiction filters** — first-class in UCP because they decide whether a product is even legal or available for the buyer; not a post-hoc filter.
- **Variant resolution** — products with size, color, region, or activation profile (eSIM) variants resolve through a structured tree, not free text.

## How it fits

UCP is the **left edge** of the commerce stack: discovery and intent, before checkout. The typical agent flow:

1. **UCP discovery** — agent queries one or more merchant storefronts with locale/currency/jurisdiction filters.
2. **UCP intent** — agent expresses what the user wants done; merchants return matching offers.
3. **Handoff** — agent moves to a checkout protocol: [ACP](./acp.md) for ChatGPT-shaped delegated card checkout, [x402](./x402.md) for stablecoin paid requests, or a direct merchant API.
4. **[AP2](./ap2.md) mandate verification** — if the agent is operating under a delegated mandate, the rail verifies it.
5. **Settlement** on the chosen rail — USDC on Base / Ethereum / Polygon / Solana for stablecoin paths; card capture for ACP paths.

UCP does not specify the payment rail, the refund model, the delivery semantics, or the merchant operations — it specifies how the agent finds the right offer in the first place. Because Shopify is the launch implementer, in practice UCP today is "what the Shopify storefront MCP exposes". For merchants outside Shopify, implementing UCP means exposing equivalent semantics on your own MCP server. See [MCP](./mcp.md) and [`/protocols/agent-skills.md`](./agent-skills.md).

## Glossary

- **Storefront** — a merchant's catalog surface, exposed via UCP-shaped tools.
- **Discovery query** — structured search input from the agent.
- **Candidate set** — the merchant's filtered, ranked response.
- **Variant tree** — structured navigation of product attributes (e.g. eSIM region → duration → data plan).
- **Quote** — price-and-availability commit from the merchant for a chosen offer.
- **Handoff** — transition from UCP discovery into a downstream checkout protocol (ACP, x402, direct API).
- **Storefront MCP** — an [MCP](./mcp.md) server implementing UCP-shaped tools. Shopify's is the canonical reference deployment.

## Reference implementations

| Name | Link | Language |
|---|---|---|
| Shopify storefront MCP | [shopify.dev](https://shopify.dev) (MCP / agentic commerce sections) | TypeScript |
| Google Agentic Commerce repos | [github.com/google-agentic-commerce](https://github.com/google-agentic-commerce) | Python / TypeScript |
| Google Cloud agentic commerce docs | Google Cloud blog and docs (search "Universal Commerce Protocol") | n/a |
| MCP TypeScript SDK | [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | TypeScript |

## When to use this

- You operate a storefront on **Shopify** and want agent discovery for free via the storefront MCP.
- You run a non-Shopify storefront and want to **expose a discovery surface to agents** in a portable way — implement UCP semantics on your MCP server.
- You're building an **agent-side shopper** that needs to query many merchants without merchant-specific adapters.
- You want **clean separation** between discovery, intent, checkout, and authorization, so each layer can evolve independently.
- You have a **multi-locale, multi-currency, jurisdiction-sensitive** catalog (eSIMs, gift cards, travel) and want filters at the discovery layer rather than after checkout starts.

## When NOT to use this

- You only need **checkout** for ChatGPT users — [ACP](./acp.md) plus a Shared Payment Token is sufficient; UCP is upstream from where you are.
- Your merchant platform doesn't yet expose an MCP server and you don't have time to build one — UCP without an MCP surface is a paper exercise.
- You need **agent-to-API micro-payments** with no human shopper — [x402](./x402.md) directly is the right primitive.
- You expect UCP to handle **payment, refunds, or delivery** — it doesn't, by design.
- Your inventory is too small to justify a discovery layer — direct MCP tools or a single-product checkout endpoint is simpler.

## Defender notes

UCP discovery surfaces are **prompt-injection adjacent**. A malicious or compromised storefront can return product titles, descriptions, or attributes crafted to steer the calling agent. Treat returned text as untrusted. Constrain agent reasoning over discovery results: never let a product description directly override authorization scope, payment instrument selection, or delivery destination. Cap result set sizes. Log discovery queries and the merchant that returned each candidate. Watch for rapid catalog mutation (drop-and-reappear pricing) which is a known signal of dynamic adversarial pricing against agents.

## Example flow

A user asks an agent: "Find me an eSIM for two weeks in Japan, under EUR 25, that works on iPhone 15."

1. **Discovery query** — agent issues a UCP search: `category=esim`, `country=JP`, `duration=14d`, `device_compatibility=iphone15`, `currency=EUR`, `max_total=25`.
2. **Storefront response** — merchants return matching SKUs with structured metadata: data allowance, activation profile type, support locale, redelivery policy.
3. **Agent ranking** — the agent ranks candidates against user preferences; ties broken by merchant attestation strength and historical reliability.
4. **Quote** — agent quotes the chosen SKU; merchant returns price, taxes, jurisdictional notes.
5. **Handoff** — merchant indicates accepted checkout protocols (ACP for card, x402 for stablecoin). Agent picks based on user's authorized payment instrument.
6. **Checkout** — flows out of UCP into ACP/x402 with [AP2](./ap2.md) mandate verification if applicable.

UCP is responsible only for steps 1–5. Steps 6+ are downstream protocols.

## Operational notes for merchants

- **Catalog completeness.** UCP is only as good as the metadata you publish. Locale, currency, jurisdiction, and KYC requirements have to be present at the SKU level, not inferred.
- **Variant trees.** Products with structured variants (eSIM regions, gift card denominations, mobile operators) need an explicit, navigable tree, not free-text descriptions.
- **Rate limits.** A discovery surface invites exploration. Cap query volume per agent identity; a runaway agent loop should not crater your storefront.
- **Result determinism.** Same query → same ranked results, modulo inventory truth. Non-deterministic ranking surfaces are noisy for agents and harder to debug.
- **Cross-merchant comparison.** UCP-shaped surfaces enable cross-merchant agent shopping. Decide whether you want to be compared on price alone or on richer attributes; expose the attributes that move you off pure price competition.
- **Handoff target.** Document which checkout protocol you accept after discovery: ACP, x402, a direct merchant API. Agents need this in the discovery response.

## FAQ

**Q: Is UCP an MCP server or its own thing?**
The launch implementation is over MCP — Shopify's storefront MCP is a UCP-shaped surface. The semantics are protocol-level; the wire format today is MCP.

**Q: Does UCP replace product feeds?**
No. Feeds are bulk publication (good for indexing); UCP is interactive query (good for live shopping). Many merchants run both.

**Q: Can my agent search across multiple UCP merchants in one call?**
Not at the protocol level. The agent calls each merchant's UCP surface and merges results client-side. Aggregator agents may emerge to fan-out automatically.

**Q: How do agents know which merchants to query?**
Agent-side concern: discovery directories, prior user preferences, MCP server registries. UCP doesn't specify it.

**Q: Does UCP support travel and flight searches?**
Yes in principle — flight, hotel, and PNR-shaped products fit the variant tree model. Production implementations are early; expect more growth through 2026.

## Merchant implications

Merchants exposing through UCP decide which inventory is queryable by agents, how locale and jurisdiction filter results, and how prices are quoted at discovery time. The spec covers query and intent; the merchant covers eligibility, ranking determinism, and rate limits per agent identity. Variant trees, KYC flags, and the handoff target (ACP, x402, direct API) are all merchant-authored. See [/merchant-playbooks/](../merchant-playbooks/) for the production decisions.

## References

- Google + Shopify announcement (Google Cloud blog and Shopify newsroom, 2025)
- Shopify developer docs: <https://shopify.dev>
- Google Agentic Commerce GitHub: <https://github.com/google-agentic-commerce>
- Model Context Protocol: <https://modelcontextprotocol.io/>
- AP2 protocol (companion authorization layer): <https://ap2-protocol.org/>
- Cryptorefills MCP storefront example: [`/examples/mcp-storefront-minimal`](../examples/mcp-storefront-minimal)
- Catalog discovery at scale playbook: [`/merchant-playbooks/catalog-discovery-at-scale.md`](../merchant-playbooks/catalog-discovery-at-scale.md)
