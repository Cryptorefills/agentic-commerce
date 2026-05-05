# Jurisdiction and Tax Metadata

## Problem

A digital-goods catalog that looks uniform from a code path is wildly non-uniform from a regulatory perspective. The same gift-card brand is a *good* in one country and a *monetary instrument* in another, with VAT, AML, and consumer-protection consequences that differ accordingly. Mobile top-ups are KYC-required in some jurisdictions and walk-up-anonymous in others. eSIMs cross borders by default and can fall foul of country-specific telecom regulation. Travel SKUs trigger consumer-protection rules (24-hour cancellation, mandatory disclosure) that vary by departure country. Crypto settlement adds the FATF travel rule and OFAC screening. An agent quoting a SKU at checkout has none of this context unless the merchant attaches it explicitly. The protocols treat the catalog as an opaque list of products; reality treats every line item as a regulatory object. This page is the merchant defender's reference for encoding jurisdictional and tax metadata at the SKU level so that the agent, the merchant's quote engine, and the merchant's compliance workflow all see the same truth.

## Why protocols don't cover this

ACP, AP2, UCP, and MPP define the *transaction shape* — agent intent, merchant offer, authorization, settlement. They do not address whether a particular product is legal to sell to a particular agent on behalf of a particular user in a particular country. That work belongs to the merchant because it is jurisdiction-specific, supplier-specific, and changes faster than any protocol revision cycle. The specs leave a hook: free-form metadata fields that the merchant must populate with structured data the agent can act on. Without the merchant doing this work, the agent will quote, the user will pay, and the order will fail at fulfillment — or worse, succeed when it should not have.

## Approach

Treat jurisdiction and tax as **structured SKU metadata**, not a footer in product copy. Filter at quote time, not at checkout. Refuse to quote rather than refund.

### SKU-level metadata fields

Every SKU carries a metadata block that the quote engine evaluates against the requesting context (user country, agent operator, settlement asset, mandate scope). The block has five sections:

1. **Country availability.** Allow-list or deny-list of ISO 3166-1 alpha-2 country codes. Drives the basic gating decision.
2. **Regulatory class.** What this product *is* under regulation: digital good, monetary instrument, prepaid access, telecom service, travel service, financial product. Drives which downstream rules apply.
3. **KYC requirement.** None / lightweight / full, with a link to the supported verification flow. Some products are KYC-required only above a threshold.
4. **Tax treatment.** VAT/GST/sales-tax behavior — taxable, exempt, reverse-charge, jurisdiction-of-supply rules. Drives invoice generation and revenue reporting.
5. **Consumer-protection windows.** Cancellation rights, mandatory disclosures, cooling-off periods. Drives refund SLA (see refunds playbook).

### Merchant filters at quote time

The agent submits a quote request with country, currency preference, settlement chain, and (where available) an end-user attestation. The merchant's quote engine runs the request through:

- Country availability filter
- Sanctions / OFAC screening on the destination address and end-user assertion
- KYC requirement check against the user attestation level
- Cross-border eligibility (some products cannot be sold to a buyer outside the issuing country)
- Asset/chain-jurisdiction compatibility (some jurisdictions restrict stablecoin acceptance)
- Tax-applicable jurisdiction determination

A SKU that fails any check is **not quoted** — return a typed denial reason, not a silent omission, so the agent can route to alternatives.

### Worked example — cross-border gift card

An agent serving a user in Germany requests a quote for an Amazon.com gift card (US-redeemable). The quote engine evaluates: `sellableTo` includes DE; `redeemableIn` is US-only; the user attestation level is `kyc-light` and the order is below the $1,000 KYC-light threshold. EU consumer-protection rules apply for the buyer side; US tax treatment applies for the redeem side. The quote is issued with the EU disclosures localized into German, the receipt records both jurisdictions, and the refund window honors the stricter EU cooling-off rule.

### Worked example — denied mobile top-up

An agent requests a top-up to a Russian carrier. The destination MSISDN resolves to a sanctioned country code. The deny-list match is the dominant rule; the order is rejected with `denied: jurisdiction_sanctioned`. The agent receives a typed denial reason and may surface alternatives to the user. No quote is issued; no settlement is attempted. The decision is logged for compliance review with the full request envelope.

### Encoding cross-border purchase rules

Cross-border purchases are common and rule-heavy. A user in Country A buying a gift card redeemable only in Country B raises questions:

- Is the merchant licensed to sell into Country A?
- Is the product legal to *use* in Country A even if it is legal to *sell*?
- Does the destination jurisdiction's tax apply, the source jurisdiction's, or both?

Encode `redeemableIn`, `sellableTo`, and `taxJurisdiction` as separate fields. Do not collapse them.

### Sanctions and travel-rule integration

Above per-jurisdiction thresholds, FATF travel-rule data must be attached to the settlement leg. This is not optional and not negotiable per SKU; encode the threshold per settlement asset and chain, and have the quote engine refuse to quote if the agent has not provided the required originator/beneficiary fields. OFAC, EU, UK, and UN sanctions lists must be screened on:

- The buyer's user attestation (where available).
- The on-chain payer address (use the addresses-of-interest feeds from Chainalysis / TRM / Elliptic — see [fraud signals](./fraud-signals-on-agent-traffic.md)).
- The recipient identity for products with a delivery address (gift-card recipient email, top-up MSISDN, eSIM activation country).

Sanctions failures are hard denies and never overridden by softer rules.

### Jurisdiction conflict resolution

