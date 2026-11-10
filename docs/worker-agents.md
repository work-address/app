# Worker agents

Status: done on 10 November 2026 (`9ba132a2` and the commit after it), on `dev`. No behaviour changed: the whole API suite passed unedited in an isolated database, 681 tests. One thing is narrower than before: the Run record's two lock predicates now ask the provisioning plan itself, so a batch for an unknown product, or for a product whose only agent was removed, takes a read lock where it used to take a write lock for a write that never happened. The default rule under Afterwards is still open.

One module answers every rule about a worker's agents and where they are attached: which agent a run goes to, whether an attachment still counts, who may see it, and what the two lists become when something changes. The repository and the Run record lock and persist.

Related documents: [agent-time-tracking.md](agent-time-tracking.md) "Agents and attachments" is the rule set; [`SPEC.md`](../SPEC.md) "Who can see what" governs visibility; [`GLOSSARY.md`](../GLOSSARY.md) defines Attachment.

## Why

- **One lookup, written seven times.** "The attachment of this agent of this worker" (`agentId` and `workerId` together) is spelled out in `agent-run-record.ts` (`rejectionCode`, `attachesTo`, `provisionDefaults`, `billable`), `agent-repository.ts` (`attach`), `agent-invoice-lines.ts` and `team-manager.ts`.
- **Three questions with no names.** "Accepts new runs" (agent not removed, attachment not detached), "bills past runs" (ever attached) and "shown on the Team" are each a different filter at a different call site. They are right today, and nothing says which is which.
- **Two modules write the same columns.** `AgentRepository` and `AgentRunRecord.provisionDefaults` both build `User.agents` and `Project.agentAttachments`. An attachment at rate 0 is created in two places, and so is a default agent.
- **Assignment is split over three functions.** `assignedAgent`, `agentForMachine` and the provisioning loop each resolve part of "pinned agent, handle, machine binding, product default".
- **Lock predicates repeat the provisioning rule.** `lockUploader` and `attachesTo` work out whether a batch will add an agent or an attachment, and `provisionDefaults` works it out again to do it. They agree by hand.
- **Visibility is written three times.** "The owner sees every attachment, a worker their own" is in `AgentRepository.attachments`, `ProjectRepository.presentTo` and `TeamManager`.

## Decisions

| Area | Decision | Not chosen |
| --- | --- | --- |
| Where it lives | A pure module, `service/worker-agents.ts`: static functions over plain lists, like `AgentInvoiceLines` and `AgentTimeNormalizer` | Growing `AgentRepository`, which would mean moving the Run record's locking |
| What it knows | Plain values only. Nothing of `AgentEventV1`, `AgentCredential`, TypeORM entities or `routing-controllers` | Passing events and entities in |
| Who writes the columns | The module alone says what the lists become. `AgentRepository` and `AgentRunRecord` keep their own transactions, locks and `tx.update` | One writer of the rows as well |
| Liveness | Three named questions, behaviour unchanged. A removed or detached agent's past runs stay billable | One "is attached" answer, which would change billing |
| Refusals | A transition returns the new list or a refusal code. `AgentRepository` turns the code into the HTTP error it throws today | Throwing from the pure module |
| Provisioning | One plan, from the worker's agents, the project's attachments and the batch's products. The lock predicates ask whether the plan is empty; the write applies it | Three functions that must agree |
| Visibility | In the module, as a fourth question | Leaving three copies |
| Column guards | `ProjectManager`'s and `UserManager`'s `delete` guards stay: they stop an edit overwriting a column, which is their own concern | Moving them |
| Credentials | Stay in `AgentRepository` | Moving them |
| Behaviour | None changes in this work | Settling the default rule in the same change |
| Tests | The Postgres tests in `agent-run-record.test.ts` and `agent-controller.test.ts` are not edited and judge the move. One table-driven in-process file covers the module | Rewriting the ingest tests now |
| Interface design | One shape, fixed by the callers | Designing it several ways in parallel |

## Module

`service/worker-agents.ts`. What it answers, in the words callers use:

| Question | Rule it owns |
| --- | --- |
| Which agent does a run go to? | The agent an earlier event of the run was pinned to; else the handle from `WORK_ADDRESS_AGENT`; else the agent bound to the machine; else the product's default. Removed agents never |
| Does this attachment accept new runs? | The agent is not removed and the attachment is not detached |
| Does it bill past runs? | It was ever attached, detached or not |
| Is it shown on the Team? | It accepts new runs |
| Who may see it? | The project's owner sees all; a worker their own; nobody else |
| What will this batch provision? | A default agent for a product the worker never had an agent for, and a rate-0 attachment where the worker never had one, for unnamed laptop runs only. A removed agent is not recreated and a detached one is not reattached |
| What do the lists become? | Saving, removing, attaching, setting a rate and detaching, each as the new list or a refusal code |

## Order

1. This brief and the glossary entry.
2. The module and its tests.
3. The callers moved over, checked with `pnpm test:isolated` on the Run record and agent controller suites.

## Afterwards

The default rule is undecided in [agent-time-tracking.md](agent-time-tracking.md): a product's first agent is its default, so a first server agent also receives the desktop app's runs. The agreed direction is that an agent created with machine bindings and `isDefault: false` does not become the default, "exactly one default agent per product" becomes "at most one", and the Team dialog's warning goes. It is a separate change to `SPEC.md`, the plan and this module, with its own tests.
