# What Protocols Don't Solve

This is the opinionated piece. The agentic commerce specs published in 2024-2026 — [ACP](https://www.agenticcommerce.dev/), [AP2](https://github.com/google-agentic-commerce/AP2), [UCP](https://github.com/google-agentic-commerce), [MPP](https://tempo.xyz/), [x402](https://www.x402.org/), [L402](https://docs.lightning.engineering/the-lightning-network/l402), [MCP](https://modelcontextprotocol.io/), [A2A](https://a2a-protocol.org/latest/), [Visa TAP](https://corporate.visa.com/en/products/intelligent-commerce.html), and [Mastercard Agent Pay](https://newsroom.mastercard.com/news/press/2025/april/mastercard-unveils-agent-pay-pioneering-agentic-payments-technology-to-power-commerce-in-the-age-of-ai/) — cover a remarkable amount of the agentic commerce stack. They standardize the wire format, the negotiation, the authorization model, and the payment handshake. What they do not cover is the long tail of merchant operations that decides whether a transaction actually closes, settles, fulfills, and refunds correctly. This essay walks through the gaps, defender-framed throughout, and ends with what merchants actually build to fill them.

## Catalog ranking

A merchant with 10,001 products across 180+ countries cannot return all of them to an agent. ACP defines a product feed format. UCP defines a discovery surface. Neither defines **the order** in which results come back. Ranking is the merchant's competitive surface, and the agent has no protocol-level way to request it: "return the three SKUs most likely to fulfill the user's intent given their locale, currency, jurisdictional eligibility, current supplier stock, and historical refund rate."

In practice merchants build a ranking pipeline that fuses locale and currency (cheap), jurisdictional eligibility (medium — gift cards and mobile top-ups are KYC-conditional in some countries), real-time supplier health (expensive — supplier APIs go down), and quality signals from prior agent traffic. None of that is in the spec. Agents that talk to several merchants will see different rankings for the same intent, and that is fine; ranking is where merchants compete. But it means **the agent's choice depends on the merchant's invisible logic**, and that has fraud and bias implications the specs do not address.

## Pricing drift between quote and settle

ACP and AP2 sign a cart, but the cart has an expiry. Between the quote being signed and the payment landing on-chain, three things can move: the FX rate of the settlement asset (small for USDC, larger for non-stable assets), the gas required to settle, and the supplier-side price of the underlying product (gift cards repriced by the brand, hotel rates updated by the GDS).

The spec says: the quote is valid for N seconds. The merchant has to decide what N is per product, what to do when it expires, and how to re-quote without making the agent loop forever. Cryptorefills handles this by quoting tight on stable supply and loose on volatile supply, signing each re-quote, and capping the number of re-quotes per intent. **Defender framing:** an unbounded re-quote loop is an attack surface; a malicious merchant could drift price upward across re-quotes, and a malicious agent could drift downward. The merchant has to bound both directions.

## Multi-chain settlement reconciliation

A merchant accepting USDC on Base, USDT on Tron, DAI on Ethereum, EURC on Polygon, and BTC on Lightning has five rails, four issuers, and three finality models. Each rail emits payment proofs in a different shape. None of the commerce protocols standardize the merchant's back-office representation. ACP says "the payment was made"; it does not say how to ledger it.

The reconciliation work the merchant does:

- Normalize the asset (USDC on Base and USDC on Polygon are fungible at the issuer level but not at the address level).
- Convert to the merchant's reporting currency at a fixed FX policy (the policy is the merchant's; nothing in the spec dictates it).
- Match each on-chain payment to a `quote_id` and an `order_id`, including the case where the buyer overpays, underpays, or pays from the wrong address.
- Flag stuck or ambiguous payments for human review.
- Roll the result up into something a finance team can audit.

There is no protocol for any of this. There are vendor-specific tools, but the policy stays with the merchant.

## Refund semantics across rails

Card rails have chargebacks. Stablecoin rails do not. Lightning has no native dispute layer. The commerce protocols are payment-rail-agnostic, which is the right design choice, but it means the merchant inherits the **dispute model of whichever rail settled the trade**.

For Cryptorefills the practical model is:

- Cards (when used, via TAP or Agent Pay) → issuer-led dispute, follow scheme rules.
- Stablecoin → merchant-initiated reversal to the original sender wallet, off-chain agreement memorialized in a signed refund receipt.
- Lightning → out-of-band refund, since once a Lightning payment settles the channel state is final.

None of this is in ACP or AP2. The spec defines `cancel` and `refund` operations but leaves the policy to the merchant. **Defender framing:** the refund flow is the second-most-attacked surface after authorization itself. Agent-driven serial refund attempts, partial refunds against partial deliveries (gift cards consumed before report), and refunds requested through a different agent than the one that bought — every one of these patterns shows up in production traffic, and every one requires merchant policy the protocol does not write.

