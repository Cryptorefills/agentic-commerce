# Receipts and Proof of Purchase

## Problem

A receipt for an agent transaction has two consumers, not one. The agent needs a machine-parseable artifact to drive reconciliation, refund flow, customer-support escalation, and downstream automation. The human (the user, the user's accountant, the user's tax authority) needs a human-readable record they can recognize as legitimate proof of purchase. Most legacy receipt systems were designed for the human alone — formatted PDFs and HTML emails — and most blockchain explorers serve only the machine. Neither is sufficient on its own. The merchant must emit a single signed artifact that satisfies both: structured fields for the agent, rendered presentation for the human, and a cryptographic signature that ties the two together so neither can be tampered with independently. This page is the merchant defender's reference for designing that receipt format, the signing path, key rotation, and versioning.

## Why protocols don't cover this

ACP's order confirmation is a JSON shape but unsigned and content-light. UCP does not define a receipt at all. AP2 ties a credential to a mandate, not to the resulting purchase. x402 returns a 200 with the resource and a transaction hash — the chain is the only proof, which is sufficient for an API call but not for a gift-card delivery, a flight, or a multi-line order with mixed assets. L402 is similar. Card-network rails inherit the merchant-of-record's receipt practice, which varies. None of the specs define a unified receipt envelope that an agent can verify cryptographically and a human can read intelligibly. The merchant has to design and sign it.

## Approach

Issue **one signed JSON receipt per order**, with a stable schema, a human-readable rendering, and verifiable signatures from the merchant's receipt key. Treat the receipt as the canonical artifact — the chain transaction is referenced inside it, not the other way around.

### Signed JSON envelope

The receipt is a JSON document signed using JWS-compact-serialization (JOSE), or where downstream systems prefer JWT, an equivalent JWT with the same claim shape. Either way, it contains:

- A stable schema version
- Order identification and merchant identity
- Line items with SKU, quantity, unit price, asset, decimals
- Totals and tax breakdown
- Settlement details: chain, transaction hash, asset, decimals, block height, finality status
- Reference to the [delivery envelope](./delivery-semantics-codes-pnrs-esims.md) for each line
- Buyer attestation level and (where present) agent identity and mandate ID
- Issuance timestamp and the merchant key id (`kid`) used for signing
- Signature

The signed JSON is the source of truth. Any human-readable rendering (PDF, HTML email, accounting export) is *generated from* the signed JSON and includes a verification footer with the receipt ID and a public verification URL.

### JWS / JWT details

- **Algorithm.** ES256 (ECDSA with P-256 and SHA-256) is the default. Avoid HS-* — symmetric signing prevents third-party verification. Avoid RS-* unless an existing PKI mandates it; the receipts are smaller with EC.
- **Header.** `alg`, `kid`, `typ: "receipt+jws"`.
- **Payload.** The receipt JSON described below.
- **Signature.** Detached or compact, depending on transport. Compact is easier for storage and email; detached is convenient for streaming.

### Field set

A receipt covers the full transaction, not just the payment. Include:

- `receiptId` — stable, used for revocation and lookup.
- `version` — schema version literal (`'1'`).
- `issuedAt`, `validAt` — issuance and the exposure-of-funds timestamp.
- `merchant` — `{ id, name, jurisdiction, taxId }`.
- `buyer` — `{ id?, address?, agent? }` where `agent` carries operator and mandate ID.
- `order` — `{ orderId, items[], subtotal, tax, total, currency }`.
- `settlement` — `{ chain, asset, decimals, txHash, blockHeight, confirmedAt, payerAddress, recipientAddress }` for crypto rails; `{ rail, processor, processorReference }` for card or bank rails.
- `delivery` — array of references to the delivery envelopes per line.
- `policy` — refund window, regulatory class summary, jurisdiction.
- `signature` — `{ alg, kid, value }`.

### Verification endpoint

The merchant exposes a public verifier:

- Accepts a receipt JWS (or receipt ID) and returns a typed verdict: `{ valid: true, payload }` or `{ valid: false, reason }`.
- Resolves `kid` against the merchant's published JWKS.
- Checks signature over the canonical payload bytes.
- Optionally cross-references the on-chain settlement transaction for crypto rails — confirms the tx exists, is to the merchant's recipient address, and has reached finality.
- Caches aggressively at the edge — receipts are immutable, so cache TTLs can be long.

The verifier is the canonical authority. Agents should call it before honoring a receipt presented in a refund or dispute flow.

### Human-readable view

Render to:

- An HTML email with the receipt summary and a "verify this receipt" link to a merchant-hosted verifier.
- A PDF with the same content, embedding the receipt JSON in an attachment slot for downstream re-verification.
- Optional QR code encoding the receipt ID and the verification URL.

The human-readable view never contains content the signed JSON does not — otherwise the signature does not cover what the human sees, and forgery is invisible.

## Schema sketch

