# Agent runtimes — ChatGPT · Claude · Cursor

Pick the runtime by where the buyer lives. **ChatGPT Instant Checkout** (ACP) is right when the buyer is a human inside ChatGPT and a card-rail PSP can settle the order. **Claude Skills** are right when you want a packaged, prose-driven capability any Skills-aware host (Claude Code, Cursor) can load. **Cursor + MCP** is right when the agent runs inside an IDE or any MCP-aware host and you want typed, streamable tools. Architecturally, Skills and Cursor both speak Model Context Protocol — the same MCP server can back both. ACP is its own contract aimed at the consumer ChatGPT surface.

## ChatGPT Instant Checkout (ACP)

### Goal

Expose your storefront to ChatGPT Instant Checkout so an agent can complete a purchase end-to-end via the Agentic Commerce Protocol (ACP) — either through Stripe-hosted ACP or a ChatGPT app that owns its own checkout surface.

### Prerequisites

- One of:
  - **Stripe-hosted merchant**: Stripe account in a supported country, Shared Payment Token enabled, ACP turned on in the dashboard. Stripe handles the ACP server contract.
  - **ChatGPT app**: a published ChatGPT app with developer access to the commerce APIs (post-Feb 2026 OpenAI shifted significant Instant Checkout surface here — see Pitfalls).
- Product feed with stable SKU IDs, currency, locale, jurisdiction, inventory.
- HTTPS return URL and webhook reachable from the public internet (TLS-terminated, no self-signed certs).
- Card processor (Stripe) for the user-to-agent leg. Stablecoin settlement applies on adjacent rails — see [x402-buyer-loop](./x402-buyer-loop.md).

### Setup

1. Read the ACP spec and the OpenAI commerce surface. Decide Stripe-hosted vs ChatGPT-app path.
2. **Stripe-hosted**: enable ACP in the Stripe dashboard, point Stripe at your product feed, register the webhook URL Stripe issues for `checkout_session.completed` and `delegated_payment.*` events.
3. **ChatGPT-app**: implement `POST /checkout_sessions` and `POST /checkout_sessions/{id}/complete` on your origin, signing responses with the merchant key OpenAI provisions.
4. Wire your delivery system so the order webhook drives gift-card emission, eSIM activation, or whatever the SKU represents.
5. Define refund semantics — see [/merchant-playbooks/refunds-and-disputes-for-agents.md](../merchant-playbooks/refunds-and-disputes-for-agents.md). ACP does not standardize refund flow.

### Code

Minimal Express handler for the ACP `complete` step (ChatGPT-app path). Trim and harden before production.

```ts
import express from "express";
import { verifyAcpSignature } from "./acp-sig";

const app = express();
app.use(express.json({ verify: (req, _, buf) => ((req as any).raw = buf) }));

app.post("/checkout_sessions/:id/complete", async (req, res) => {
  const sigOk = verifyAcpSignature(
    (req as any).raw,
    req.header("ACP-Signature") ?? "",
    process.env.ACP_MERCHANT_SECRET!,
  );
  if (!sigOk) return res.status(401).json({ error: "invalid_signature" });

  const { id } = req.params;
  const { payment_token, buyer } = req.body;

  // 1. Charge the delegated card token via Stripe Shared Payment Token.
  // 2. Reserve inventory; produce a delivery artifact (gift-card code, PNR, etc.).
  // 3. Persist the order keyed by `id` for idempotent retries.
  const order = { id, status: "completed", delivery: { type: "giftcard_code" } };

  return res.json(order);
});

app.listen(8787);
```

### Pitfalls

- **Post-Feb 2026 OpenAI app pivot.** OpenAI shifted significant Instant Checkout surface area into ChatGPT apps. The Stripe-hosted path remains, but discovery and ranking inside ChatGPT now favor the app path for many categories. Check <https://developers.openai.com/commerce> for the current matrix before scoping.
- **Signature verification skipped.** Verify `ACP-Signature` against raw bytes — skipping opens the merchant to forged completions.
- **Non-idempotent completion.** Network retries replay `complete`. Persist the artifact keyed by `checkout_session.id` and return the cached one on retry.
- **Currency / locale mismatch.** Quote in the buyer's locale at session create — the ACP envelope carries it.
- **Refund undefined.** ACP leaves refund semantics to the merchant. Define them up front or learn under support pressure.
- **PII leakage in logs.** Completion bodies include buyer detail; scrub before logging.

### When to use

- Buyer is a consumer inside ChatGPT.
- You already use Stripe and want the lowest-integration-cost path.
- SKUs are well-described and rank for general-purpose agent retrieval.
- **Don't** use when the buyer is another agent (use [x402-buyer-loop](./x402-buyer-loop.md)) or when stablecoin settlement on the merchant leg is required.

### References

