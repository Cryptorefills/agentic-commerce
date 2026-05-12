# Glossary

This is the canonical glossary for the agentic commerce stack as it ships in 2026. One-line definitions, alphabetical, defender-framed for security terms. Where a term has a maintaining organization, the link points to that organization's primary documentation. Where a term has multiple competing definitions, the entry takes the one used by production merchants who actually settle stablecoin payments.

## A

### A2A — Agent-to-Agent Protocol

Open spec from [Google](https://a2a-protocol.org/latest/) for one agent to discover, authenticate, and transact with another agent; the AP2 mandate model layers on top.

### ACP — Agentic Commerce Protocol

Open spec from [OpenAI and Stripe](https://www.agenticcommerce.dev/) standardizing the checkout exchange between an agent and a merchant — product feed, quote, cart, payment, receipt.

### Acquirer

The merchant's bank in a card transaction; receives the authorization request from the merchant and forwards it to the [card network](https://corporate.visa.com/en/products/intelligent-commerce.html) for routing to the issuer.

### Agent identity

A cryptographic identifier (typically a public key, sometimes wrapped in a [verifiable credential](https://www.w3.org/TR/vc-data-model-2.0/)) that lets a merchant tell which agent is acting and on whose behalf.

### Agent Skills

Spec from [Anthropic](https://claude.com/blog/skills) (and [agentskills.io](https://agentskills.io)) describing how an agent loads task-specific instructions, tools, and resources at runtime; adopted by Claude Code, Cursor, and others.

### Agentic token

A network-issued payment credential that carries agent context (agent identity, mandate scope, intent hash) alongside the card number; see [Visa TAP](https://corporate.visa.com/en/products/intelligent-commerce.html), [Mastercard Agent Pay](https://newsroom.mastercard.com/news/press/2025/april/mastercard-unveils-agent-pay-pioneering-agentic-payments-technology-to-power-commerce-in-the-age-of-ai/), and Amex agentic tokens.

### AP2 — Agent Payments Protocol

Open spec from [Google and 60+ partners](https://github.com/google-agentic-commerce/AP2) for payment-agnostic agent transactions, built on verifiable digital credentials (VDCs) and signed mandates.

### Attestation

A signed statement that some property holds — for example, that an agent is running a known model version, that a wallet has passed KYC, or that a settlement happened. The defender uses attestations as evidence in disputes.

### Attestation chain

A linked sequence of attestations from user → agent → merchant → settlement, each signed by the next party in the flow; used to reconstruct authority after the fact.

### Authorization

A pre-settlement hold by an issuer or wallet promising that funds are available; in card networks this is reversed by a void or completed by a capture.

## B

### Base

A Layer 2 EVM rollup operated by Coinbase, the default chain for [x402](https://www.x402.org/) USDC stablecoin payments in 2026; settles to Ethereum.

### Buyer-loop

The client-side x402 pattern: hit the resource, receive HTTP 402 with payment requirements, sign a payment payload, retry; documented in the [x402 spec](https://github.com/coinbase/x402).

## C

### Capture

Converting an authorization into an actual settlement debit; in card networks this is the second leg, in stablecoin rails it is typically a single atomic step.

### Card network

Visa, Mastercard, American Express, Discover, JCB, UnionPay; the routing fabric that sits between issuer and acquirer.

### Chargeback

A reversal initiated by the issuer at the cardholder's request, governed by [card-network rules](https://www.visa.com/en-us/personal/security.html); has no native equivalent in stablecoin rails.

### CVV / CVC

The 3-4 digit verification code on a card; not stored by PCI-compliant merchants, generally not present in agentic-token flows.

## D

### DAI

Decentralized stablecoin issued by [MakerDAO / Sky](https://docs.sky.money/), collateralized on-chain; supported as a settlement asset alongside USDC, USDT, EURC.

### Decimals

The integer scale factor an [ERC-20 token](https://eips.ethereum.org/EIPS/eip-20) uses to represent fractional units; USDC and USDT use 6 decimals on most chains, DAI uses 18. **Defender note:** never assume; always read `decimals()` on-chain or risk a 10^12× off-by-many bug.

### Dispute

The post-settlement disagreement process; in card networks it is the chargeback flow, in stablecoin rails it is whatever the merchant and counterparty contract for off-chain.

## E

### EIP-712

[Ethereum standard](https://eips.ethereum.org/EIPS/eip-712) for typed structured-data signatures; used by AP2 mandates, x402 payment payloads, and most signed-message commerce flows on EVM.

### EMV

Chip-card standard governed by [EMVCo](https://www.emvco.com/); relevant to agentic commerce because EMV tokens are the substrate for Visa TAP and Mastercard Agent Pay.

### ERC-4337

[Ethereum standard](https://eips.ethereum.org/EIPS/eip-4337) for account abstraction; lets agents transact without holding gas, enables paymasters and per-transaction policies.

### eSIM

Embedded SIM profile delivered as a QR code or activation URL; a digital good with device-compatibility, country-of-issuance, and reissue semantics no commerce protocol covers.

### EURC

Euro-denominated stablecoin issued by [Circle](https://www.circle.com/eurc); used for EUR-quoted agent payments where USDC pricing would introduce FX risk.

## F

### Finality

The point at which a transaction is irreversible on its settlement rail; on Base it is ~2 seconds soft, ~13 minutes to Ethereum hard finality, on Tron it is ~3 minutes, on Solana it is ~13 seconds. Merchants design refund and reconciliation around finality, not block time.

## G

### Gas

The fee paid to a blockchain validator to include a transaction; on Base typically a fraction of a cent, on Ethereum L1 it can dominate small payments.

### Gas abstraction

Using a paymaster or relayer (often via [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)) so the user's wallet doesn't need to hold the chain's native gas token; load-bearing for stablecoin-only agent UX.

## I

### Idempotency key

A client-supplied identifier that lets the merchant safely retry a request without double-charging; standard in [Stripe](https://docs.stripe.com/api/idempotent_requests), required in any agent loop where retries are automatic.

### Intent

A user or agent's stated goal — "buy a USD 50 Amazon US gift card for under USD 51" — separable from the transaction that fulfills it; central to AP2's [intent mandate](https://google-agentic-commerce.github.io/AP2/) model.

### Intent token

A signed credential expressing an intent and its constraints (amount cap, time window, merchant scope); the AP2 mandate is an intent token.

### Issuer

The cardholder's bank; underwrites the card, authorizes purchases, and is the counterparty in chargebacks.

### ITV

Interactive Television; a legacy term sometimes still in card-not-present scheme rules. Mostly irrelevant to agentic commerce.

## K

### KYB — Know Your Business

Onboarding diligence applied to a business counterparty; required before a merchant can settle to a corporate wallet at most regulated stablecoin off-ramps.

### KYC — Know Your Customer

Identity verification on the buyer; for digital goods it is product-conditional — gift cards typically do not require it, mobile top-ups in some jurisdictions do.

## L

### L402

[Lightning Labs](https://docs.lightning.engineering/the-lightning-network/l402) protocol pairing HTTP 402 with Lightning macaroons; descends from LSAT, used for Lightning-native pay-per-call APIs.

### Lightning Network

Bitcoin Layer 2 payment channel network; the primary rail for sub-cent BTC-denominated micropayments and the substrate L402 sits on. See [Lightning Labs](https://lightning.engineering/).

### LSAT

Lightning Service Authentication Token; the original Lightning + macaroon design, now generalized as L402.

## M

### Macaroon

A bearer credential format with delegated, attenuating capabilities; introduced by [Google research](https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/), used by Lightning's L402 to encode payment + authorization.

### Mandate

A signed authorization from a user (or upstream agent) to a downstream agent allowing transactions within a specified scope; AP2's [core primitive](https://github.com/google-agentic-commerce/AP2).

### MCP — Model Context Protocol

Open spec from [Anthropic](https://modelcontextprotocol.io/) and the broader ecosystem (Stripe, Cloudflare, Shopify) for connecting agents to tools, resources, and prompts; the dominant agent-context standard in 2026.

### Merchant of Record

The legal seller in a transaction — handles tax, returns, and chargebacks; for some agent flows this is the platform (Shopify, Stripe), for Cryptorefills it is Cryptorefills.

### Merchant operations layer

The surface of agentic commerce that protocols leave to merchants: catalog, quote, pay, deliver, refund, reconcile. Where ACP / AP2 / x402 / MCP standardize the wire protocol, the merchant operations layer is everything that has to be built on top to actually transact — SKU eligibility per jurisdiction, dynamic pricing and re-quote, multi-rail settlement reconciliation, refund semantics for irreversible rails, fraud signals on agent traffic, signed receipts. See [/docs/merchant-operations-layer.md](./merchant-operations-layer.md) for the canonical page and [/merchant-playbooks/](../merchant-playbooks/) for the operational patterns.

### MPP — Machine Payments Protocol

Spec from [Tempo and Stripe](https://tempo.xyz/) for machine-to-machine settlement primitives.

### MSISDN

Mobile Station International Subscriber Directory Number — the international phone number identifier; mobile top-ups are validated against MSISDN format and operator lookups before charging.

### Multi-sig

A wallet that requires N-of-M signatures to authorize a transaction; common for merchant treasury, used to gate large stablecoin movements.

## O

### Off-ramp

A regulated service that converts crypto to fiat in a bank account; subject to KYB, jurisdictional, and travel-rule constraints.

### On-ramp

The inverse — fiat to crypto.

## P

### Paymaster

A contract (typically an [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) component) that pays gas on behalf of users so they can transact in stablecoins without holding the chain's native asset.

### PNR — Passenger Name Record

The airline reservation record; the unit of fulfillment for a flight purchase, governed by GDS and IATA rules. Refund and change semantics live on the PNR, not the payment.

### PSP — Payment Service Provider

A processor that abstracts card-network or rail integration for the merchant; Stripe, Adyen, Checkout.com.

## R

### Refund

A merchant-initiated reversal; in cards it is a separate clearing message, in stablecoin rails it is a new transfer back to the original sender wallet.

## S

### Scope

The set of constraints attached to an agent's authorization — which merchants, which amounts, which categories, which time window. Defender framing: scope is the primary control surface for agent fraud.

### Settlement

The actual movement of value from buyer to merchant; distinct from authorization. In stablecoin flows authorization and settlement collapse into one on-chain transfer.

### SPT — Shared Payment Token

A vendor-specific token format; check the maintainer's spec before assuming semantics — the term is overloaded.

### Stablecoin

A token whose value tracks a reference asset, typically USD or EUR; **the agent-native default for production agentic commerce in 2026.** USDC and USDT are the dominant USD stablecoins, EURC the dominant EUR.

## T

### TAP — Trusted Agent Protocol

[Visa's spec](https://corporate.visa.com/en/products/intelligent-commerce.html) for agentic card transactions, embedding agent identity and intent metadata into the EMV token flow.

## U

### UCP — Universal Commerce Protocol

Spec from [Google and Shopify](https://github.com/google-agentic-commerce) for storefront discovery and intent at agent scale.

### USDC

[Circle](https://www.circle.com/usdc)-issued USD stablecoin; the default settlement asset for x402 in 2026, available on Base, Ethereum, Solana, Polygon, and others.

### USDT

[Tether](https://tether.to/)-issued USD stablecoin; the dominant volume asset on Tron and Ethereum, widely used in regions where USDC distribution is thinner.

## V

### Void

A cancellation of an authorization before capture; not applicable to atomic stablecoin transfers, which complete on inclusion.

## X

### x402

[Coinbase](https://www.x402.org/) and [x402 Foundation](https://github.com/x402)-led HTTP-native stablecoin payment protocol; reuses HTTP status code 402 ("Payment Required") to signal payment requirements and accept signed payment payloads in a single round trip after the initial challenge.
