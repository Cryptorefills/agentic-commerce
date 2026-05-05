# Refunds and Disputes for Agents

## Problem

Stablecoin settlement is final. Once a USDC transfer confirms on Base or a USDT transfer confirms on Tron, the merchant has the funds and the network has no concept of "reverse the prior payment." Card networks paper over this with chargebacks; crypto rails do not. At the same time, agentic commerce introduces new reasons a transaction needs to be reversed: the agent bought the wrong SKU, the supplier returned a "code already redeemed" error after settlement, the user withdrew authorization between quote and delivery, the gift-card brand pulled inventory mid-flight, the eSIM activation profile failed to install on the target device. The merchant is now responsible for a *programmable* refund layer that protocols (ACP, AP2, x402, L402) do not specify. This page is the merchant defender's reference for how to design that layer.

> There is no chargeback in stablecoin. What follows is what merchants do when an agent or its principal needs money back — not a model that assumes a card network will absorb the loss.

## Why protocols don't cover this

ACP and UCP standardize the checkout exchange; ACP defines `cancel` and `refund` operations but does not define refund SLAs, partial-redemption semantics, gas-uneconomic thresholds, or cross-chain return paths. AP2 covers authorization mandates and disputes-of-mandate, not settlement reversal. x402 is a payment primitive — its scope is "client paid server, server fulfilled request" with no opinion on reversal semantics. L402 is similar. Visa TAP and Mastercard Agent Pay inherit card-network chargeback flow, which the merchant must still translate to internal refund operations. The specs define the wire-level operations; none define the policy layer. That is correct scope for a protocol — and a load-bearing gap for the merchant.

## Approach

Treat refunds as a **first-class product surface**, not a customer-support escalation. Decisions are made before checkout, encoded in SKU metadata, and enforced by a refund engine.

### Refund SLAs per product type

Different products have different reversal windows because the underlying supplier has different rules. The merchant must encode the SLA per SKU at catalog time, not at refund time — by the time a refund request arrives, the window is either open or closed and the answer must be deterministic.

| Product class | Pre-fulfillment | Post-fulfillment | Notes |
|---|---|---|---|
| Gift card (digital code) | Full void within ~60s of authorization | Refundable only if code unredeemed; supplier-dependent | Most brands: code irrevocable once revealed |
| Mobile top-up | Void window measured in seconds | Generally non-reversible after carrier accepts MSISDN credit | Carrier confirmation is the point of no return |
| eSIM activation profile | Refundable until QR/activation code is consumed | Non-reversible after install | Detect install via supplier webhook |
| Travel — flight PNR | Free 24h void in many jurisdictions | Subject to fare rules | Honor regulatory windows even if supplier doesn't |
| Travel — hotel | Free until cancellation deadline | Penalty schedule applies | Encode policy at quote |
| Digital subscription | Pro-rated within first period | Cancel at period end | Stop dunning on dispute open |
| API pay-per-call | Void if request not fulfilled | Generally non-reversible | Use idempotency keys to detect duplicate charge |

The SLA is a contract the agent quotes against and the human consents to. Surface it in the receipt and the delivery envelope so all three parties — agent, user, merchant — agree on the window before settlement.

### Void-before-fulfillment vs refund-after-fulfillment

These are two different mechanisms that must not be conflated.

- **Void.** Settlement has happened on-chain but fulfillment has not. The merchant initiates a return transfer to the original sender, ideally same-block or same-day. No supplier coordination. Accounting reverses the order before it lands in revenue.
- **Refund.** Fulfillment occurred. The merchant must reconcile with the supplier (gift-card brand, carrier, airline) before returning funds. Refund is a workflow, not a single action — it includes supplier validation, partial-redemption inspection, and a refund-routing decision.

Encode the cut-over time per product. For digital codes, fulfillment usually completes within seconds of settlement, so the void window is tiny. For travel, fulfillment may be minutes or hours.

### Partial refunds for partially-redeemable products

Some products are partially consumed. A $100 gift card with $40 spent has $60 of residual value; a multi-day eSIM with one day used has fractional remaining value. Where the supplier supports it, refund the residual; where they don't, the merchant decides whether to absorb the loss as a customer-trust spend or deny the refund explicitly. The decision is policy, not engineering — but it must be documented in the playbook so the agent and the human both know what to expect.

