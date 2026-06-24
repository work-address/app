# Web Effector — Reference

Detailed conventions for the `web/` package and its Effector state layer.

## Package location

| Item | Path |
|------|------|
| Frontend app | `web/` |
| Source root | `web/src/` |
| Path alias | `@` → `web/src` |
| API client (generated) | `web/src/shared/api/generated/` |
| Codegen | run `pnpm codegen` inside `web/` (needs `.env`) |

pnpm workspaces (`pnpm-workspace.yaml`): `api`, `web`, `packages/*`. The `web` package has no `name` field, so filter by path: `pnpm --filter ./web <script>` (matching the root's `pnpm --filter ./api test`), or `cd web && pnpm <script>`. Dev server: `cd web && pnpm dev` (port 3000, proxies `/api`).

## Layer architecture

Feature-Sliced Design–style layers. Import direction: **pages → features/widgets → entities → shared**. Never import upward.

```
web/src/
├── app/          # Router, global init (auth subscription)
├── pages/        # Route-level components; fetch/reset on mount/unmount
├── layouts/      # AuthLayout, MainLayout
├── widgets/      # Cross-page UI (header)
├── features/     # User scenarios (balance, dashboard, profile, invoice, auth)
├── entities/     # Domain units (profile/auth, activities/projects)
└── shared/       # UI kit, hooks, API base, i18n, cross-cutting models
```

**Public API rule:** import from layer `index.ts` exports only — not deep internal files.

- `entities/profile` — auth orchestration, wallet models, `$user`, `login`/`logout`
- `entities/activities` — projects, worklogs, filters, mutations
- `features/*/model/` — feature-scoped state when not shared across entities
- `shared/model/` — app-wide UI state (`confirm.model`, `breakpoints.model`)

## Tech stack (relevant to state)

- **Effector** + **effector-react** (`useUnit`, `createGate`)
- **@farfetched/core** — `createQuery`, `createMutation` (not raw `createEffect` for API reads)
- **patronum** — operators like `debounce`
- **React 19**, **Vite 7**, **react-router-dom 7**, **styled-components**, **Radix UI**
- **react-hook-form** + **zod** for forms (local component state, not Effector)
- **i18next** for strings

## Effector file conventions

Split state by responsibility. Typical files inside `entities/*` or `features/*/model/`:

| File | Contents |
|------|----------|
| `*.events.ts` | `createEvent` — user intents, triggers |
| `*.stores.ts` | `createStore`, `combine`, derived `$` stores |
| `*.effects.ts` | `createEffect` — side effects without farfetched (localStorage, subscriptions) |
| `*.queries.ts` | `createQuery` handlers — API reads |
| `*.mutations.ts` | `createMutation` handlers — API writes |
| `*.model.ts` | Wallet/provider sub-domains (eth, ton, solana) |
| `index.ts` | `sample()` wiring, re-exports public API |

### Naming

- Stores: `$balance`, `$authenticated`, `$worklogsFilters`
- Events: verb/noun — `fetchBalance`, `changeWorklogFilters`, `login`
- Effects: suffix `Fx` — `fetchStatusFx`, `loginEthFx`
- Queries/mutations: suffix `Query` / `Mutation` — `activitiesQuery`, `saveProfileMutation`

### Orchestration in `index.ts`

Wire logic with `sample()`, `split()`, `combine()` in the module's `index.ts` — not in React components.

```typescript
// features/balance/model/index.ts pattern
sample({
  clock: fetchBalance,
  target: [balanceQuery.start, transactionsQuery.start],
})

sample({
  clock: resetBalance,
  target: [balanceQuery.reset, transactionsQuery.reset],
})

export { fetchBalance, resetBalance } from './events'
export { $balance, $transactions, $balanceLoading } from './stores'
```

Complex flows use `split()` for branching (see `entities/profile/index.ts` auth routing by `LoginMode`).

### Farfetched queries & mutations

```typescript
// queries.ts
export const balanceQuery = createQuery({
  handler: async (): Promise<Balance> => {
    // call baseApi or mock
  },
})

// stores.ts — derive from query stores
export const $balance = combine(balanceQuery.$data, (data) => data ?? null)
export const $balanceLoading = combine(
  balanceQuery.$pending,
  transactionsQuery.$pending,
  (...flags) => flags.some(Boolean),
)
```

Trigger queries via events wired in `index.ts`: `clock: fetchX → target: xQuery.start`.
Reset on page leave: `resetX → xQuery.reset`.

Mutations follow the same pattern; refresh related queries on `mutation.finished.success`:

```typescript
sample({
  clock: createActivityMutation.finished.success.map(() => void 0),
  target: activitiesQuery.start,
})
```

### API error handling

Generated client returns `AxiosError` instances. Always check and rethrow:

```typescript
const result = await baseApi.projectControllerCreate({ body: activity })
if (result instanceof AxiosError) throw result
return result
```

Use `baseApi` from `@/shared` (configured axios client with token refresh in `shared/api/base.ts`).

### Effects vs farfetched

| Use | Tool |
|-----|------|
| HTTP read/write | `createQuery` / `createMutation` |
| localStorage, wallet SDK subscribe, DOM | `createEffect` |
| Async confirm dialogs | `createEffect` in model (see `confirm.model.ts`) |

### Pub/sub event pattern (wallet connections)

Wallet models use internal + public events to avoid duplicate handling:

```typescript
export const ethConnected = createEvent<EthModalResult>()
export const ethConnectedPub = createEvent<EthModalResult>()

sample({
  clock: ethConnected,
  source: $ethConnectionStatus,
  filter: (status) => status === 'disconnected',
  fn: (_, data) => data,
  target: ethConnectedPub,
})
```

Orchestration in `entities/profile/index.ts` listens to `*Pub` events.

### Gates (component lifecycle)

Use `createGate` when state depends on component mount params:

```typescript
// features/profile/model/index.ts
const ProfileGate = createGate<{ friendlyWalletAddress: string | null }>({
  defaultState: { friendlyWalletAddress: null },
})

sample({
  clock: ProfileGate.open,
  // ...
  target: profileQuery.start,
})

// Component: <ProfileGate friendlyWalletAddress={address} />
```

Solana wallet uses `SolanaWalletGate` similarly.

### Patronum debounce

Debounce filter events, not API calls directly:

```typescript
import { debounce } from 'patronum/debounce'

export const debouncedChangeWorklogFilters = debounce(changeWorklogFilters, 1500)
```

Wire debounced clock to `applyWorklogFilters` in `index.ts`.

## React integration

### useUnit (required)

Bind stores and events in components with `useUnit` — not `useStore` or manual subscriptions.

```typescript
const { fetchBalanceEvent, balance, loading } = useUnit({
  fetchBalanceEvent: fetchBalance,
  balance: $balance,
  loading: $balanceLoading,
})
```

### Page lifecycle

Pages own fetch/reset timing:

```typescript
useEffect(() => {
  fetchBalanceEvent()
  return () => resetBalanceEvent()
}, [fetchBalanceEvent, resetBalanceEvent])
```

Keep components dumb: read `$stores`, dispatch events, no `sample()` in JSX files.

### Local UI state

Use `useState` for ephemeral UI (modal open, form draft) when it does not need sharing or persistence. Profile edit forms use react-hook-form locally.

## Routes

Typed route tree in `web/src/routes/index.ts`. Use `routes.dashboard.build()`, `routes.profile.build({ walletAddress })` — not hardcoded paths.

React Router schemas in `app/app.tsx`; lazy-loaded pages from `pages/`.

## Adding new feature state

1. Create `features/<name>/model/` with `events.ts`, `queries.ts` (or `mutations.ts`), `stores.ts`, `types.ts`
2. Wire `sample()` in `model/index.ts`
3. Export public API from `model/index.ts` and `features/<name>/index.ts`
4. Page: `useUnit` + `useEffect` fetch/reset
5. Components: `useUnit` for stores only

For cross-feature domain logic, put state in `entities/` instead of `features/`.

## Adding entity state

Follow `entities/activities` or `entities/profile` as templates:

- **activities**: queries + stores + events + mutations + utils
- **profile**: split wallet `*.model.ts` files, `profile.stores.ts` for session, `index.ts` for auth orchestration

## Dev tooling

- **effector/babel-plugin** — enabled in dev via `vite.config.ts` (adds `sid` for debugging)
- **effector-logger** — `localStorage.setItem('log', '1')` then reload; `attachLogger()` in `main.tsx`

## UI & styling conventions

- Radix Themes + styled-components; theme in `shared/lib/theme.ts`
- Breakpoints: `useBreakpoint('isDesktop')` hook or `$breakpoints` store (updated by `BreakpointsWatcher`)
- Confirm dialogs: `useConfirm()` hook → `shared/model/confirm.model.ts`
- Toasts: `showToast` from `@/shared`

## Do not

- Put `sample()` wiring in React components or hooks (except gate definitions co-located with model)
- Import deep paths like `@/entities/profile/profile.stores` — use `@/entities/profile`
- Use `createEffect` for standard CRUD when farfetched query/mutation fits
- Skip `AxiosError` checks on `baseApi` calls
- Add Redux, Zustand, or other global state libraries

## Reference implementations

| Pattern | Location |
|---------|----------|
| Simple feature model | `features/balance/model/` |
| Combined query stores | `features/invoice/model/stores.ts` |
| Entity with filters + debounce | `entities/activities/` |
| Auth orchestration + split | `entities/profile/index.ts` |
| Wallet sub-model | `entities/profile/eth.model.ts` |
| Gate + query | `features/profile/model/index.ts` |
| Global UI model | `shared/model/confirm.model.ts` |
| Page fetch/reset | `pages/balance.tsx`, `pages/dashboard.tsx` |
