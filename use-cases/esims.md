# eSIMs for Agents

> Embedded-SIM data plans delivered as activation profiles — typically an LPA string and/or a QR code that installs a cellular profile on a compatible device. Agent-friendly for the purchase, with friction at activation owed to device compatibility and the small but real reissue-on-failure flow.

**Agent-readiness:** Medium. Discovery, quote, and stablecoin payment are clean. The delivered artifact (an LPA string) is straightforward, but installation and activation depend on device and carrier behavior the merchant does not fully control.

---

## Overview

An eSIM is a software-defined SIM profile installed onto a device's embedded UICC. The agent buys a data plan (typically defined by region, data amount, and validity), and the merchant returns an **activation profile** the user installs on the device.

eSIMs are most commonly bought for travel — short-term data in a destination country or region — and increasingly for IoT and dual-line use. The combination of a digital-only artifact (no shipping) and a tightly bounded validity window makes eSIMs an unusually clean fit for agent-driven purchase: the agent can quote, settle in stablecoin, and deliver the activation profile in a single round-trip with no physical fulfillment surface to manage.

For agents, eSIMs are attractive because:

- **No physical fulfillment.** Delivery is an activation string.
- **Stablecoin-native.** Travel-sized purchases settle cleanly on Base, Solana, Polygon, or Tron.
- **Time-bounded SKUs.** Validity windows make pricing and refund logic tractable.

Friction comes from device compatibility (not all phones, tablets, or wearables support eSIM), carrier-specific activation behavior, and the occasional installation failure that requires a profile reissue.

---

## Agent-relevant attributes

| Attribute | Description |
|---|---|
| `region` | Country, multi-country region, or `global` coverage |
| `data_amount` | e.g. `1GB`, `5GB`, `unlimited` (with a fair-use cap) |
| `validity_days` | Window during which the data must be consumed (e.g. `7`, `15`, `30`) |
| `carrier` | The underlying carrier (sometimes hidden behind an MVNO; surface when available) |
| `activation_window` | The window after delivery in which the profile must be installed |
| `device_compat` | Constraints (e.g. "iPhone XS+", "Pixel 3+", IoT module families) |
| `voice_sms` | Whether voice/SMS is included; most travel eSIMs are data-only |
| `apn` | APN configuration if manual install is required |
| `terms_url` | Carrier and aggregator terms |

---

## Activation profiles

The delivered artifact is an **activation profile**, expressed in one or more equivalent forms:

1. **LPA Activation Code String.** The canonical form: `LPA:1$<smdp+-server>$<matching-id>` (per GSMA SGP.22). This is the machine-parseable artifact.
2. **QR code.** A QR encoding of the LPA string, suitable for camera-based install on phones.
3. **Manual entry fields.** SM-DP+ address, activation code, optional confirmation code — for devices that require manual entry.

For agents, the LPA string is the primary artifact. The QR is a presentation. The agent should deliver the LPA string in the order response, optionally with a QR image for human-facing surfaces.

A profile is typically **single-install**: once installed, the activation code cannot be reused. If installation fails part-way (e.g. the user scans the QR but cancels before commit), some carriers permit a second attempt; others require a reissue. Reissue is supported when the underlying supplier supports it (see "Reissue flow" below).

---

## Country gating

eSIM SKUs are gated by **coverage region**, not by buyer location. A `Japan 5GB / 15 days` eSIM is buyable from anywhere; it provides data only when the device roams onto a Japanese network. This decouples the buyer's KYC jurisdiction from the SKU's coverage region — a useful property for agents.

That said, two gates apply:

- **Carrier-imposed regional gating.** Some carriers refuse to provision a profile that has never landed in the coverage region. This shows up as activation failure, not purchase failure.
- **Sanctions or export controls.** A small number of countries are excluded from coverage; this is set by the underlying carrier and surfaced as `region` unavailability in the catalog.

The catalog surfaces both `coverage_region` (where data works) and any `excluded_buyer_country` (rare, usually sanctions-driven).

---

## Device compatibility

eSIM support depends on:

- **Device model.** Most flagship phones from 2018 onward support eSIM; many do not. Tablets and laptops vary.
- **Region SKU.** Some devices sold in specific regions ship with eSIM disabled (e.g. some China-region iPhones).
- **Carrier lock.** A carrier-locked device may refuse to install third-party eSIM profiles.
- **OS version.** Older OS versions sometimes mishandle profile install.

The agent should treat compatibility as a discovery-time disclosure, not a guarantee. A compatibility check best-practice is:

1. Surface a **known-compatible device list** for each SKU.
2. Provide the buyer with a self-check link (`*#06#` to read EID is supported on most phones).
3. Fail soft on installation: do not deduct full balance until the install confirms to the carrier.

---

## Reissue flow if installation fails

Installation failure is real. The defender's stance: assume some non-trivial fraction of installs will fail and design for it.

The reissue flow:

1. **Detect failure.** The buyer reports failure; or, where the supplier supports activation telemetry, the merchant detects no install within the activation window.
2. **Validate.** The merchant checks the supplier's status: profile not yet installed, profile expired, profile partially installed.
3. **Reissue.** The supplier issues a new profile (new LPA string), the old one is voided. The new artifact replaces the original on the existing order.
4. **Refund fallback.** If reissue is not possible (most often: profile shows installed-but-not-active, which the supplier interprets as consumed), the merchant refunds in the original stablecoin to the original payer address.

Reissue is supplier-mediated and not always instant. The agent should communicate the timeline to its principal honestly.

---

## Worked example: a small agent flow

```
1. Principal: "I land in Tokyo Friday for 10 days, get me data."
2. Agent queries catalog: region=Japan, validity_days>=10, data_amount>=3GB.
3. Agent picks SKU; requests quote in USDC on Base.
4. Merchant returns: 11.50 USDC, quote_id=Q987, expires_in=300s, address=0x...
5. Agent confirms compatibility: principal's iPhone 14 Pro is supported.
6. Agent settles; merchant confirms; supplier issues activation profile.
7. Order endpoint returns: LPA string, QR image, install instructions, receipt.
8. Agent delivers artifact to principal via secure channel.
9. Principal installs on Friday; data is consumed Friday onward.
```

If install fails (e.g. principal cancels mid-flow), the agent triggers reissue. If reissue fails, refund follows.

---

## Common pitfalls

- **Buying for a non-eSIM device.** The most common failure. Agents should check `device_compat` against the principal's device.
- **Activating outside the validity window.** A `15-day from first connection` plan is consumed by clock once the device first attaches to the carrier. A `15-day from purchase` plan is consumed regardless of use. Read `validity_days` semantics from `terms_url`.
- **Installing on the wrong device.** The LPA is single-install. If the user scans on a phone they didn't intend to use, the profile is bound to that phone and cannot be moved without reissue.
- **APN misconfiguration.** Some carriers require manual APN; auto-config covers most flagships. If data fails after install, APN is the first thing to check.
- **Region overlap confusion.** A "Europe" plan covers some countries but not others (e.g. Switzerland and the UK are sometimes excluded). Read coverage list carefully.
- **Roaming-only carriers.** Some travel eSIMs only work in the destination — they do not work in the buyer's home country. This is intentional, not a bug.

---

## Production considerations

- **Stablecoin defaults.** Travel eSIMs are typically `USD 5–30`. Default to fast, low-fee chains (Base, Solana, Polygon, Tron) and let the principal switch.
- **Receipt content.** The signed receipt should include the LPA string hash (not the LPA string itself) plus order metadata. Distribute the LPA string through a secure channel.
- **Activation telemetry.** Where the supplier exposes it, expose it back to the agent. This lets the agent verify success without asking the principal.
- **Refund timing.** Pre-install refunds are clean. Post-install refunds depend on the carrier and are rarely full-value if data was consumed.
- **PII minimization.** eSIMs do not require buyer KYC in most cases — that is a feature. Do not collect more than the principal volunteers.
- **Aggregator dependency.** Most eSIM SKUs are routed through one of a handful of aggregators (Airalo, Twilio, etc.). Outages and policy changes propagate through them.

---

## A note on agent-readiness rating

We rate eSIMs **Medium** because:

- Discovery, quote, and payment are clean — comparable to gift cards.
- Delivery is a deterministic artifact (the LPA string), so the merchant side is solid.
- The friction lives at activation: device compatibility is real, install can fail, and the reissue flow takes a round trip with the supplier.

An agent that pre-checks compatibility at discovery and supports a reissue path on failure can deliver a better experience than most human-facing eSIM purchase flows.

---

## Merchant note

eSIMs sit in an awkward middle: the merchant controls the LPA artifact cleanly, but the activation surface — device compatibility, single-install profiles, and aggregator-mediated reissue — sits outside merchant control and forces a real failure-handling design. Cryptorefills is a digital-goods merchant operating publicly since 2018 across 180+ countries, with stablecoin-first checkout, and runs eSIMs alongside top-ups and a 10,500+ brand gift-card catalog at [cryptorefills.com/en/spend-crypto](https://www.cryptorefills.com/en/spend-crypto). The activation, compatibility-check, and reissue patterns above reflect what that production flow has had to handle.

---

## References

- GSMA SGP.22 (Remote SIM Provisioning, the LPA spec): <https://www.gsma.com/solutions-and-impact/technologies/esim/>
- Refunds: [/merchant-playbooks/refunds-and-disputes-for-agents.md](../merchant-playbooks/refunds-and-disputes-for-agents.md)
- Delivery semantics: [/merchant-playbooks/delivery-semantics-codes-pnrs-esims.md](../merchant-playbooks/delivery-semantics-codes-pnrs-esims.md)
- Stablecoin rails: [/rails/crypto-stablecoin.md](../rails/crypto-stablecoin.md)
- Mobile top-ups (sibling category): [./mobile-topups.md](./mobile-topups.md)
