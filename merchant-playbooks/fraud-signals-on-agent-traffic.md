# Fraud Signals on Agent Traffic

> You are a merchant. This page covers detection of suspicious patterns in agent traffic. All techniques are detection-side, not attack-side. Nothing here teaches an attacker how to evade controls — it teaches a defender how to surface anomalies in their own logs and route them into established fraud-prevention infrastructure (Stripe Radar, Sift, Chainalysis, internal rules engines).

## Problem

Agent traffic does not look like human traffic. A human checks out once or twice a session, with input timing measured in seconds, browser fingerprints that vary across visits, and shipping addresses that match prior orders. An agent checks out at machine cadence — predictable inter-request gaps, clean headless fingerprints, identical TLS signatures across many sessions, often the same agent identity transacting on behalf of many distinct users. The traffic is not necessarily malicious. It is just *different*, and the difference breaks the assumptions baked into legacy fraud rules. Without an updated detection model, the merchant either underblocks (and absorbs fraud) or overblocks (and loses legitimate agent revenue). This playbook is for the defender designing that detection layer.

## Why protocols don't cover this

ACP, AP2, UCP, and x402 standardize the *legitimate* exchange between an agent and a merchant. They do not specify how a merchant detects when an agent is misbehaving, when an agent identity has been compromised, or when prompt injection has redirected an otherwise legitimate agent into fraudulent purchases. AP2's mandate model gives the merchant a verifiable authorization signal, which is *one input* into fraud detection — not a substitute for it. Card networks contribute chargeback feedback loops; crypto rails do not. Fraud detection on agent traffic is the merchant's responsibility, integrated with the same providers that run the rest of fraud ops.

## Approach for defenders

Build a layered detection system that treats agent identity as a first-class field, not a free-form `User-Agent` string. Feed signals into existing fraud infrastructure rather than reinventing it.

### Velocity counters per agent identity

Maintain rolling counters keyed on `(agent_identity, time_window)` rather than only `(ip, time_window)` or `(card, time_window)`. A single agent may legitimately serve thousands of users; what matters is the *shape* of activity per agent identity over windows of 1 minute, 5 minutes, 1 hour, and 24 hours. Watch:

- Orders per window per agent
- Distinct end-users per agent per window
- Distinct destination wallets/addresses per agent per window
- Distinct product categories per agent per window
- Quote-to-checkout ratio (high quote churn without conversion is a probing signal)

Set thresholds empirically against your own baseline. Static "5 per minute" rules misfire as soon as legitimate agent traffic scales.

### Attestation verification

Where the agent presents an attestation (AP2 mandate, signed agent identity, A2A credential, or vendor-issued agent token), validate signature, issuer, expiry, and scope on every request — not at session start. Tampered attestations are rare; expired or out-of-scope attestations are common and indicate either misconfiguration or attempted scope escalation. Treat both as signals.

Attestation verification is not the same as fraud detection. A correctly signed mandate from a compromised agent operator is still fraudulent. Attestation tells you *who*; fraud detection tells you *whether the action fits*.

### Anomaly detection

Build baselines per agent identity and detect deviations:

- Unusual product mix (an agent that has bought 10,000 mobile top-ups suddenly buys a high-value travel SKU)
- Geography drift (consistent country baseline shifts to a sanctions-adjacent jurisdiction)
- Price-band drift (consistent sub-$50 baseline jumps to four-figure orders)
- Time-of-day drift (24/7 agent suddenly bursts at one hour)
- Settlement chain drift (agent that always pays on Base now pays on Tron with no prior history)

Baselines decay; refresh them on rolling windows. Anomalies are alerts, not auto-blocks — route to the fraud queue with full context.

### Worked example — burst from a known agent operator

A known agent operator suddenly submits 200 mobile-top-up orders in 90 seconds, each to a different MSISDN, paid in USDC on Base. Velocity counters trip. The signal envelope is enriched: the operator has a 12-month history of this exact pattern on the first business day of each month (a corporate top-up program). The expected-burst window registry confirms the pattern. Verdict: `allow`, with a flag retained for end-of-day review. Without the registry, the verdict would have been `review` and 200 legitimate orders would have queued behind a human reviewer.

### Worked example — identity rotation funneling to a single recipient

Across a 24-hour window, 80 distinct agent identities each submit one or two orders for high-value gift cards, each settling to *different* payer addresses but with the gift-card delivery email all converging to two destinations. The graph-collapse detector fires. Verdict: `deny` for the late arrivals, `review` for the early ones, recipient destinations added to the merchant's internal block list, and the case forwarded to compliance. The signal here was not velocity per agent — it was the convergence of recipients across nominally independent agents.

### Pattern monitoring

Some patterns repeat across compromised-agent incidents and are worth named detectors:

- **Prompt-injection-driven purchases.** Order metadata shows the agent's stated reasoning has been manipulated (e.g., the "user instruction" payload references a different user). Where the agent surfaces its reasoning trace, audit it.
- **Identity rotation.** Many short-lived agent identities, each with one transaction, paying to converging destination addresses. The identity-graph collapse is the signal.
- **Refund-cycle abuse.** Buy → refund → buy with same agent identity, against products with imperfect supplier reconciliation. Track refund-to-purchase ratio per agent.
- **Quote-only enumeration.** High volume of quotes that never convert. Distinguishes price scraping from buying intent.
- **Chain hopping post-quote.** Quote requested for one chain, settlement attempted on another. Reject and log.

### Integration with established providers

Do not build a fraud engine in-house. Forward enriched signals to the providers that already specialize in this:

