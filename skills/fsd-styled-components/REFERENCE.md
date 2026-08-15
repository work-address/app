# Reference: Feature-Sliced Design + styled-components

Full normative specification. `SKILL.md` carries the rules that apply on every task;
this document carries the complete tables, the rationale behind each rule, and the
edge cases.

**Normative keywords.** MUST / MUST NOT are enforced by lint, types or review.
SHOULD is the default and needs a written reason to break. MAY is free choice.

---

## 1. Layers

`src/` contains exactly these layers, from most to least abstract:

| Layer | Path | Holds | May import from |
| --- | --- | --- | --- |
| app | `src/app` | Bootstrap, providers, routing, global styles | every layer below |
| pages | `src/pages` | Route-level composition, no business rules | features, entities, shared |
| features | `src/features` | User-facing capabilities and interactions | entities, shared |
| entities | `src/entities` | Domain objects, their contracts and views | shared |
| shared | `src/shared` | Framework, utility and design primitives with no domain meaning | shared only |

### 1.1 Import direction

Imports MUST point downward. A layer MUST NOT import from any layer above it, and
`shared` MUST NOT import from any other layer. Enforce this mechanically, e.g. with
`import/no-restricted-paths` zones mirroring the table:

```js
{
  target: './src/shared',
  from: ['./src/entities', './src/features', './src/pages', './src/app'],
  message: '"shared" cannot import from other layers',
}
```

A specification that requires an upward import is invalid. Resolve it by moving the
common part down a layer, never by relaxing the rule.

### 1.2 Sibling imports

Slices on the same layer SHOULD NOT import each other. When two slices need the same
thing, that thing belongs one layer down.

### 1.3 Path alias

Cross-layer imports MUST use the project's configured alias (`@/…`, `@app/…`, or
whatever the project standardises on), never a relative path that climbs out of the
slice. Intra-slice imports MUST be relative — a slice referring to itself through the
alias is a defect.

---

## 2. Slices and segments

A slice is a directory directly under a layer, named in kebab-case after its concept
rather than its technical role. A slice's only children are segments:

| Segment | Contains | Rules |
| --- | --- | --- |
| `ui/` | Components, styled-components, component-local hooks | MUST NOT hold rules that can be expressed as pure functions in `model/`. |
| `model/` | Types, unions, constants, pure functions, invariants | MUST be free of React and of any framework. This is the unit-tested core. |
| `lib/` | Slice-internal helpers that are not domain rules | Only if used by more than one file in the slice. |
| `api/` | Requests and transport mapping for the slice | Transport only, no view concerns. |
| `config/` | Static configuration, feature limits | Values only. |
| `__fixtures__/` | `create<Thing>Stub` factories and static stubs | For tests and stories only; MUST NOT be imported by production code. |

### 2.1 Public API

- Every slice MUST expose a root `index.ts` re-exporting only what other slices may
  consume. A slice with one entry point exports exactly that:

```ts
export * from './ui/user-card'
```

- Every segment MUST expose its own barrel, so consumers import
  `<alias>/entities/user/model`, never a file path inside the segment.
- Reaching past a barrel into another slice's file tree MUST NOT happen.

---

## 3. Files and names

- Files and directories: kebab-case. `.tsx` only when the file exports JSX.
- Filenames MUST carry the chain of the slice and group they belong to, so every name
  is unique and greppable across the repository: `user-card-header.tsx`, not
  `header.tsx`.
- A group directory MUST contain the file that matches its own name; that file holds
  the group's entry component:

```
ui/user-card/
  index.ts
  user-card.tsx          # entry: shell, props, composition
  user-card-header.tsx
  user-card-body.tsx
  user-card.stories.tsx
```

- Components: PascalCase mirroring the filename (`UserCardHeader`).
- Local prop types are `type Props = { … }` and stay unexported. Exported prop types
  are `<Component>Props`.
- Constants: `SCREAMING_SNAKE_CASE`. Fixtures: `create<Thing>Stub(partial?)`.
- Tests: `<file-under-test>.test.ts`, colocated. Stories: `<component>.stories.tsx`,
  colocated.

### 3.1 File layout

Order inside a component file MUST be:

1. imports, grouped (packages, aliases, relative) with type-only imports last,
2. module constants,
3. `type Props`,
4. the exported component,
5. all styled-components, in the order they appear in the markup.

