# Work Address app

The time tracking and invoicing product: who worked on what, what it is worth, and who may see it. `SPEC.md` governs the domain rules; this file only fixes the words.

## Language

**Owner**:
The person a project belongs to.
_Avoid_: Client, employer, admin

**Worker**:
A person whose address is on a project's worker list and who records time on it.
_Avoid_: Contractor, freelancer, member

**Viewer**:
A person whose address is on a project's viewer list and who reads project totals only.
_Avoid_: Guest, observer

**Collaborator**:
A worker or a viewer, as opposed to the owner.
_Avoid_: Member, teammate

**Role**:
What a project's lists say a person is: owner, worker, viewer, or nothing.
_Avoid_: Permission, access level

**Access**:
What a person's role grants them today, once the owner's plan is taken into account.
_Avoid_: Role, membership

**Entry**:
One record of a worker's time on a project, for a ten-minute slice.
_Avoid_: Timelog, time row

**Detail**:
What an entry holds beyond its time: screenshot, apps, titles, input counts and note.
_Avoid_: Evidence, activity data

**Published**:
Of an entry: its detail has reached the owner, because its author released it, an invoice billed it, or the review window ended.
_Avoid_: Reviewed, released, public

**Project totals**:
The figures a reader may see for a project over a span, answered by one module: a viewer the project's time, a worker their own time and money, an owner everyone's.
_Avoid_: Stats, project summary

**Paid time**:
Every `isPaid` minute in the reader's scope, however it came to be marked.
_Avoid_: Settled time, billed time

**Paid money**:
The reader's paid invoice amounts, plus hand-marked `isPaid` entries not on a paid invoice at the project's current rate. An estimate until those entries are invoiced.
_Avoid_: Earnings, payout

**Address**:
What an account is called: an EVM address for a wallet account, the Google email for a Google account. Project lists hold these.
_Avoid_: Wallet address, username

**Connected wallet**:
A wallet a Google account has proved is its own, shown on its profile and paid on its invoices. It signs nobody in and grants no access.
_Avoid_: Linked wallet, payout address
