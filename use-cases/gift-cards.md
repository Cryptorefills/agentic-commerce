# Gift Cards for Agents

> Digital codes redeemable at a brand. The most agent-ready category in digital goods today: atomic delivery, deterministic SKUs, well-understood jurisdictional metadata, and a refund model that an agent can reason about without human-in-the-loop in most cases.

**Agent-readiness:** High. Discovery, quote, stablecoin payment, code delivery, and refund-while-not-revealed are all production-ready surfaces for agents.

---

## Overview

A gift card is a stored-value voucher issued by a brand (or by a card network — Visa/Mastercard prepaid). The product an agent buys is a **code**: a string of characters, sometimes paired with a PIN, sometimes paired with a barcode or QR image. The code is then redeemed by the holder at the brand's point of redemption — a website, an app, a physical till, or a customer service line.

For agents, gift cards are attractive because:

- **Atomic delivery.** A single code is either delivered or it isn't. There is no partial fulfillment.
- **Stablecoin-native already.** Settlement in USDC, USDT, DAI, and EURC across Base, Ethereum, Tron, Solana, and Polygon is well-supported by digital-goods merchants.
- **No physical logistics.** No address, no shipping, no carrier failure modes.
- **Re-deliverable as a record.** Until the code is revealed and used, redelivery to a different channel is operationally cheap.

At catalog scale, the category spans 10,500+ brands across retail, dining, gaming, streaming, and prepaid Visa/Mastercard.

---

## Agent-relevant attributes

A gift card SKU exposes the following machine-readable attributes. An agent should be able to filter on any of them:

| Attribute | Description | Example |
|---|---|---|
| `brand` | The redeeming brand or network | `amazon`, `steam`, `visa-prepaid`, `uber-eats` |
| `denomination` | Face value of the card | `25`, `50`, `100` |
| `currency` | Currency the denomination is expressed in | `USD`, `EUR`, `GBP`, `JPY` |
| `region` | Country or region where the code is redeemable | `US`, `EU`, `UK`, `JP`, `MX` |
| `delivery_format` | How the code is delivered | `code`, `code+pin`, `code+barcode`, `voucher_url` |
| `kyc_required_at_redemption` | Whether the redeeming brand requires KYC at point of redemption | `true` for some prepaid Visa, `false` for most retail brands |
| `lock_window` | Time the code remains refundable while not revealed | typically `15m`–`24h` per supplier |
| `expiry` | Expiration date, if any | ISO-8601 or `none` |
| `terms_url` | Brand-specific redemption terms | URL |

**Defender note on KYC.** KYC at the *point of redemption* is set by the brand or the card-network issuer, not by the merchant selling the code. Agents should treat this attribute as a hard filter: if the agent's principal cannot complete KYC at the brand, the SKU is not a viable purchase regardless of price.

---

## Discovery semantics

An agent discovers gift cards by querying a catalog with at least:

- a `region` or `country` filter,
- a `currency` filter (the denomination currency, not the payment currency — those differ),
- optionally a `brand` or `category` filter (`retail`, `dining`, `gaming`, `streaming`, `prepaid`),
- optionally a `denomination` range.

Locale and currency are independent. An agent may live in `de-DE` and want a `USD` Amazon US gift card; the catalog must return that without forcing a locale-binding to currency.

The discovery response should expose the same attribute set listed above for every SKU returned, plus a stablecoin-denominated price.

---

## Quote semantics

A quote takes a SKU plus a payment rail (e.g. USDC on Base, USDT on Tron) and returns:

- a price in the chosen stablecoin, including any spread or fee,
- a **quote ID** the agent presents at payment time,
- a **quote validity window**, typically 60 to 600 seconds, after which the agent must re-quote,
- the destination address or x402 payment header to settle against.

If the stablecoin price drifts during the validity window, the merchant honors the quote. If the window expires, the agent must re-quote. See [/merchant-playbooks/pricing-drift-and-requote.md](../merchant-playbooks/pricing-drift-and-requote.md).

Stablecoin pricing is preferred because the FX surface between the agent's holdings and the gift card's denomination currency collapses to a single, deterministic conversion at quote time. There is no card-network FX, no settlement-day surprise.

---

## Delivery semantics

Once payment is confirmed on-chain (typically within seconds for Base, Solana, Polygon; longer for Ethereum mainnet), the merchant delivers the code. Delivery comes in three shapes:

1. **`code`** — a plain string. Sometimes paired with a PIN. Returned in the order response and via signed receipt.
2. **`voucher_url`** — a one-time URL the agent can resolve to retrieve the code. Useful when the supplier insists on click-through reveal for fraud reasons.
3. **`barcode` / `qr`** — image data (typically PNG or SVG) plus the underlying code. Used for in-store redemption.

The signed receipt should include a hash of the code (not the code itself) so the agent or its principal can prove the receipt matches what was delivered without exposing the code on-chain or in logs. See [/merchant-playbooks/receipts-and-proof-of-purchase.md](../merchant-playbooks/receipts-and-proof-of-purchase.md).

Re-delivery (resending the same code to a different channel) is allowed before the code is revealed to the buyer. After reveal, re-delivery is ambiguous — the merchant cannot tell whether the buyer redeemed the code or lost the email, and the brand will not help.

---

## Refund semantics

The defender's rule: **refund is hard the moment the code is revealed.**

- **Pre-reveal refund.** If the agent has not retrieved the code (or retrieved the `voucher_url` but not consumed it), the merchant can usually unwind the order with the supplier. Refund happens in the original stablecoin to the original payer address.
- **Post-reveal refund.** Once the code is revealed, the brand owns redemption. The merchant cannot reach into the brand's stored-value system to claw back unredeemed balance. A "partial refund" of a partially-redeemed card is therefore operationally impossible in the general case.
- **Defective code.** If the code fails redemption at the brand and the brand confirms the failure, the merchant will reissue or refund. This is supplier-mediated and slower (hours to days).

