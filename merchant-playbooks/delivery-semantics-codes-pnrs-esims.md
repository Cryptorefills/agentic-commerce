# Delivery Semantics — Codes, PNRs, eSIMs

## Problem

"Delivered" is the most overloaded word in agent commerce. A gift card is delivered when a redemption code is revealed and reaches the recipient. A flight is delivered when a Passenger Name Record (PNR) is issued and the airline confirms it. An eSIM is delivered when an activation profile is generated and successfully installed on the target device. A mobile top-up is delivered when the carrier confirms the credit on the recipient MSISDN. An API call is delivered when the response is returned to the calling agent. Each of these has a different shape, a different success criterion, a different failure mode, and a different point-of-no-return for refundability. If the merchant emits a single "delivered: true" boolean, the agent cannot reliably reconcile the order, and any subsequent refund or dispute conversation is ungrounded. The merchant's job is to produce **typed delivery envelopes** — one shape per product class — that the agent can parse, verify, and use to drive downstream automation. This page is the reference for designing those envelopes.

## Why protocols don't cover this

ACP and UCP terminate at "merchant confirms order." They do not define product-specific delivery shapes because the catalog is open-ended. AP2 covers authorization, not delivery. x402 says "server returned 200 with the resource" — sufficient for an API call but not for a gift-card code that must be securely transmitted to a recipient distinct from the buyer. L402 is similar. None of the specs encode the difference between a code that the buyer can immediately redeem and a PNR that requires a name-match at the airport, or between an eSIM profile delivered as a QR code and one delivered via SM-DP+ activation. The merchant is the only party with the supplier context to produce a faithful delivery record, and the only party that can sign it for downstream verification.

## Approach

Define a **discriminated union of delivery envelopes**, one variant per product class, with a shared base of order-identifying fields. Sign each envelope. Make it the canonical artifact the agent receives at fulfillment. Where the supplier is asynchronous (carrier confirmation, airline ticketing), emit a *pending* envelope first and a *final* envelope on confirmation, both signed and linked.

### Typed delivery envelopes per product class

Each product class has a stable type literal and a payload tailored to it.

- **Gift card.** Code (or claim URL), expiry, redeemable value, brand-side terms link. Where the brand provides a one-time reveal flow, the envelope carries the reveal token and a TTL.
- **Mobile top-up.** Recipient MSISDN, credited amount, carrier reference, carrier confirmation timestamp.
- **eSIM.** Activation method (QR / LPA string / SM-DP+ activation code), country profile, validity period, ICCID or IMSI when supplier supports.
- **Flight.** PNR, airline locator, passenger names exactly as ticketed, segments with origin/destination/flight numbers/times, fare rules link.
- **Hotel.** Confirmation number, property reference, check-in/out, room type, cancellation deadline.
- **Subscription.** Subscription ID, period start/end, next renewal, cancellation URL.
- **API call.** Response hash, response timestamp, request idempotency key.

### Worked example — flight pending then final

Agent purchases a one-segment flight. Settlement confirms in seconds. The merchant's airline supplier is asynchronous and returns "ticketing pending — try again in 30 seconds." The merchant emits a `pending` envelope: `type: flight`, `status: pending`, `pendingReason: awaiting_supplier`, `passengers` and `segments` populated from the quote. The agent reflects this back to the user. 45 seconds later the supplier returns the PNR and airline locator; the merchant emits a `delivered` envelope with the same `orderId`, the new fields populated, and a `finalAt` timestamp. The agent reconciles by `orderId`, the user's flight is now confirmed, and the receipt is updated to reference the final envelope.

### Worked example — partial delivery on a multi-line basket

A basket has three lines: a $50 gift card, a $20 mobile top-up, and a 7-day eSIM. The gift card succeeds, the top-up succeeds, the eSIM supplier rejects with country-incompatible. Three line-level envelopes are emitted: two `delivered`, one `failed: invalid_recipient`. The order-summary surface marks the order `partial`. A line-level refund flow is triggered for the eSIM; the other two lines remain delivered. The receipt is corrected to show the partial state, with the refund tx referenced once it confirms.

