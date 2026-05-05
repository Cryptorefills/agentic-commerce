# Travel — Flights and Hotels for Agents

> Air ticketing and hotel reservations. The hardest mainstream use case for agents today: time-limited fares, supplier failure modes, complex cancellation policies, and a delivered artifact (a PNR + ticket number, or a hotel confirmation number) that an agent must hand off to a principal in a way that survives downstream airline or hotel system behavior.

**Agent-readiness:** Low-medium. Stablecoin payment is solved. The complexity is in supply-side variability, time-bounded fares, and after-sale customer service that the agent typically cannot perform on the principal's behalf without explicit authorization.

---

## Overview

Travel splits into two distinct mechanics:

- **Flights.** A reservation produces a **PNR** (Passenger Name Record) at the airline, and once paid, a **ticket number** that confirms a seat is held. The PNR is the durable identifier. The ticket number is the proof of payment to the airline.
- **Hotels.** A reservation produces a **confirmation number** at the property or chain, sometimes intermediated by a wholesaler. There is no airline-style ticket; the confirmation number is the artifact.

Cryptorefills offers travel across approximately 300 airlines and 1M+ hotels, settled in stablecoins (USDC, USDT, DAI, EURC) plus BTC/Lightning. See <https://www.cryptorefills.com/en/spend-crypto>.

For agents, travel is attractive because it is high-value, frequent, and a strong demonstration of agent autonomy. It is hard because every step has a real-world dependency: schedule changes, supplier outages, fare expiry, and chain-of-custody for the principal's identity (passport, name spelling) at the airline.

---

## Agent-relevant attributes

### Flights

| Attribute | Description |
|---|---|
| `origin` / `destination` | IATA airport codes |
| `departure_date` / `return_date` | ISO-8601 |
| `cabin` | `economy`, `premium-economy`, `business`, `first` |
| `passengers` | Adults, children, infants — names must match passport |
| `airline` | IATA carrier code; sometimes auto-routed |
| `fare_basis` | The fare class (refundable vs. non-refundable, change rules) |
| `pnr` | PNR record locator (issued at booking) |
| `ticket_number` | 13-digit airline ticket number (issued at payment) |
| `supplier` | The GDS or NDC channel used (Sabre, Amadeus, Travelport, NDC direct) |
| `quote_validity_seconds` | Often `60`–`300` for live fares |

### Hotels

| Attribute | Description |
|---|---|
| `property_id` | Internal or aggregator property ID |
| `chain` | Brand, if any |
| `check_in` / `check_out` | ISO-8601 |
| `room_type` | Bed configuration, view, smoking, etc. |
| `guests` | Adult and child counts; sometimes ages |
| `confirmation_number` | Issued by the property or wholesaler at booking |
| `cancellation_policy` | Free-until-date, partial-fee, non-refundable |
| `supplier` | Wholesaler or direct |

---

## Flight booking semantics

A flight booking is a two-step in most channels:

1. **Reserve.** Hold a seat against the fare. Generates a PNR. The PNR is fragile until ticketed: most airlines auto-cancel an unticketed PNR within hours.
2. **Ticket.** Pay against the PNR. The airline issues a 13-digit ticket number (e.g. `220-1234567890`), which is the durable proof the seat is held.

The agent must complete both steps in a single transactional flow when possible. If the agent reserves but cannot ticket within the airline's window, the PNR vanishes and the fare may not be repeatable.

**Identity binding.** The passenger's name on the PNR must match the travel document. Misspellings (a missing hyphen, a swapped middle name) are common cause of denied boarding. The agent must confirm name spelling with the principal before booking — not after.

**NDC vs. GDS.** New Distribution Capability (NDC) channels and traditional GDS channels differ in fare access, ancillaries (bags, seats), and refund mechanics. The agent should treat `supplier` as a meaningful attribute: the same `BCN-LIS` flight on NDC and on GDS may have different fare rules.

---

## Hotel booking semantics

Hotel bookings are typically single-step: a reservation against a rate generates a confirmation number. Two channel models:

- **Direct.** The booking goes directly to the property's PMS. Confirmation is immediate; the property has the reservation.
- **Wholesaler.** The booking goes through an aggregator (Hotelbeds, Expedia TAAP, etc.). The wholesaler holds the reservation; the property may receive it as a rooming list closer to the date.

For the agent, the practical implication is that a confirmation number alone is not always verifiable at the property until close to check-in. A signed receipt from the merchant plus the wholesaler's confirmation is the durable artifact.

**Late-arrival and no-show policies.** A booking that the property cannot find on arrival (rooming-list lag, name mismatch, miscoded room type) requires after-sale support. The agent should set the principal's expectation that arriving with the reservation email *and* the merchant-signed receipt is the safe path.

---

## 24-hour cancellation windows

Two distinct rules conflict here and agents must keep them straight:

- **DOT 24-hour rule (US flights).** Tickets purchased at least 7 days before departure on flights to/from the US can be canceled within 24 hours of purchase for a full refund, regardless of fare rules. This is a US Department of Transportation rule, not a fare rule. It applies broadly but has carve-outs.
- **Fare-specific cancellation.** The fare rules attached to the booking dictate cancellation outside the 24-hour window: refundable, partially refundable (change fee), or non-refundable.