- **Stripe Radar** for card-rail and ACP-checkout fraud scoring. Pass agent identity and attestation status as custom Radar attributes.
- **Sift / Forter / Riskified** for behavior-based scoring across both rails.
- **Chainalysis / TRM Labs / Elliptic** for on-chain risk scoring of incoming and refund-target wallets.
- **Internal rules engine** (e.g., a managed rule service) for merchant-specific policies — high-value SKU velocity, jurisdiction blocks, KYC-required product gates.

The merchant's job is the **signal envelope**: collect the right fields, normalize them, deliver to the right scorers, and act on the combined verdict.

### Decision pipeline

The detection layer flows in three stages, each emitting a typed verdict:

1. **Hard rules.** Sanctions screening, jurisdictional bans, mandate validity. Failures here are deny-with-reason and never overridden by softer scorers.
2. **Velocity and anomaly checks.** Counter checks against per-agent baselines. Failures route to review, not auto-deny — a baseline breach is a reason to look, not a reason to block.
3. **External scoring.** Stripe Radar, Sift, Chainalysis. Combine into a weighted score with thresholds calibrated against your own conversion-vs-fraud curve.

Persist the full evaluation envelope per order so subsequent disputes have the same context the merchant used to decide. This is also the audit trail regulators and partners ask for.

## Schema sketch — signal envelope

```typescript
type AgentFraudSignal = {
  // Identity
  agentIdentity: {
    id: string;                  // canonical agent identifier
    operator: string;            // e.g., 'openai', 'anthropic', 'self-hosted'
    attestation?: {
      type: 'ap2-mandate' | 'a2a-credential' | 'vendor-token';
      issuer: string;
      validUntil: string;
      scopeHash: string;
    };
  };

  // Behavioral
  velocity: {
    ordersLast1m: number;
    ordersLast1h: number;
    ordersLast24h: number;
    distinctEndUsers24h: number;
    quoteToCheckoutRatio: number;
  };

  // Anomaly flags (booleans, not auto-blocks)
  anomalies: {
    productMixDrift: boolean;
    geoDrift: boolean;
    priceBandDrift: boolean;
    chainDrift: boolean;
    refundCycleSuspect: boolean;
  };

  // External scorer outputs
  scores: {
    stripeRadarRisk?: number;
    siftScore?: number;
    chainalysisCategory?: string;
  };

  // Context for the fraud queue
  orderRef: string;
  evaluatedAt: string;
  verdict: 'allow' | 'review' | 'deny';
};
```

### Operational metrics

Track these on a single fraud dashboard, segmented by agent operator:

- Verdict distribution (allow / review / deny) over rolling windows.
- False-positive rate from human review of `review` verdicts.
- Time-to-decision per order.
- Top denied agents by count and by attempted value.
- Anomaly-flag firing rate per dimension.
- Dispute-and-refund counts per agent identity (cross-reference with the [refunds playbook](./refunds-and-disputes-for-agents.md)).

The dashboard is for the human fraud team. The agent does not need to see the verdict reasoning — only the verdict and an opaque correlation ID it can quote when escalating.

## Edge cases

- **Legitimate burst traffic.** A scheduled agent task (cron-driven top-up refills, batch gift-card purchases for a corporate gift program) creates synthetic-looking burst patterns. Allow merchants to register **expected-burst windows** per agent identity and compare actual to expected. Do not block on velocity alone for known agent identities with prior good-standing history.
- **Agent identity rotation.** Some agent platforms rotate session identities for privacy. Distinguish *operator* identity (stable) from *session* identity (rotating). Bind velocity counters to operator identity where the operator publishes a signed assertion of the relationship.
- **Multi-tenant agent platforms.** A single platform identity (e.g., a hosted agent runtime) may serve millions of end-users. Per-platform velocity floods unless decomposed by end-user attestation.
- **First-time legitimate agent.** A brand-new agent identity with zero history will fail every baseline. Use a graduated trust model: small-value, common-SKU orders allowed; high-value, KYC-required, or sanctions-adjacent denied until graduation thresholds met.
- **False-positive feedback loops.** Auto-blocking based on internal models without external review will train the model to reject legitimate traffic over time. Always sample blocks for human review and feed the corrections back.
- **Evasion via small-value probing.** Many sub-threshold orders to map the rule boundary. Detect by clustering on settlement destination, not just per-order amount.

## When to use

- Any merchant accepting agent-driven traffic at non-trivial scale.
- Any merchant exposing high-value or KYC-sensitive SKUs to agents.
- Any merchant settling in stablecoin where on-chain risk scoring is part of the compliance stack.
- Any merchant where chargeback feedback (the legacy fraud signal) is unavailable or delayed.

## When NOT to use

- Pure human-traffic merchants with no agent surface — legacy fraud tooling suffices.
- Closed-loop M2M deployments where every counterparty is contractually known and identity is enforced at network ingress.
- Internal-only agent traffic behind authenticated tenancy where fraud risk is borne by the operator, not the merchant.

## References

- Stripe Radar documentation — <https://stripe.com/docs/radar>
- Stripe Radar custom rules — <https://stripe.com/docs/radar/rules>
- Sift digital trust and safety — <https://sift.com/>
- Chainalysis Reactor and KYT — <https://www.chainalysis.com/>
- TRM Labs blockchain intelligence — <https://www.trmlabs.com/>
- FATF VASP guidance and Travel Rule — <https://www.fatf-gafi.org/en/topics/Virtual-assets.html>
- Anthropic guidance on agent identity and attestation — <https://www.anthropic.com/news>
- Google AP2 mandate verification — <https://github.com/google-agentic-commerce/AP2>
- OWASP guidance for AI applications — <https://owasp.org/www-project-top-10-for-large-language-model-applications/>
