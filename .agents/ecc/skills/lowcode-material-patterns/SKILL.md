---
name: lowcode-material-patterns
description: Patterns for building and registering luban materials — props schema, component/schema sync, versioning, the editor props panel, cross-client rendering, and the engine/material contract.
origin: luban
---

# Low-Code Material Patterns

Patterns for the luban material library (`packages/ui/luban-ui`, Vue 3 + Vite, pnpm) and the engine schema layer (`packages/engine/luban`). The material contract is the highest-priority constraint in the repo. Specs: `docs/LOWCODE_ENGINE_SPEC.md`, `.agents/rules/luban-material-schema.md`, `.agents/rules/luban-multi-client-consistency.md`.

## When to Activate

- Adding, modifying, or deprecating a material (a luban-ui component) or its props schema.
- Touching material registration, the manifest, or the schema layer.
- Changing how a material renders across engine / website(SSR) / electron / flutter.
- Wiring a material prop to a BFF field.

## The Contract

The props schema is the single source of truth shared by:

```
material props schema
        │
        ├── engine renderer      (renders schema → DOM in the canvas)
        ├── editor props panel   (authors the schema)
        ├── BFF                  (transports schema across the network)
        └── clients              (web / electron / flutter each render it)
```

Four consumers, one contract. Drift between any two is a bug.

## Material Structure

A material is a component + a props schema + metadata, registered with the engine.

```
packages/ui/luban-ui/src/materials/button/
├── Button.vue              # the component
├── button.schema.ts        # the props schema (the contract)
├── button.meta.ts          # name, version, group, icon
└── __tests__/Button.test.ts
```

### The schema is the contract — not the component

The component must survive any input that conforms to the schema, and must NOT silently rely on props the schema does not declare.

```ts
// button.schema.ts
export const buttonSchema = {
  type: 'object',
  properties: {
    label: { type: 'string', default: 'Button', description: '按钮文本' },
    variant: { type: 'string', enum: ['primary', 'ghost', 'danger'], default: 'primary' },
    onClick: { type: 'event' }, // event handler, not a serializable value
  },
  required: ['label'],
} as const
```

## Schema/Component Sync (no drift)

### Every declared prop is consumed; every consumed prop is declared

```vue
<!-- BAD: schema declares `disabled` but the component never reads it -->
<template>
  <button>{{ label }}</button>
</template>

<!-- GOOD -->
<template>
  <button :disabled="disabled" :class="`btn btn--${variant}`" @click="emit('click')">
    {{ label }}
  </button>
</template>
```

### Defaults must agree

The schema default and the component's own fallback MUST produce the same render. If they differ, behavior depends on whether the editor authored the prop — a silent bug.

```ts
// BAD: schema default 'primary', component fallback 'ghost' — drift
const variant = props.variant ?? 'ghost'

// GOOD: let the schema/registration supply the default; component trusts the contract
const variant = props.variant
```

### Optional props must render safely when absent

```vue
<!-- BAD: crashes if icon is optional and not provided -->
<img :src="icon.url" />

<!-- GOOD -->
<img v-if="icon" :src="icon.url" :alt="icon.alt" />
```

## Registration & Resolution

### Register before resolve; handle "not yet loaded"

Materials referenced in a schema must be registered with the engine before the renderer resolves them. Lazy/async materials must not crash the renderer while loading.

```ts
// GOOD — explicit loading state
<template>
  <Suspense>
    <component :is="resolvedMaterial" v-bind="props" />
    <template #fallback>
      <MaterialSkeleton :name="materialKey" />
    </template>
  </Suspense>
</template>
```

### No colliding material keys

Two materials registering the same key → undefined resolution order. The manifest must reject duplicates at build time.

### Tree-shaking-safe materials

No side effects in module scope. Materials must work both when statically bundled and when dynamically imported.

## Versioning & Backward Compatibility

The engine renders authored pages whose schemas may reference old material versions. Old versions MUST stay resolvable, or be migrated explicitly.

### Bump version on breaking changes

Removing a prop, renaming a prop, narrowing a type, or changing a default = breaking change. Bump the material version.

