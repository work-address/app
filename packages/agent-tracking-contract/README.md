# Work Address agent tracking contract

Versioned, strict runtime validation and TypeScript types for the collector prototype.
`parseEvent` accepts only the explicit lifecycle variants `run.started`,
`run.completed`, `run.failed`, and `run.cancelled`, plus observations and desktop
timer gates described below. Nested unknown fields are rejected.
Each event is limited to 16 KiB; timestamps are ISO UTC and numeric durations are
nonnegative safe integers in milliseconds.

This is the implemented subset of `docs/agent-time-tracking.md`, not the entire
planned contract. Waits, content and manual entries are not accepted until their
semantics and tests are implemented. Capabilities describe the producer;
a receiving server must check them against its own compatibility registry.

`pnpm build` compiles `dist/` and generates `schema/agent-event-v1.json` from the
same Zod definition. The JSON Schema is exported as
`@work-address/agent-tracking-contract/schema` for consumers such as the Qt reader.
The package has no dependency on backend entities, UI or OpenClaw.

The experimental subset also includes `run.observed` with running/unknown state
and lifecycle/runtime-state evidence. Hook/stream receipt timestamps explicitly
use `collector_wall`; they are not native timestamps. Unknown observations never
mean successful completion, and session status alone does not qualify run timing.

Desktop timer mode also accepts `tracking.paused` with `stopped`, `idle`,
`suspended` or `switched`, and `tracking.resumed` with `started` or `switched`.
These require a reason and otherwise use the same strict envelope. The server
must restrict these events to timer-mode credentials and qualified Qt adapters.
