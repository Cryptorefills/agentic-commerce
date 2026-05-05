# Rails Comparison

Side-by-side of the settlement rails an agentic-commerce merchant or buyer agent will actually encounter. Numbers are typical April 2026 production behavior; outliers exist on every rail.

## Summary table

| Rail | Settlement speed | Finality model | Fee model | Dispute model | Dev experience |
|---|---|---|---|---|---|
| **USDC on Base** | ~2 s confirmation, ~12 min hard finality[^base-finality] | Probabilistic → hard finality on L2 → L1 settlement | Sub-cent gas; issuer mint/burn fees off-chain[^usdc-fees] | None on-chain; merchant-initiated reverse transfer | High — Stripe, Coinbase, Cloudflare SDKs, x402 ecosystem[^base-dx] |
| **USDC on Ethereum L1** | ~12 s/block; ~12–15 min finality (~64 blocks)[^eth-finality] | Probabilistic → finalized | Variable gas, often $0.50–$5+; spikes higher[^eth-fees] | None on-chain; merchant-initiated reverse | High — every EVM SDK, well-documented |
| **USDT on Tron** | ~3 s/block; ~57 s super-rep finality[^tron-finality] | Probabilistic → SR-confirmed | Energy/bandwidth model, often free for users with staked TRX[^tron-fees] | None on-chain | Medium — TronWeb, well-supported but EVM tooling does not transfer |
| **DAI on Ethereum L1** | ~12 s/block; ~12–15 min finality | Same as ETH L1 | Same as USDC on ETH; CDP-related fees if minting | None on-chain | High — same EVM tooling |
| **EURC on Base** | ~2 s confirmation, ~12 min hard finality | Same as USDC on Base | Sub-cent gas; Circle issuer fees off-chain[^eurc-fees] | None on-chain | High — same as USDC on Base |
| **BTC on-chain** | ~10 min/block; 6-conf (~60 min) standard for high-value[^btc-finality] | Probabilistic; deeper confirmations = higher confidence | Variable sat/vB; $1–$30+ depending on mempool[^btc-fees] | None on-chain | Medium — well-known but slow for agentic UX |
| **BTC over Lightning** | Sub-second routing; settlement on close-out[^ln-finality] | Channel-balance updates are instant; on-chain only at channel open/close | Routing fees often <1 sat; sometimes higher on multi-hop[^ln-fees] | None on-chain | Medium — Lightning Labs, LDK, Fewsats; node-ops overhead |
| **Visa Trusted Agent (TAP)** | T+0–T+1 authorization; T+1–T+3 settlement to merchant[^visa-settle] | Authorization → capture → settlement → chargeback window | Interchange + scheme + acquirer markup; agent surcharges TBD[^visa-fees] | Full chargeback model; agent-specific scheme rules emerging[^visa-disputes] | High — every card processor, but agent-specific endpoints still rolling |
| **Mastercard Agent Pay** | T+0–T+1 authorization; T+1–T+3 settlement[^mc-settle] | Same as Visa | Interchange + scheme + acquirer markup[^mc-fees] | Full chargeback model; Agent Pay-specific rules[^mc-disputes] | High — every card processor with Agent Pay support |
| **SEPA Credit Transfer (EU)** | T+1 batch; SEPA Instant ~10 s when both banks support[^sepa-speed] | Bank-confirmed; reversal limited window | Often free for retail; Instant fees vary[^sepa-fees] | Recall mechanism (R-transactions); not a chargeback[^sepa-recall] | Low–Medium — bank APIs vary; PSD2 open banking helps |
| **ACH (US)** | 1–3 business days standard; same-day ACH for higher-fee batches[^ach-speed] | Bank-confirmed; reversal possible within rules | Per-transaction, often $0.20–$1.50[^ach-fees] | Returns within 60 days for unauthorized debits[^ach-returns] | Low–Medium — Plaid, Dwolla, Stripe ACH |
| **FedNow (US)** | <20 s end-to-end[^fednow-speed] | Bank-confirmed, irrevocable[^fednow-final] | Bank-set; participating banks publish fees[^fednow-fees] | None — irrevocable by design; fraud reversal is bank-mediated | Emerging — direct integration via banks; processor support growing |

## Reading the table

A few patterns to call out.

**Stablecoin finality is fast but not instant.** USDC on Base confirms in seconds, but the practical cutoff for agent UX is "is this transaction reorg-safe?" Most production wallets wait for hard finality before crediting an order. Plan for 12–15 minutes of latency between agent-paid and merchant-credited unless you accept reorg risk explicitly.[^base-finality]

**There is no chargeback in stablecoin or Lightning.** Once the transfer is on-chain, it is final. Refunds are merchant-initiated reverse transfers. This is a feature for some merchants (no chargeback fraud) and a problem for some buyers (no recourse). Encode your refund policy in the receipt and the merchant feed so both sides know what is reversible. See [`/merchant-playbooks/refunds-and-disputes-for-agents.md`](../merchant-playbooks/refunds-and-disputes-for-agents.md).

**Card networks are fast on authorization, slow on settlement, and reversible.** A Visa or Mastercard authorization is T+0; merchant settlement is T+1–T+3; the chargeback window is up to 120 days. Agentic card protocols (TAP, Agent Pay) inherit this — they add agent-specific fraud signals and underwriting, but the settlement and dispute mechanics are the same.[^visa-settle][^mc-settle]

