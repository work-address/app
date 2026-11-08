# Workspace concepts: implementation acceptance

Recorded 2026-11-07 against the uncommitted tree on top of `e58721c4`. Each
preview and its app route were opened at the same width (1280px and 390px) in
headless Chromium, the demo in Owner · Typical, and the shared geometry was read
from the computed styles of the first white panel on each page.

## Measured comparison

| Page | Width | Font | h1 (size/line) | Panels | Radius | Shadow layers | Panel gap | Horizontal overflow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | 1280 | system / system | 32/38.4 → 40/48 | 6 → 10 | 26 → 28 | 2 / 2 | 20 → 24 | none / none |
| Dashboard | 390 | system / system | 29/34.8 → 28/36 | 6 → 10 | 26 → 28 | 2 / 2 | 20 → 24 | none / none |
| Time | 1280 | system / system | 32/38.4 → 40/48 | 3 / 3 | 26 → 28 | 2 / 2 | 20 → 24 | none / none |
| Time | 390 | system / system | 29/34.8 → 28/36 | 3 / 3 | 26 → 28 | 2 / 2 | 20 → 24 | none / none |
| Invoices | 1280 | system / system | 32/38.4 → 40/48 | 2 / 2 | 26 → 28 | 2 / 2 | 20 → 24 | none / none |
| Invoices | 390 | system / system | 29/34.8 → 28/36 | 2 / 2 | 26 → 28 | 2 / 2 | 20 → 24 | none / none |
| Profile | 1280 | system / system | 32/38.4 → 40/48 | 5 / 5 | 26 → 28 | 2 / 2 | 20 → 24 | none / none |
| Profile | 390 | system / system | 29/34.8 → 28/36 | 5 / 5 | 26 → 28 | 2 / 2 | 16 → 24 | none / none |
| Settings | 1280 | system / system | 32/38.4 → 40/48 | 3 / 3 | 26 → 28 | 2 / 2 | 20 → 24 | none / none |
| Settings | 390 | system / system | 29/34.8 → 28/36 | 3 / 3 | 26 → 28 | 2 / 2 | 16 → 24 | none / none |

Concept value first, app value second; one value means they match.

**Sign-in** (Workspace welcome, the selected variant) was compared the same
way. On desktop, the welcome story sits beside a white sign-in card on the
canvas; on a phone, the eyebrow and heading sit above the card. Both match the
preview's hierarchy, with no horizontal overflow at either width. The card's
column is 400px because Google draws its button at most that wide, so every
row in the card lines up with it.

## Status

The user accepted the pages on 2026-11-08. The Dashboard's Desktop session
block was then built as well (below), so every preview's composition is now in
the app.

## Differences that are intended

- **Type scale and geometry.** The h1, panel radius, panel gap and Settings
  panel title (19 → 22) differ by the scale mapping this catalog's README
  prescribes: the previews use compact proportions for a ~1024px conversation
  surface, and the app keeps its `--ui-*` roles. Every page uses the same
  mapping, so the pages stay consistent with each other.
- **Dashboard has 10 panels, not 6.** The first row matches the preview:
  the chart beside the Desktop session block. The live Insights, Projects, App
  usage, Agents, Recent prompts, Team and screenshots blocks are kept, as the
  Dashboard row of the README's concept-to-product table requires; Insights
  moved to a full-width row of its own.
- **"Time by day" is the app's Time by project chart.** It plots the same
  daily bars for the period, split by project. On a phone, up to twelve bars
  (a week, or a day by hour) lie in rows as in the preview; a longer period
  keeps its columns rather than becoming a long list.
- **Phone summaries list one figure per row** on Dashboard, Time and
  Invoices, as their previews do: the label and its hint on the left, the
  value on the right. Invoice amounts are grouped like every other amount
  (`$9,976.32`).
- **Desktop session is the reader's own, read from real entries.** The time
  search returns each entry's author, though the generated type leaves it out.
  The block shows the signed-in person's latest stretch of desktop-app time in
  the selected projects and period, joined across gaps of up to ten minutes
  (the statistics' focus-session rule): its length, when it ended, its project
  and note, and a "View session" link to that day on the Time page. Like
  Insights, it is about the reader whoever the people filter selects, and a
  viewer, who cannot track, does not get it. The search takes no person, so
  pages of everyone's entries are read newest first, up to 1,000 entries; past
  that, a busy team's owner sees "No recent desktop session". The duration uses
  the app's format ("2 hr 10 min") rather than the preview's stopwatch.
- **Real data in place of illustrative data.** Avatars are initials or the
  profile's QR code, sample names and figures come from the demo world, and the
  "Saved"/"Synced" labels appear only when application state backs them.
- **Sign-in's example day is labelled "Example".** Its date is today, and
  its figures are fixed sample values. A visitor has no workspace yet, so
  nothing on the page may read as their own data. The preview's line about
  agents is left out.

## Desktop session states checked, desktop and phone

Filled (a teammate's newer entries skipped, the reader's session found), empty
("No recent desktop session" when the period holds none of the reader's
desktop time), loading in the block's own shape with its place held while
projects load, a failed request with Try again recovering it, hidden for a
viewer, and "View session" opening that day and project on the Time page.

## Sign-in states checked, desktop and phone

Methods loading (skeleton in the Google slot), methods failure, and retry
bringing the options back. Import a private key, create a wallet, and Back to
the choice. Backing up the key, then signing in on to the dashboard. Signed out
with a saved wallet: the unlock step, with its "Last used" mark, and a wrong
password named inline. The code that holds one option back while the other
is busy, the return path, and the tracker `nonce` hand-off in
`pages/sign-in.tsx` are unchanged; the first was not exercised here.

## States checked on every page, desktop and phone

Loading skeletons in the page's own shape, retryable load failures (whole page,
panel, and inline beside working content), empty worlds, filters with no match,
not-found records and profiles, signed-out redirects, and the owner, worker,
viewer and mixed roles. Dialogs open and close as centered modals on desktop and
as drawers on phones, and one Escape closes them.

## Reproducing

Serve the previews (see [README](README.md)), run the web app in demo mode on
`localhost:8000`, and capture both at the same viewport width. The screenshots
are not kept in the repository because of their size.