### Refund routing back to original chain and asset

The default is to refund to the same address, on the same chain, in the same asset, to the same decimal precision. Exceptions:

- **Original chain congested or paused.** Pause the refund and notify, do not silently reroute to a different chain — the agent's mandate may not authorize the alternate.
- **Original asset deprecated.** Refund in the closest equivalent stablecoin (USDC ↔ USDT) only with explicit policy and the user/agent's prior consent.
- **Sender wallet inactive.** See edge cases.

Refunds across rails (e.g., paid in USDT/Tron, refunded in USDC/Base) introduce reconciliation pain and FX exposure. Avoid unless the original chain is permanently unavailable.

### Worked example — gift card void within 60 seconds

The agent submits a quote for a $50 Amazon US gift card. The merchant returns a quote pinned to a USDC/Base settlement at $50.04 including supplier margin, with a stated 60-second post-settlement void window. The agent settles. The supplier API is called; the gift-card brand returns "inventory exhausted." The merchant's order state moves from `settled` to `void_pending`, the supplier-attempt-failed event is logged, and a void transfer of the same USDC amount is broadcast to the original payer. The void confirms within one block. The merchant emits a corrected receipt referencing the original receipt as superseded, and a delivery envelope with `status: failed, failedReason: inventory_unavailable`. No support contact is required; the agent reconciles automatically.

### Worked example — eSIM refund post-install rejection

The agent settles a 7-day Italy eSIM. The supplier returns an activation profile, which the merchant delivers in a `delivered` envelope. The user attempts install on an incompatible device; install fails. The agent submits a refund request with reason `not_delivered` and partial-units-remaining of 7. The merchant queries the supplier for install status, confirms the activation was never consumed, and approves a full refund. The supplier credits the merchant; the merchant pays the buyer and emits a corrected receipt. SLA: refund is approved within minutes; on-chain confirmation depends on the settlement chain.

### Escrow patterns

For high-value or supplier-coordinated products, hold settlement in a merchant-controlled escrow wallet for a configurable hold window before sweeping to treasury. Reduces the cost of a same-day refund to a single internal transfer instead of pulling from cold storage. The escrow window should match the SLA of the riskiest product in the basket.

### Dispute escalation paths

A dispute is a refund request the agent or human believes the merchant has wrongly denied. Escalation tiers:

1. **Automated re-review.** Re-run the refund decision against the latest supplier state. Many disputes resolve here because supplier inventory changed.
2. **Human review.** Merchant operations queue with full context — order, settlement tx, supplier response, agent attestation.
3. **Mediation.** For AP2-mandate-backed orders, dispute the mandate via the mandate authority. For card-network rails, follow chargeback procedure.
4. **External arbitration.** Out-of-scope for most digital goods; documented for completeness.

Track disputes-per-1000-orders by agent identity. Spikes are a fraud signal, not just a support cost. Forward the time-series into the same dashboard the fraud team uses for velocity anomalies.

### Reconciliation between refund engine and treasury

A refund is two ledger movements: the merchant's revenue reverses, and treasury sends funds back to the buyer. These must reconcile per-day. Common failure modes:

- Refund tx broadcast and confirmed but the merchant's order ledger never marked refunded — buyer is whole, merchant double-counts revenue.
- Refund tx failed at gas estimation but the order ledger marked refunded — buyer is short, support tickets follow.
- Multiple refund attempts across retries — buyer over-refunded.

The fix is an idempotency key per refund decision, written before broadcast, checked before retry, reconciled against on-chain state nightly. The same key is referenced in the [receipts playbook](./receipts-and-proof-of-purchase.md) so that a refund-corrected receipt supersedes the original cleanly.

## Schema sketch

