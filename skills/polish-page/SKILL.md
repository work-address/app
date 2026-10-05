---
name: polish-page
description: Polish one or more web/ pages until each is dense, complete, visually refined, and ready to market. Use when the user invokes /polish-page, or asks for a thorough page-polish pass over one page or a short list of pages, with responsive screenshots and measured verification.
---

# Polish a page

Polish the `web/` pages named by the user until each one is finished, dense, and ready to market to real users. Treat every URL or app path supplied with the invocation as a target page, in the order given; the words around them are directions for the pass. With one target, the rest of this skill applies to it; with several, it applies to each of them, and [Several pages](#several-pages) adds how to run the set. If no page is identifiable from the request or current browser context, ask for its URL.

Work in rounds when the user wants an iterative review: complete a full pass, present the result, then apply feedback and re-verify. Do not commit until the user asks.

## Several pages

- **Read the list.** Split the targets on spaces, commas and new lines, strip the origin (`http://localhost:8000/invoice` is `/invoice`), and drop duplicates. A query variant (`?nonce=`) is a format of the same page, not another page.
- **Plan before editing.** For each target, find its route in `web/src/routes/index.ts`, the page file it renders in `web/src/app/app.tsx` (pages are flat files, `web/src/pages/<page>.tsx`, composing `features/<slice>`), and its last polish commit (`git log --oneline -- web/src/pages/<page>.tsx web/src/features/<slice>`). Pages that share a feature slice, such as `/invoice` and `/invoice/:id`, or `/profile/:walletAddress` and its `/edit`, get one pass together. Keep the user's order otherwise.
- **Capture the whole set first,** before any change, so the before shots all show the same code.
- **Shared fixes once.** When two targets draw the same thing — a card, a row, a header, a state notice — fix it in `shared/ui`, `shared/styles`, the layout or the entity, then recheck every target and every other importer of what changed.
- **Then one full pass per page,** in order: before changing anything, layout, components and code, finish, and verify. Finish and verify a page before starting the next. Keep each page's changes inside its page file and feature slice, plus the shared fixes it needs.
- **Keep the set consistent.** Measure the same things on every target: `PageTitle` size and weight, header height, the `Wrapper` content column's x and width, `SectionTitle` size and the gaps between cards. Values should agree across the set, and an outlier is a finding.
- **Rounds.** Go straight through the list and present the whole set at the end, unless the user asked to review each page before the next.
- **Report per page.** One short section per page — what changed and why, before and after screenshots, remaining dependencies — then the shared changes and the pages each one touched.
- **Commits,** when the user asks: one per page, titled `feat(web): polish the <page>`, plus one per shared change, staging only this session's hunks.
- **Whole app or a broad area** ("every signed-in page", "everything about invoices"): use [polish-app](../polish-app/SKILL.md) instead, which adds the full inventory and the cross-page audit.

## Before changing anything

- Read `skills/fsd-styled-components/SKILL.md` and follow it; read `skills/web-effector/SKILL.md` too if state changes.
- Read the page file, the feature slices it composes, and any stories for the components it uses.
- Run the app locally (see [Running locally](#running-locally)) and capture the page as it is, full length, at 390, 1280, 1440 and 1920 wide, signed in and, where the route allows it, as a guest.
- Inventory every visible block. Look for repeated facts, identities or CTAs; unfinished controls; raw colors or spacing; local clones of shared components; and missing loading, empty or error states.

## Layout

1. Show each fact once. Merge blocks that repeat the same name, address, amount, status or action.
2. Group related content in one card with one border. Put media flush at the top, padded rows below it, and hairlines between distinct rows.
3. Make adjacent panels share a height through grid layout rather than fixed heights.
4. Keep related content in the same column. Data pages use `Wrapper width="full"` and `ListPageLayout` (`Main` and `Aside`); one record or a form uses `Wrapper width="document"`, so every record page starts at the same place.
5. Open the page with the shared `PageHeader` — `PageTitle` h1, at most one small badge, a description, and trailing actions. A page whose title sits inside its own card (a profile, an invoice) uses `PageTitle` alone so the size still matches. On phones, give icon-only actions their own line and preserve accessible labels.
6. Group related actions together, using `Button` and `IconButton` sizes (`s`, `m`, `l`) consistently within a bar, with at most one `solid` button per area.
7. Do not style non-actions as buttons.
8. Align paired information rows across columns. Measure their vertical centers and make them match to the pixel.
9. Use a dense rhythm: tight padding and gaps inside cards, and inline tags and chips where they fit. Headline figures go in a `StatStrip` of `StatTile`s, not in loose text.

## Components and code

- Reuse `shared/ui` first, especially `Wrapper`, `PageHeader`, `PageTitle`, `PageHelmet`, `ListPageLayout`, `SectionTitle`, `Card`, `WidePageCard`, `StatTile`, `StatStrip`, `Button`, `IconButton`, `AdaptiveDialog`, `Tabs`, `Table`, `Search`, `Tooltip`, `Hint`, `StateNotice` and `LoadFailure`, plus Radix Themes primitives such as `Skeleton`.
- Follow the repository's styled-components and FSD conventions. Use the custom properties in `shared/styles/variables.css` and the Radix theme tokens, CSS grid, container queries, and finite `data-*` variants. Avoid raw colors, magic spacing values, and local component clones.
- Keep application and interaction state in Effector. Put pure helpers in `model/` and add meaningful unit tests.
- All copy goes through `t()`. Add every new key to all five locales in `shared/i18n/locales` (en, es, ja, ru, zh).
- Preserve unrelated behavior and existing public boundaries.

## Finish the page

- Use motion through `motion/react`, the way the shell and `shared/ui` already do: staggered fades for block reveals, `AnimatePresence` for conditional content, and no snapping layout. Respect reduced motion (`useReducedMotion`).
- Add promotional content only when the page has a real next step backed by real data. Do not invent prices, availability, metrics or social proof.
- Give the page a `PageHelmet`: a title (formatted as `<title> - Address Work`), a description explaining what visitors can do, `noindex` for anything behind sign-in, a person's own records and every form, and `ogType="profile"` for a person. A page about one record builds these in a pure head builder in its feature's `model/head.ts`, as `buildInvoiceHead` and `buildProfileHead` do. Test the builder.
- Cover the states relevant to the page: a `Skeleton` in the page's own shape (as `time-grid-skeleton.tsx` does), a retryable `LoadFailure` that tells "not found" from "failed" with `getLoadFailureKind`, an empty `StateNotice` that offers a way on, the guest view where the layout allows guests, and copy/share feedback.

## Verify

- From `web/`: run `npx tsc -b`, lint the changed files with `npx eslint <files>` (zero errors), and run the relevant unit tests with `pnpm test` (`vitest run --project unit`). Run the whole web suite when shared behavior warrants it.
- Capture every meaningful page format and state at the same widths as the before shots: 390, 1280, 1440 and 1920.
- Measure alignment, equal panel heights, and header height with browser scripts rather than judging by eye.
- Exercise the relevant interactions, including the primary CTA, dialogs, copy and share where present, and confirm the browser console has no errors.
- Report what changed and why, include useful screenshots, and identify any remaining backend or data dependency.

## Running locally

- The web dev server runs on port 8000 and proxies `/api` to `VITE_API_PROXY_TARGET` (set it in `web/.env.local`; with no API URL configured, dev talks to production). The `.claude/launch.json` configs `api-dev-4100` and `web-dev-api-4100` run the pair on 4100/8100 when something else holds port 4000. Check both servers answer before every browser run.
- Auth is wallet-only. To sign in locally, seed the demo user (`pnpm run seed:demo` in `api/`), mint an access/refresh token pair with the API's `APP_JWT_SECRET`, and set `access_token`, `refresh_token` (no `Bearer ` prefix) and `authenticated=true` in localStorage before loading the page. For a guest, clear those three keys.
- For full-resolution captures, drive headless Chromium from `web/node_modules/playwright` with `fullPage` screenshots. Wait on `domcontentloaded` plus a short fixed delay; `networkidle` never settles.

## Repository pitfalls

- Never run `prettier --write` or `eslint --fix` across `web/src`. It rewrites the generated API client in `shared/api/generated/` and collapses the hand-aligned route union in `routes/index.ts`. Format only the files you touched.
- Do not run `pnpm test` from the repository root during a browser pass: it runs the API suite, which can share the dev database and wipe the seeded user, so the next request 401s. Run web tests from `web/`, and API tests only after the screenshots.
- `MainLayout` sends a guest to sign-in, so dashboard, invoices, an invoice and the profile editor have no guest view; the profile and not-found pages render for guests inside `PublicLayout`.
- A hidden browser can freeze `requestAnimationFrame`; use a visible or suitable headless browser for motion-sensitive screenshots.
