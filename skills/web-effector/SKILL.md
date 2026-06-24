---
name: web-effector
description: >-
  Guides work in the web package (React/Vite frontend) and its Effector state
  layer. Use when editing web/src, adding features, stores, queries, mutations,
  auth flows, pages, or when the user mentions Effector, farfetched, entities,
  features, or the web frontend.
---

# Web Package & Effector State

## Quick start

1. **Locate code** under `web/src/` (`@` → `web/src`).
2. **Follow layer imports:** pages → features/widgets → entities → shared (never upward).
3. **State lives in** `entities/*` or `features/*/model/` — wire with `sample()` in `index.ts`, not in React.
4. **React binds** via `useUnit`; pages own fetch/reset in `useEffect`.
5. **API reads/writes** use `@farfetched/core` (`createQuery` / `createMutation`), not raw `createEffect`.

For full conventions, code patterns, and file-level reference, see [REFERENCE.md](REFERENCE.md).

## Package

| Item | Path |
|------|------|
| Frontend | `web/` |
| Source | `web/src/` |
| API client | `web/src/shared/api/generated/` |

Dev: `cd web && pnpm dev` (port 3000). Codegen: `cd web && pnpm codegen` (needs `.env`).

## Layers

```
web/src/
├── app/       # Router, global auth init
├── pages/     # Route components; fetch/reset on mount/unmount
├── layouts/   # AuthLayout, MainLayout
├── widgets/   # Cross-page UI (header)
├── features/  # User scenarios (balance, dashboard, profile, invoice, auth)
├── entities/  # Domain units (profile/auth, activities/projects)
└── shared/    # UI kit, hooks, API base, i18n, cross-cutting models
```

Import from layer `index.ts` only — not deep internal paths.

## Effector file split

| File | Role |
|------|------|
| `*.events.ts` | `createEvent` — triggers |
| `*.stores.ts` | `createStore`, `combine`, derived `$` stores |
| `*.effects.ts` | `createEffect` — localStorage, wallet SDK, subscriptions |
| `*.queries.ts` | `createQuery` — API reads |
| `*.mutations.ts` | `createMutation` — API writes |
| `*.model.ts` | Wallet/provider sub-domains |
| `index.ts` | `sample()` wiring + public exports |

## Naming

- Stores: `$balance`, `$authenticated`
- Events: `fetchBalance`, `login`
- Effects: `fetchStatusFx`, `loginEthFx`
- Queries/mutations: `activitiesQuery`, `saveProfileMutation`

## React rules

```typescript
// Bind with useUnit — not useStore
const { fetchBalanceEvent, balance, loading } = useUnit({
  fetchBalanceEvent: fetchBalance,
  balance: $balance,
  loading: $balanceLoading,
})

// Pages own lifecycle
useEffect(() => {
  fetchBalanceEvent()
  return () => resetBalanceEvent()
}, [fetchBalanceEvent, resetBalanceEvent])
```

- `useState` / react-hook-form for ephemeral local UI (modals, forms).
- Routes: `routes.dashboard.build()` from `web/src/routes/index.ts` — no hardcoded paths.

## Adding state

**Feature:** `features/<name>/model/` → wire `index.ts` → export via `features/<name>/index.ts` → page `useUnit` + `useEffect`.

**Entity:** follow `entities/activities` (queries + filters) or `entities/profile` (auth orchestration + wallet models).

Cross-feature domain logic → `entities/`, not `features/`.

## Do not

- Put `sample()` in React components or hooks (except gate definitions in model)
- Import `@/entities/profile/profile.stores` — use `@/entities/profile`
- Use `createEffect` for CRUD when farfetched fits
- Skip `AxiosError` checks on `baseApi` calls
- Add Redux, Zustand, or other global state libraries

## Reference implementations

| Pattern | Location |
|---------|----------|
| Simple feature model | `features/balance/model/` |
| Combined query stores | `features/invoice/model/stores.ts` |
| Entity + filters + debounce | `entities/activities/` |
| Auth orchestration + split | `entities/profile/index.ts` |
| Wallet sub-model | `entities/profile/eth.model.ts` |
| Gate + query | `features/profile/model/index.ts` |
| Global UI model | `shared/model/confirm.model.ts` |
| Page fetch/reset | `pages/balance.tsx`, `pages/dashboard.tsx` |