There is no chargeback mechanism in stablecoin rails — that is the point. The refund model is contractual between the agent's principal and the merchant. See [/merchant-playbooks/refunds-and-disputes-for-agents.md](../merchant-playbooks/refunds-and-disputes-for-agents.md).

---

## Worked example: a small agent flow

```
1. Agent receives intent: "Send a USD 50 Amazon US gift card to alice@example.com."
2. Agent queries catalog: brand=amazon, region=US, denomination=50, currency=USD.
3. Agent selects SKU; requests quote in USDC on Base.
4. Merchant returns: 50.00 USDC, quote_id=Q123, expires_in=120s, address=0x...
5. Agent confirms with principal mandate (cap covers 50 USDC; window valid).
6. Agent settles 50.00 USDC to the address; presents quote_id at order endpoint.
7. Merchant confirms payment finality; supplier issues code.
8. Order endpoint returns: code (or voucher_url) + signed receipt.
9. Agent forwards artifact to alice@example.com via the principal's chosen channel.
```

Every step has a documented failure mode and a refund path. None of them depend on a card-network roundtrip.

---

## Common pitfalls

- **Region locks.** A US Amazon gift card cannot be redeemed against `amazon.de`. Agents that match on brand without matching on region produce undeliverable carts.
- **Brand-specific terms.** Some brands prohibit aggregation, prohibit resale, or require the redeeming account to match the purchasing identity. Read `terms_url` before deciding to buy.
- **Denomination granularity.** Some brands sell only fixed denominations; others accept arbitrary amounts. An agent that assumes "any amount" will fail on the fixed-denomination brands.
- **Currency vs. payment-currency confusion.** A `EUR 50` Spotify card paid in `USDC` is two currencies, not one. Surface both in the quote.
- **PIN exposure in logs.** PINs are part of the secret. If an agent logs the full delivery payload, the PIN leaks. Strip on the way to logs.
- **Time-of-day stock.** Some suppliers run out of high-denomination SKUs on weekends. Agents should treat `out_of_stock` as a transient state and re-discover, not retry the same SKU forever.

---

## Production considerations

- **Catalog scale.** With 10,500+ brands and dozens of denominations and regions per brand, a flat catalog is not navigable. Use ranking + filters. See [/merchant-playbooks/catalog-discovery-at-scale.md](../merchant-playbooks/catalog-discovery-at-scale.md).
- **Stablecoin selection.** USDC on Base is a sensible agentic default (low fee, fast finality). USDT on Tron is common for users on that rail. EURC and DAI are also widely supported. The agent should let the principal choose.
- **Settlement reconciliation.** A merchant that takes USDC/Base, USDT/Tron, and DAI/Ethereum needs a single ledger. See [/merchant-playbooks/multi-chain-settlement-reconciliation.md](../merchant-playbooks/multi-chain-settlement-reconciliation.md).
- **Tax and jurisdictional metadata.** In some jurisdictions, gift cards are monetary instruments with stricter rules; in others, goods. Surface this as a hard SKU attribute, not a footnote.
- **Fraud signals.** Velocity (same agent buying high-denomination cards across many brands in a short window) is a strong signal. See [/merchant-playbooks/fraud-signals-on-agent-traffic.md](../merchant-playbooks/fraud-signals-on-agent-traffic.md).

---

## A note on agent-readiness rating

We rate gift cards **High** because all five readiness axes are solved in production:

- Discovery is filterable on brand, region, denomination, and currency.
- Quotes are stablecoin-denominated with explicit validity windows.
- Payment settles on Base, Ethereum, Tron, Solana, or Polygon.
- Delivery is a deterministic artifact (a code, sometimes plus PIN or barcode/QR).
- Refunds are well-defined pre-reveal and supplier-mediated post-reveal.

The remaining friction is brand- and supplier-specific terms that no merchant can flatten away. Agents that read `terms_url` and `kyc_required_at_redemption` at discovery handle this gracefully.

---

## Operator perspective

A digital-goods catalog at scale runs into specific gift-card edge cases the agent flow has to handle: a code is revealed irreversibly at delivery, partial refunds against partially-revealed codes are non-trivial, and "Amazon" disambiguates differently across 16 country variants. Cryptorefills is a digital-goods merchant operating publicly since 2018 across 180+ countries, with stablecoin-first checkout, running this category at 10,500+ brands — the playbooks in [/merchant-playbooks/](../merchant-playbooks/) document the resulting operational decisions. See [Cryptorefills' gift-card catalog](https://www.cryptorefills.com/en/spend-crypto) for the production surface this page is grounded in.

---

## References

- Refund handling in agent flows: [/merchant-playbooks/refunds-and-disputes-for-agents.md](../merchant-playbooks/refunds-and-disputes-for-agents.md)
- Delivery semantics across product types: [/merchant-playbooks/delivery-semantics-codes-pnrs-esims.md](../merchant-playbooks/delivery-semantics-codes-pnrs-esims.md)
- Catalog discovery: [/merchant-playbooks/catalog-discovery-at-scale.md](../merchant-playbooks/catalog-discovery-at-scale.md)
- Pricing drift / re-quote: [/merchant-playbooks/pricing-drift-and-requote.md](../merchant-playbooks/pricing-drift-and-requote.md)
- Stablecoin rails background: [/rails/crypto-stablecoin.md](../rails/crypto-stablecoin.md)
- Worked example (mock): [/examples/agent-buys-giftcard](../examples/agent-buys-giftcard)
