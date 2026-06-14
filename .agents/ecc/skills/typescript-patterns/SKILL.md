---
name: typescript-patterns
description: TypeScript patterns shared across the luban engine, BFF, and SSR website — type safety, async, error handling, pnpm workspace hygiene, SSR/hydration safety, and cross-package contracts.
origin: luban
---

# TypeScript Development Patterns

Patterns for the luban TypeScript packages: `packages/engine/luban`, `packages/bff/luban-bff`, `packages/web/luban-website`. Unified on pnpm. Specs: `docs/LOWCODE_ENGINE_SPEC.md`, `.agents/rules/luban-lowcode-engine-quality.md`, `.agents/rules/luban-cross-cutting-standards.md`.

## When to Activate

- Writing or modifying `.ts`/`.tsx`/`.vue`/`.js` in `engine/luban`, `bff/luban-bff`, or `web/luban-website`.
- Crossing a package boundary (engine ↔ BFF ↔ website).
- Touching shared types or the BFF field surface consumed by the engine.

## Package Hygiene

- **pnpm only.** Never `npm install` or `yarn` in CI/new work; legacy exceptions documented in-tree.
- One package = one pnpm workspace member; do not duplicate dependencies at the workspace root.
- Shared types live in a shared package or a clearly-documented `@luban/*` import path — avoid copy-pasting DTOs across engine/bff/website.

```bash
pnpm install
pnpm test
pnpm run build
pnpm run test:e2e
```

## Type Safety

### No `any` without justification

```ts
// BAD
function render(props: any) { ... }

// GOOD — unknown + narrow, or a precise type
function render(props: unknown) {
  if (!isMaterialProps(props)) throw new Error('invalid material props')
  ...
}
```

### No `as` casts to bypass checks

```ts
// BAD — silences the compiler; runtime may diverge
const schema = rawAsKnownSchema(json)

// GOOD — validate then narrow with a type guard
if (isKnownSchema(json)) {
  const schema: KnownSchema = json
}
```

### Non-null assertions need a preceding guard

```ts
// BAD
const el = document.querySelector('#canvas')!

// GOOD
const el = document.querySelector('#canvas')
if (!el) throw new Error('canvas root missing')
```

### Public functions have explicit return types

```ts
// GOOD
export function parseSchema(raw: unknown): MaterialSchema { ... }
```

### Touching `tsconfig.json`

Any change that weakens strictness (loosening `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`) is a finding. Prefer tightening.

## Async Correctness

### No floating promises

```ts
// BAD — rejection is unhandled and unobservable
loadMaterial(key)

// GOOD
void loadMaterial(key).catch((e) => log.error('loadMaterial', e))
// or await it, or surface it to the caller
```

### No `forEach` with async

```ts
// BAD — forEach does not await; items run in parallel silently
items.forEach(async (it) => await process(it))

// GOOD — sequential
for (const it of items) {
  await process(it)
}
// or parallel when independent
await Promise.all(items.map((it) => process(it)))
```

### Parallelize independent awaits

```ts
// BAD — sequential when independent
const a = await loadA()
const b = await loadB()

// GOOD
const [a, b] = await Promise.all([loadA(), loadB()])
```

### Honor cancellation

Long-running async work in the engine/BFF must accept an `AbortSignal` (or equivalent) and bail when aborted — don't keep fetching/rendering after the user navigated away.

## Error Handling

### Never swallow

```ts
// BAD
try { await x() } catch {}

// GOOD — at minimum log with context
try {
  await x()
} catch (e) {
  log.error('x failed', { err: e })
  throw e // or map to a domain error
}
```

### Wrap `JSON.parse`

```ts
// GOOD
let parsed: unknown
try {
  parsed = JSON.parse(raw)
} catch (e) {
  return errResult('INVALID_JSON', e)
}
```

### Throw `Error`, not strings

```ts
// BAD
throw 'boom'

// GOOD
throw new Error('boom')
```

## SSR / Hydration Safety (engine + website)

The engine renders in the canvas; the website renders on the server then hydrates. Output must match.

- No `Date.now()`/`Math.random()`/`new Date()` directly in render path — they differ between server and client.
- No `typeof window === 'undefined'` branches that change rendered output (use them only to guard post-hydrate effects).
- Stable list keys; no keys derived from non-deterministic values.
- Material props must be fully serializable (no functions, class instances, symbols) so the BFF can transport them.

```ts
// BAD — server and client differ
const id = `el-${Math.random().toString(36).slice(2)}`

// GOOD — stable
const id = `el-${index}`
```

## Cross-Package Contracts

### Engine ↔ BFF

The engine consumes BFF fields. A prop bound to a BFF field must be a field the BFF actually returns. Drift renders `undefined`.

- Shared DTO types live in one place; both packages import from there.
- Breaking the BFF response shape without updating the engine is a finding.

### BFF ↔ Backend (Java/Go)

The BFF aggregates the Java/Go backends. Per `docs/DUAL_BACKEND_PARITY.md`, both backends return the same shape — the BFF must not silently assume otherwise.

## Security

- No `eval`/`new Function` on untrusted input.
- No `innerHTML`/`dangerouslySetInnerHTML`/`v-html` on authored or fetched strings without sanitization.
- No `child_process` with user input without an allowlist.
- Parameterize queries; never string-concat SQL.
- No hardcoded secrets — read from env.

## Imports & Module Shape

- Prefer named exports; avoid `export default` for things that benefit from refactor-friendly names (engine convention).
- No circular imports between engine packages — they break tree-shaking and bundler output.
- Keep the engine bundle lean: a material that pulls a heavy dep is a size finding.

## Testing

- Unit tests next to the code; aim for 85% on engine/bff/website (see `docs/TESTING_SPEC.md`).
- Run the project's canonical typecheck/lint before finishing:
  ```bash
  pnpm run typecheck
  pnpm run lint
  pnpm test
  ```
- E2E: `pnpm run test:e2e`. No `*.skip` without explicit user approval (luban no-skip contract).

## Build Verification (run before finishing)

From each touched package root:

```bash
pnpm run build        # must succeed
pnpm run typecheck    # must pass
pnpm test
```

If the change touches the engine or a material, also smoke-render in `packages/web/luban-website` and confirm zero new `console.error` from the renderer.

## Common Anti-Patterns

- `any`, unjustified `as`, `value!` without a guard.
- Floating promises; `forEach(async ...)`; sequential awaits over independent work.
- Empty `catch`; throwing strings; `JSON.parse` without try/catch.
- Non-deterministic values in render (SSR/hydration mismatch).
- Non-serializable material props.
- Engine ↔ BFF field drift.
- Circular imports; heavy deps added to the engine bundle.
- `npm`/`yarn` in new work.
- `*.skip` on tests without approval.

## Encoding (MUST)

All `.ts`/`.tsx`/`.vue`/`.js` files are UTF-8 without BOM. Verify if mojibake appears.
