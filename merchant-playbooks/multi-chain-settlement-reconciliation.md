# Multi-Chain Settlement Reconciliation

> USDC on Base + USDT on Tron + DAI on Ethereum + USDC on Solana + USDC on Polygon, normalized into one ledger with finality, decimals, and fees handled per chain.

---

## Problem

A real merchant day at Cryptorefills looks like this. Within the same hour we receive: USDC on Base (6 decimals, ~2s soft finality, 12-minute hard finality, ~$0.001 gas), USDT on Tron (6 decimals, ~3s SR finality, ~$0.30 fee absorbed by sender, no native fee subsidy), DAI on Ethereum L1 (18 decimals, ~12s per block, fees variable from $0.50 to $40), USDC on Solana (6 decimals, ~13s finalized, sub-cent fees but occasional dropped txs), and USDC on Polygon PoS (6 decimals, ~2s checkpoints, ~$0.005 fees). Each chain reports tx-arrived events through a different RPC, with different reorg risk, different decimal scaling, and different "finalized" semantics. The accounting team — and the supplier-payouts pipeline — needs all of these in *one* ledger, in *one* numeraire (we use USD), with idempotent rows keyed on something stable across reorgs and across chain reorganizations. Mis-accounting one chain's decimals by a single digit converts a $50 receipt into a $50,000 receipt or a $0.05 receipt; bridged-asset confusion makes a `USDC.e` payment look like a native USDC payment in the wrong column. Multi-chain reconciliation is where engineering meets compliance, and where a careless ETL job can fail an audit.

---

## Why protocols don't cover this

x402 settles a payment to a recipient address on a specific chain with a specific asset; once the tx confirms, the protocol's job is done. ACP's order lifecycle ends at "paid" — the merchant tells ACP the order is paid, and ACP doesn't care whether the merchant's general ledger has reconciled the inflow yet. AP2 is upstream — it authorizes the payment, not the bookkeeping after. MPP defines machine payments primitives but not the merchant's ledger model. None of these protocols define how a merchant should normalize a USDC-on-Solana inflow against a USDT-on-Tron inflow into a single USD-denominated ledger entry, how to handle the small but real depeg between USDC and USDT at the moment of receipt, how to attribute on-chain fees to the right account, or how to keep the ledger idempotent in the presence of L2 reorgs and dropped Solana txs. That work is entirely the merchant's, and the cost of getting it wrong is silent until the auditor or the supplier-payouts engineer notices.

---

## Approach

We model reconciliation as an **idempotent ingest pipeline per chain**, feeding a **single normalized ledger** keyed on `(chainId, txHash, logIndex)`, with a **finality gate** before a row is considered authoritative.

### Decision 1: per-chain ingestion adapters, one ledger model

