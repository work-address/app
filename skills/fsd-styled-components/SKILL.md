---
name: fsd-styled-components
description: >-
  Specification-driven workflow for React apps built with Feature-Sliced Design and
  styled-components: layer and slice placement, barrel exports, kebab-case filenames,
  `Root` plus role-based styled-component names, and `data-*` attributes as the
  variant and state contract. Use when writing a feature spec before implementation,
  creating or refactoring React components, naming styled-components, adding visual
  variants or states, choosing which layer or slice code belongs in, or reviewing code
  for structure and styling conventions.
---

# FSD + styled-components

Specify first, implement second. A feature spec is done when it names concrete paths,
exports, styled-component names and the `data-*` variant matrix — then implementation
is transcription, not invention.

## Workflow

1. Write the spec from the template below. Do not write code until placement, public
   API and the variant matrix are filled in.
2. `model/` types, unions and pure functions, with unit tests.
3. `__fixtures__/` stubs.
4. `ui/` bottom-up, one story per variant value.
5. Barrels, then wire the consumer.

## Placement

| Layer | Holds | May import from |
| --- | --- | --- |
| app | Bootstrap, providers, routing, global styles | every layer below |
| pages | Route-level composition | features, entities, shared |
| features | User-facing capabilities | entities, shared |
| entities | Domain objects and their views | shared |
| shared | Primitives with no domain meaning | shared only |

Imports MUST point downward; `shared` imports from nothing else. If a spec needs an
upward import, move the common part down a layer instead.

Segments inside a slice: `ui/`, `model/` (framework-free, unit-tested), `lib/`,
`api/`, `config/`, `__fixtures__/` (tests and stories only). Every slice and segment
exposes an `index.ts`; never import past a barrel into another slice's files.
Cross-layer imports use the path alias, intra-slice imports are relative.

## Naming

- Files and directories kebab-case; `.tsx` only when it exports JSX.
- Filenames carry the slice and group chain, so names are unique and greppable:
  `user-card-header.tsx`, not `header.tsx`.
- A group directory contains the file matching its own name — that is the entry
  component.
- Components PascalCase mirroring the filename. `type Props` stays unexported.
- Colocate `<file>.test.ts` and `<component>.stories.tsx`.

## styled-components

**File layout**: imports, constants, `type Props`, component, then every styled
declaration at the bottom in markup order.

**One `Root` per file.** The outermost styled element is always named `Root` — never
`Wrapper`, `Container`, or the component's own name. It makes every file open the
same way and gives siblings a stable selector target.

```tsx
export const UserCard: React.FC<Props> = ({ className, children }) => (
  <Root className={className}>{children}</Root>
)

const Root = styled.div`
  display: grid;
  gap: 8px;
`
```

**Layout with grid, not flexbox.** `display: grid` is the default for every container;
`flex`/`inline-flex` layout is not used. `grid-auto-flow: column` replaces
`flex-direction: row`, `grid-template-columns` replaces `flex-basis`/`flex-grow`
juggling, and `gap` replaces manual gutter margins. Reach for `flex-wrap` only when
`grid-template-columns: repeat(auto-fill, minmax(…))` genuinely cannot express the
wrapping behaviour needed, and say why in a comment.

**Name parts by role, not appearance.** Use `Header`, `Body`, `Footer`, `Content`,
`Panel`, `Section`, `Group`, `List`, `Item`, `Row`, `Cell`, `Label`, `Value`,
`Caption`, `Hint`, `Icon`, `Media`, `Actions`, `Trigger`, `Overlay`, `Backdrop`,
`Divider`, `Placeholder`, `Skeleton`. Never `BlueBox`, `FlexRow`, `SmallGrayText`,
`Wrapper2`, or a `Styled*` prefix. Names are file-local, so reusing `Body` across
files is correct.

Also:

- Extend with `styled(Component)`, fixing repeated props via `.attrs()`.
- To let a parent restyle a child, the child accepts `className` and forwards it to
  its own `Root`. Never reach in with `& .some-child`.
- Colours, spacing, radii and z-indices come from design tokens. No raw hex, no
  one-off `rgba()`, no ad-hoc `@media` literals — breakpoints come from one helper.
