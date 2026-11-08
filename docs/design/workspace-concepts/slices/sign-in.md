# Sign-in: a calm entrance to the workspace

Preview: [sign-in.html](../previews/sign-in.html). App route: `/sign-in`.
Read the [handoff](../../../claude-handoff-time-workspace.md) first.

## Design direction

The preview opens **Workspace welcome**: a pale-blue canvas, a white sign-in
panel, and an illustrative workspace summary. **Quiet focus** uses a centered
white panel with less surrounding content. Both retain Google, create-wallet,
and import-key choices. The selected variant in the conversation was Workspace
welcome; saving this concept does not itself authorize implementation.

On phones, Workspace welcome removes the illustrative summary and shortens its
introductory region. Both layouts keep the complete sign-in flow in one natural
page scroll. Map proportions to the shared workspace tokens.

## Units

| Unit | Files under `web/src/` | Finish condition |
| --- | --- | --- |
| A1 — page composition and choices | `pages/sign-in.tsx`, `features/auth/ui/auth-brand-panel.tsx`, `auth-google-panel.tsx`, `auth-wallet-panel.tsx` | The assigned layout matches the reference hierarchy, white surfaces, spacing, and typography on desktop and phone. Every available sign-in option remains reachable. |
| A2 — step presentation and request states | Relevant `features/auth/ui/` components and `features/local-wallet/ui/local-wallet-dialog/` step components | Create, import, unlock, backup, loading, failure/retry, and back transitions fit the page and retain their existing behavior. Other consumers of shared wallet steps and auth controls remain usable. |

Bare `auth-*` filenames in A1 remain under `features/auth/ui/`. Start by reading
the current diff and opening the route. Existing styling may already satisfy
part of a unit; refine observed gaps rather than replacing the implementation.

## Preserve these contracts

- `pages/sign-in.tsx` owns method availability, authenticated redirects, the
  requested return path, and the `nonce` handoff to the tracker connection route.
- Keep the real Google provider and its supported rendering. The concept's
  letter G and local account chooser are visual placeholders, not OAuth UI.
- Preserve loading and failed-method states, Google script/API errors, last-used
  hints, and mutual exclusion while one sign-in method is busy. Wallet-only
  deployments remain complete; an API outage affects both methods.
- Keep `use-local-wallet-flow.ts` and `local-wallet-steps.tsx` as the behavior
  owners. Preserve password validation, encryption, import, unlock, key backup,
  and existing leave warnings. Sample passwords and success states stay in docs.
- Keep the actual Help Center destination. The concept's help panel is only a
  local illustration. Public-page example metrics must remain clearly
  illustrative and never imply access to a visitor's private workspace.

## Verification

Use the demo's sign-in scenarios from [demo-mode](../../../demo-mode.md) and
restore its original role/session afterward. Check Google offered, wallet-only,
method failure, script failure, new wallet, existing wallet, and error retry.
Verify the return path and tracker nonce behavior if their surrounding code
changes. Use `entities/profile/google.model.test.ts` for affected Google model
behavior. Follow the handoff's viewport, keyboard, translation, and source checks.

Deliver A1/A2 evidence independently; completing a styled first screen does not
establish that the later wallet and authentication states are finished.
