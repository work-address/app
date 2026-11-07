# Settings concept: adapt the existing profile editor

Preview: [settings.html](../previews/settings.html). Explore Public profile, Links,
and Account & wallet. Read the [handoff](../../../claude-handoff-time-workspace.md).

**Routing default:** implement the assigned presentation work on
`/profile/:id/edit`. The current router has no Settings page. The mock's sidebar
entry and section navigation describe a proposed organization; adding `/settings`
or changing app navigation requires a separately assigned product scope.

## Units

| Unit | Files under `web/src/` | Finish condition |
| --- | --- | --- |
| S1 — public details form | `pages/profile-edit.tsx`, `features/profile/ui/profile-edit/profile-edit.tsx`, `profile-edit-details.tsx`, `profile-edit-field.tsx`, `profile-edit-actions.tsx` | Labeled fields on natural-height white sheets; desktop/phone actions, validation, dirty state, loading, save and discard work without obscuring fields. |
| S2 — social links | `features/profile/ui/profile-edit/profile-edit-links.tsx` and its field composition | Consistent labels/hints, all existing providers, valid URL/handle mapping, and the same actual save lifecycle. |
| S3 — account/wallet presentation | `features/connected-wallet/ui/`, `features/local-wallet/ui/` | Existing conditional account/wallet panels and their dialogs use shared design while preserving authentication, export/reveal, and recovery behavior. |

Paths after the first profile-edit path remain in that directory. S3 is a styling
unit, not permission to redesign wallet security or add account capabilities.

## Preserve these contracts

- The route checks ownership. Keep the auth/profile loading and failure states;
  an unavailable profile must not produce an editable blank form.
- `react-hook-form` owns drafts; `saveProfileMutation` owns persistence. Preserve
  reset seeding, validation, name/title fallbacks, and server-error handling.
- Preserve current null/empty semantics: cleared rate is `null`; a cleared email
  is deliberately removed; an unchanged email can be omitted. Skills and rich
  biography retain their existing mapping, not the mock's comma-input shortcut.
- Preserve leave/discard confirmation and pending-save behavior. Back navigation
  and the existing phone action sheet must remain usable; the last field must
  scroll clear of the action bar.
- Keep wallet components outside the profile form so their own dialog submission
  cannot submit profile edits. Keep connected/local/Google states conditional on
  actual account capability; the mock displays illustrative combinations.
- Preserve current wallet reveal/export/recovery controls and secret handling.
  Never replace them with a static success toast or a mock backup message.
- A live preview, if included in the assigned unit, reads the same form draft
  without saving on keystrokes. Section switching preserves unsaved fields.

Verify clean/dirty/pending/failed form states, Save/Cancel/Back and leave behavior,
validation, phone scrolling, and the supported account variants. Use the current
form/model and wallet tests covering changes; no real wallet operation is needed
to verify visual geometry. Report any proposed routing/live-preview work separately
from the completed presentation unit.