- Declare styled components at module scope only; inside render they remount the
  subtree.
- Keep nesting within two levels; deeper means the markup wants another component.
- Never `!important`. A styled component is a single class, so a global reset like
  `.app button { … }` outranks it — double the class and comment why:

```tsx
const Root = styled.button`
  /* .app button { background: none } outranks a single generated class. */
  && {
    background: var(--button-background);
    border: 1px solid var(--button-border);
  }
`
```

## data-* attributes

Variants and states are `data-*` attributes selected in CSS. Never branch styling on
props inside interpolations.

```tsx
<Root data-variant={variant} data-size={size} data-loading={loading || undefined}>

const Root = styled.div`
  &[data-variant='compact'] { padding: 4px; }
  &[data-size='large'] { font-size: 18px; }
  &[data-loading] { pointer-events: none; }
`
```

- **Enumerated** attributes take a value from a closed union typed in `model/`, so CSS
  and TypeScript cannot drift: `data-variant`, `data-size`, `data-tone`, `data-state`,
  `data-align`, `data-orientation`. Names describe the axis; values are lowercase.
- **Boolean** attributes are presence-only: emit `data-active={value || undefined}`
  and select `&[data-active]`. `data-active="false"` still matches `[data-active]`, so
  it is a defect.
- **Prefer native and ARIA state** where it exists: `:disabled`, `:checked`,
  `:focus-visible`, `[aria-expanded='true']`, `[aria-current='page']`,
  `[aria-busy='true']`. Never mirror `aria-disabled` as `data-disabled`.
- **Cross-component reaction** uses an ancestor reference, not a threaded prop:

```tsx
const Body = styled.div`
  padding: 12px;

  ${Root}[data-variant='compact'] & {
    padding: 6px;
  }
`
```

  Reference only within the same slice, one level deep. Deeper cases pass a
  component-scoped custom property declared on `Root` instead:

```tsx
const Root = styled.div`
  --card-accent: var(--text-default);

  &[data-tone='positive'] { --card-accent: var(--color-success); }
`
```

- `data-*` carries presentation state only — never identifiers, content, or anything
  sensitive. Data flows through props.

## Decomposition

Split a shell from its content: an entry component owning layout and props, plus one
child per independently readable region, each with its own styles and data access.
Split when a file passes ~150 lines, grows a second `Root`-like container, or its
styled block outgrows its component.

## Spec template

```md
# <Feature name>

## Outcome
What the user can do that they could not before. No implementation.

## Placement
Layer, slice path, segments touched, and why this layer satisfies the import rules.

## Public API
Exact exported symbols and the barrel each is exported from.

## Model contract
Types, unions, pure functions and their invariants. These become the unit tests.

## Variant matrix
Each visual axis as a `data-*` attribute: name, union of values, default, and what
changes for each value. Boolean axes listed as presence-only.

## Composition
Component tree with the file per node and the `Root` / part names each declares.

## Tokens
Design tokens consumed, plus any component-scoped custom properties introduced.

## Fixtures and stories
Stubs to add, and the states to review — at least one per enumerated variant value.

## Tests
Unit tests over the model contract; interaction tests where behaviour is non-trivial.

## Boundaries
Layers imported, confirming import direction holds.

## Out of scope
Explicit non-goals.
```

## Definition of done

- [ ] Paths, filenames and exports follow the naming rules.
- [ ] Exactly one `Root` per container file; part names are role-based.
- [ ] Container layout uses `display: grid`; no undocumented `flex`/`inline-flex`.
- [ ] Every variant is a `data-*` attribute backed by a union in `model/`; no
      prop-driven style branching remains.
- [ ] Boolean attributes are presence-only (`|| undefined`).
- [ ] Native and ARIA states used where they exist.
- [ ] No raw colours, magic breakpoints, `!important`, or styled components in render.
- [ ] One story per enumerated variant value.
- [ ] Pure logic in `model/`, covered by tests.
- [ ] Only barrels imported across slices; intra-slice imports relative.
- [ ] Lint, type-check and tests pass.

## Reference

Full normative spec with rationale, complete tables and the anti-pattern list:
[REFERENCE.md](REFERENCE.md).
