# FAQ

This is the canonical FAQ for the agentic commerce stack as it ships in 2026. Entries are short, defender-framed where security applies, and link to the maintaining organization for every protocol mentioned. Each answer is wrapped in a `<details>` block so the page can be skimmed.

## What it is

<details>
<summary><b>Who maintains this repo and why?</b></summary>

Maintained by [Cryptorefills](https://www.cryptorefills.com), a digital-goods merchant operating publicly since 2018 across 180+ countries. We sell gift cards, mobile top-ups, eSIMs, flights, and hotels with stablecoin-first checkout, and we expose agent-facing purchase flows through [Skills](https://agentskills.io/specification), [MCP](https://modelcontextprotocol.io/), and [x402](https://www.x402.org/). We open-sourced this reference because the protocols leave the merchant operations layer — catalog, quote, pay, deliver, refund, reconcile — to merchants. The playbooks here come from a real catalog, not a whiteboard.
</details>

<details>
<summary><b>Why is this called the merchant operations layer?</b></summary>

Because that is the operational surface ACP, AP2, x402, and MCP leave to merchants. Catalog discovery, dynamic pricing, eligibility per jurisdiction, delivery semantics, refunds for irreversible rails, multi-chain settlement reconciliation, fraud signals on agent traffic, and signed receipts are merchant-side decisions — every protocol on this page assumes a merchant who handles them. The merchant operations layer is the surface of agentic commerce that protocols standardize *into*, not *over*. See [/docs/merchant-operations-layer.md](./merchant-operations-layer.md) for the canonical definition and [/merchant-playbooks/](../merchant-playbooks/) for the patterns.
</details>

<details>
<summary><b>What is agentic commerce?</b></summary>

A transaction where an AI agent acts on behalf of a user (or another agent) to discover, negotiate, pay for, and accept delivery of a good or service. The agent typically holds a scoped authorization (a mandate, a key, or a session credential) and reaches into a merchant through a standardized commerce protocol like [ACP](https://www.agenticcommerce.dev/) or [AP2](https://github.com/google-agentic-commerce/AP2), settling over a payment rail like [x402](https://www.x402.org/) or a [Visa TAP](https://corporate.visa.com/en/products/trusted-agent-protocol.html)-flagged card.
</details>

<details>
<summary><b>How is this different from ordinary ecommerce?</b></summary>

Three things change. First, the buyer is software, so latency budgets shrink and idempotency becomes mandatory. Second, the authorization is a scoped mandate, not a cardholder swiping; the merchant has to verify scope, not just card number. Third, the dominant rail is shifting toward stablecoin (USDC, USDT, DAI, EURC) over [x402](https://www.x402.org/) for deterministic settlement without chargeback latency. Card rails still work, with agentic-token extensions ([TAP](https://corporate.visa.com/en/products/trusted-agent-protocol.html), [Agent Pay](https://www.mastercard.com/news/press/2025/april/mastercard-unveils-agent-pay/)).
</details>

<details>
<summary><b>What does "stablecoin-native" mean?</b></summary>

That the default settlement asset is a USD- or EUR-pegged stablecoin (USDC, USDT, DAI, EURC) and the default rail is HTTP-native ([x402](https://www.x402.org/)) rather than a card network. Stablecoin-native does not mean crypto-only — it means the merchant treats stablecoins as the primary path and cards as one of several alternatives. Cryptorefills is stablecoin-native by design.
</details>

## Protocols

<details>
<summary><b>What does each agentic-commerce protocol solve?</b></summary>

A 10-line landscape. Skim this first; the [protocols index](../protocols/README.md#what-each-protocol-solves) has the same recap with links plus the deeper grouped tables.

- **ACP** (OpenAI + Stripe) — checkout exchange between agent and merchant
- **AP2** (Google + 60 partners) — verifiable agent mandates and authorization
- **UCP** (Google + Shopify) — storefront discovery and intent
- **MPP** (Tempo + Stripe) — machine-to-machine settlement
- **x402** (Coinbase) — HTTP-native stablecoin payments (USDC on Base)
- **L402** (Lightning Labs) — Bitcoin/Lightning micropayments for APIs
- **MCP** (Anthropic) — tools and resources for agents
- **Agent Skills** (agentskills.io) — packaged agent capabilities
- **A2A** (Google) — agent-to-agent communication
- **Visa TAP / Mastercard Agent Pay / Amex agentic** — card-network identity and authorization for agent purchases
</details>

<details>
<summary><b>ACP vs AP2 vs x402 — which one do I use?</b></summary>

They are not alternatives; they layer.

- [**ACP**](https://www.agenticcommerce.dev/) (OpenAI + Stripe) standardizes the *checkout exchange* between an agent and a merchant — product feed, quote, cart, payment, receipt. Use it when you need to expose a merchant surface to ChatGPT-style agent runtimes.
- [**AP2**](https://github.com/google-agentic-commerce/AP2) (Google + 60 partners) standardizes the *authorization model* — signed intent and cart mandates as verifiable digital credentials. Use it when you need scoped, auditable authorization decoupled from the rail.
- [**x402**](https://www.x402.org/) (Coinbase + foundation) standardizes the *payment handshake* — HTTP 402 + a signed payment payload settling stablecoin on-chain. Use it as the rail underneath ACP or AP2 when you want stablecoin settlement.

A typical 2026 production flow is **ACP for the checkout surface, AP2 for the authorization, x402 for the rail.**
</details>

<details>
<summary><b>What is MCP and how does it relate to commerce?</b></summary>

[MCP (Model Context Protocol)](https://modelcontextprotocol.io/) from Anthropic is the agent-side surface — how an agent reaches into tools, resources, and prompts at runtime. A storefront MCP server exposes `search_products`, `get_quote`, and `place_order` to any MCP-capable agent (Claude, Cursor, others). MCP doesn't define a checkout protocol; it carries one. Most production stacks use MCP-on-the-agent-side and ACP-on-the-merchant-side.
</details>

<details>
<summary><b>What about UCP, MPP, A2A, Agent Skills?</b></summary>

[**UCP**](https://github.com/google-agentic-commerce) (Google + Shopify) — storefront discovery and intent for agents; complements ACP. [**MPP**](https://tempo.xyz/) (Tempo + Stripe) — machine-to-machine settlement primitives. [**A2A**](https://google.github.io/A2A/) (Google) — agent-to-agent communication; AP2 layers on top. [**Agent Skills**](https://agentskills.io) — runtime spec for loading task-specific instructions, tools, and resources; adopted by Claude Code, Cursor.
</details>

<details>
<summary><b>L402 vs x402 — when do I use each?</b></summary>

[**x402**](https://www.x402.org/) settles on EVM and Solana stablecoins, with Base as the 2026 default. Use it when your buyer holds USDC/USDT/DAI/EURC and you want sub-second-to-seconds finality.

[**L402**](https://docs.lightning.engineering/the-lightning-network/l402) settles on Bitcoin Lightning. Use it when your buyer is Lightning-native, when you need sub-cent micropayments, or when BTC is the unit of account. The two protocols are not interchangeable; the choice is upstream.
</details>

## Payment and settlement

<details>
<summary><b>Why stablecoins instead of cards?</b></summary>

For agent traffic specifically: deterministic settlement (no two-leg authorize-then-capture), no chargeback latency, programmable refunds, and HTTP-native via [x402](https://www.x402.org/). Cards still matter — [Visa TAP](https://corporate.visa.com/en/products/trusted-agent-protocol.html) and [Mastercard Agent Pay](https://www.mastercard.com/news/press/2025/april/mastercard-unveils-agent-pay/) extend card flows with agent context, and they bring chargeback rights stablecoin doesn't have. The right answer is "support both, default to stablecoin for digital goods."
</details>

<details>
<summary><b>Which stablecoins does production agentic commerce use?</b></summary>

In 2026 the production set is **USDC** ([Circle](https://www.circle.com/usdc), default for x402 on Base), **USDT** ([Tether](https://tether.to/), dominant on Tron and high-volume on Ethereum), **DAI** ([Sky / MakerDAO](https://sky.money/), used where decentralization is a requirement), and **EURC** ([Circle](https://www.circle.com/eurc), the EUR-denominated alternative). Cryptorefills supports all four across Base, Ethereum, Tron, Solana, and Polygon.
</details>

<details>
<summary><b>Do I have to handle multiple chains?</b></summary>

If you accept stablecoin from agents originating in different ecosystems, yes. USDC on Base for x402-native agents, USDT on Tron for buyers in regions where Tron USDT distribution is dominant, USDC on Solana where Solana wallets dominate. The merchant decides the supported set; the wire protocol does not. See [merchant-playbooks/multi-chain-settlement-reconciliation.md](../merchant-playbooks/multi-chain-settlement-reconciliation.md).
</details>

<details>
<summary><b>What about gas?</b></summary>

On Base, Tron, Solana, and Polygon, gas is a fraction of a cent per stablecoin transfer. On Ethereum L1 it can dominate small payments. For agent UX, [ERC-4337 paymasters](https://eips.ethereum.org/EIPS/eip-4337) let the agent pay only in stablecoin while the paymaster covers gas. Most 2026 production agent stacks abstract gas this way.
</details>

<details>
<summary><b>What is finality and why does it matter?</b></summary>

Finality is the point at which a payment is irreversible on its rail. On Base it is ~2 seconds soft, ~13 minutes hard. On Tron ~3 minutes. On Solana ~13 seconds. On Lightning, immediate on settlement. Merchants design their fulfillment timing around finality — releasing a gift-card code at soft finality is fine for low-value digital goods; high-value flights wait for hard finality.
</details>

## Authorization and identity

<details>
<summary><b>Do agents need KYC?</b></summary>

The agent itself usually does not. The user behind the agent and, in some product categories, the recipient do. Gift cards generally do not require KYC on the buyer. Mobile top-ups in some jurisdictions do. Flights are governed by airline rules, not generic KYC. The merchant attaches KYC requirements to SKUs, not to agents. See [merchant-playbooks/jurisdiction-and-tax-metadata.md](../merchant-playbooks/jurisdiction-and-tax-metadata.md).
</details>

<details>
<summary><b>How does the merchant know which agent is acting?</b></summary>

Through agent identity surfaced in the request — typically a public key in the [AP2 mandate](https://github.com/google-agentic-commerce/AP2) or in headers defined by ACP. Defender framing: never trust agent identity that is not signed by something the merchant can independently verify. A self-asserted "I am Agent X" is not identity.
</details>

<details>
<summary><b>What is a mandate?</b></summary>

A signed authorization from a user (or upstream agent) to a downstream agent, scoped to merchant, amount, time window, and category. AP2 calls this an [intent mandate](https://github.com/google-agentic-commerce/AP2) when it expresses a goal and a [cart mandate](https://github.com/google-agentic-commerce/AP2) when it commits to a specific cart. The merchant verifies the signature against the user's known key before acting.
</details>

<details>
<summary><b>Can my agent issue refunds?</b></summary>

Only within scopes the user authorized. Defender framing: a mandate that allows arbitrary refunds back to wallets controlled by the agent is a self-paying loop and should be rejected. Cryptorefills' policy is that refunds go to the original payer wallet only, with serial-refund rate limits per mandate. The mandate model lets the user delegate refund authority but the merchant decides which delegations to honor.
</details>

## Refunds, disputes, and receipts

<details>
<summary><b>How do refunds work without chargebacks?</b></summary>

Stablecoin rails have no native chargeback, so refunds are merchant-initiated transfers back to the original sender wallet, memorialized in a signed refund receipt. The dispute layer is whatever the merchant and counterparty contracted for off-chain — a published refund policy, a third-party arbiter, or escrow. Card rails (TAP, Agent Pay) keep their normal chargeback rights. See [merchant-playbooks/refunds-and-disputes-for-agents.md](../merchant-playbooks/refunds-and-disputes-for-agents.md).
</details>

<details>
<summary><b>What does a good receipt contain?</b></summary>

The intent mandate hash, the cart mandate hash, the payment proof (transaction hash, chain id, asset, amount), the delivery artifact (or its hash), the merchant's signature, and a stable verification URL. Machine-parseable JSON and human-readable HTML with a matching content hash printed in both. See [merchant-playbooks/receipts-and-proof-of-purchase.md](../merchant-playbooks/receipts-and-proof-of-purchase.md).
</details>

<details>
<summary><b>What if the agent loses the receipt?</b></summary>

The merchant retrieves it on demand from the verification URL keyed by the order id or the transaction hash. Receipts are not single-copy; they are reissuable from the merchant's records. Cryptorefills publishes receipts on a stable URL pattern for a defined retention window.
</details>

## Jurisdictional, tax, and fulfillment

<details>
<summary><b>How does jurisdiction affect what an agent can buy?</b></summary>

A given SKU may be sellable in one country and not another, may require KYC in some countries, and may carry different tax treatment everywhere. The merchant attaches metadata at the SKU level and filters at quote time. Agents that cross jurisdictions (a US-based agent buying a EU-issued gift card for a UK recipient) hit the intersection of three rule sets. The merchant resolves it; the spec doesn't.
</details>

<details>
<summary><b>What does "delivered" mean?</b></summary>

Per product type. A gift card is delivered when the code is revealed and not yet consumed. An eSIM is delivered when the activation profile is generated. A flight is delivered when the PNR is ticketed. A mobile top-up is delivered when the carrier acks. The merchant defines the semantic and writes it into the receipt. See [merchant-playbooks/delivery-semantics-codes-pnrs-esims.md](../merchant-playbooks/delivery-semantics-codes-pnrs-esims.md).
</details>

<details>
<summary><b>Are gift cards taxable?</b></summary>

Depends on jurisdiction. In some they are stored-value instruments not subject to VAT until redemption; in others they are taxable at sale. The merchant tags each SKU with its tax treatment per buyer jurisdiction.
</details>

## Fraud and safety

<details>
<summary><b>What new fraud patterns show up with agents?</b></summary>

Defender framing: prompt-injection-driven purchases (an attacker hijacks the agent's context and redirects it to buy something), velocity attacks (the agent loops faster than any human), serial-refund attempts against partial deliveries, mandate scope pushing (an agent presents a stretched-interpretation mandate hoping the merchant doesn't validate strictly), and credential reuse across agents. The merchant's defenses are scope rejection, rate limits, signed receipts, and per-rail risk scoring. See [merchant-playbooks/fraud-signals-on-agent-traffic.md](../merchant-playbooks/fraud-signals-on-agent-traffic.md).
</details>

<details>
<summary><b>How do I rate-limit an agent?</b></summary>

Per mandate, per buyer wallet, per agent identity, per SKU category, and per rail — each independently. Stablecoin rails have no card-network velocity layer, so the merchant has to provide it. Idempotency keys plus per-mandate transaction caps are the cheap baseline.
</details>

## Implementation

<details>
<summary><b>What's the minimum I need to ship to accept agent payments?</b></summary>

A discoverable surface (an MCP server or an ACP feed), a quote endpoint that signs the cart, a payment endpoint that accepts x402 (or a card with TAP context, or both), a delivery handler per product type, and a signed-receipt service. The first four are in the protocols. The fifth is the merchant's. Total surface area for a digital-goods merchant is small.
</details>

<details>
<summary><b>Is there runnable code?</b></summary>

Yes — see [`/examples`](../examples) in this repo: x402 pay-an-API, MCP storefront minimal, agent-buys-giftcard end-to-end mock.
</details>

<details>
<summary><b>Where do I start reading?</b></summary>

[reading-order.md](../README.md#if-you-only-read-three-files) suggests paths through the repo for a CTO, a developer, a merchant, and a protocol contributor.
</details>