Styles at the bottom keep the readable part of the file first, and make the styled
block a predictable place to look.

---

## 4. styled-components

### 4.1 One `Root` per file

Each component file that renders a container MUST name its outermost styled element
`Root`. This is the single most important naming rule: every file opens the same way,
and sibling files get a stable handle to target (§5.4).

```tsx
export const UserCard: React.FC<Props> = ({ className, children }) => (
  <Root className={className}>{children}</Root>
)

const Root = styled.div`
  display: grid;
  gap: 8px;
`
```

A file MUST NOT declare two `Root` elements. A component that renders a fragment of
siblings with no container has no `Root`.

### 4.2 Name by role, never by appearance or element

Styled-component names describe the part an element plays in the composition. They
MUST NOT encode looks, position or the HTML tag, because those change without the
role changing.

| Use | Avoid |
| --- | --- |
| `Root`, `Header`, `Body`, `Footer` | `Wrapper2`, `DivContainer`, `Outer` |
| `Label`, `Value`, `Caption`, `Hint` | `SmallGrayText`, `BoldSpan` |
| `List`, `Item`, `Actions`, `Toolbar` | `FlexRow`, `Column3` |
| `Trigger`, `Overlay`, `Content`, `Panel` | `BlueBox`, `TopThing` |
| `Icon`, `Media`, `Thumb`, `Badge` | `Img24`, `RoundedSquare` |

Names are file-local, so repeating `Body` in twenty files is correct, not a
collision. Standard vocabulary worth standardising on: `Root`, `Header`, `Body`,
`Footer`, `Content`, `Panel`, `Section`, `Group`, `List`, `Item`, `Row`, `Cell`,
`Label`, `Value`, `Caption`, `Hint`, `Icon`, `Media`, `Actions`, `Trigger`,
`Overlay`, `Backdrop`, `Divider`, `Placeholder`, `Skeleton`.

### 4.3 Do not restate the component name

Inside `user-card-header.tsx` the outer element is `Root`, not `UserCardHeaderRoot`
or `StyledUserCardHeader`. The filename already provides the namespace. The `Styled*`
prefix MUST NOT be used.

### 4.4 Extending components

- Extend with `styled(Component)`, and pass fixed props with `.attrs()` rather than
  repeating them at every call site:

```tsx
const Label = styled(Typography).attrs({ variant: 'caption', as: 'span' })`
  color: var(--text-muted);
`
```

- When a parent needs to restyle a child component, the child MUST accept `className`
  and forward it to its own `Root`. This is the only sanctioned way to reach into
  another component's styling.
- An empty wrapper that adds no declarations MUST NOT be committed, unless it exists
  purely to create a targetable reference for §5.4, in which case a comment MUST say
  so.

### 4.5 Design tokens

- Colours, spacing, radii, typography and z-indices MUST come from CSS custom
  properties (or the theme object, if the project standardises on that). Raw hex
  values, magic pixel scales and one-off `rgba()` literals MUST NOT appear in a
  slice; add a token instead.
- Component-scoped tokens are declared on `Root` and consumed by descendants, which
  keeps a variant switch in one place:

```tsx
const Root = styled.div`
  --card-accent: var(--text-default);

  &[data-tone='positive'] {
    --card-accent: var(--color-success);
  }
  &[data-tone='negative'] {
    --card-accent: var(--color-danger);
  }
`

const Value = styled.span`
  color: var(--card-accent);
`
```

This is also the escape hatch for depth: a grandchild reads `--card-accent` instead
of chaining ancestor selectors.

### 4.6 Interpolation discipline

- Static CSS MUST be static. Function interpolations are for values that genuinely
  vary at runtime and cannot be expressed as a token or a `data-*` selector.
- Every styled component MUST be declared at module scope. Declaring one inside
  render remounts the subtree on every render and MUST NOT happen.
- `keyframes` used by a single file lives in that file, above the styled block that
  references it. Animations shared by several files belong in `shared`.
- Inline `style` is reserved for values computed per render (measured sizes,
  transforms driven by pointer position). Anything static MUST be CSS.

### 4.7 Nesting and specificity

- Nesting SHOULD stay within two levels. Deeper nesting signals that the markup wants
  to be split into another component.
- `!important` MUST NOT be used to win a specificity fight.
- A styled component compiles to a single class, so a global reset written as
  `.app button { … }` outranks it. When a global rule must be overridden, raise
  specificity by doubling the class, and say why in a comment:

```tsx
const Root = styled.button`
  /* .app button { background: none } outranks a single generated class. */
  && {
    background: var(--button-background);
    border: 1px solid var(--button-border);
  }
`
```

- Descendant selectors that reach into another component's internals
  (`& .some-child`) MUST NOT be used; target a component reference instead (§5.4).

### 4.8 Responsiveness

Breakpoints MUST come from one shared helper or token set, never from ad-hoc
`@media (max-width: 731px)` literals scattered across slices. Media blocks SHOULD sit
at the end of the styled declaration they modify, so the base case reads first.

---

## 5. `data-*` attributes

`data-*` attributes are the contract between a component's state and its CSS. They
replace boolean style props, conditional class strings and duplicated styled variants.

### 5.1 Variants and states MUST be data attributes

A component MUST express its visual variants as `data-*` attributes on the element
and select them in CSS. It MUST NOT branch styling on props inside interpolations.

```tsx
// Correct
<Root data-variant={variant} data-size={size} data-loading={loading || undefined}>

const Root = styled.div`
  &[data-variant='compact'] { padding: 4px; }
  &[data-size='large'] { font-size: 18px; }
  &[data-loading] { pointer-events: none; }
`
```

```tsx
// Incorrect: prop-driven branching
const Root = styled.div<{ $variant: Variant; $size: Size }>`
  padding: ${(p) => (p.$variant === 'compact' ? '4px' : '12px')};
  font-size: ${(p) => (p.$size === 'large' ? '18px' : '14px')};
`
```

Why this is the rule, not a preference:

- Styling stays in CSS, so the whole variant matrix is readable in one block instead
  of being spread across ternaries.
- No new class is generated per prop combination, so the style sheet stays small and
  diffs stay stable.
- The rendered DOM states its own state, which makes it inspectable in devtools and
  directly queryable from tests without test-only attributes.
- The same attribute can be read by a parent, a sibling or a snapshot test.

### 5.2 Enumerated versus boolean attributes

- Enumerated attributes carry a value from a closed union:
  `data-variant="compact" | "full"`, `data-size="s" | "m" | "l"`,
  `data-tone="neutral" | "positive" | "negative"`,
  `data-state="idle" | "loading" | "error"`. The union MUST be a TypeScript type in
  `model/`, so CSS and TS cannot drift apart.
- Boolean attributes are presence-only. They MUST be emitted as
  `data-active={isActive || undefined}` so the attribute disappears when false, and
  selected as `&[data-active]`. Rendering `data-active="false"` still matches
  `[data-active]` and is a defect.

### 5.3 Prefer native and ARIA state where it exists

`data-*` is for state the platform does not already express. When a native or ARIA
state exists, styling MUST use it: `:disabled`, `:checked`, `:focus-visible`,
`[aria-expanded='true']`, `[aria-current='page']`, `[aria-busy='true']`, or the
`[data-state]` a headless UI library already exposes. Duplicating `aria-disabled` as
`data-disabled` MUST NOT happen — it creates two sources of truth for one state.

### 5.4 Cross-component styling through references

A child MAY react to an ancestor's variant by interpolating the ancestor's styled
component as a selector. This is the sanctioned alternative to threading the variant
down as a prop:

```tsx
const Root = styled.div``

const Body = styled.div`
  padding: 12px;

  ${Root}[data-variant='compact'] & {
    padding: 6px;
  }
`
```

Rules:

- The referenced component MUST be defined in the same file, or imported from a
  sibling file inside the same slice. Referencing across slices MUST NOT happen; use
  a `data-*` attribute or a token on the consumer's own `Root` instead.
- A reference chain SHOULD be one level deep. If a grandchild needs an ancestor's
  variant, pass a component-scoped custom property down instead (§4.5).

### 5.5 Naming and hygiene

- Attribute names are kebab-case and describe the axis, not the outcome:
  `data-variant`, `data-size`, `data-tone`, `data-state`, `data-align`,
  `data-orientation`, `data-selected`, `data-empty`.
- Values are lowercase and short, drawn from the union type.
- `data-*` MUST NOT carry payload data (identifiers, JSON blobs, user content, or
  anything sensitive). Data flows through props; `data-*` describes presentation
  state only.
- Attributes referenced by automated tests SHOULD be the same semantic ones used for
  styling; a separate `data-testid` is added only when no semantic state fits.