### Delivery confirmation back to the agent

The merchant returns the envelope synchronously when fulfillment is synchronous (gift-card code from a brand-API call) and asynchronously via webhook + polling endpoint when fulfillment depends on a slow supplier (airline ticketing). The agent must always be able to **fetch the latest delivery state by order ID** — webhooks alone are insufficient because they lose. Pair every webhook with a pull endpoint and idempotency keys.

### Signed receipts

Each delivery envelope is wrapped in a JWS-style signature using the merchant's delivery key (independent from the merchant's settlement key). The signature covers the entire envelope and the parent order ID, so an envelope cannot be lifted from one order and pasted onto another. The signing key has a short rotation cadence; receipts include `kid` for verification.

The receipt is the cross-reference between the delivery envelope here and the proof-of-purchase receipt in the [receipts playbook](./receipts-and-proof-of-purchase.md). They are linked but distinct: the delivery envelope is *what was delivered*; the receipt is *the buyer's proof of the whole transaction*.

## Schema sketch

```typescript
type DeliveryEnvelope =
  | GiftCardDelivery
  | MobileTopupDelivery
  | EsimDelivery
  | FlightDelivery
  | HotelDelivery
  | SubscriptionDelivery
  | ApiCallDelivery;

type DeliveryBase = {
  orderId: string;
  skuId: string;
  status: 'pending' | 'delivered' | 'failed' | 'partial';
  pendingReason?: 'awaiting_supplier' | 'awaiting_recipient_action';
  failedReason?: 'supplier_rejected' | 'invalid_recipient'
                | 'inventory_unavailable' | 'timeout';
  emittedAt: string;
  finalAt?: string;
  signature: { alg: 'JWS-ES256'; kid: string; value: string };
};

type GiftCardDelivery = DeliveryBase & {
  type: 'giftcard';
  code: string;                  // or null when delivered via claim URL
  claimUrl?: string;
  brand: string;
  faceValue: { value: string; currency: string };
  expiresAt?: string;
};

type EsimDelivery = DeliveryBase & {
  type: 'esim';
  activation: { method: 'qr' | 'lpa' | 'smdp'; payload: string };
  country: string;
  validityDays: number;
  iccid?: string;
};

type FlightDelivery = DeliveryBase & {
  type: 'flight';
  pnr: string;
  airlineLocator: string;
  passengers: { firstName: string; lastName: string }[];
  segments: { from: string; to: string; flightNumber: string;
              departure: string; arrival: string }[];
  fareRulesUrl: string;
};

type ApiCallDelivery = DeliveryBase & {
  type: 'api_call';
  responseHash: string;
  idempotencyKey: string;
};
```

The discriminator is `type`. Agents pattern-match on it. Adding a new product class is a new variant; existing agents continue to handle older variants without change.

### Pending-then-final pattern

For asynchronous suppliers, emit:

1. A `pending` envelope with `status: 'pending'` and a `pendingReason`.
2. A `delivered` (or `failed`) envelope when the supplier confirms.

Both are signed and addressable by order ID. The agent treats `pending` as "do not yet consider this fulfilled" and reconciles when the final arrives.

### Delivery-to-receipt linkage

The delivery envelope's `orderId` and signature are referenced from the [receipt](./receipts-and-proof-of-purchase.md) for the order. A receipt without a matching delivery envelope is incomplete. A delivery envelope without a referencing receipt is orphaned and must trigger a reconciliation alert. Treat the pair as the canonical fulfillment artifact.

### Sensitive payload handling

Gift-card codes, eSIM activation strings, and PNR locators are bearer credentials. Treat them with the same discipline as API keys:

- Reveal only over authenticated retrieval, not in webhook bodies.
- Encrypt at rest with a key separate from the merchant's signing keys.
- Limit log emission — never log raw codes; log envelope IDs.
- Set retrieval expiry where the supplier's redemption deadline is short.

### Operational metrics

