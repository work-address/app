# Work Address app

The time tracking and invoicing product: who worked on what, what it is worth, and who may see it. `SPEC.md` governs the domain rules; this file only fixes the words.

## Language

**Owner**:
The person a project belongs to.
_Avoid_: Client, employer, admin

**Worker**:
A person whose address is on a project's worker list and who records time on it. Always a person: an agent is "an agent run by a contributor". Text users read calls this role **Contributor** (es colaborador, ru участник, ja コントリビューター, zh 贡献者); `worker` stays in code, the API, stored values and internal docs.
_Avoid_: Contractor, freelancer, member. In text users read, avoid Worker too, except "remote workers" as a description of the audience

**Viewer**:
A person whose address is on a project's viewer list and who reads project totals only.
_Avoid_: Guest, observer

**Collaborator**:
A worker or a viewer, as opposed to the owner. Text users read says **people** (es personas, ru люди, ja メンバー, zh 人员), or "contributors or viewers"; `collaborator` stays in code and internal docs.
_Avoid_: Member, teammate. In text users read, avoid Collaborator too

**Team**:
The people on a project's lists and the agents they run, as the `/team` page shows them. Not an account or an organisation: nothing is stored under this name.
_Avoid_: Organisation, workspace

**Server agent**:
An agent of a worker's that runs on a server rather than their laptop, and uploads with its own credential limited to one agent on one project.
_Avoid_: Project agent, hosted agent

**Role**:
What a project's lists say a person is: owner, worker, viewer, or nothing.
_Avoid_: Permission, access level

**Access**:
What a person's role grants them today, once the owner's plan is taken into account.
_Avoid_: Role, membership

**Plan**:
What an owner's account is on: Free, Premium, or a self-hosted instance with no limits. It limits who may record on the owner's projects, how far back entries, runs and screenshots are kept, and how many workers the owner may list.
_Avoid_: Tier, subscription. Entitlement is billing's signed message that sets the plan, not the plan itself

**Entry**:
One record of a worker's time on a project, for a ten-minute slice.
_Avoid_: Timelog, time row

**Detail**:
What an entry holds beyond its time: screenshot, apps, titles, input counts and note.
_Avoid_: Evidence, activity data

**Published**:
Of an entry: its detail has reached the owner, because its author released it, an invoice billed it, or the review window ended.
_Avoid_: Reviewed, released, public

**Invoiced**:
Of an entry: covered by an invoice from its author that has not been rejected, either billed on it or, for an invoice older than frozen lines, inside its period. Its detail stays and only its paid state can still change by hand.
_Avoid_: Billed, frozen, settled

**Run record**:
One agent run's whole life, kept by one module: credentialed events in, the run they project, frozen once billed, finished, released and rotated.
_Avoid_: Agent timelog, agent entry

**Project totals**:
The figures a reader may see for a project over a span, answered by one module: a viewer the project's time, a worker their own time and money, an owner everyone's.
_Avoid_: Stats, project summary

**Reader's scope**:
Which Entries and runs a reader counts over a span, under one of four named rules: time, published detail, own entries and runs.
_Avoid_: Visibility, access filter

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