```typescript
type Receipt = {
  receiptId: string;
  version: '1';
  issuedAt: string;
  validAt: string;

  merchant: {
    id: string;
    name: string;
    jurisdiction: string;
    taxId?: string;
  };

  buyer: {
    id?: string;
    address?: string;
    agent?: {
      operatorId: string;
      agentId: string;
      mandateId?: string;
    };
  };

  order: {
    orderId: string;
    items: {
      skuId: string;
      title: string;
      quantity: number;
      unitPrice: { value: string; currency: string };
      regulatoryClass?: string;
    }[];
    subtotal: { value: string; currency: string };
    tax: { value: string; currency: string; breakdown?: TaxLine[] };
    total: { value: string; currency: string };
  };

  settlement:
    | {
        rail: 'crypto';
        chain: string;
        asset: string;
        decimals: number;
        txHash: string;
        blockHeight: number;
        confirmedAt: string;
        payerAddress: string;
        recipientAddress: string;
      }
    | {
        rail: 'card' | 'bank';
        processor: string;
        processorReference: string;
      };

  delivery: { lineRef: string; envelopeId: string; status: string }[];

  policy: {
    refundWindowSeconds: number;
    jurisdiction: string;
    regulatoryNotes?: string;
  };

  signature: { alg: 'ES256'; kid: string; value: string };
};

type TaxLine = { jurisdiction: string; rate: string; amount: string };
```

### Operational metrics

- Receipt issuance latency (settlement-confirmed to receipt-issued).
- Verification calls per receipt (high counts suggest frequent downstream re-checks; very low counts may suggest agents are skipping verification).
- Signature-verification failure rate at the public verifier.
- Reissuance rate — tracks settlement reorgs, tax recalculations, refund corrections.
- JWKS resolution failures — early signal of key-rotation misconfigurations.

## Edge cases

- **Key rotation.** Merchants rotate signing keys periodically. Receipts include `kid`; the verifier resolves `kid` to a public key via a stable JWKS endpoint hosted by the merchant. Old receipts remain verifiable as long as the historical `kid` is still published. Never delete a public key from the JWKS; mark it `inactive` and keep it.
- **Receipt versioning.** Schema evolves. `version` is mandatory. Verifiers must reject receipts with unknown versions. Add new fields as version increments; never silently change the meaning of existing fields.
- **Settlement chain reorg.** A receipt issued at confirmation height H is invalidated by a reorg. Issue a `corrected` receipt referencing the original `receiptId` with the new settlement details, and surface both via the verifier. Never edit a signed receipt — replace.
- **Tax recalculation.** A subsequent jurisdictional clarification changes the tax for a prior receipt. Issue a corrected receipt with a `supersedes` pointer; do not modify the original.
- **Multi-asset settlement.** A single order paid in two assets (e.g., USDC for one line, USDT for another). Settlement becomes an array; the schema supports multi-leg by treating `settlement` as `Settlement[]` in v2.
- **Off-chain settlement.** Card-rail or store-credit. The same receipt envelope works; `settlement` carries the processor reference instead of a chain tx hash.
- **Buyer privacy.** The buyer may not want their wallet address in a public receipt copy. The signed JSON contains the address; the rendered human-readable view can redact selectively. The signature still covers the full payload.
- **Lost or unverifiable receipt.** The merchant must support reissuance against the original order ID. The reissued receipt has a new `receiptId` and a `supersedes` pointer; the original remains valid.
- **Merchant identity change.** A merchant rebrands or migrates legal entity. New receipts include the new entity; old receipts remain valid under the old `kid`. Document the relationship in the merchant's identity registry.
- **Counterfeit human-readable views.** PDFs forged without altering the JSON. The verifier endpoint is the canonical authority — surface the verification link prominently, and train support staff and agents to use it before honoring a receipt.

## When to use

- Any merchant emitting receipts to agents that will programmatically verify them.
- Any merchant whose buyer needs human-readable proof for accounting or tax.
- Any flow where downstream systems (refund, dispute, customs, expense) must trust the receipt cryptographically.
- Any merchant operating across multiple settlement rails where a unified receipt format simplifies reconciliation.

## When NOT to use

- Pure API-monetization flows where the chain transaction itself is the receipt and no human consumer exists — the tx hash plus an idempotency key suffices.
- Test environments where receipts have no real consumers.
- Internal tooling between trusted services where signing is overhead without a security gain — though a stable JSON shape is still worth maintaining.

## References

- JOSE / JWS (RFC 7515) — <https://datatracker.ietf.org/doc/html/rfc7515>
- JWT (RFC 7519) — <https://datatracker.ietf.org/doc/html/rfc7519>
- JWK / JWKS (RFC 7517) — <https://datatracker.ietf.org/doc/html/rfc7517>
- W3C Verifiable Credentials Data Model — <https://www.w3.org/TR/vc-data-model-2.0/>
- ACP order confirmation reference — <https://github.com/agentic-commerce-protocol/agentic-commerce-protocol>
- Google AP2 mandate-receipt extension drafts — <https://github.com/google-agentic-commerce/AP2>
- Stripe receipt and invoice APIs — <https://stripe.com/docs/receipts>
- Coinbase Commerce charge confirmation — <https://docs.cdp.coinbase.com/commerce/docs/webhooks>
- EU VAT invoice requirements — <https://taxation-customs.ec.europa.eu/taxation/vat_en>
- IETF SCITT (Supply Chain Integrity, Transparency, Trust) — <https://datatracker.ietf.org/wg/scitt/about/>