- **Time-to-delivery.** From settlement confirmation to `delivered` envelope, segmented by product class.
- **Pending-to-final latency.** Especially for travel and eSIMs where supplier asynchrony dominates.
- **Failure rate by supplier.** Drives supplier-portfolio decisions and routing fallbacks.
- **Retry depth.** Suppliers that need three attempts to confirm are flagged for re-evaluation.
- **Envelope-signature verification failures.** Should be near zero; spikes indicate key-rotation issues or downstream tampering.

## Edge cases

- **Partial delivery.** A multi-line basket where some items deliver and others fail. Emit one envelope per line; mark the order as `partial` only at the order-summary layer. Refund per-line, not per-order — see [refunds playbook](./refunds-and-disputes-for-agents.md).
- **Delivery to the wrong recipient.** Gift-card code revealed to the buyer when the intended recipient was someone else. If the code is unredeemed, void and re-deliver with a fresh code. If redeemed, dispute escalation. Record the deliver-to identity in the envelope so this is always auditable.
- **Supplier failure post-payment.** Settlement confirmed, supplier returned an error or never confirmed. Emit `failed` with reason; trigger refund. Do not silently retry against a supplier that has rejected — log and escalate.
- **Supplier eventual success after timeout.** The merchant gave up, refunded, and then the supplier confirmed hours later. Encode an idempotency token at the supplier and check it before retrying refunds; if the supplier ultimately delivered, the envelope upgrades from `failed` to `delivered` and the refund is reversed (or the buyer keeps both — policy decision, document it).
- **Code already redeemed at reveal.** Some brands return codes from a pool with stale state. Detect by attempting a non-mutating balance check before delivery where the API permits, or by accepting the small loss and refunding.
- **eSIM device incompatibility.** The user's device cannot install the profile. Emit `failed: invalid_recipient`; refund. eSIMs are easy to refund pre-install and impossible post-install.
- **PNR voided by airline before flight.** Schedule change cancels the booking. Treat as supplier failure; refund per fare rules. The envelope updates to `failed: supplier_rejected` with airline reason.
- **API response too large to hash inline.** Hash off-band, return the digest plus a fetch URL with TTL.
- **Recipient unreachable.** Top-up to a phone number that the carrier rejects (number ported, deactivated). Emit `failed: invalid_recipient`; refund.
- **Time-zone slippage in PNR or hotel envelopes.** Always emit times with explicit time zones; never local-naive.

## When to use

- Any merchant catalog with multiple product classes whose delivery shape differs.
- Any merchant exposing fulfillment to an agent that must verify and reconcile programmatically.
- Any flow where supplier confirmation is asynchronous and the merchant must distinguish pending from final.
- Any flow where the recipient is not the buyer (gift cards, top-ups to third parties).

## When NOT to use

- Single-product, single-supplier, fully synchronous flows where a generic "delivered" boolean and a free-form receipt blob suffice.
- Pure API-monetization flows where the response itself is the delivery and no further envelope is meaningful — the API response plus an idempotency key is the envelope.
- Internal flows where merchant and agent share a database and delivery state is observable directly.

## References

- IATA NDC / Resolution 824 — passenger record semantics — <https://www.iata.org/en/programs/airline-distribution/ndc/>
- GSMA RSP architecture (eSIM remote provisioning) — <https://www.gsma.com/esim/>
- SM-DP+ specification (eSIM activation) — <https://www.gsma.com/esim/wp-content/uploads/2018/12/SGP.22-v2.2.2.pdf>
- ITU E.164 (MSISDN format) — <https://www.itu.int/rec/T-REC-E.164>
- JOSE / JWS (JSON Web Signature) — <https://datatracker.ietf.org/doc/html/rfc7515>
- W3C Verifiable Credentials Data Model — <https://www.w3.org/TR/vc-data-model-2.0/>
- Stripe Checkout completion semantics — <https://stripe.com/docs/payments/checkout>
- Coinbase Commerce delivery webhooks — <https://docs.cdp.coinbase.com/commerce/docs/webhooks>
- ACP fulfillment-section drafts — <https://github.com/agentic-commerce-protocol/agentic-commerce-protocol>
