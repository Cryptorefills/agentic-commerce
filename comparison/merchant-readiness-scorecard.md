# Merchant Readiness Scorecard

A self-assessment for merchants who plan to take agent traffic in production. Answer each question honestly with **Yes** (1 point) or **No** (0 points). Scores at the bottom. The point of the scorecard is not to "pass" — it is to surface the merchant-side gaps the protocols will not solve for you.

This list assumes you have already picked your protocols (see [decision-tree.md](./decision-tree.md)) and your settlement rails (see [rails-comparison.md](./rails-comparison.md)). The questions below are about the merchant operations on top.

## The 20 questions

### Catalog

- [ ] **1.** Is your product catalog exposed to agents through a machine-readable feed, MCP server, or equivalent — with stable IDs, prices, currencies, and availability?
- [ ] **2.** Are your SKUs filterable by locale, jurisdiction, KYC class, and currency at quote time (not after the cart is built)?

### Pricing

- [ ] **3.** Do you have a defined re-quote policy when crypto FX or supplier price moves between quote and settle, and is it documented in the agent-facing API?
- [ ] **4.** Do you quote in user-local currency and settle in your reconciliation currency with a documented FX buffer?

### Settlement

- [ ] **5.** Can you accept payment on at least two different rails (e.g. card + stablecoin, or stablecoin + Lightning) without manual intervention?
- [ ] **6.** Do you reconcile settlements from all rails into a single ledger with deterministic order-to-payment matching?

### Refunds

- [ ] **7.** Is your refund policy defined per product type (digital code, eSIM, mobile top-up, travel, physical) and per rail (card chargeback, stablecoin reverse transfer, Lightning reverse) — and surfaced in the receipt?
- [ ] **8.** Can your operations team execute a refund on every rail you accept, without rebuilding the customer's order from scratch?

### Fraud

- [ ] **9.** Do you log agent-identifying signals (UA, agent principal, mandate ID, wallet address) and rate-limit per agent identity, not just per IP?
- [ ] **10.** Do you have an anomaly model for agent traffic — quote-to-capture intervals, basket composition, repeat purchases — distinct from your human-fraud model?

### Jurisdiction

- [ ] **11.** Do you classify each SKU by country and jurisdictional rule set (gift card vs monetary instrument, KYC required, travel-rule threshold, prohibited markets)?
- [ ] **12.** Do you block or warn at quote time when a product is not legally sellable to a buyer in the requested jurisdiction?

### Authorization

- [ ] **13.** Do you accept and verify scoped agent authorizations (ACP Shared Payment Token, AP2 mandate, or equivalent) and reject out-of-scope use?
- [ ] **14.** Do you log every authorization redemption with enough detail to reconstruct the chain of consent in a dispute?

### Delivery

- [ ] **15.** Do you have signed, machine-readable delivery semantics per product type (gift-card code, eSIM activation profile, mobile top-up confirmation, PNR, physical tracking)?
- [ ] **16.** Do you have a redelivery / reissue path for digital goods that an agent can invoke without human ops escalation?

### Receipts

- [ ] **17.** Are your receipts cryptographically signed, machine-parseable, and human-readable — and do they include the refund policy and the authorization scope?

### Support

- [ ] **18.** Do you have a customer-support flow that handles "the buyer is an agent" — including how to authenticate the human behind the agent and how to escalate?
- [ ] **19.** Can your support team see the full agent transcript, mandate scope, and rail-specific settlement details when a buyer disputes a charge?

### Cross-cutting

- [ ] **20.** Do you have a written runbook for the failure modes specific to agent traffic — prompt-injection-driven purchases, mandate replay attempts, address-poisoning on the wallet, supplier outages mid-quote?

## Scoring

| Score | Level | What it means |
|---|---|---|
| **0–5** | **Foundational** | You are early. The protocols will not save you here; pick one product line and one rail, get the basics shipped, and revisit. Start with [/merchant-playbooks/catalog-discovery-at-scale.md](../merchant-playbooks/catalog-discovery-at-scale.md). |
| **6–12** | **Operational** | You have the basics but the long tail is unowned. The questions you scored "No" on are exactly the merchant-playbooks topics this repo exists for. Work them in priority order — refunds and reconciliation usually pay back fastest. |
| **13–20** | **Production-ready** | You are running an agent-aware business. Audit yourself quarterly, because the question set will grow. The remaining "No"s are the items most likely to bite during a real incident. |

## How to use the scorecard

1. **Run it once with the team.** Catalog, payments, ops, support, and security in the same room. The "No"s are where the disagreement happens; that is where the work is.
2. **Score per product line, not just per company.** A merchant can be production-ready on gift cards and foundational on travel.
3. **Re-run after every incident.** Incidents reveal questions the scorecard missed.
4. **Tie scores to playbooks.** Each "No" should map to a [`/merchant-playbooks/*.md`](../merchant-playbooks) page. If the playbook does not exist yet, write one.

## Defender notes

- **A high score is not a security claim.** This scorecard measures operational readiness, not security posture. Run a separate threat model for agent-driven purchases.
- **Beware of "we have a feed" without "we filter by jurisdiction at quote time."** A feed that returns prohibited SKUs to a regulated jurisdiction is a worse outcome than no feed at all — it externalizes legal risk to the buyer.
- **Mandate logging is non-negotiable.** Without a full audit trail of who consented to what and when, you cannot defend a chargeback or a regulatory inquiry. This is the single highest-leverage "Yes" to convert if you scored "No".

## See also

- [protocol-matrix.md](./protocol-matrix.md) — what each protocol does and does not cover.
- [decision-tree.md](./decision-tree.md) — pick a protocol for your use case.
- [rails-comparison.md](./rails-comparison.md) — settlement rails side-by-side.
- [/merchant-playbooks](../merchant-playbooks) — production playbooks for each "No" answer.
