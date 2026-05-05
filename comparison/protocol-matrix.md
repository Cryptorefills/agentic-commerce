# Protocol Matrix

Capability × protocol. Cells read `yes` / `partial` / `no` / `out of scope`, with footnoted source references.

Status as of April 2026. Spec versions evolve; if a cell is wrong, open a PR with a primary-source citation.

## How to read this

- **yes** — the protocol explicitly defines the capability and reference implementations exist.
- **partial** — the capability is partially specified, optional, or covered by an extension that is not yet broadly adopted.
- **no** — the capability is not in the protocol; merchants or agents have to build it themselves.
- **out of scope** — the protocol explicitly does not address this layer of the stack and never will (e.g. asking MCP about settlement is a category error).

Protocols compared:

- **ACP** — Agentic Commerce Protocol (OpenAI + Stripe)[^acp]
- **AP2** — Agent Payments Protocol (Google + ecosystem)[^ap2]
- **UCP** — Universal Commerce Protocol (Google + Shopify)[^ucp]
- **MPP** — Machine Payments Protocol (Tempo + Stripe)[^mpp]
- **x402** — HTTP 402 stablecoin payments (Coinbase + x402 Foundation)[^x402]
- **L402** — Lightning + macaroon payments (Lightning Labs)[^l402]
- **MCP** — Model Context Protocol (Anthropic)[^mcp]

## Capability matrix

| Capability | ACP | AP2 | UCP | MPP | x402 | L402 | MCP |
|---|---|---|---|---|---|---|---|
| **Checkout exchange** (cart, totals, finalize) | yes[^acp-checkout] | partial[^ap2-checkout] | partial[^ucp-checkout] | partial[^mpp-checkout] | no[^x402-checkout] | no[^l402-checkout] | out of scope[^mcp-scope] |
| **Authorization model** (who can spend what, when) | partial[^acp-auth] | yes[^ap2-mandate] | no[^ucp-auth] | partial[^mpp-auth] | no[^x402-auth] | partial[^l402-auth] | out of scope[^mcp-scope] |
| **Agent identity** (verifiable agent principal) | partial[^acp-agent] | yes[^ap2-vc] | no[^ucp-agent] | no[^mpp-agent] | partial[^x402-agent] | partial[^l402-agent] | partial[^mcp-agent] |
| **Recurring mandate** (scoped, multi-transaction) | no[^acp-recurring] | yes[^ap2-mandate] | no[^ucp-recurring] | partial[^mpp-recurring] | no[^x402-recurring] | no[^l402-recurring] | out of scope[^mcp-scope] |
| **Refund support** (protocol-level dispute or reversal) | partial[^acp-refund] | partial[^ap2-refund] | no[^ucp-refund] | no[^mpp-refund] | no[^x402-refund] | no[^l402-refund] | out of scope[^mcp-scope] |
| **Settlement currency** (what moves on the wire) | card[^acp-card] | rail-agnostic[^ap2-rails] | no settlement[^ucp-settle] | machine[^mpp-settle] | stablecoin[^x402-settle] | BTC[^l402-settle] | out of scope[^mcp-scope] |
| **Jurisdictional metadata** (per-SKU country, tax, KYC) | partial[^acp-juris] | no[^ap2-juris] | partial[^ucp-juris] | no[^mpp-juris] | no[^x402-juris] | no[^l402-juris] | partial[^mcp-juris] |
| **Dispute model** (how a buyer contests a charge) | inherits processor[^acp-dispute] | partial[^ap2-dispute] | no[^ucp-dispute] | no[^mpp-dispute] | none[^x402-dispute] | none[^l402-dispute] | out of scope[^mcp-scope] |

## Reading the matrix

A few patterns are worth calling out.

**No protocol is a complete merchant stack.** ACP standardizes checkout but leaves authorization shallow and refunds to the processor. AP2 standardizes authorization but stops short of catalog and checkout. x402 and L402 settle but say nothing about disputes or jurisdictional metadata. MCP is a tool-and-context protocol — it is not a commerce protocol at all, and asking it for refund semantics is a category error.

