# Pricing Drift and Re-Quote

> Quote-vs-settle drift when stablecoin FX, supplier price, or chain confirmation latency moves under you. TTLs, drift thresholds, and re-quote semantics.

---

## Problem

An agent asks for a $50 Amazon US gift card and accepts a quote of `49.85 USDC` at 14:02:11.000. The agent submits the order at 14:02:11.420, the buyer wallet broadcasts on Base at 14:02:14, and the chain confirms with sufficient finality at 14:02:23. Three things may have moved in those twelve seconds: the supplier's wholesale price (gift cards are often priced against a daily wholesale rate that updates intraday), the USDC/USD peg micro-deviation (Circle USDC trades within tight bands but is not a hard peg), and — for non-USD denominations — the FX between the agent's settlement asset and the supplier's billing currency. Stablecoins also occasionally depeg meaningfully (USDC briefly traded near $0.88 during the March 2023 SVB event; USDT has wobbled during liquidity stress). On a 50-cent margin a 30bps drift erases the trade. On a $500 SKU it changes which side of break-even the merchant lands on. The merchant either eats the drift, refuses to settle, or re-quotes — and the protocol does not tell us which.

This is the *most-litigated bug class* in agent-payable checkout. Every team that ships agent payments hits it within the first month.

---

## Why protocols don't cover this

ACP defines an order lifecycle with quote, accept, and pay steps but explicitly leaves the validity window of a quote to the merchant. The spec says a quote *may* expire and a checkout session *may* be invalidated; it doesn't define a TTL, a drift threshold, or a re-quote handshake. AP2 is upstream of pricing — it authorizes a mandate up to a cap, but the in-cap variability of the actual amount is the merchant's concern. x402 settles a specific amount in a specific asset on a specific chain; if the merchant decided that amount five seconds ago and the price has since moved, x402 has nothing to say. L402 is the same: macaroon-with-a-price, the price is the merchant's decision. None of the specs define how to communicate "your quote expired" vs "your quote drifted past the threshold and here is a new one" vs "your quote is still valid, settle now." The merchant invents this protocol.

---

## Approach

We treat the quote as a short-lived signed object with three explicit knobs: TTL, drift threshold, and a re-quote handshake. The agent learns the rules at quote time.

### Decision 1: a TTL per quote, not per session

What we do: every quote has a `ttlSeconds` field, default 60s, configurable per SKU class. Volatile categories (FX-priced gift cards, time-sensitive flights) get 30s. Stable categories (USD-priced gift cards on a USD-stablecoin settlement) get 90s. The TTL is signed inside the quote envelope; tampering invalidates the signature.

Why: a session-level TTL is too coarse. An agent can hold a session open for minutes; a quote *must not*.

Tradeoff: the agent must be prepared to re-quote on every transaction, including in the middle of an interactive flow. We see ~3% re-quote rate at 60s TTL on stablecoin-to-USD SKUs; this is acceptable.

### Decision 2: drift threshold in basis points, not percentage

What we do: at submit time, we re-price the SKU against the live supplier and the live FX. If the new total differs from the quoted total by more than `driftThresholdBps` (default 50bps = 0.5%), we refuse settlement and return `quote_drifted` with a fresh quote. If the drift is *favorable* to the user (price moved down), we settle at the lower price and emit a credit reconciliation entry. We do not silently overcharge.

Why: bps quantizes the threshold across SKU sizes ($5 and $500 cards see the same percentage threshold). Symmetric handling — reject when adverse, pass-through when favorable — defends both the user and the audit trail.

Tradeoff: pass-through credits add reconciliation entries and change the receipt total vs the quote. The receipt has to clearly show the favorable drift and the reduced charge, or auditors will read it as inconsistent.

### Decision 3: explicit re-quote handshake, not a silent retry

What we do: when a quote is rejected for drift or expiration, the response is a new quote envelope with `replaces: <old_quote_id>` and a fresh signature, fresh TTL, fresh total. The agent must explicitly accept the new quote — we do not let an agent pre-authorize "any quote within X% of the original." That converts a bounded transaction into an unbounded one.

Why: agents under prompt-injection or compromised tool definitions will accept anything they're told to accept. A forced re-acknowledgment limits the blast radius.

Tradeoff: an extra round trip on the ~3% drift case. Worth it.

### Decision 4: chain finality is a quote concern, not a settlement-only concern

What we do: the quote includes `expectedFinalityMs` per chain (Base ~2s for soft confirmations, ~12 minutes for L1 finality; Tron ~3s for SR confirmations; Solana ~13s for finalized). If the agent's chosen chain has expected finality longer than the remaining TTL at submit time, we refuse the quote rather than accept a payment that may confirm after the supplier price has moved.

Why: chain finality variance is the silent killer. A USDC payment on Base that lands in 2s is fine on a 60s TTL. A USDC payment on Ethereum L1 with a 30s TTL will sometimes confirm after the quote has expired. We catch that at submit, not after the user has paid.

Tradeoff: we sometimes reject Ethereum L1 payments on short-TTL SKUs. The user has to pick a faster chain. This is correct.

### Schema sketch