For hotels, cancellation policies are property- and rate-specific. "Free cancellation until 48h before check-in" is common but never universal. The agent must surface the policy at quote time, not at booking time.

The defender's framing: a non-refundable fare is the cheapest because the buyer is taking the cancellation risk. An agent representing a principal who values flexibility should bias toward refundable fares; an agent buying for a fixed itinerary should not pay for flexibility it does not need.

---

## Time-limited fare quotes (re-quote semantics)

Air fares are live inventory. A quote is valid for **seconds to minutes**, not hours. Hotel quotes are typically more stable but still drift.

The merchant returns a quote with an explicit `expires_at`. After that:

1. The agent must call `requote` against the original SKU.
2. The merchant returns a new quote, which may be identical, higher, or lower.
3. The agent confirms the new quote with the principal (or against a pre-authorized price ceiling) before paying.

If the agent attempts to settle against an expired quote, the merchant rejects the payment. If the principal pre-authorized a price ceiling via AP2 mandate or equivalent, the agent can re-quote and settle as long as the new price is within the ceiling.

See [/merchant-playbooks/pricing-drift-and-requote.md](../merchant-playbooks/pricing-drift-and-requote.md).

---

## Supplier failure modes

Travel inventory has more ways to fail than gift cards or top-ups. The agent should design for:

- **Schedule change.** The airline reroutes or retimes the flight after booking. The PNR survives but the times change. Customer-service channel required.
- **Equipment swap.** Seat assignments move when an aircraft type swaps.
- **Overbooking.** Rare but real. The airline involuntarily reassigns a passenger.
- **Cancellation by airline.** Refund or rebook entitlement triggers; rules vary by jurisdiction (EU 261, US DOT, Brazil ANAC).
- **Supplier outage.** GDS, NDC pipe, or wholesaler connectivity drops. Quote and payment may complete on the merchant side without producing a PNR/ticket. The merchant must reconcile and either retry, rebook, or refund.
- **Hotel overbooking ("walk").** The property runs out of rooms and walks the guest to a comparable property. Standard but disorienting.

The agent's job is not to solve these — most require the principal or a human travel desk. The agent's job is to detect them quickly, surface them to the principal, and not silently consume the principal's time or money on a broken booking.

---

## Common pitfalls

- **Settling against an expired fare.** Quote expiry is short. Re-quote before pay.
- **Name mismatch.** Passport name must match PNR. Catch at booking.
- **Currency confusion.** Fare currency, billing currency, and stablecoin payment currency are three different things. Surface all three.
- **Assuming `confirmation_number` equals reservation.** Wholesaler-mediated bookings can show a confirmation number while the property does not yet have the rooming list.
- **24-hour rule overreach.** The DOT rule does not apply to all flights everywhere; do not promise a 24-hour refund universally.
- **Cancelling a non-refundable fare.** Some non-refundable fares offer "credit" toward a future booking with the same airline. This is not cash. Communicate clearly.

---

## Production considerations

- **Stablecoin selection.** A `USD 800` flight tolerates Ethereum mainnet fees; a `USD 60` hotel night does not. Default to Base or Solana for low-value, allow Ethereum for high-value or where finality matters.
- **Time-of-flight finality.** Don't ticket against a stablecoin payment that hasn't reached confirmed finality on the chain. The risk of a re-org-induced double spend is small but the supplier won't refund a re-org'd payment.
- **Receipt detail.** Receipts must contain PNR, ticket number, fare rules summary, and the merchant's terms. Hotel receipts must contain the confirmation number and cancellation policy verbatim.
- **Customer service hand-off.** Define explicitly which channel handles after-sale (schedule changes, refunds). The agent should not impersonate the principal in customer service.
- **Refund flow.** If the supplier refunds, the merchant refunds in the original stablecoin to the original payer address. Timelines depend on the supplier (days for airlines, days to weeks for some wholesalers). See [/merchant-playbooks/refunds-and-disputes-for-agents.md](../merchant-playbooks/refunds-and-disputes-for-agents.md).
- **Authorization scope.** Travel is the use case where AP2 mandates or equivalent pre-authorization windows are most useful: "agent may book flights up to USD X within window Y, on behalf of principal Z." See [/merchant-playbooks/agent-authorization-scopes.md](../merchant-playbooks/agent-authorization-scopes.md).

---

## References

- Cryptorefills travel (live catalog): <https://www.cryptorefills.com/en/spend-crypto>
- US DOT 24-hour cancellation rule: <https://www.transportation.gov/individuals/aviation-consumer-protection/refunds>
- IATA NDC overview: <https://www.iata.org/en/programs/airline-distribution/ndc/>
- Refunds: [/merchant-playbooks/refunds-and-disputes-for-agents.md](../merchant-playbooks/refunds-and-disputes-for-agents.md)
- Pricing drift and re-quote: [/merchant-playbooks/pricing-drift-and-requote.md](../merchant-playbooks/pricing-drift-and-requote.md)
- Agent authorization scopes: [/merchant-playbooks/agent-authorization-scopes.md](../merchant-playbooks/agent-authorization-scopes.md)
- Stablecoin rails: [/rails/crypto-stablecoin.md](../rails/crypto-stablecoin.md)

Flights and hotels run in Cryptorefills' production catalog, and the merchant-side calls above are drawn from real PNR handling and supplier failure modes we operate against.
