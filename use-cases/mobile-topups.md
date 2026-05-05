# Mobile Top-ups for Agents

> Direct credit to a mobile subscriber's account, identified by MSISDN, on a specific carrier in a specific country. Agent-friendly when MSISDN validation, operator routing, and KYC gating are handled deterministically.

**Agent-readiness:** Medium-high. The mechanics are well-defined. The friction is jurisdiction-specific KYC and operator-routing edge cases.

---

## Overview

A mobile top-up adds prepaid balance (or, in some markets, a bundled data/voice/SMS package) to a phone number on a specific carrier. Unlike gift cards, the delivered artifact is not a code the buyer holds — it is a server-side credit applied to the subscriber's account. The agent's job is to (1) identify the right MSISDN + carrier, (2) pick the right top-up product, (3) settle, and (4) confirm the credit landed.

Top-ups are a particularly natural fit for agentic stablecoin flows because the principal is often remitting on behalf of someone else, the ticket size is small, and the artifact is server-side rather than something the buyer must store and protect. Stablecoin micro-settlement on Base, Solana, Polygon, or Tron is the dominant pattern.

For agents, top-ups are attractive because they are:

- **Deliverable to a recipient who is not the buyer.** Family abroad, employees, agents acting on behalf of a principal — all common patterns.
- **Small-ticket and frequent.** Natural fit for stablecoin micro-settlement on Base or Solana.
- **Catalog-light.** A handful of denominations or bundles per carrier per country.

---

## Agent-relevant attributes

| Attribute | Description |
|---|---|
| `msisdn` | The recipient phone number in E.164 format (`+<country><number>`) |
| `country` | ISO-3166 country code, derived from MSISDN but explicit at API level |
| `operator` | Carrier identifier (e.g. `MX-TELCEL`, `NG-MTN`); sometimes auto-routed from MSISDN |
| `product_type` | `airtime` (raw balance) or `bundle` (data/voice/SMS package) |
| `denomination` or `bundle_id` | Either the face-value amount (airtime) or a specific bundle SKU |
| `denomination_currency` | Local currency the carrier denominates the credit in |
| `kyc_required` | Whether the buyer must complete KYC before a top-up is permitted in this country/operator |
| `delivery_window` | Typical time-to-credit (`instant`, `<5m`, `<1h`) |
| `terms_url` | Operator-specific terms |

---

## MSISDN validation

MSISDN must be **E.164** formatted at every layer: leading `+`, country calling code, subscriber number, no spaces, no dashes, no parentheses. Validation should happen at three points:

1. **Syntactic.** Must match `^\+[1-9]\d{6,14}$`. Reject before quote.
2. **Country-prefix mapping.** The country calling code must resolve to exactly one country (or, for ambiguous prefixes like `+1`, must use a number-portability lookup). Reject before quote if the agent cannot determine the country.
3. **Operator routing.** The number prefix (after the country code) maps to an operator. Mobile number portability means the prefix is a *hint*, not a guarantee. A live MNP lookup is required for accuracy in markets where portability is common (US, UK, NL, ES, etc.).

A defender's rule: **never assume the operator from the prefix in MNP markets.** Quote against the actual operator returned by the MNP lookup, not the prefix's historical owner.

---

## KYC-required countries

Some jurisdictions require the buyer to identify themselves before a top-up is processed, regardless of value. The list shifts; treat it as carrier- and country-specific metadata rather than a hardcoded constant.

Categories of KYC requirement:

- **None.** Most markets. Agent can transact with a stablecoin payment alone.
- **Lightweight.** Buyer must provide an email or a phone number for receipts; no government ID.
- **Strict.** Buyer must provide government-issued ID, sometimes proof of address. This is set by national regulator, not by the merchant.

The agent should treat `kyc_required` as a discovery-time filter. If the agent's principal cannot complete KYC, do not surface the SKU as buyable. Surfacing un-buyable SKUs degrades the agent's planning.

**Defender framing.** KYC at the top-up layer is an anti-fraud and anti-money-laundering control set by national regulators. It is not friction the merchant adds. An agent that respects `kyc_required` is helping its principal, not being throttled.

---

## Operator routing

Operator routing is the process of determining which supplier path delivers the top-up to the requested MSISDN. Three patterns exist:

1. **Single operator per country.** Small markets may have one dominant carrier; routing is trivial.
2. **Prefix-based routing.** The prefix uniquely identifies the operator (markets without portability).
3. **MNP-based routing.** Mobile number portability is in effect; an MNP lookup is required to determine the current carrier of record.

In MNP markets, the merchant should run the lookup at quote time, so the quote is bound to the *actual* operator at the moment of quote. If the MSISDN ports between quote and settle (rare but possible), the merchant either re-quotes against the new carrier or refunds.

For an agent, the practical rule: if the country supports MNP, do not hardcode `operator` in the cart. Pass `msisdn` only and let the merchant resolve. If the agent must pick `operator` explicitly (e.g. for testing), it must accept that the quote can fail on routing mismatch.