**Bank rails differ a lot by jurisdiction.** SEPA Instant is sub-10s in the EU when both banks participate, and reversal is via a recall mechanism (not a chargeback). FedNow is sub-20s and irrevocable. ACH is slow (1–3 days) and partially reversible (60-day window for unauthorized debits). For agentic flows, FedNow's irrevocability is closer to stablecoin semantics than to ACH.[^sepa-recall][^fednow-final][^ach-returns]

**Fees compound at the agent layer.** Every rail has its own fee model, and an agentic flow may stack several (issuer mint, on-chain gas, Lightning routing, scheme fees, FX). When quoting in user-local currency and settling in a different currency, build a quote-to-settle FX buffer; see [`/merchant-playbooks/pricing-drift-and-requote.md`](../merchant-playbooks/pricing-drift-and-requote.md).

**Tron USDT is the dominant emerging-market rail.** USDT on Tron carries very large daily transfer volumes and low or zero fees for users with staked TRX. EVM tooling does not transfer; if you support Tron, you are running a separate code path. Many merchants accept this trade for the demand.[^tron-fees]

## Developer-experience notes

- **Best-supported in agent SDKs (April 2026):** USDC on Base (x402, Coinbase, Stripe, Cloudflare), USDC on Ethereum L1 (every EVM SDK), card rails via Stripe.
- **Best for sub-cent metering:** Lightning (BTC). x402 on Base is competitive but on-chain gas sets a floor.
- **Best for irrevocable instant settlement to a bank account:** FedNow (US), SEPA Instant (EU). Both are fiat-only; agentic-card protocols ride on top.
- **Best for emerging-market consumers:** USDT on Tron. Tooling is heavier than EVM, but demand is real.
- **Worst for synchronous agent UX:** BTC on-chain. The 10-minute block time is too slow for most agent loops; use Lightning if you need BTC settlement and speed.

## Defender notes

- **Decimal mismatches are the most common silent bug across stablecoins.** USDC on most chains is 6 decimals; DAI is 18; bridged tokens may differ from the canonical issuer. Look up decimals at runtime per chain; do not hardcode. See the `evm-token-decimals` skill in this repo's tooling notes.
- **Reorg windows matter.** A confirmed transaction at 1 confirmation can still be re-orged on most chains. Wait for hard finality before fulfillment, or accept the reorg risk explicitly with insurance or a hold.
- **FX between user-local quote and settlement is a real loss center.** Quote with a buffer, re-quote on drift, and document re-quote semantics in your merchant feed. See [`/merchant-playbooks/pricing-drift-and-requote.md`](../merchant-playbooks/pricing-drift-and-requote.md).
- **Address-poisoning and clipboard-replacement attacks affect agents.** When an agent constructs a payment, it should verify the destination address against a signed merchant directory, not against whatever the page or the previous tool call returned.

## See also

- [protocol-matrix.md](./protocol-matrix.md) — capability × protocol.
- [decision-tree.md](./decision-tree.md) — pick the right protocol for your use case.
- [`/rails`](../rails) — per-rail deep dives.

[^base-finality]: Base sequencer finality and L1 hard finality — Base docs (<https://docs.base.org>); typical figures observed in production.
[^usdc-fees]: USDC fee structure — Circle documentation; on-chain fees are gas, not Circle fees, except for mint/burn flows.
[^base-dx]: Base ecosystem SDKs — Coinbase Cloud, Stripe x402-on-Base announcement, Cloudflare Agents SDK.
[^eth-finality]: Ethereum L1 finality — Ethereum.org consensus docs; typical 64-block (~12–15 min) finality.
[^eth-fees]: Ethereum gas variability — Etherscan gas tracker; production observations.
[^tron-finality]: Tron Super Representative finality — Tron developer docs.
[^tron-fees]: Tron energy/bandwidth model — Tron documentation; many users transact with zero TRX cost via staked resources.
[^eurc-fees]: EURC on Base — Circle developer docs.
[^btc-finality]: Bitcoin 6-confirmation convention — Bitcoin.org; deeper confirmations for higher-value settlement.
[^btc-fees]: Bitcoin fee market — mempool.space historical data.
[^ln-finality]: Lightning Network channel-update model — Lightning Labs documentation.
[^ln-fees]: Lightning routing fees — Lightning network analytics dashboards.
[^visa-settle]: Visa settlement timeline — Visa merchant documentation; agent-specific scheme rules emerging via TAP.
[^visa-fees]: Visa interchange schedule — Visa publicly published interchange tables.
[^visa-disputes]: Visa Trusted Agent dispute rules — Visa TAP announcements; rules evolving in 2026.
[^mc-settle]: Mastercard settlement timeline — Mastercard merchant documentation.
[^mc-fees]: Mastercard interchange schedule — Mastercard publicly published interchange tables.
[^mc-disputes]: Mastercard Agent Pay scheme rules — Mastercard Agent Pay announcements.
[^sepa-speed]: SEPA Instant and SEPA Credit Transfer timing — European Payments Council docs.
[^sepa-fees]: SEPA fee structure — varies by bank; ECB and EPC consumer guidance.
[^sepa-recall]: SEPA recall (R-transaction) mechanism — EPC SEPA scheme rulebook.
[^ach-speed]: ACH and Same-Day ACH — Nacha rules.
[^ach-fees]: Typical ACH per-transaction pricing — published by ACH processors (Stripe, Dwolla, Plaid).
[^ach-returns]: ACH return windows — Nacha rules; 60-day window for unauthorized consumer debits.
[^fednow-speed]: FedNow timing — Federal Reserve FedNow service documentation.
[^fednow-final]: FedNow irrevocability — Federal Reserve FedNow operating procedures.
[^fednow-fees]: FedNow participating-bank fees — Federal Reserve published fee schedule.
