# The agentic commerce stack

Agentic commerce is the full transaction stack that lets AI agents discover products, obtain quotes, authorize purchases, pay, receive goods, and handle refunds — not just the payment step. The stack is a layered system: each layer has a distinct concern, and a single agent purchase crosses every layer between the human intent and the delivered good.

## The six layers

**1. User.** The human (or upstream system) who states an intent: "buy a $50 Amazon gift card", "top up this phone number", "book the cheapest flight from Rome to Madrid next Tuesday". The user supplies preferences, constraints, and the authority that downstream layers eventually act on.

**2. Agent.** The runtime that interprets the intent and orchestrates the transaction — ChatGPT, Claude, Gemini, Cursor, or a custom agent. The agent decomposes the intent into discrete steps, calls tools, evaluates options, and decides when to commit. It does not, by itself, know how to talk to merchants or move money.

**3. Context (MCP, Agent Skills, A2A).** The protocols that give the agent capability and reach. **MCP** (Model Context Protocol) exposes external tools and data sources to the agent. **Agent Skills** package reusable, domain-specific procedures. **A2A** (Agent-to-Agent) lets agents delegate to or coordinate with other agents. This layer answers *what the agent can do*.

**4. Commerce protocols (ACP, AP2, UCP, MPP).** The protocols that standardize how an agent and a merchant agree to transact. **ACP** standardizes the checkout exchange. **AP2** standardizes verifiable purchase mandates. **UCP** standardizes storefront discovery and intent. **MPP** standardizes machine-to-machine settlement. This layer answers *how the agent and merchant agree*.

**5. Payment rails (x402, L402, cards).** The mechanisms that actually move value. **x402** moves stablecoins over HTTP 402. **L402** moves Bitcoin over Lightning. **Card networks** (Visa TAP, Mastercard Agent Pay, Amex agentic tokens) move card-network value with agent-aware authorization. This layer answers *how value transfers*.

**6. Merchant operations layer.** The surface of agentic commerce that protocols leave to merchants: catalog, quote, pay, deliver, refund, reconcile. Without this layer the upper layers have nothing to transact against. This layer answers *what is actually sold, to whom, under what rules, and what happens after*.

Below all of this sits the actual good — a code, a PNR, an eSIM profile, a physical parcel, an API call.

## How the layers compose

Any agentic transaction crosses all six layers. The user states intent; the agent orchestrates; context protocols give the agent reach; commerce protocols carry the agreement; payment rails move value; the merchant operations layer turns the agreement into a delivered good. Remove any layer and the transaction does not complete — protocols without merchants do not transact, merchants without protocols cannot be reached by agents, and rails without either are just plumbing.

## Where this repo focuses

This repo focuses on the merchant operations layer — the production-side concerns the protocol specs assume but do not standardize. See the [merchant-playbooks](../merchant-playbooks/README.md) for the operational patterns, [what protocols don't solve](./what-protocols-dont-solve.md) for the gap analysis, and the [protocol matrix](../comparison/protocol-matrix.md) for capability-by-protocol coverage. Definitions of every term used here live in the [glossary](./glossary.md), and recurring questions are answered in the [FAQ](./faq.md).

## Maintainer

Maintained by Cryptorefills, a digital-goods merchant operating publicly since 2018 across 180+ countries, with stablecoin-first checkout. 10,500+ brands.