When the rules of two relevant jurisdictions conflict, define an explicit precedence at the SKU level. The default precedence:

1. Hard prohibitions (sanctions, sale bans) override everything.
2. Stricter consumer-protection rule wins.
3. Stricter KYC rule wins.
4. Tax-of-supply jurisdiction governs invoicing unless an explicit reverse-charge applies.

Document the chosen precedence in metadata and in the merchant's customer-facing terms so the agent and the human can audit.

## Schema sketch

```json
{
  "skuId": "giftcard-amazon-us-50",
  "title": "Amazon.com Gift Card — USD 50",
  "regulatoryClass": "monetary_instrument",
  "redeemableIn": ["US"],
  "sellableTo": [
    "US", "CA", "MX", "GB", "DE", "FR", "IT", "ES", "BR", "JP"
  ],
  "deniedTo": ["IR", "KP", "SY", "CU"],
  "kycRequirement": {
    "level": "lightweight_above_threshold",
    "thresholdUsd": 1000,
    "verificationFlow": "kyc-light-v3"
  },
  "tax": {
    "treatment": "exempt_monetary_instrument_in_redeem_jurisdiction",
    "supplyJurisdiction": "US",
    "vatGstApplies": false,
    "invoiceRequired": true
  },
  "consumerProtection": {
    "coolingOffHours": 0,
    "mandatoryDisclosures": ["expiry_policy", "redemption_terms"],
    "refundability": "void_only_pre_reveal"
  },
  "settlementAssets": ["USDC", "USDT"],
  "settlementChains": ["base", "ethereum", "tron", "solana", "polygon"],
  "fatfTravelRule": {
    "appliesAboveUsd": 1000,
    "fields": ["originator_name", "originator_address", "beneficiary"]
  }
}
```

The metadata is per-SKU, not per-brand. Two denominations of the same gift card may have different KYC thresholds; an eSIM for Country A and Country B from the same supplier may have different consumer-protection windows.

### Operational discipline

- **Source of truth.** Metadata lives in a versioned catalog system. Changes are reviewed, not silently pushed.
- **Effective dates.** Every metadata field has an `effectiveFrom` and (optionally) an `effectiveUntil`. Quote-time evaluation uses the active version at the moment of quote.
- **Override register.** Any per-order override is logged with operator identity and reason; overrides are reviewed quarterly.
- **Regulatory monitoring.** Subscribe to OFAC, EU sanctions, FATF, and country-specific telecom and gift-card regulator feeds. Treat the metadata refresh as part of compliance ops, not catalog ops.

## Edge cases

- **Cross-border purchase.** Buyer is in EU, gift card is redeemable only in US. Allow if `sellableTo` includes the buyer's country and the product is not contraband in either jurisdiction. Apply the stricter consumer-protection regime.
- **Jurisdiction conflicts.** Mobile top-up to a country where prepaid SIMs require KYC, but the agent presents a user from a country with no such requirement. The destination governs — KYC required.
- **Sanctioned jurisdictions.** The buyer's country is fine, but the *destination* of the product is sanctioned (e.g., a top-up to a phone number in a sanctioned country). Deny based on the destination, not the buyer.
- **Tax determination ambiguity.** A digital subscription consumed by a user nominally in one country but on infrastructure in another. Default to the user's billing country; document the rule.
- **Regulatory class change.** A product reclassified mid-flight (e.g., a new EU directive moves a category from "digital good" to "monetary instrument"). Pull the SKU from the catalog until the metadata is updated; do not let the quote engine emit stale rules.
- **Agent acting across users from many countries.** A single agent operator serving users globally. Country must be derived per-quote from the user attestation, not from the agent's home country.
- **Mandatory disclosure language localization.** Some jurisdictions require disclosures in the local language. Either localize or refuse to sell into that jurisdiction.
- **Travel SKU departure-country rules.** A flight from one EU member state to another carries EU261 protections regardless of where the buyer or agent is — encode by route, not by buyer.

## When to use

- Any merchant with a multi-country digital-goods catalog.
- Any merchant exposing the catalog to AI agents that can serve users across jurisdictions the merchant does not directly know.
- Any catalog mixing regulatory classes (gift cards + telecom + travel + subscriptions) where unified rules do not apply.
- Any settlement leg in stablecoin where FATF travel-rule data must be attached above thresholds.

## When NOT to use

- Single-country, single-class catalogs where one global rule fits the entire surface.
- Pure marketplaces where the underlying merchants own the metadata and the platform passes through.
- Internal-only or test deployments where no real user funds and no real regulation are in scope.

## References

- FATF Recommendation 16 (Travel Rule) — <https://www.fatf-gafi.org/en/topics/fatfrecommendations/r16.html>
- FATF VASP guidance — <https://www.fatf-gafi.org/en/topics/Virtual-assets.html>
- OFAC sanctions search and SDN list — <https://sanctionssearch.ofac.treas.gov/>
- EU consumer rights directive (cooling-off) — <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011L0083>
- EU VAT for digital services (place of supply) — <https://taxation-customs.ec.europa.eu/vat-digital-services_en>
- US FinCEN prepaid access rule — <https://www.fincen.gov/resources/statutes-and-regulations/cfr/31-cfr-chapter-x>
- ITU country code references for telecom and MSISDN — <https://www.itu.int/pub/T-SP-E.164D>
- IATA Resolution 824 / fare rules for travel SKUs — <https://www.iata.org/>
- ISO 3166-1 country codes — <https://www.iso.org/iso-3166-country-codes.html>