---

## 6. Component decomposition

A component file MUST NOT mix a container shell with substantial content. Split it
into an entry component that owns layout and props plumbing, plus one child per
independently readable region:

```
ui/summary-card/
  index.ts
  summary-card.tsx          # shell: Root, header slot, composition
  summary-card-heading.tsx  # title, subtitle
  summary-card-metrics.tsx  # figures, chart
```

Each child owns its own styles and its own data access. Props carry only what the
parent genuinely owns, such as the variant that feeds `data-variant`. Building blocks
shared by several groups in a slice go in `ui/common/`, and shared behaviour in
`ui/hooks/`.

Triggers to split: a file past roughly 150 lines, a second `Root`-like container, a
styled block longer than its component, or a region a reviewer must scroll past to
understand the whole.

---

## 7. Specification-driven workflow

### 7.1 Order of work

1. Write the feature specification (§7.2). No implementation until placement, public
   API and the variant matrix are filled in.
2. Add `model/` types, unions and pure functions, with unit tests.
3. Add fixtures.
4. Build `ui/` bottom-up, adding a story per visual state and variant.
5. Export through barrels, then wire the consumer.

### 7.2 Feature specification template

```md
# <Feature name>

## Outcome
What the user can do that they could not before. One paragraph, no implementation.

## Placement
- Layer: <shared | entities | features | pages | app>
- Slice: <path>
- Segments touched: ui / model / lib / api / config / __fixtures__
- Why this layer, and which import rules it satisfies.

## Public API
Exact exported symbols and the barrel each is exported from.

## Model contract
Types, unions and pure functions with their invariants. These become the unit tests.

## Variant matrix
Every visual axis as a `data-*` attribute: name, union of values, default, and what
changes visually for each value. Boolean axes listed as presence-only attributes.

## Composition
Component tree with the file for each node, and the `Root` / part names each file
declares.

## Tokens
Design tokens consumed, and any component-scoped custom properties introduced.

## Fixtures and stories
Stubs to add, and the story states that must be reviewable — at minimum one per value
of each enumerated variant.

## Tests
Unit tests over the model contract; interaction tests where behaviour is non-trivial.

## Boundaries
Layers imported, confirming no rule in §1.1 is violated.

## Out of scope
Explicit non-goals.
```

### 7.3 Definition of done

- [ ] Paths, filenames and exports follow §2 and §3.
- [ ] Each container file declares exactly one `Root`; part names are role-based.
- [ ] Every variant is a `data-*` attribute backed by a union type in `model/`; no
      prop-based style branching remains.
- [ ] Boolean attributes are presence-only (`|| undefined`).
- [ ] Native and ARIA states are used where they exist.
- [ ] No raw colours, magic breakpoints, `!important`, or styled components declared
      inside render.
- [ ] Every enumerated variant value has a story.
- [ ] Pure logic lives in `model/` and is covered by tests.
- [ ] Only barrels are imported across slices; intra-slice imports are relative.
- [ ] Lint, type-check and tests pass.

---

## 8. Anti-patterns

| Anti-pattern | Correct form |
| --- | --- |
| `StyledWrapper`, `Wrapper2`, `Outer` | `Root`, then role names |
| `BlueBox`, `SmallGrayText`, `FlexRow` | `Panel`, `Caption`, `Actions` |
| Restating the component name in styled names | File-local `Root`, `Body`, `Header` |
| Style props (`$variant`, `$size`) driving ternaries in CSS | `data-variant`, `data-size` selected in CSS |
| `data-active="false"` | `data-active={value \|\| undefined}` |
| `data-disabled` alongside `aria-disabled` | Style from `:disabled` / `[aria-disabled]` |
| Identifiers or content in `data-*` | Props for data, `data-*` for presentation state |
| `!important` to beat a global reset | `&&` with a comment explaining the conflict |
| Descendant selectors into another component's internals | Component reference selector, same slice only |
| Styled component declared inside render | Module scope |
| Raw hex, `rgba()` literals, ad-hoc breakpoints | Design tokens and the shared media helper |
| Deep import into another slice's file tree | Import the slice root or a segment barrel |
| Slice importing itself through the path alias | Relative imports inside a slice |
| Fixtures imported by production code | Fixtures only in tests and stories |
| Relaxing an import rule to make code compile | Move the common part down a layer |
