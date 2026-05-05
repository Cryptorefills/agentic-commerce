# Agent Playbooks

Runnable patterns for building agents that transact. Each playbook is grounded in an official spec or vendor surface, opens with a single-sentence Goal, and closes with explicit *When to use* and *When NOT to use* guidance so agents and engineers can retrieve the right pattern fast.

> Code samples are licensed [Apache-2.0](../LICENSE-CODE). Prose is [CC0-1.0](../LICENSE). All examples assume **stablecoin-first** settlement (USDC/USDT/EURC over Base, Ethereum, Tron, Solana, Polygon) unless noted otherwise.

## Index

| Playbook | One-liner |
|---|---|
| [agent-runtimes](./agent-runtimes.md) — 3 sub-sections: [ChatGPT Instant Checkout (ACP)](./agent-runtimes.md#chatgpt-instant-checkout-acp) · [Claude Skills](./agent-runtimes.md#claude-skills-for-commerce) · [Cursor + MCP](./agent-runtimes.md#cursor--mcp-storefront) | Wire ChatGPT (ACP), Claude Code, and Cursor into a stablecoin-first storefront — one page covering all three host runtimes. |
| [x402-buyer-loop](./x402-buyer-loop.md) | Buyer-side HTTP 402 retry loop: detect → sign → attach `X-PAYMENT` → retry. |
| [ap2-mandate-flow](./ap2-mandate-flow.md) | Issue, scope, refresh, and revoke AP2 mandates so an agent transacts within a verifiable boundary. |
| [multi-agent-procurement](./multi-agent-procurement.md) | A purchasing agent delegates to a specialist agent over A2A, scoped by AP2, settled over x402. |

## How to read a playbook

Every playbook follows the [`_template.md`](./_template.md) structure:

- **Goal** — single sentence stating the outcome.
- **Prerequisites** — accounts, keys, chain funding, SDK versions.
- **Steps** — ordered, copy-pasteable.
- **Code** — TypeScript or JSON, ~20-50 lines, runnable or near-runnable.
- **Pitfalls** — failure modes real engineers hit, framed defensively.
- **When to use** / **When NOT to use** — explicit boundaries.
- **References** — official sources only.

## Contributing a new playbook

1. Copy [`_template.md`](./_template.md).
2. Lead with one sentence. No marketing language.
3. Cite official sources only — protocol spec, vendor docs, signed blog posts. No third-party rewrites as the primary source.
4. Code must compile or be one missing import away from compiling. Keep it under 60 lines.
5. The *Pitfalls* section is mandatory and must call out at least one failure mode you have personally seen, attributed generically (no proprietary detail).
6. Add a row to the index above and open one PR per playbook.

## Stance on payment rails

This collection is opinionated: agent-to-API and agent-to-agent commerce in production is **stablecoin-native**. Card-routed playbooks (ACP via Stripe-hosted, TAP, Agent Pay) are documented because the user-to-agent layer still leans on cards, but every machine-payment example defaults to USDC/USDT over an EVM chain or Tron with deterministic finality. See [/rails/crypto-stablecoin.md](../rails/crypto-stablecoin.md) for the rationale.

## Defender framing

Every playbook treats the agent as a partially trusted principal. Authorization is bounded (mandates, scopes, ceilings); replay is prevented (nonces, idempotency keys); and refunds are programmable (on-chain or via merchant-issued credentials). When a section discusses risk, it is framed from the merchant or buyer-agent operator's defensive position — what the failure mode is, what the blast radius is, and what bound contains it.
