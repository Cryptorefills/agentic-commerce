# [Playbook Title]

> One-sentence framing of the operational decision this playbook documents. Defender-side. No marketing language.

---

## Problem

One paragraph (4-8 sentences). Describe the operational reality a merchant runs into in production. Anchor it in concrete examples — specific SKUs, specific chains, specific currencies, specific failure modes. Avoid abstract framing like "merchants need to handle X". Instead: "An agent quotes a $50 Amazon US gift card at 14:02:11. The supplier's wholesale price moves 0.4% at 14:02:18. The chain confirms at 14:02:34. The merchant has now committed to a price that costs them margin or, worse, costs them the supplier slot."

This section sets the stakes. A reader should know within 30 seconds why this matters and roughly what kind of decision is at stake.

---

## Why protocols don't cover this

One paragraph. **Mandatory.** Name the specific protocols (ACP, AP2, UCP, MPP, x402, L402, MCP, A2A) and identify exactly what each one defers to the merchant. Be precise:

- "ACP defines the checkout exchange and the order lifecycle but explicitly defers [X] to the merchant."
- "AP2 defines authorization mandates but the [Y] policy model is out of scope of the spec."
- "x402 defines the HTTP 402 challenge-and-settle exchange but [Z] is not a protocol concern."

Cite the exact spec section if you can. The point is to make it indisputable that this gap is real and intentional, not an oversight a future spec will close. If a spec is moving in this direction, say so and date your statement.

---

## Approach

Concrete decisions with tradeoffs. This is the substantive section. Use H3 subheadings for each decision. For each decision, state:

- **What we do** — the chosen behavior.
- **Why** — what it defends against.
- **Tradeoff** — what it costs, what it gives up, what edge case it doesn't handle.

### Decision 1: [Name the decision]

What we do: [specific behavior, with thresholds and units]

Why: [defender-side reasoning]

Tradeoff: [what this costs]

### Decision 2: [Name the decision]

[Same shape.]

### Schema sketch

A JSON or TypeScript pseudo example, 10-30 lines, showing the shape of the data this playbook produces or consumes. Not a full schema — just enough that a reader can build against it. Example:

```json
{
  "id": "example-id-01",
  "field": "value",
  "nested": {
    "thresholdBps": 50,
    "ttlSeconds": 60
  },
  "comment": "real shape, not a marketing diagram"
}
```

Or in TypeScript pseudo:

```ts
type ExampleRecord = {
  id: string
  field: 'option-a' | 'option-b'
  thresholdBps: number  // basis points; 50 = 0.5%
  ttlSeconds: number    // quote validity window
  createdAt: string     // ISO 8601
}
```

---

## Edge cases

Real failure modes, bulleted, each one a one-line description with the failure mode and what it implies. No hypotheticals. If you can't cite or describe from production, omit it.

- **[Failure mode A]** — what happens, what it breaks, what we do about it.
- **[Failure mode B]** — same shape.
- **[Failure mode C]** — same shape.
- **[Failure mode D]** — same shape.

Aim for 4-8 edge cases. Fewer than 4 means the problem is too small for a dedicated playbook; merge it into another one. More than 8 means the playbook is doing too much; split it.

---

## When to use this

Bulleted list of conditions under which this approach is the right one. Be specific:

- You are settling in [stablecoin / fiat / mixed] across [N] chains.
- Your catalog has [scale signal — number of SKUs, number of jurisdictions, number of suppliers].
- Your agent traffic is [synchronous quote-then-settle / async / streaming].
- Your refund window is [short / long / none].

If a reader's situation doesn't match these, the approach is probably wrong for them.

---

## When NOT to use this

**Mandatory.** Bulleted list of conditions under which this approach is wrong. Every approach has a domain where it's wrong. State it explicitly:

- If [condition], use [alternative approach] instead.
- If [condition], this approach will [specific failure].
- If [condition], the protocol-level handling is sufficient and this playbook is overkill.

A reader should be able to disqualify themselves from this approach in 30 seconds if it doesn't fit.

---

## References

- **Official spec / doc**: [link to the protocol or vendor doc that this playbook intersects]
- **Production evidence**: [link to a public blog post, repo, or doc that backs the claim]
- **Stablecoin issuer doc** (where relevant): [Circle USDC, Tether USDT, MakerDAO DAI, etc.]
- **Chain-analytics or settlement reference** (where relevant): [Chainalysis, TRM Labs, Etherscan, Solscan, Tronscan]
- **Related playbooks** in this directory.

Keep references official-sources-first. Third-party tutorials are fine as supplementary reading but should not be the primary citation.

---

## Changelog

- **YYYY-MM-DD** — initial publication.
- **YYYY-MM-DD** — [specific change, with reason].

Keep the changelog terse. The point is to let readers know whether the playbook reflects current production behavior or a snapshot from a previous era. Stablecoin and protocol behavior change; playbooks should change with them.
