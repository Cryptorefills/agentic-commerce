# Agent buys digital goods — end-to-end (mocked)

A single-script demo of the full happy path: an agent searches a multi-category digital-goods catalog (gift cards, mobile top-ups, eSIMs), gets a quote, pays via an x402-style header, and receives a category-appropriate signed delivery envelope.

## Why this is the canonical agent-shopping demo for digital goods

Digital goods (gift cards, mobile top-ups, eSIMs) are the cleanest reference case for agentic commerce: instant fulfillment, no shipping, no chargebacks, no inventory model that changes by region. The same five-step loop — search, quote, pay, settle, deliver — runs across all three categories with only the delivery envelope shape changing. That's what this demo shows.

## Goal

Stitch the previous two examples (`x402-pay-an-api`, `mcp-storefront-minimal`) into a single readable narrative so you can see the full agentic-commerce loop in one file. Useful as a screencast script, a tutorial backbone, or a scaffold for your own integration.

## Prerequisites

- Node.js >= 20.10
- pnpm >= 9 (or npm/yarn)

```bash
cp .env.example .env
pnpm install
```

## Run it

```bash
pnpm demo
```

By default this runs the `gift_card` category. Switch categories with the `--category` arg:

```bash
pnpm demo -- --category=gift_card     # default
pnpm demo -- --category=mobile_topup
pnpm demo -- --category=esim
```

Convenience scripts are also wired up:

```bash
pnpm demo:mobile
pnpm demo:esim
```

Everything happens in-process — no extra terminals, no servers to start. The "MCP storefront", the "x402 facilitator", and the "supplier" are all in-file functions, each marked `// MOCK:` where production would substitute a real dependency.

## Expected output (gift_card, default)

```
[demo] step 1/5  search   -> 5 gift_card products available
[demo] step 2/5  quote    -> qt_xxxx  total 50.08 USDC on base-sepolia
[demo] step 3/5  pay      -> X-PAYMENT header built (50.08 USDC, signed: mock)
[demo] step 4/5  settle   -> facilitator returned txHash 0xMOCKTX_...
[demo] step 5/5  deliver  -> code MOCK-AMAZ-XXXX-XXXX (by_email)

=== signed receipt ===
{
  "version": "cr-receipt/1",
  "order_id": "ord_xxxx",
  "merchantSurfaces": ["Skills", "MCP", "x402"],
  "line": {
    "product_id": "0cbbacb6-4820-4463-945e-914295fcd002",
    "brand_id": "11111111-1111-4111-8111-111111111111",
    "brand": "Amazon",
    "kind": "giftcard",
    "category": "shopping",
    "denomination": "$50",
    "face_value": { "currency_code": "USD", "amount": { "type": "fixed", "price": "50.00" } },
    "quantity": 1
  },
  "...": "..."
}
```

For `--category=mobile_topup` the deliver step prints `confirmationId MOCK-CONF-...`. For `--category=esim` it prints `eSIM LPA:1$DEMO-NOT-REDEEMABLE...`. The catalog and field names (`product_id`, `brand_id`, `kind`, `face_value`, `delivery_type`, `coin`, `payment_method`) mirror the real public Cryptorefills MCP server. The final block is a JSON receipt shaped like a real signed proof-of-purchase (see [`/merchant-playbooks/receipts-and-proof-of-purchase.md`](../../merchant-playbooks/receipts-and-proof-of-purchase.md)). The signature is mocked.

## Read next

- [`/examples/x402-pay-an-api`](../x402-pay-an-api) — the payment primitive on its own.
- [`/examples/mcp-storefront-minimal`](../mcp-storefront-minimal) — the MCP storefront on its own.
- [`https://github.com/cryptorefills/agents`](https://github.com/cryptorefills/agents) — Skills repo (`cryptorefills-catalog`, `cryptorefills-buy`, `cryptorefills-x402`) — the same tool surface as a Claude/Cursor Skill.
- [`https://www.cryptorefills.com/en/spend-crypto`](https://www.cryptorefills.com/en/spend-crypto) — the human-facing version of this catalog.
- [`/use-cases/gift-cards.md`](../../use-cases/gift-cards.md) — production gift-card semantics: redelivery, partial refunds, jurisdictional classification.
- [`/merchant-playbooks/delivery-semantics-codes-pnrs-esims.md`](../../merchant-playbooks/delivery-semantics-codes-pnrs-esims.md) — what "delivered" means per product type.

## What this demo does NOT do

- No real MCP transport — the storefront is invoked as a function rather than over stdio. See `mcp-storefront-minimal` for the real transport.
- No real x402 settlement — the "facilitator" returns a mock txHash.
- No real signing on the receipt — `signature` is `0xMOCKSIG...`.
- No idempotency keys, no retry budgets, no failure paths. All sad paths are simulated by tweaking the script.

## Real-merchant mapping

A production digital-goods flow — operated by merchants like Cryptorefills — adds brand disambiguation, regional eligibility, KYC posture per jurisdiction, partial-refund handling against revealed codes, and supplier-side fulfillment that this demo mocks. See [/use-cases/gift-cards.md](../../use-cases/gift-cards.md) and [/merchant-playbooks/refunds-and-disputes-for-agents.md](../../merchant-playbooks/refunds-and-disputes-for-agents.md).

## Safety guarantees

- **No real funds move.** Default mode is `MOCK_MODE=true`. Real-checkout paths are not implemented.
- **No real keys required.** No environment variable is required to run the demo.
- **No external network calls** in default mode. Local-only.
- **Fake delivery codes** are clearly non-redeemable (`MOCK-` / `DEMO-` prefixes).
- If you fork this and add a real-payment path, **add tests for the safety guard before merging.**