**The "rail-agnostic" cell is doing real work.** AP2 deliberately does not pick a rail; an AP2 mandate can be redeemed against a card, a stablecoin transfer (via the AP2 + x402 extension), or a bank rail. That flexibility is the point of the spec. ACP ships paired with cards in production; AP2 is rail-agnostic by design.

**For stablecoin-settled flows.** If you settle in stablecoins natively, x402 is the protocol that actually moves money on the wire. ACP can sit on top of x402, but ACP itself does not specify the on-chain transfer.

**Jurisdictional metadata is unsolved everywhere.** Every cell in that row is `partial` or `no`. Gift-card categorization, KYC-required mobile top-ups, travel-rule thresholds, and country-specific delivery rules stay merchant-side. See [`/merchant-playbooks/jurisdiction-and-tax-metadata.md`](../merchant-playbooks/jurisdiction-and-tax-metadata.md).

**Refund and dispute support is the second-biggest gap.** Card-network protocols inherit chargebacks. Crypto rails do not — there is no chargeback in USDC. Merchants have to define their own refund policy, encode it in receipts, and honor it operationally. See [`/merchant-playbooks/refunds-and-disputes-for-agents.md`](../merchant-playbooks/refunds-and-disputes-for-agents.md).

## What this matrix is not

- Not a feature-completeness scorecard. A `yes` here only means the protocol covers it; it does not mean the implementation is mature in production.
- Not a prediction. Adoption can flip a `partial` to `yes` quickly when an ecosystem extension lands.
- Not a substitute for reading the spec. Use this as a navigation aid, then read the source.

## Defender notes

- A `yes` for authorization (AP2 mandates) does not eliminate misuse risk. Mandates can be over-scoped, refresh tokens can be replayed, and verifiable credentials can be issued by an under-vetted authority. Defenders should pin scopes tightly, log every mandate redemption, and rotate credentials.
- A `partial` for refunds is worse than a clear `no`. Partial coverage means some flows reverse cleanly and some do not — and the fault line is rarely documented. Encode your refund policy in your receipts so the agent and the human both know what is reversible.

