# <Playbook Title>

> Copy this file to a new playbook. Keep section order. Delete this blockquote.

## Goal

State the outcome in a single sentence. Example: "Let an agent call a paid HTTP API by detecting a 402 response, attaching a signed USDC payment header, and retrying."

## Prerequisites

- Accounts, vendor enrollments, or API keys required.
- Chain, network, or token funding (specify chain ID, asset, minimum balance).
- SDK / library versions (pin majors).
- Local tooling (Node 20+, Python 3.11+, etc.).
- Any prior playbook this one depends on (link with relative path).

## Steps

1. Step one. One imperative sentence.
2. Step two. Reference exact file paths or endpoints, not generic descriptions.
3. Step three. If the step has two valid paths, branch with sub-bullets.
4. Step four. End on the user-visible outcome (e.g., "agent receives 200 OK with the resource").

Keep total step count under 10. Split into a second playbook if it grows beyond that.

## Code

Provide one runnable or near-runnable snippet. TypeScript or JSON preferred. Target 20-50 lines. Imports at the top, comments only where they explain non-obvious behavior.

```ts
// minimal example — replace with your actual code
import { example } from "some-pkg";

export async function run(): Promise<void> {
  const result = await example({ ok: true });
  console.log(result);
}
```

If the playbook needs a JSON document (mandate, manifest, config), inline it directly:

```json
{
  "version": "1.0",
  "field": "value"
}
```

If the example points to a folder under `/examples/`, link it with a relative path and include the smallest excerpt that makes the playbook self-contained.

## Pitfalls

Defender framing. Each bullet is a failure mode plus the bound that contains it.

- **Pitfall name.** What goes wrong, what the blast radius is, and what to do about it. Example: "Idempotency key reuse across distinct intents — duplicate charges on retry. Bound: derive the key from the intent hash, not a wall-clock timestamp."
- **Second pitfall.** Same shape.
- **Third pitfall.** Same shape.

Three to six pitfalls is the right range. Each one must be something a real engineer has hit.

## When to use

Concrete situations where this playbook is the right answer.

- Bullet one — specific scenario.
- Bullet two — specific scenario.
- Bullet three — specific scenario.

## When NOT to use

Concrete situations where this playbook is the *wrong* answer and what to use instead.

- Bullet one — scenario plus the alternative playbook or protocol.
- Bullet two — scenario plus the alternative.
- Bullet three — scenario plus the alternative.

## References

Official sources only. Spec docs, vendor docs, signed engineering posts. No third-party rewrites as the primary source.

- [Spec or doc title](https://example.com/canonical-url) — what the link covers.
- [Second source](https://example.com/) — what it covers.
- Internal cross-link: [/comparison/protocol-matrix.md](../comparison/protocol-matrix.md) where relevant.
