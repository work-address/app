# Profile: a readable public identity

Preview: [profile.html](../previews/profile.html). App route: `/profile/:id`.
Read the [handoff](../../../claude-handoff-time-workspace.md) first.

## Units

| Unit | Files under `web/src/` | Finish condition |
| --- | --- | --- |
| P1 — identity and page composition | `pages/profile.tsx`, `features/profile/ui/profile-view/profile-view.tsx`, `profile-view-head.tsx`, `profile-view-section.tsx` | Canvas heading, white identity sheet, role/rate/location, and owner actions have the reference hierarchy at desktop and phone sizes. |
| P2 — biography, links, and sharing | Other `features/profile/ui/profile-view/` components | Biography/skills and contact links read clearly, long values wrap, optional fields disappear deliberately, and real QR/address/share behavior still works. |

`profile-view-*` names after the first path stay in that directory. The checkout
already contains styling changes there; refine only observed gaps.

## Preserve these contracts

- Use `ProfileGate`, profile loading/failure/not-found states, and the current
  own-profile/authentication checks. Edit appears only for the appropriate user.
- Preserve real title/name fallbacks, address identity, rate formatting, skills,
  contact fields, and profile metadata. Use the sample identity only as a layout
  stress reference, not product content or a default account.
- Retain rich biography rendering/sanitization and accessible real social links.
  Hide absent values instead of filling them with concept text.
- Keep QR, copy-address, and share behavior even though the mock emphasizes a
  simple hero and share panel. The mock's initials do not imply avatar upload.
- Maintain public/restricted content rules and premium status from application
  state. The concept's visible badges do not establish entitlements.

Review own and another person's profile, a sparse profile, long name/title/link,
loading/error/not-found, and desktop/phone sharing. Use `model/head.test.ts` when
changing head/fallback behavior. Hand off Settings separately from public-profile
presentation.
