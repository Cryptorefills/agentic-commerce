# Contributing

Thanks for considering a contribution to **Cryptorefills · Agentic Commerce**.

This repo is curated. We aim for a high signal-to-noise ratio, fast PR review, and durable links. The rules below exist to keep that bar.

## What we accept

1. **New resources** — protocols, payment rails, agent skills, MCP servers, runnable examples, articles, videos, podcasts, books, courses, conferences.
2. **Updates** — moved or renamed projects, version bumps, deprecations, status changes (e.g. "spec → live").
3. **New playbooks** — merchant or agent playbooks backed by a public artifact (a doc, a repo, a post, a public talk).
4. **New comparisons** — additions to the matrix or decision tree, with sourced rows.
5. **Fixes** — broken links, typos, factual errors, outdated facts.
6. **Translations** — once the English content stabilizes (post-1.0).

## Rules

### 1. Official sources only

Link to the maintaining organization's spec, documentation, blog post, or repository. Do not link to a third-party tutorial as the *primary* source for a protocol or rail entry. (Tutorials are welcome under `/resources.md#articles`.)

### 2. Production-evidence preferred

For playbooks and examples, link to a public, reproducible artifact — a published doc, a public repo, a recorded talk, a public post-mortem. We do not accept proprietary screenshots or NDA material. If your evidence is private, write the playbook so the *pattern* stands without it.

### 3. One change per PR

One resource, one playbook, one comparison row, one fix. PRs that bundle ten unrelated changes get split or closed.

### 4. Alphabetize within categories

Unless there's a stated ordering rationale (e.g. the protocol matrix is ordered by adoption, not name).

### 5. No marketing language

Description should be neutral and factual. Cut "production-grade", "best-in-class", "leading", "powerful", "next-generation". Tell us what it *does*.

### 6. Reproducible code

Examples must run locally with documented prerequisites. Each example folder needs:
- A `README.md` with a "Run it" section.
- A license header (Apache-2.0 — see [LICENSE-CODE](./LICENSE-CODE)).
- No hardcoded secrets. Use `.env.example` and `process.env`.
- Pinned dependencies.

### 7. Respect licenses

Don't paste copyrighted prose. Quote with attribution if necessary. The repo content is CC0-1.0; that means *your* contribution will be CC0-1.0 too. Don't contribute material you don't have the right to dedicate to the public domain.

### 8. Honest claims

If a protocol "supports" feature X, link to the spec section or doc that says so. If a rail is "live", link to a public production artifact. We do not allow aspirational language as if it were shipped.

## How to add a resource

1. Open an issue using the **Add a resource** template, or skip straight to a PR.
2. Add the entry to the right file under `/protocols`, `/rails`, `/use-cases`, etc.
3. Update the parent index (`README.md` or the section's `README.md`) if needed.
4. Run `markdownlint` and the link-checker locally if you can.
5. Open the PR, fill in the template.

## How to add a playbook

Playbooks are the wedge of this repo. They are higher-stakes than resource entries.

1. Pick a real problem you've solved or seen solved in production.
2. Use the template in [`/merchant-playbooks/_template.md`](./merchant-playbooks/_template.md) (or [`/agent-playbooks/_template.md`](./agent-playbooks/_template.md)).
3. Each playbook must have:
   - **Problem** — one paragraph.
   - **Why it isn't covered by the protocols** — one paragraph.
   - **Approach** — concrete decisions, with tradeoffs.
   - **Edge cases** — what we ran into.
   - **References** — public artifacts.
   - **When to use this** / **When NOT to use this**.
4. Link to a public artifact (doc, repo, post). If your artifact is private, generalize the pattern enough that it stands alone.

## Style

- Prefer plain prose to bullet soup.
- Diagrams in **Mermaid** where possible — they render inline on GitHub and parse cleanly for LLMs.
- Tables for comparisons.
- `<details>` / `<summary>` for FAQ-shaped content.
- One concept per file. Many small files beats one large file.
- Markdown headings are the navigation. Use H2 for top-level sections inside a file, H3 for subsections. Don't skip levels.

## Scope — in and out

**In scope:**
- Agentic commerce protocols and payment rails.
- Agent skills, MCP servers, A2A patterns aimed at commerce.
- Merchant operations for agentic checkout.
- Use cases with shippable surfaces (gift cards, mobile, eSIMs, travel, subscriptions, APIs, M2M).
- Comparison and decision content.
- Real published reading material.

**Out of scope:**
- General AI agent content with no commerce surface.
- Generic e-commerce content with no agent surface.
- Individual product launches that don't introduce a new pattern.
- Closed-source SDKs without public documentation.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Contributor Covenant 2.1. Be useful, be honest, be kind.

## License

By contributing, you agree your contribution is licensed under [CC0-1.0](./LICENSE) (content) or [Apache-2.0](./LICENSE-CODE) (code), depending on what you contributed. CC0 means public domain. If you can't dedicate your contribution to the public domain (e.g. employer constraints), don't contribute it.

## Maintainer SLAs

We aim for:
- **24h** to triage a new issue.
- **24h** to merge a trivially-correct PR (typo, link fix, alphabetization).
- **5 business days** to review a substantive PR (new playbook, new protocol page, new comparison row).
- We close stale PRs after 30 days of no activity, with a comment.

## Questions

Open a [GitHub Discussion](https://github.com/cryptorefills/agentic-commerce/discussions) (once enabled) or an issue with the **Question** template.