### Keep old versions resolvable

```ts
// material registry: both versions coexist
registerMaterial({ key: 'Button', version: '1.0.0', component: ButtonV1, schema: buttonSchemaV1 })
registerMaterial({ key: 'Button', version: '2.0.0', component: ButtonV2, schema: buttonSchemaV2 })

// authored schema { material: 'Button', version: '1.0.0', ... } still renders via V1
```

### Migrations when versions are retired

If an old version MUST be removed, ship a documented migration and run it on existing pages — don't silently break them.

### Deprecation with a path

Deprecating a material/prop requires (a) a replacement and (b) a migration note in the manifest.

## Cross-Client Rendering Consistency

A schema must render the same way in the engine canvas, on the SSR website, in electron, and in flutter.

### No engine-only APIs during render

```vue
<!-- BAD: works in canvas, breaks on SSR website and on flutter -->
<template>
  <div>{{ window.innerWidth }}px</div>
</template>

<!-- GOOD: environment capability is a first-class prop, not a render-time sniff -->
```

### BFF fields must actually exist

A prop bound to a BFF field the BFF never returns renders `undefined`. The material must degrade gracefully AND the missing field must be flagged at review time.

### SSR/hydration-safe rendering

No `Date.now()`/`Math.random()`/`new Date()` directly in render (server and client will differ). No `typeof window` branches that change output. Move non-determinism into lifecycle hooks that run after hydration.

## Editor Props Panel Fidelity

The panel renders a form FROM the schema. Complex types must be authorable:

- `enum` → select.
- nested object / oneOf → grouped or conditional form section.
- `pattern`/`minimum`/`maximum` → client-side validation surfaced to the author.

If the schema declares a constraint, either the panel enforces it or the component validates at render and reports it. Never silent.

## Security: Authored Props Are Untrusted

Anything an author can put into the schema is untrusted input.

```vue
<!-- BAD: XSS via authored content -->
<template>
  <div v-html="content" />
</template>

<!-- GOOD: escape, or sanitize explicitly with a vetted lib -->
<template>
  <div>{{ content }}</div>
</template>
```

- No `v-html`/`innerHTML`/`href="javascript:..."` on authored strings without explicit sanitization.
- Guard `__proto__`/`constructor` when deep-merging authored props into defaults.
- Validate authored URLs (images, fonts) before loading.

## Testing

### Contract test (every material)

- Every declared prop is rendered for at least one value.
- Every consumed prop is declared.
- The component renders with all optional props absent (no crash).

```ts
describe('Button material contract', () => {
  it('declares every consumed prop', () => {
    expect(consumedProps(ButtonV2)).toMatchObject(declaredProps(buttonSchemaV2))
  })
  it('renders with only required props', () => {
    const { container } = render(ButtonV2, { props: { label: 'Go' } })
    expect(container.textContent).toContain('Go')
  })
})
```

### Cross-client consistency assertion

Where a client harness exists (SSR website, electron, flutter), assert the same schema produces matching output.

### No skipped E2E

`*.skip` on material/engine E2E violates the luban no-skip contract — needs explicit user approval.

## Build & Verification (run before finishing)

From `packages/ui/luban-ui` and `packages/engine/luban`:

```bash
pnpm run build       # emits components + schema artifacts; must succeed
pnpm test            # unit + contract tests
```

Then SSR smoke in `packages/web/luban-website`: render a schema using the changed material and confirm zero new `console.error` from the renderer.

## Common Anti-Patterns

- Material registered without a props schema.
- Schema declares a prop the component doesn't read (dead contract).
- Component reads a prop the schema doesn't declare (invisible to editor + BFF).
- Schema default ≠ component fallback (behavior depends on authoring).
- Breaking change without version bump.
- `v-html`/`innerHTML` on authored content without sanitization.
- Render-time `window`/`Date.now()` branches breaking SSR hydration.
- Optional prop dereferenced without a null guard.
- Cross-client divergence left untested.

## Encoding (MUST)

All `.ts`/`.vue`/`.js` files are UTF-8 without BOM. Verify if mojibake appears.
