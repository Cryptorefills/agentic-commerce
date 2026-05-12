# Resources

> *Selection bias: we prioritize materials useful to a production merchant operating agentic commerce — protocols, rails, agent runtimes, and the operations layer.*

Curated reading, viewing, listening, and tooling for agentic commerce. Every link points to an officially maintained source — vendor blogs are accepted when the post documents the vendor's own product, but scraped mirrors, soft-paywalled excerpts, and content of unverifiable provenance are excluded. Entries are alphabetized within each section. If a category looks thin, it is intentional: the field moves quickly, but the durable references are still few.

## Articles

- [Agent Payments Protocol (AP2) announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-payments-protocol-ap2) — Google Cloud — Launch post for AP2 and the partner roster behind it.
- [Agentic commerce is the next platform shift](https://www.crossmint.com/blog) — Crossmint — Crossmint's framing of agentic commerce as a new transactional layer; mostly product-positioning, useful for the category vocabulary.
- [Building agentic commerce with Stripe](https://stripe.com/blog) — Stripe — Stripe's overview of how their agentic-commerce primitives plug into ACP and x402.
- [Coinbase Commerce x402 launch](https://www.coinbase.com/blog) — Coinbase — Coinbase's announcement of x402 and the HTTP 402 stablecoin pattern.
- [Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) — Anthropic — The MCP launch post; the canonical "what is MCP" reference.
- [MCP servers for commerce](https://www.anthropic.com/news) — Anthropic — Anthropic's framing of how MCP servers expose commerce surfaces to Claude and other clients.
- [OpenAI Apps and the Agentic Commerce Protocol](https://openai.com/blog) — OpenAI — OpenAI's announcement of the apps platform and ACP's role in checkout.
- [Shopify storefront MCP](https://shopify.engineering) — Shopify Engineering — Shopify's writeup of exposing the storefront API as an MCP server.
- [Stripe x402 on Base](https://stripe.com/blog) — Stripe — Stripe's integration post for x402-on-Base settlement.
- [The Agent Pay vision](https://www.mastercard.com/news) — Mastercard — Mastercard's positioning piece on Agent Pay and agent-aware card underwriting.
- [Visa Trusted Agent Protocol](https://usa.visa.com/about-visa/newsroom.html) — Visa — Visa's announcement of TAP and its agent-credentialing model.
- [What is x402?](https://www.x402.org/) — x402 Foundation — Spec hub overview with examples.
- [Why agentic commerce needs verifiable credentials](https://github.com/google-agentic-commerce/AP2) — Google AP2 — AP2 design rationale, including why mandates use VCs.

## Videos

- [Anthropic dev livestreams](https://www.youtube.com/@anthropic-ai) — Anthropic / YouTube — Channel hosting MCP and Claude developer talks; specific episodes covering MCP commerce surfaces.
- [Coinbase Developer Platform sessions](https://www.youtube.com/@CoinbaseDeveloperPlatform) — Coinbase / YouTube — Channel with x402 walkthroughs and Base agentic-payments demos.
- [Devcon talks](https://www.youtube.com/@EthereumFoundation) — Ethereum Foundation / YouTube — Devcon recordings; search for agent-payments and EIP-related sessions.
- [Google Cloud Next sessions](https://cloud.withgoogle.com/next) — Google Cloud — Cloud Next session library; AP2 and Vertex agent sessions.
- [OpenAI DevDay](https://www.youtube.com/@OpenAI) — OpenAI / YouTube — Channel hosting the DevDay keynote and developer sessions, including ACP and ChatGPT apps.
- [Shopify Editions](https://www.shopify.com/editions) — Shopify — Shopify's biannual product showcase; agentic and storefront MCP content.
- [Stripe Sessions](https://www.youtube.com/@StripeDev) — Stripe Developers / YouTube — Stripe's developer keynotes including agentic commerce primitives.

## Podcasts

- [a16z Podcast](https://a16z.com/podcast/) — Andreessen Horowitz — Recurring coverage of AI agents, stablecoins, and crypto-payments primitives.
- [Bankless](https://www.bankless.com/podcast) — Bankless — Crypto-payments, stablecoin, and agent-finance episodes.
- [Latent Space](https://www.latent.space/) — swyx and Alessio — AI engineering podcast; multiple episodes on agent runtimes and tool use.
- [Lex Fridman Podcast](https://lexfridman.com/podcast/) — Lex Fridman — Long-form interviews including AI-payments and stablecoin operator conversations.
- [No Priors](https://www.no-priors.com/) — Sarah Guo & Elad Gil — AI investor podcast with regular agentic-commerce coverage.
- [Practical AI](https://changelog.com/practicalai) — Changelog — Engineering-focused episodes on AI tooling, including MCP and agent infrastructure.
- [The AI Agent Podcast](https://www.youtube.com/@aiagentpodcast) — Independent — Episodes specifically on agent operations and commerce flows.
- [The Stripe Podcast](https://stripe.com/sessions) — Stripe — Stripe's own podcast; episodes on agentic commerce primitives.
- [Unchained](https://unchainedcrypto.com/podcasts/) — Laura Shin — Crypto-payments and stablecoin coverage relevant to x402 and L402.

## Books

- [Designing Data-Intensive Applications](https://dataintensive.net/) — Martin Kleppmann — The reference for the consistency, replication, and ledger-design problems any multi-rail merchant runs into.
- [Mastering Bitcoin](https://github.com/bitcoinbook/bitcoinbook) — Andreas M. Antonopoulos — Open-source second edition; foundational for anyone building on BTC and Lightning rails.
- [Mastering the Lightning Network](https://github.com/lnbook/lnbook) — Antonopoulos, Osuntokun, Pickhardt — Open-source companion to Mastering Bitcoin focused on Lightning, directly relevant to L402.
- [The Anthropic guide to building effective agents](https://www.anthropic.com/research) — Anthropic — Long-form research notes on agent design that read book-length when collected.
- [When AI Shops](https://www.amazon.com/dp/B0DH9F3HBG) — Geoff Gibbins — One of the first practitioner books framing agentic commerce as a category; useful for vocabulary and merchant-side framing.

## Courses

- [AI Agents in LangGraph](https://www.deeplearning.ai/short-courses/ai-agents-in-langgraph/) — DeepLearning.AI — Short course on building agent runtimes with LangGraph; useful primitives for commerce-flow agents.
- [Anthropic Skilljar courses](https://anthropic.skilljar.com/) — Anthropic — Anthropic's structured courses including Claude API, MCP, and agent-engineering tracks.
- [Building Systems with the ChatGPT API](https://www.deeplearning.ai/short-courses/building-systems-with-chatgpt/) — DeepLearning.AI — Foundations for orchestrating LLM-driven workflows.
- [Functions, Tools and Agents with LangChain](https://www.deeplearning.ai/short-courses/functions-tools-agents-langchain/) — DeepLearning.AI — Tool-use fundamentals that translate to MCP and ACP/AP2 client work.
- [LLMOps](https://www.deeplearning.ai/short-courses/llmops/) — DeepLearning.AI — Production patterns for LLM systems, applicable to running agent-driven checkout in production.
- [MCP for Developers](https://www.anthropic.com/learn) — Anthropic — Anthropic's developer-track materials on MCP servers and clients.

## Conferences

- [a16z Crypto Summit](https://a16zcrypto.com/) — Andreessen Horowitz — Recurring summit and content series on crypto-payments primitives, including agentic commerce.
- [AI Engineer Summit / World's Fair](https://www.ai.engineer/) — AI Engineer — Practitioner conference; tracks on agent runtimes, tool use, MCP.
- [Coinbase Developer Day](https://www.coinbase.com/developer) — Coinbase — Coinbase's developer event; x402 and Base agent content.
- [Devcon](https://devcon.org/) — Ethereum Foundation — Ethereum's flagship conference; agent-payments, EIPs, and on-chain commerce.
- [ETHDenver](https://www.ethdenver.com/) — ETHDenver — Largest grassroots Ethereum conference; agentic commerce and stablecoin tracks.
- [Google Cloud Next](https://cloud.withgoogle.com/next) — Google Cloud — AP2 announcements and partner sessions.
- [Money 20/20](https://www.money2020.com/) — Money 20/20 — Payments-industry flagship; agentic commerce sessions in the AI track.
- [OpenAI DevDay](https://openai.com/devday) — OpenAI — Annual developer event; ACP and ChatGPT apps content.
- [Shopify Editions](https://www.shopify.com/editions) — Shopify — Twice-yearly product showcase; agentic and storefront MCP launches.
- [Stripe Sessions](https://stripe.com/sessions) — Stripe — Stripe's annual conference; agentic commerce primitives sessions.
- [Token2049](https://www.token2049.com/) — Token2049 — Major crypto conference (Singapore + Dubai); stablecoin and agent-payments tracks.

## Newsletters

- [Ben Thompson — Stratechery](https://stratechery.com/) — Ben Thompson — Recurring strategy coverage of agent platforms, app stores, and payments.
- [Bitcoin Optech](https://bitcoinops.org/) — Bitcoin Optech — Weekly engineering newsletter; relevant for L402 and Lightning operators.
- [Bytes by deeplearning.ai](https://www.deeplearning.ai/the-batch/) — DeepLearning.AI — Weekly AI digest; agent and tool-use coverage.
- [Import AI](https://importai.substack.com/) — Jack Clark — Long-running AI policy and capability newsletter.
- [Latent Space Newsletter](https://www.latent.space/) — swyx and Alessio — AI engineering newsletter to accompany the podcast.
- [Milk Road](https://milkroad.com/) — Milk Road — Crypto-markets daily; covers stablecoin and agentic-payments stories.
- [Not Boring](https://www.notboring.co/) — Packy McCormick — Strategy newsletter with regular agent and payments coverage.
- [Stripe Press](https://press.stripe.com/) — Stripe — Curated long-form including payment-industry primitives that underlie agentic commerce.
- [The Block Newsletter](https://www.theblock.co/newsletters) — The Block — Crypto-industry news including stablecoin-rail developments.
- [The Defiant](https://thedefiant.io/newsletters) — The Defiant — DeFi and stablecoins newsletter, useful for x402 and on-chain commerce context.

## Tools

- [ACP spec repository](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol) — Agentic Commerce Protocol working group — OpenAPI / JSON Schema definitions and reference materials.
- [agentskills.io](https://agentskills.io) — Agent Skills working group — Spec hub for the Agent Skills format used by Claude Code, Cursor, and others.
- [Anthropic SDK (Python)](https://github.com/anthropics/anthropic-sdk-python) — Anthropic — Python SDK for the Claude API; used in MCP host implementations.
- [Anthropic SDK (TypeScript)](https://github.com/anthropics/anthropic-sdk-typescript) — Anthropic — TypeScript SDK for the Claude API.
- [AP2 reference repository](https://github.com/google-agentic-commerce/AP2) — Google Agentic Commerce — AP2 spec, examples, and reference implementations including the x402 extension.
- [Base SDK](https://docs.base.org) — Coinbase — Base L2 developer documentation and SDKs; primary deployment surface for x402 in production.
- [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) — Anthropic — CLI agent that natively supports MCP and Agent Skills.
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) — Cloudflare — Edge-deployed agent runtime with x402 support.
- [Coinbase CDP SDK](https://docs.cdp.coinbase.com/) — Coinbase Developer Platform — Wallets, smart-contract calls, and x402 primitives.
- [Cursor](https://cursor.com) — Cursor — IDE agent supporting MCP servers and Agent Skills.
- [Fewsats](https://fewsats.com/) — Fewsats — L402 toolkit for building Lightning-paid APIs.
- [Lightning Development Kit (LDK)](https://lightningdevkit.org/) — Lightning Labs — Library for building Lightning applications including L402 services.
- [LND (Lightning Network Daemon)](https://github.com/lightningnetwork/lnd) — Lightning Labs — Reference Lightning node; the original L402/LSAT implementation surface.
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) — Model Context Protocol — Build MCP servers and clients in Python.
- [MCP servers (community catalog)](https://github.com/modelcontextprotocol/servers) — Model Context Protocol — Reference MCP servers across many domains, useful as templates for storefront MCPs.
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Model Context Protocol — Build MCP servers and clients in TypeScript.
- [Shopify Storefront MCP](https://shopify.dev) — Shopify — Storefront API exposed as an MCP server.
- [Stripe Agents SDK](https://docs.stripe.com) — Stripe — Stripe's developer surface for agent commerce primitives, including ACP server-side and x402-on-Base.
- [TronWeb](https://github.com/tronprotocol/tronweb) — Tron — JavaScript SDK for Tron, primary surface for USDT-on-Tron settlement.
- [viem](https://viem.sh/) — wagmi/viem — TypeScript interface for EVM chains, widely used in x402 client and server libraries.
- [Wagmi](https://wagmi.sh/) — wagmi — React hooks for Ethereum, common in agent-buyer-loop implementations.
- [x402 reference repository](https://github.com/coinbase/x402) — Coinbase — x402 spec, reference servers and clients, middleware for common frameworks.
- [x402.org](https://www.x402.org/) — x402 Foundation — Spec hub, ecosystem registry, and developer documentation.

## Contributing

Open a PR with one entry per change for faster review. Three rules: official sources only, production-evidence preferred (the post or repo should document a shipped artifact rather than a roadmap), and one change per PR. For broken links, open an issue rather than a PR so maintainers can decide whether a redirect is appropriate. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guidelines.