[^acp]: Spec hub — <https://www.agenticcommerce.dev/>; reference repo — <https://github.com/agenticcommerce/agentic-commerce-protocol>.
[^ap2]: AP2 announcement and spec — <https://github.com/google-agentic-commerce/AP2>; partner list at launch (Sept 2025).
[^ucp]: Universal Commerce Protocol — Google + Shopify announcement (2025); see Shopify storefront MCP integration docs.
[^mpp]: Machine Payments Protocol — Tempo + Stripe spec; early-stage as of April 2026.
[^x402]: x402 spec — <https://www.x402.org/>; Coinbase x402 documentation; Stripe x402 integration on Base announcement.
[^l402]: L402 spec — <https://docs.lightning.engineering/the-lightning-network/l402>; Fewsats developer toolkit.
[^mcp]: Model Context Protocol — <https://modelcontextprotocol.io>; Anthropic spec repository.
[^acp-checkout]: ACP defines checkout-session creation, line items, totals, taxes, shipping, finalize, and capture endpoints — see ACP spec, "Checkout" section.
[^ap2-checkout]: AP2 defines mandate redemption against payment rails but leaves cart construction to the merchant or to a paired commerce protocol.
[^ucp-checkout]: UCP focuses on storefront discovery and intent; checkout exchange is delegated to ACP or merchant-defined flows.
[^mpp-checkout]: MPP targets machine-to-machine settlement primitives; consumer-grade checkout (cart, taxes, shipping) is not in scope.
[^x402-checkout]: x402 is a payment-rail protocol; cart and order semantics are not part of the spec — the buyer agent and the seller endpoint negotiate price out-of-band or via headers.
[^l402-checkout]: L402 is access-control + payment via macaroons; no cart model.
[^mcp-scope]: MCP is a context-and-tools protocol for connecting models to data and capabilities. It is deliberately not a commerce, payment, or settlement protocol.
[^acp-auth]: ACP scopes a Shared Payment Token to one merchant and one cart — narrow authorization, single use; broader mandate semantics are not in scope.
[^ap2-mandate]: AP2's core primitive is the mandate — a scoped, signed, optionally recurring authorization with verifiable digital credentials.
[^ucp-auth]: UCP defers authorization to a paired protocol (ACP, AP2) or to merchant policy.
[^mpp-auth]: MPP includes machine-identity primitives but a rich mandate model is not in the public draft as of April 2026.
[^x402-auth]: Authorization is at the wallet/key layer, not the protocol layer; x402 does not define mandates.
[^l402-auth]: L402 macaroons can encode caveats (expiry, scope) but are typically per-resource; broader authorization graphs are merchant-defined.
[^acp-agent]: ACP includes agent identity headers but the verifiable-credential model is light compared to AP2.
[^ap2-vc]: AP2 uses verifiable digital credentials for the agent principal — see AP2 spec, "Identity" section.
[^ucp-agent]: UCP does not define an agent identity model.
[^mpp-agent]: MPP early drafts include machine identity but the verifiable-credential model is not finalized.
[^x402-agent]: x402 inherits identity from the wallet signing the on-chain transfer; richer agent-principal identity is out of scope.
[^l402-agent]: L402 macaroons are bearer tokens; identity binding is up to the issuer.
[^mcp-agent]: MCP defines server- and client-identity primitives in its auth profiles but does not define a commerce-grade agent principal.
[^acp-recurring]: ACP carts are single-use; recurring purchases require a separate authorization layer.
[^ucp-recurring]: UCP does not define recurring purchases.
[^mpp-recurring]: MPP draft mentions repeatable machine settlement but the recurrence model is not standardized.
[^x402-recurring]: x402 is per-request — the buyer agent re-authorizes each call.
[^l402-recurring]: L402 is per-resource; recurring access is implementation-defined.
[^acp-refund]: ACP standardizes the post-completion notification of a refund initiated by the merchant in its processor; the chargeback model is the processor's, not ACP's.
[^ap2-refund]: AP2 mandates can express reversibility constraints but the refund execution path is rail-dependent.
[^ucp-refund]: UCP does not address refunds.
[^mpp-refund]: MPP does not address refunds in its current draft.
[^x402-refund]: A USDC transfer over x402 is final on-chain; refunds are merchant-initiated reverse transfers.
[^l402-refund]: A Lightning payment is final once the HTLC settles; refunds are merchant-initiated reverse payments.
[^acp-card]: In production, ACP carts capture against card processors (Stripe and compatible); the spec is processor-aligned.
[^ap2-rails]: AP2 is rail-agnostic by design — see the AP2 + x402 extension for stablecoin redemption.
[^ucp-settle]: UCP is a discovery and intent layer; it does not move money.
[^mpp-settle]: MPP targets machine-to-machine settlement primitives.
[^x402-settle]: x402 settles in stablecoins (predominantly USDC) on EVM chains, with Base as the most common deployment.
[^l402-settle]: L402 settles in BTC over Lightning.
[^acp-juris]: ACP merchant feeds carry tax and shipping fields; deeper SKU-level jurisdictional metadata (KYC class, monetary-instrument flag) is merchant-defined.
[^ap2-juris]: AP2 mandates do not encode product-level jurisdictional metadata.
[^ucp-juris]: UCP storefront discovery includes locale and currency hints but not full jurisdictional rule sets.
[^mpp-juris]: MPP machine-to-machine flows do not encode jurisdictional metadata.
[^x402-juris]: x402 transfers carry no jurisdictional metadata at the protocol layer.
[^l402-juris]: L402 macaroons can encode caveats but jurisdiction is rarely modeled.
[^mcp-juris]: An MCP server can expose jurisdictional metadata as a tool result, but the protocol does not standardize the schema.
[^acp-dispute]: ACP inherits the dispute model of the underlying card processor; the protocol does not define a dispute API.
[^ap2-dispute]: AP2 mandates can include reversibility hints; concrete dispute resolution depends on the rail.
[^x402-dispute]: An on-chain stablecoin transfer is final; there is no chargeback. Merchant-initiated reversal is the only dispute mechanism.
[^l402-dispute]: A settled Lightning payment is final; there is no chargeback.