```typescript
type RefundRequest = {
  orderId: string;
  initiatedBy: 'agent' | 'human' | 'merchant' | 'supplier';
  reason: 'unauthorized' | 'not_delivered' | 'partially_redeemed'
        | 'supplier_failure' | 'wrong_sku' | 'duplicate' | 'other';
  requestedAt: string;        // ISO-8601
  amount: { value: string; asset: string; decimals: number };
  scope: 'full' | 'partial';
  partialUnitsRemaining?: number;
  agentAttestation?: string;  // signed scope check, see authorization-scopes
};

type RefundDecision = {
  orderId: string;
  decision: 'void' | 'refund' | 'partial_refund' | 'denied';
  denyReason?: 'window_closed' | 'already_redeemed'
              | 'supplier_rejected' | 'fraud_hold' | 'gas_uneconomic';
  payout?: {
    chain: string;            // 'base' | 'tron' | 'ethereum' | ...
    asset: string;            // 'USDC' | 'USDT' | ...
    to: string;               // original sender by default
    amount: string;
    txHash?: string;
  };
  decidedAt: string;
  decidedBy: 'auto' | 'human-ops';
  receiptId: string;          // links to receipts playbook
};
```

## Operational metrics

Detect, monitor, and act on:

- **Time-to-refund.** Median and p99 from refund request to on-chain confirmation, segmented by product class and rail.
- **Refund failure rate.** Refund attempts that did not confirm within SLA. Investigate per-rail.
- **Disputes-per-mandate.** A high ratio for a single mandate is either a flawed mandate scope or a compromised agent — see [authorization scopes](./agent-authorization-scopes.md).
- **Supplier-side refund-rejection rate.** Identifies suppliers whose terms are eroding merchant margin.
- **Gas-cost / refund-value ratio.** Detects rails that have become uneconomic for small refunds.
- **Buyer-side reissuance rate.** Refunds initiated because the original delivery failed — points back to the [delivery semantics playbook](./delivery-semantics-codes-pnrs-esims.md).

## Edge cases

- **Gas cost greater than refund value.** Sub-dollar refunds on Ethereum mainnet can cost more in gas than the refund itself. Options: batch refunds into a daily multicall on cheaper chains, route through L2, or issue store credit instead. Document the threshold per chain and disclose the policy.
- **Sender wallet inactive or compromised.** The original payer is a smart-contract wallet that has been deprecated, or the EOA's keys have been reported lost. Hold refund in a recovery account, require signed claim from a fresh address bound to the original mandate, and log the divergence for audit.
- **Cross-chain refund needed.** Original chain has been paused (e.g., USDC issuer freeze, network halt). Pause refund, notify counterparty, surface the reason. Never silently switch chains — the mandate likely authorized one chain only.
- **Supplier failure post-payment.** Settlement confirmed but the gift-card brand returned an error or the eSIM provider rejected the activation. Refund unilaterally; do not wait for the supplier dispute to resolve. Log the supplier failure as a separate reconciliation item.
- **Agent-initiated refund without user knowledge.** Validate the refund mandate the agent presents. An agent that can buy is not automatically an agent that can refund — scopes are independent.
- **Idempotent retries.** A refund tx that fails at broadcast may have actually landed. Idempotency-key the refund and check chain state before re-broadcasting.
- **Partial supplier redemption with residual stuck.** $100 gift card, $40 spent, brand cannot return the $60 — disclose, deny refund with reason, escalate to dispute.

## When to use

- Any digital-goods merchant accepting stablecoin from agents.
- Any merchant where the buyer is an agent and the original payer cannot be assumed to be reachable for support.
- Any catalog with mixed product classes where refund rules differ per SKU.
- Any deployment where finality of settlement is faster than fulfillment confirmation.

## When NOT to use

- Pure card-rail merchants with chargeback coverage and no crypto settlement leg — use the card network's dispute flow as primary; this playbook is overkill.
- Pre-paid store-credit-only flows where there is no on-chain settlement to reverse.
- Pilots without production traffic — prototype the void path first; the full refund engine is for live workloads.

## References

- Stripe Radar dispute handling — <https://stripe.com/docs/disputes>
- Stripe Refunds API — <https://stripe.com/docs/refunds>
- Coinbase Commerce refund flow — <https://docs.cdp.coinbase.com/commerce/docs/refunds>
- Coinbase x402 specification — <https://www.x402.org/>
- Google Agent Payments Protocol (AP2) mandates — <https://github.com/google-agentic-commerce/AP2>
- USDC issuer policy and freeze controls — <https://www.circle.com/usdc>
- AP2 dispute extension drafts — <https://github.com/google-agentic-commerce/AP2/tree/main/specifications>