What we do: each chain has its own ingestion adapter that subscribes to RPC events (logs/transfers to our deposit addresses), normalizes the raw on-chain amount into a canonical `unitsMinor` representation (an integer in the asset's smallest unit), tags the row with `chainId`, `assetSymbol`, `assetContract`, `txHash`, `logIndex`, and `blockNumber`, and writes to the ledger as `pending`. A second pass promotes `pending` to `confirmed` once the chain's finality threshold is met.

Why: chain-specific quirks (Solana's slot-vs-block model, Tron's energy/bandwidth fee accounting, Ethereum's reorgs deeper than expected, Base's sequencer model) belong inside the adapter, not bleeding into the ledger schema.

Tradeoff: more adapters to maintain. We accept the cost; trying to abstract chains too early was an antipattern we already burned on.

### Decision 2: normalize to USD at ingest, store both raw and normalized

What we do: every ledger row stores both the raw on-chain amount (`unitsMinor`, integer, exact) and a normalized USD amount at the time of finality, using the issuer's reserve-backed peg for stablecoins (1.0000) modulated by an oracle-sourced deviation if the deviation exceeds 30bps. We never use a single off-chain price feed; we use the median of Chainlink, Pyth, and Coinbase prime where available.

Why: the raw is the authoritative amount; the USD figure is the accounting view. Auditors want both, and a depeg event needs the USD column to reflect reality, not 1.0000.

Tradeoff: under depeg, we have to explain why a USDC inflow booked at 0.985. We document the oracle source per row.

### Decision 3: finality gate, per chain, per asset

What we do: each chain has a `finalityBlocks` (or `finalitySlots`) configuration per asset class. High-value (>$1,000) inflows wait for hard finality. Low-value (<$50) inflows promote on soft finality to keep the order pipeline moving. A reorg that orphans a `pending` row deletes the row; a reorg that orphans a `confirmed` row triggers a `compensating-debit` and an alert — we never silently mutate confirmed rows.

Why: idempotency requires a one-way state machine. Mutating confirmed rows under reorg is the most common silent-correctness bug we see in third-party reconciliation systems.

Tradeoff: high-value buyers wait longer for delivery on slow-finality chains. We tell them this at quote time (see [pricing-drift-and-requote](./pricing-drift-and-requote.md), `expectedFinalityMs`).

### Decision 4: idempotency key is `(chainId, txHash, logIndex)`

What we do: ledger primary key is `(chainId, txHash, logIndex)` plus a `recipientAddress` index. The same `txHash` exists on multiple chains (different transactions) — `chainId` disambiguates. The same tx may emit multiple Transfer logs to the same address — `logIndex` disambiguates. Replays from the indexer are idempotent on this key.

Why: chain-id collisions are real (txHash is not globally unique across chains). Multi-log txs are real (batched ERC-20 transfers, multi-recipient sends).

Tradeoff: more storage, more careful index design. Cheap.

### Decision 5: bridged assets get their own asset code

What we do: native USDC and bridged USDC.e on the same chain get different `assetSymbol` values. We never collapse them into one row class. Bridged supply is not under Circle's reserve attestation; treating it as native USDC is a compliance error.

Why: Circle has explicitly noted that USDC.e is a bridged representation, not native USDC. Same for native vs. bridged USDT on chains where Tether deployed natively after a bridge already existed.

Tradeoff: more SKU configuration per chain. Worth it.

### Schema sketch

```ts
type LedgerRow = {
  // identity
  chainId: 'base' | 'ethereum' | 'tron' | 'solana' | 'polygon'
  txHash: string
  logIndex: number               // 0 for chains without log model (Solana: instructionIndex)
  recipientAddress: string

  // amount
  asset: { symbol: 'USDC' | 'USDT' | 'DAI' | 'EURC' | 'USDC.e', contract: string, decimals: number }
  unitsMinor: string             // exact integer in smallest unit, as string to avoid f64
  usdAtFinality: string          // normalized USD at the finality moment, as decimal string
  usdOracleSource: 'chainlink' | 'pyth' | 'coinbase-prime' | 'issuer-peg'

  // lifecycle
  status: 'pending' | 'confirmed' | 'orphaned' | 'compensated'
  blockNumber: number
  observedAt: string             // when our indexer first saw it
  finalizedAt: string | null     // when finality threshold was met
  finalityBlocks: number         // configured threshold for this asset class

  // attribution
  orderId: string | null         // populated by the matcher; null until matched
  feeUnitsMinor: string          // chain fee paid by sender (for our records; we don't deduct)

  // audit
  reorgEventId: string | null    // populated if this row has been touched by a reorg
  notes: string | null
}
```

Three operational rules built into the schema:

1. `unitsMinor` is a string, not a number. Solidity uint256 does not fit in IEEE-754 f64, and DAI's 18 decimals make the issue immediate.
2. `usdAtFinality` is the USD figure at the moment of finality, not at the moment of observation. Under depeg these can differ.
3. `status` is a state machine, not a boolean. `orphaned` and `compensated` are first-class so reorgs and corrections are auditable.

---

## Edge cases

- **Reorgs on L2s.** Base, Polygon, Arbitrum-style L2s can reorg up to several blocks under stress. Our `finalityBlocks` for L2s is set conservatively (we currently use 30 blocks for Base for >$1k inflows). If a `confirmed` row becomes orphaned, we issue a `compensating-debit` row, alert, and treat the original order as unpaid until a new tx confirms.
- **Bridged assets booked as native.** USDC.e ≠ USDC. Bridged USDT on chains with both native and bridged deployments. We maintain a per-chain allowlist of contracts and refuse inflows from non-allowlisted contracts.
- **Solana dropped transactions.** A Solana tx that lands in a slot but is not finalized — we never promote past finality without seeing the slot rooted by the cluster. Pending rows that don't finalize within 90s are aged out and the user is asked to retry.
- **Tron energy / bandwidth model.** The fee model differs from EVM. The `feeUnitsMinor` on Tron is energy + bandwidth converted to TRX; we record but do not deduct from the principal.
- **Decimals mismatch.** USDC = 6 decimals on every chain. DAI = 18 decimals. EURC = 6 decimals. A wrong decimals constant in the adapter scales the inflow by 10^12. We unit-test every adapter against known historical txs at every release.
- **Supplier credits in a different unit.** A supplier refund issued in EUR back to our EUR off-ramp is not the same row class as a USDC refund on-chain. Cross-currency refund attribution lives in [refunds-and-disputes](./refunds-and-disputes-for-agents.md), not here.
- **Address re-use across chains.** EVM addresses are reused across all EVM chains; the same recipient address on Base and Polygon is a different account in our ledger because `chainId` is part of the key.
- **Stablecoin depeg events.** When the median oracle deviates from peg by more than 30bps, we book at the oracle median and flag the row. We do not retroactively adjust closed accounting periods.

---

## When to use this

- You accept stablecoins on more than one chain.
- You operate a single general ledger across multiple deposit addresses, multiple chains, and multiple stablecoins.
- You owe an auditable, idempotent record of every inflow with chain-of-custody from RPC event to ledger row.
- Your supplier payouts or finance team consume a single normalized ledger and cannot tolerate per-chain spreadsheets.

---

## When NOT to use this

- Single-chain, single-stablecoin operation. The full ledger model is overhead; a deposit-address watcher with a finality counter is sufficient.
- Custodial setups where a third party (Coinbase Commerce, Circle, BitGo, Fireblocks) does the reconciliation for you and gives you a normalized webhook. Trust their ledger; reconcile only their summaries.
- Purely test/demo flows on testnet — testnet finality semantics differ enough that you should not generalize from testnet behavior.
- M2M micropayment flows where the per-tx cost of recording exceeds the inflow. Aggregate first (e.g., a Lightning channel or a state channel), then book the aggregate.

---

## References

- **Circle USDC** — multichain native deployments, contract addresses, decimals, reserve attestations · [developers.circle.com/stablecoins](https://developers.circle.com/stablecoins), [Circle bridged-USDC framework](https://www.circle.com/blog/bridged-usdc-standard)
- **Tether USDT** — multichain deployments and transparency reports · [tether.to/en/supported-protocols](https://tether.to/en/supported-protocols)
- **MakerDAO DAI** — contract reference and decimals · [docs.makerdao.com](https://docs.makerdao.com)
- **Chain finality docs** — Base ([docs.base.org](https://docs.base.org)), Ethereum ([ethereum.org](https://ethereum.org)), Tron ([developers.tron.network](https://developers.tron.network)), Solana ([docs.solana.com](https://docs.solana.com)), Polygon ([docs.polygon.technology](https://docs.polygon.technology))
- **Chainalysis** — multi-chain transaction monitoring, address attribution, reorg considerations · [chainalysis.com](https://www.chainalysis.com)
- **TRM Labs** — multi-chain compliance and reconciliation tooling · [trmlabs.com](https://www.trmlabs.com)
- **Stripe crypto-payouts and ACP integration** — for the ACP-on-stablecoin flow · [docs.stripe.com](https://docs.stripe.com)
- **Coinbase x402** — settlement-side semantics on Base · [www.x402.org](https://www.x402.org)
- Related playbooks: [pricing-drift-and-requote](./pricing-drift-and-requote.md), [refunds-and-disputes-for-agents](./refunds-and-disputes-for-agents.md), [receipts-and-proof-of-purchase](./receipts-and-proof-of-purchase.md).

---

## Changelog

- **2026-04-28** — initial publication.