```ts
type Quote = {
  quoteId: string                      // ULID, unique per quote
  skuId: string
  totals: {
    subtotal: { amount: string, currency: 'USD' | 'EUR' | string }
    fees:     { amount: string, currency: string }
    grand:    { amount: string, currency: 'USDC' | 'USDT' | 'DAI' | string }
  }
  settlement: {
    asset: 'USDC' | 'USDT' | 'DAI' | 'EURC'
    chain: 'base' | 'ethereum' | 'tron' | 'solana' | 'polygon'
    expectedFinalityMs: number         // chain-specific
  }
  policy: {
    ttlSeconds: number                 // 30 | 60 | 90
    driftThresholdBps: number          // default 50
    onFavorableDrift: 'pass-through' | 'reject'
  }
  issuedAt:  string                    // ISO 8601
  expiresAt: string                    // issuedAt + ttlSeconds
  replaces?: string                    // prior quoteId if this is a re-quote
  sig: string                          // merchant signature over the canonicalized quote
}

type SettleResponse =
  | { status: 'settled', orderId: string }
  | { status: 'quote_expired',  newQuote: Quote }
  | { status: 'quote_drifted',  driftBps: number, newQuote: Quote }
  | { status: 'chain_too_slow', newQuote: Quote, suggestion: { chain: string, asset: string } }
```

The `replaces` chain is preserved so an audit can reconstruct every re-quote a single intent produced. We have seen single intents produce three re-quotes during chain congestion; without the chain you can't reconstruct the user's actual exposure.

---

## Edge cases

- **Stablecoin depeg events.** USDC at $0.985, USDT at $0.992 — even a "stable" stablecoin can move 50-150bps over minutes during liquidity stress. We monitor issuer-published reserve attestations and oracle prices (Chainlink, Pyth) and tighten `driftThresholdBps` automatically when median deviation exceeds 30bps.
- **Supplier inventory drop between quote and settle.** The supplier returns "out of stock" on a SKU we just quoted. We refund-on-settle (the agent's payment is returned) and emit `inventory_lost` with a re-quote pointing at the next-best supplier. See [refunds-and-disputes](./refunds-and-disputes-for-agents.md).
- **Re-org on an L2.** Base and other L2s can re-org under stress. We require N-block confirmations matching the SKU's risk class — high-value SKUs wait longer. A re-org that orphans a settled tx triggers a re-quote, not a refund attempt against a tx hash that no longer exists.
- **Bridged stablecoins.** Bridged USDC (e.g. `USDC.e` on some chains) is *not* the same asset as native USDC. We treat them as separate `quotableCurrencies` and never silently substitute.
- **Concurrent quotes for the same SKU.** An agent requests three quotes in rapid succession to compare. Each gets its own ID and TTL; we don't deduplicate. Settlement is per-quote, not per-SKU.
- **Clock skew on the agent side.** An agent with a slow clock may submit a quote it believes is valid but is past its `expiresAt`. We reject on the merchant clock. The merchant clock is authoritative.
- **Favorable drift and tax implications.** A pass-through credit changes the invoice total; jurisdictions that compute VAT on the invoice line need the new total, not the quoted total. The receipt encodes both.

---

## When to use this

- You quote in stablecoin and settle in stablecoin where the supplier prices in a different fiat or stablecoin.
- Your settlement chain has variable finality (any L1, Tron under load, Ethereum under congestion).
- Your suppliers have intraday wholesale price moves.
- Your SKU margins are thin enough that 30-100bps of drift matters.

---

## When NOT to use this

- Same-asset, same-chain, instantly-final flows where the merchant is also the supplier and the price is fixed at quote time — no drift to defend against.
- Pre-paid stored-value flows where the user has already settled into the merchant's ledger and the "purchase" is a balance debit. Drift was handled at top-up time.
- Lightning micropayments where the price is in sats and the settlement is sub-second; TTLs are sub-second too and the re-quote machinery is overhead. Use L402's macaroon expiry directly.
- High-frequency M2M flows where re-quote round trips would dominate latency. For those, agree a price corridor up front in a longer-lived AP2 mandate and skip per-call re-quotes.

---

## References

- **ACP** — checkout session and quote lifecycle · [agentic-commerce-protocol](https://github.com/agentic-commerce-protocol)
- **AP2** — mandate caps and authorization model · [google-agentic-commerce/AP2](https://github.com/google-agentic-commerce/AP2)
- **x402** — challenge-and-settle exchange semantics · [coinbase x402 docs](https://www.x402.org)
- **Circle USDC** — multichain availability, finality, and reserve attestations · [developers.circle.com](https://developers.circle.com), [Circle reserve report](https://www.circle.com/transparency)
- **Tether USDT** — multichain availability and reserve disclosures · [tether.to/transparency](https://tether.to/en/transparency)
- **Chain finality references** — Base, Ethereum, Tron, Solana, Polygon official docs.
- **Chainlink and Pyth oracle prices** — used as drift reference for stablecoin pegs.
- Related playbooks: [multi-chain-settlement-reconciliation](./multi-chain-settlement-reconciliation.md), [refunds-and-disputes-for-agents](./refunds-and-disputes-for-agents.md), [receipts-and-proof-of-purchase](./receipts-and-proof-of-purchase.md).

---

## Changelog

- **2026-04-28** — initial publication.