## Jurisdictional and tax metadata

A USD 50 Amazon US gift card is a stored-value instrument in some jurisdictions and a monetary instrument in others. A mobile top-up to a Saudi Arabian MSISDN requires KYC; one to a Mexican MSISDN does not. A flight booking is taxable per departure airport, not per buyer location. None of this metadata is in MCP, ACP, AP2, or x402. It has to be attached at the merchant level, surfaced at quote time, and respected at settlement.

What merchants build: a SKU-level metadata layer that joins product type × buyer jurisdiction × seller jurisdiction × supplier jurisdiction and emits a flag set the agent can filter on. That layer is the merchant's compliance backbone, and it does not generalize across merchants — a digital-goods catalog's jurisdiction matrix is not a travel aggregator's, and neither maps to a SaaS reseller's.

## Fraud signaling on agent traffic

The card networks have decades of fraud telemetry on human cardholders. They are now extending it to agents through TAP and Agent Pay, but **stablecoin rails ship without any of that infrastructure**, and the commerce protocols do not standardize it.

The fraud surface specific to agentic commerce includes: prompt-injection-driven purchases (the agent buys what an attacker tells it to in a hijacked context), velocity attacks (the agent loops faster than a human ever would), stable-IP-but-rotating-card attempts, and credential reuse across agents. **Defender framing throughout:** the merchant's job is to surface signals (agent fingerprint, intent shape, mandate provenance, settlement-rail risk score) and act on them at the rate the rail allows. On stablecoin rails that means pre-quote screening because there is no post-settlement chargeback. On card rails it means relying on the issuer's score and supplementing it with agent-specific telemetry.

## Authorization scopes for agents

AP2's [mandate model](https://github.com/google-agentic-commerce/AP2) is the closest the ecosystem has to a standard scope language: per-merchant, per-amount, per-time-window, per-product-category. It is also the youngest, with thinner ecosystem support than ACP. Most merchants in 2026 receive mandates whose scopes they cannot fully verify against because the verifier infrastructure is still being built.

Until the verifier ecosystem catches up, merchants implement scope checking themselves: parse the mandate, validate the signature against the user's known key, intersect with the merchant's policy (some merchants refuse mandates that allow auto-purchase above a threshold), and emit a refusal early in the flow if the scope is suspicious. **Defender framing:** the cheapest fraud control in the agent era is **rejecting mandates that don't make sense** — too broad, too long-lived, too high a cap, scopes that include the merchant's own off-ramps.

## Delivery semantics

The spec says "the order was placed" or "the order is shipped". The merchant has to decide what those mean per product:

- A gift card is "delivered" when the code is revealed to the agent — but the code is also redeliverable until consumed.
- An eSIM is "delivered" when the activation profile is generated; it is "active" only after the device installs it.
- A flight is "delivered" when the PNR is ticketed; the supplier may un-ticket it under specific failure modes.
- A mobile top-up is "delivered" when the carrier ack arrives, which is async and per-operator.
- A pay-per-call API charge is "delivered" when the response is returned, which is the same response that triggered the charge.

Each of these has a different "what does done mean" answer. None of the commerce protocols write it down. The merchant writes it into the receipt.

## Receipts as the merchant's evidence

A signed receipt is the single most load-bearing artifact in agentic commerce, and the protocols define only its rough shape. The merchant decides what fields go in, which key signs it, where it is verifiable from, and how long it is retained. **Defender framing:** in any future dispute the merchant's receipt is the case. Skipping the receipt — or signing it with a key the merchant rotates without publishing rotation history — concedes the dispute before it starts.

What good receipts do:

- Bind the intent mandate, the cart mandate, the payment proof, and the delivery artifact in one signed object.
- Sign with a key whose rotation history is public.
- Are machine-parseable JSON and human-readable HTML, with a stable hash printed in both.
- Are retrievable from a stable URL on the merchant's domain for a published retention period.

## What merchants build to fill the gap

Across these eight surfaces, the merchant's investment ends up looking like:

- A **product metadata layer** that joins SKU × locale × jurisdiction × supplier health and feeds catalog ranking and quote-time filtering.
- A **quote engine** with bounded re-quote semantics, signed by a per-merchant key.
- A **multi-chain reconciliation ledger** that normalizes payments across USDC, USDT, DAI, EURC and Base/Ethereum/Tron/Solana/Polygon plus Lightning.
- A **refund policy engine** keyed by product type and rail, with explicit serial-refund rate limits.
- A **mandate verifier** with scope rejection rules.
- An **agent telemetry layer** for fraud signals — fingerprint, velocity, mandate shape, intent provenance.
- A **delivery semantic library** with one definition of "done" per product type.
- A **receipt service** with a published signing key and stable verification URL.

None of these is in a protocol spec. All of them are in production at any merchant who actually ships agentic commerce at scale. That is the gap this repo documents.