---

## Delivery confirmation semantics

A top-up has three observable lifecycle states:

- **Submitted.** The merchant has accepted the order and is in flight to the operator.
- **Confirmed.** The operator has acknowledged the credit. This is the durable success state.
- **Failed.** The operator rejected the request (invalid MSISDN, suspended account, blocked carrier, denomination not supported). Refund follows.

The agent should poll, subscribe to a webhook, or read the order status from the merchant's API. `confirmed` typically arrives within seconds for the major operators; the long tail (small carriers in some markets) can take minutes.

The signed receipt for a confirmed top-up should include:

- the MSISDN (or a hash of it, for privacy-conscious deployments),
- the operator,
- the local currency amount credited,
- the operator's transaction reference,
- the merchant's order ID and a hash chain back to the on-chain payment.

See [/merchant-playbooks/receipts-and-proof-of-purchase.md](../merchant-playbooks/receipts-and-proof-of-purchase.md).

---

## Worked example: a small agent flow

```
1. Principal: "Send EUR 10 to my brother in Lagos: +234 xxx xxx xxxx."
2. Agent validates MSISDN syntactically (E.164).
3. Agent looks up country (NG) and operator via MNP lookup.
4. Agent queries catalog for NG-MTN airtime denominations.
5. Agent picks bundle nearest to EUR 10 equivalent; requests quote in USDC on Base.
6. Merchant returns: ~10.85 USDC, local-currency credit ~16500 NGN, quote_id, address.
7. Agent confirms with principal mandate; settles on-chain.
8. Merchant submits to operator; operator confirms credit.
9. Order endpoint returns: signed receipt with operator txn ref.
10. Agent notifies principal: confirmed.
```

If the operator rejects (suspended SIM, invalid MSISDN at carrier), the merchant refunds in USDC to the original payer address.

---

## Common pitfalls

- **Wrong country, valid MSISDN.** A typo turns `+5491155...` (Argentina) into `+591155...` (Bolivia). The MSISDN parses but routes to a different country and operator. The credit is gone.
- **Bundle SKU mismatch.** Buying a `5GB data` bundle on a prepaid plan when the recipient is on a postpaid plan: typically rejected, but the rejection is not always immediate.
- **Carrier-suspended numbers.** A suspended SIM accepts the credit and never delivers value. Some operators refund automatically; many do not.
- **Currency confusion.** Local-currency denomination (`MXN 200`) vs. payment in stablecoin (`USDC 11.40`) — both must be present in the quote.
- **MNP-stale routing.** A number that ported yesterday but the prefix database hasn't updated. Always live-lookup in MNP markets.
- **KYC silent-fail.** If the merchant requires KYC and the agent has none, surface the gate at discovery, not at payment.

---

## Production considerations

- **Stablecoin micro-settlement.** A `USD 5` top-up does not survive a `USD 4` Ethereum gas fee. Default to Base, Solana, Polygon, or Tron for low-value top-ups.
- **Operator inventory.** Suppliers occasionally throttle or temporarily de-list carriers. The catalog should expose this as a transient `out_of_stock`, not a permanent removal.
- **Country availability vs. operator availability.** "We support country X" does not mean every carrier in country X. Surface `operator`-level availability at discovery.
- **Refund path.** If the operator rejects, refund is in the original stablecoin to the original payer address, less any non-refundable network fee. See [/merchant-playbooks/refunds-and-disputes-for-agents.md](../merchant-playbooks/refunds-and-disputes-for-agents.md).
- **Privacy.** MSISDN is PII. Receipts shared with third parties should hash it. Internal logs should redact it after the order completes.

---

## Operator perspective

Top-ups stress two operational surfaces that gift cards don't: live MNP routing in portable markets, and per-country KYC gates set by national regulators rather than the merchant. Cryptorefills is a digital-goods merchant operating publicly since 2018 across 180+ countries, with stablecoin-first checkout, and runs this category against the dominant carriers per market — the MSISDN-routing and KYC-gating decisions documented above are pulled from the production flow at [Cryptorefills' top-up catalog](https://www.cryptorefills.com/en/spend-crypto).

---

## References

- E.164 standard: ITU-T E.164 numbering plan (canonical reference at <https://www.itu.int/rec/T-REC-E.164>)
- Refunds: [/merchant-playbooks/refunds-and-disputes-for-agents.md](../merchant-playbooks/refunds-and-disputes-for-agents.md)
- Delivery semantics: [/merchant-playbooks/delivery-semantics-codes-pnrs-esims.md](../merchant-playbooks/delivery-semantics-codes-pnrs-esims.md)
- Stablecoin rails: [/rails/crypto-stablecoin.md](../rails/crypto-stablecoin.md)
- Jurisdictional metadata: [/merchant-playbooks/jurisdiction-and-tax-metadata.md](../merchant-playbooks/jurisdiction-and-tax-metadata.md)