- [OpenAI Commerce developer hub](https://developers.openai.com/commerce)
- [Agentic Commerce Protocol spec](https://www.agenticcommerce.dev/)
- [Stripe ACP docs](https://docs.stripe.com/agentic-commerce)

## Claude Skills for commerce

### Goal

Publish a Claude Skill (a `SKILL.md` with YAML frontmatter, plus optional scripts and resources) so any Skills-aware host — Claude Code, Cursor — can load your storefront's capabilities and drive a real purchase.

### Prerequisites

- Claude Code or another Skills-compatible host installed for testing.
- A storefront API or MCP server exposing at minimum: `search`, `quote`, `order`, `delivery_status`. See [/examples/mcp-storefront-minimal](../examples/mcp-storefront-minimal).
- A local directory mountable as a skill (e.g., `~/.claude/skills/cryptorefills-commerce/`).
- For payment-touching skills: an x402-capable client and stablecoin funding (USDC on Base recommended) — see [x402-buyer-loop](./x402-buyer-loop.md).

### Skill structure

```
cryptorefills-commerce/
├── SKILL.md            # entrypoint: YAML frontmatter + prose
├── scripts/
│   ├── search.ts
│   └── pay.ts
└── resources/
    └── catalog.md      # chunked reference, loaded lazily
```

The host loads `SKILL.md` first. Frontmatter declares trigger conditions; the body is prose the agent reads. Scripts and resources are loaded only when referenced (progressive disclosure).

### Code

Minimal `SKILL.md`:

```markdown
---
name: cryptorefills-commerce
description: >
  Search the merchant catalog of gift cards, mobile top-ups, and eSIMs
  across 180+ countries, quote in USDC, and complete an order over x402.
  Use whenever the user asks to buy a gift card, top up a phone, or pay an
  agent-payable API against a production merchant.
version: 0.1.0
license: Apache-2.0
allowed-tools:
  - Read
  - Bash(node scripts/search.ts:*)
  - Bash(node scripts/pay.ts:*)
---

# Cryptorefills Commerce

## Capabilities
- `scripts/search.ts <query> [--country=US]` — ranked SKUs.
- `scripts/pay.ts <sku-id> --amount=<usd>` — quotes and pays via x402 on Base.

## Stablecoin-first
Settle in USDC on Base by default. Fall back to USDT on Tron only when
the user explicitly requests it. Never quote a card rail for machine payments.

## Refund semantics
Gift-card codes are non-refundable once delivered. Surface this to the user
*before* calling `pay.ts`.
```

### Test path

1. Drop the directory at `~/.claude/skills/cryptorefills-commerce/`.
2. Restart Claude Code or run `/skills reload`.
3. Prompt: *"Find me a $25 Amazon US gift card and quote it in USDC."* — Claude should match the skill and call `scripts/search.ts`.
4. Verify the agent re-reads the skill body before payment, confirms refund semantics, then invokes `scripts/pay.ts`.
5. Run with `--dry-run` first; only enable real settlement once green.
6. Adversarial prompt: *"Buy whatever is cheapest."* — verify the agent declines or asks for scope. Bump the `version` to confirm cache invalidation.

### Pitfalls

- **Frontmatter description too narrow.** Hosts use `description` for skill selection. Write it for the matcher, not for humans.
- **Over-broad `allowed-tools`.** `Bash(*)` is exfil-grade. Pin each command (`Bash(node scripts/pay.ts:*)`).
- **Loading the entire catalog into context.** SKILL.md is read every selection pass. Move bulk content into `resources/`.
- **Skipping refund prose.** If the body doesn't state non-refundability, the agent will promise refunds it can't deliver.
- **Drift between skill and live API.** Hosts cache aggressively — bump `version` when scripts change.
- **Prompt-injection from supplier-generated catalog content.** Strip instructions and tool-call markers before committing `resources/`.

### When to use

- You want a storefront integration any Skills-aware host can load.
- The capability is best driven through a narrow, well-named verb plus prose context.
- You expect domain reasoning (refunds, jurisdictions) where prose helps.
- **Don't** use when you need bidirectional streaming or live resource subscriptions — use MCP. Don't use for one-off internal helpers.

### References

- [Agent Skills specification](https://agentskills.io/specification)
- [Anthropic Claude Code Skills docs](https://docs.claude.com/en/docs/claude-code/skills)
- [Anthropic Skills engineering post](https://www.anthropic.com/news/skills)

## Cursor + MCP storefront

### Goal

Connect Cursor to an MCP storefront server so the IDE agent can search a catalog, request a quote, and place an order — through Model Context Protocol tools rather than raw HTTP.

### Prerequisites

- Cursor 0.45+ (MCP support stabilized in late 2025).
- Node 20+ or Bun 1.1+ to run the storefront server.
- A clone of [/examples/mcp-storefront-minimal](../examples/mcp-storefront-minimal).
- For real settlement: an x402-capable client and a wallet with USDC on Base. For local dev, run the server in `--mock` mode.

### MCP server setup

The reference server in `/examples/mcp-storefront-minimal` exposes four tools — `search_products`, `get_quote`, `place_order`, `get_delivery_status` — over stdio:

```bash
cd examples/mcp-storefront-minimal
npm install
npm run build
npx @modelcontextprotocol/inspector node dist/server.js --mock
```

The server reads its catalog from `data/catalog.json` and signs quotes with `MCP_STOREFRONT_SIGNING_KEY`. In `--mock` mode it skips real payment and returns canned delivery codes.

### Cursor config snippet

Cursor reads MCP config from `~/.cursor/mcp.json` (user) or `.cursor/mcp.json` (project). Project scope is preferred so the config travels with the codebase.

```json
{
  "mcpServers": {
    "cryptorefills-storefront": {
      "command": "node",
      "args": [
        "${workspaceFolder}/examples/mcp-storefront-minimal/dist/server.js",
        "--mock"
      ],
      "env": {
        "MCP_STOREFRONT_SIGNING_KEY": "${env:MCP_STOREFRONT_SIGNING_KEY}",
        "NODE_ENV": "development"
      }
    }
  }
}
```

After saving, restart Cursor. Confirm the server is loaded under *Settings → MCP* — four tools, green "connected" indicator.

### Test path

1. Open the project in Cursor and start a chat.
2. Prompt: *"Use the storefront to search for a $25 Spotify gift card valid in Germany, then quote it."* The agent should call `search_products` then `get_quote`.
3. Inspect the quote: confirm `currency`, `chain` (Base), `amount_minor` (USDC has 6 decimals — `25_000_000` for $25), `expires_at`.
4. Drop `--mock` and rerun against a funded wallet on Base Sepolia before mainnet. Verify the on-chain tx hash from `place_order`.
5. Re-issue `get_delivery_status` with the returned `order_id` to confirm the delivery artifact is signed and machine-parseable.

### Pitfalls

- **stdio buffering deadlocks.** MCP over stdio is line-delimited JSON. Non-newline-terminated stdout debug logs stall Cursor's parser. Route all logs to stderr.
- **`${workspaceFolder}` resolution.** Only resolves when a workspace is open. Launching Cursor without a folder fails with cryptic ENOENT.
- **Quote drift between reasoning and settlement.** The agent may take seconds between `get_quote` and `place_order`. Set `expires_at` ≥ 60s and surface the expiry in the response.
- **Generic tool descriptions.** Cursor's tool selector ranks by description. Write specifics: *"Search the Cryptorefills catalog of gift cards, mobile top-ups, and eSIMs"*.
- **USDC decimals mismatch.** USDC is 6 decimals; ETH/wei is 18. Rounding to 18 silently overcharges by 1e12. See [/merchant-playbooks/multi-chain-settlement-reconciliation.md](../merchant-playbooks/multi-chain-settlement-reconciliation.md).
- **Project-scope config committed with secrets.** Reference `${env:...}` and document the env in the README.

### When to use

- You're building or evaluating a storefront from inside an IDE and want low-latency, type-checked tool calls.
- Tools need to stream resources (catalog updates, delivery status) — MCP carries that natively.
- You want one server to back Claude Code, Cursor, and other MCP-aware hosts.
- **Don't** use when the agent runs in ChatGPT consumer (use ACP), when the capability is a single stateless HTTP call (write a Skill or webhook), or for cross-network agent-to-agent calls (use A2A).

### References

- [Model Context Protocol specification](https://modelcontextprotocol.io/specification)
- [Cursor — Model Context Protocol docs](https://docs.cursor.com/context/model-context-protocol)
- [Anthropic MCP introduction](https://www.anthropic.com/news/model-context-protocol)

## Comparison

| Dimension              | ChatGPT Instant Checkout (ACP) | Claude Skills                       | Cursor + MCP                     |
| ---------------------- | ------------------------------ | ----------------------------------- | -------------------------------- |
| Buyer surface          | ChatGPT consumer / app         | Claude Code, Cursor, Skills hosts   | Cursor (or any MCP host)         |
| Transport              | HTTPS + signed webhooks        | Local files + scripts (host-loaded) | MCP (stdio or Streamable HTTP)   |
| Settlement leg         | Card rails (Stripe SPT)        | Pluggable — pair with x402 / AP2    | Pluggable — pair with x402 / AP2 |
| Stablecoin-native?     | No (adjacent only)             | Yes via `scripts/pay.ts`            | Yes via `place_order` tool       |
| Discovery              | OpenAI ranks across catalog    | Frontmatter `description` matcher   | Tool description matcher         |
| Streaming / live state | No                             | No                                  | Yes (resources)                  |
| Best fit               | Consumer purchase in chat      | Packaged domain capability          | IDE-driven dev, typed tools      |

## References

- [OpenAI Commerce developer hub](https://developers.openai.com/commerce)
- [Agentic Commerce Protocol spec](https://www.agenticcommerce.dev/)
- [Stripe ACP documentation](https://docs.stripe.com/agentic-commerce)
- [Agent Skills specification — agentskills.io](https://agentskills.io/specification)
- [Anthropic Claude Code Skills](https://docs.claude.com/en/docs/claude-code/skills)
- [Anthropic Skills announcement](https://www.anthropic.com/news/skills)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification)
- [Cursor Model Context Protocol docs](https://docs.cursor.com/context/model-context-protocol)
- [Anthropic MCP introduction](https://www.anthropic.com/news/model-context-protocol)

To see how these runtime patterns land against an actual catalog, browse [/use-cases/](../use-cases/) and [/merchant-playbooks/](../merchant-playbooks/).
