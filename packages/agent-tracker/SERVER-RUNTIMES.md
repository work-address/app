# Server runtime adapters — qualification status

Checked against `app/docs/agent-time-tracking.md` and `agent-data-sources.md` on
2026-10-17. These are **experimental collector integrations**, not completed billing
support. The production ingest API, normalization/accounting, wait subtraction,
Windows qualification and live runtime qualification remain separate work. No
runtime in this matrix has passed live qualification here. Tests use synthetic
metadata fixtures derived from the linked contracts.

Keep these packages in the app monorepo: they share the versioned contract, durable
queue, tests and release checks. Hermes needs a small Python distribution; it does
not need a separate repository. OpenCode runs its plugin under Bun and invokes the
Node collector rather than loading Node's SQLite module into Bun.

| Runtime / transport | Implemented behavior | Qualification / remaining limitation |
| --- | --- | --- |
| OpenClaw | Separate pinned plugin: trusted diagnostic run start and terminal | Partial, SDK 2026.10.4 dispatcher tested; live host requires Node >=24.16 <25 or >=26.1. No waits/replay/lineage |
| Hermes Agent | Python `hermes_agent.plugins` entry point, `pre_llm_call` and `on_session_end`; outcome flags distinguish success/failure/interruption | Partial, observer v1 schema enforced; root turns only; start follows compression; ambiguous outcome stays unknown |
| Claude Code headless | Separate provisional records per `UserPromptSubmit`, provisional `Stop`, definitive `StopFailure` | Partial; successful Stop cannot finalize because other hooks may continue. Transcript reconciliation and interruption fixtures required |
| Codex headless hooks | Native turn IDs, provisional `Stop`, `Interrupt` cancellation | Partial; successful Stop needs authoritative completion evidence |
| Codex `exec --json` | Live `thread.started`, `turn.started/completed/failed`; per-launch run identity; disconnect remains unknown | Partial; receipt-time measurement, no replay/native timestamps or wait accounting |
| Current Kimi Code | `TurnStarted` includes scheduled/system turns; provisional `Stop`; `StopFailure` and `Interrupt` | Partial; no waits, replay or child attribution; terminals without a turn ID rely on serial hook ordering |
| Kimi Code Server API | Explicit unavailable registry entry; hook transport above is available | Installed `/openapi.json` and `/asyncapi.json` and replay/epoch fixtures required. Collector does not poll APIs that might resume work |
| OpenCode server | JS plugin forwards allowlisted status; busy/idle/error become running/unknown observations | Partial **observation only**, no qualified run boundaries and no billable elapsed-time claim; no replay/child attribution |
| Claude Cowork | Explicit unavailable registry entry | Its cloud hook payload, executable deployment, credentials and delivery at VM teardown need qualification. Use the existing manual timer; Claude Code payloads are not assumed interchangeable |
| Legacy Kimi CLI | Explicit unavailable registry entry, separate from current Kimi | Optional route needs negotiated Wire version and launched-session fixtures; not implemented |
| Generic runtime | Strict `emitEvent(queue, envelope)` SDK and `agent-tracker emit` stdin | Caller must provide native lifecycle evidence and stable IDs; model-generated timer calls are not native observations |
| Optional OTel | Explicit unavailable registry entry | No receiver/span mapping implemented. Organisation-wide Cowork OTel remains out of scope |

`agent-tracker adapters` exposes the same statuses without requiring credentials.
All native hook/stream adapters require explicit
`WORK_ADDRESS_EXPERIMENTAL_ADAPTERS=1`. Set `WORK_ADDRESS_RUNTIME_VERSION` to the
installed runtime version (or source commit); absent values are recorded as
`unqualified`. This label is operator-supplied, not automatic version attestation.
Schema matching and fixture tests do **not** establish compatibility with every
runtime release. Unknown Hermes schema versions are rejected without affecting the
agent. Other adapters ignore unrecognized events and do not serialize extra fields.

## Install and operate

Build from the repository with `pnpm agent-tracker:build`; use the existing tarball
packaging workflow to install the collector. Requires Node >=22.16 (the separate
OpenClaw host has its stronger requirement). Set up the collector once using the
README's endpoint/project/credential command. Configure a fixed project and private
state directory for each deployment; no task/project inference from prompt text.

Export these variables into the **runtime's** environment:

```sh
export WORK_ADDRESS_STATE_DIR=/absolute/private/collector-state
export WORK_ADDRESS_EXPERIMENTAL_ADAPTERS=1
# Replace with the actual installed version or source revision.
export WORK_ADDRESS_RUNTIME_VERSION=your-runtime-version
```

For **Claude Code/Codex**, merge the appropriate `bridges/hooks/*.json` hooks into
runtime configuration. For **Kimi Code**, merge `bridges/hooks/kimi-code.toml` into
`~/.kimi-code/config.toml`. Resolve `agent-tracker` through the runtime's PATH or
replace it with an absolute executable path. Hooks are synchronous, return neutral
JSON and exit zero on capture failure. Codex additionally requires its own hook
trust review. These examples are configuration templates, not automatically
installed plugins or a published marketplace.

For **Hermes**, install the shipped `bridges/hermes` directory with pip in the same
Python environment as Hermes, then add `work-address` to `plugins.enabled` in
Hermes configuration. The pip entry point registers two callbacks accepting
`**kwargs` and returning `None`; the bridge never returns context or directives.
Set `WORK_ADDRESS_COLLECTOR_BIN` to an absolute collector executable if needed.
Only session/turn/parent identity, schema version and three boolean outcome flags
cross the Python-to-Node boundary. The subprocess has a one-second timeout and no
network operation. Bridge failure emits one generic warning per Python process;
loss before reaching SQLite cannot be counted durably and requires host-log
monitoring. Collector failures after queue opening increment `status.lost`.

For **OpenCode**, copy `bridges/opencode/work-address.mjs` into
`.opencode/plugins/` or `~/.config/opencode/plugins/`. The host plugin passes only
session ID and status to a bounded Node subprocess. Status events are ephemeral;
this integration never reconstructs missed activity from process uptime.

For **Codex exec**, consume one live invocation (not a saved transcript):

```sh
set -o pipefail
codex exec --json 'your task' | agent-tracker stream codex
agent-tracker sync
```

The stream command consumes output and does not echo messages/tool payloads. Each
invocation creates a launch UUID; turns without native IDs use that namespace.
Truncated streams emit unknown observations, not successful completion. A retry
must launch a fresh invocation; replaying saved JSONL is unsupported and would
create new receipt-time measurements. The stream reader limits each line to 1 MiB. On malformed/oversized input,
configuration failure or storage failure, it warns once and drains the remaining
output without interpreting it, keeping the producer pipe open until EOF. Skipping
a record could lose a turn boundary, so parsing does not resume mid-stream. It
reports failure after draining; an unfinished observed turn remains unknown.
Source event numbers continue increasing across all turns in one launch epoch.

**Delivery:** no resident service. `SessionStart`, `SessionEnd`, `Stop`,
`StopFailure`, `Interrupt`, Hermes `on_session_end` and OpenCode `idle`/`error`
start a short-lived detached `agent-tracker sync` when events are queued; the
upload lease keeps it single. When `CLAUDE_CODE_REMOTE` or a CI variable (`CI`,
`GITHUB_ACTIONS`, `GITLAB_CI`, `BUILDKITE`, `CIRCLECI`, `JENKINS_URL`) is set,
`Stop` and `StopFailure` also flush for up to 8 seconds before returning, which is
why the bundled configs give those hooks a 10-second timeout. Set
`WORK_ADDRESS_HOOK_UPLOAD=0` to leave delivery to `agent-tracker sync`. Still run
`sync` before a CI job or ephemeral VM exits, even when the agent command fails
(for example, a CI `always()` cleanup step), to drain what a flush left. Sync can
retry at most 20 batches with a 10-second request timeout each; budget teardown time
accordingly. A failed upload requires persistent state to survive VM reclamation.
Sync exits 0 only when no retained events remain, 1 for command/transport failures,
and 2 for an incomplete drain (including pending backoff, a competing upload lease,
batch limit or rejected events). Preserve the state directory on either nonzero
result; examine rejection/loss counts rather than repeatedly retrying rejected data.
This package does not install a service or guarantee delivery from reclaimed VMs.

Enable **one authoritative product** for an execution chain. OpenClaw launching
Codex/Claude must not be billed independently by both integrations until proven
cross-product execution identity/deduplication is implemented. Hermes children are
suppressed when parent identity is present; anonymous/late terminal-only records
must remain pending downstream, never become guessed duration.

Claude hook submissions carry no reliable turn ID or steering indicator. Every
submission therefore gets a separate provisional record; a preceding open record
becomes unknown, never guessed complete. This prevents a later task's failure from
being attached to an interrupted earlier task. Follow-ups, autonomous submissions
and duplicate hook invocations cannot be classified as distinct logical tasks with
these signals alone; run-boundary capability remains false. Prompt text is never
used to guess identity. See the [UserPromptSubmit contract](https://code.claude.com/docs/en/hooks#userpromptsubmit).

## Evidence and validation

- Hermes source revision reviewed: `26f1b2753056f877b6db25bd0697f1adb4df2049`,
  [observer contract](https://github.com/NousResearch/hermes-agent/blob/26f1b2753056f877b6db25bd0697f1adb4df2049/website/docs/developer-guide/observer-hooks.md),
  `agent/turn_finalizer.py`, `hermes_cli/plugins_dispatch.py` and
  `hermes_cli/plugins_discovery.py`. Package version `0.0.0` is insufficient for
  release qualification. Tests exercise the shim, not an installed Hermes host.
- [Claude Code hooks](https://code.claude.com/docs/en/hooks): Stop continuation,
  definitive StopFailure and headless teardown constraints.
- [Codex hooks](https://learn.chatgpt.com/docs/hooks) and
  [exec JSONL](https://learn.chatgpt.com/docs/non-interactive-mode): native hook turn
  identity versus anonymous exec turn events; Stop can continue.
- [Current Kimi hooks](https://moonshotai.github.io/kimi-code/en/customization/hooks),
  [Server API](https://www.kimi.com/en/help/kimi-code/cli-server-api) and
  [legacy Wire](https://moonshotai.github.io/kimi-cli/en/customization/wire-mode.html).
  Server API payload qualification remains blocked on installed schemas; Wire is
  an optional, separately versioned transport.
- [OpenCode plugin API](https://opencode.ai/docs/plugins/) and
  [status schema](https://github.com/anomalyco/opencode/blob/dev/packages/schema/src/session-status-event.ts):
  session ID, busy/idle/retry, ephemeral status events. Retry is not a human wait.
- [Cowork plugin documentation](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)
  confirms hook availability, not interchangeability with CLI fixtures.

Run `pnpm agent-tracker:test`, `pnpm agent-tracker:test-hermes`,
`pnpm agent-tracker:demo`, and `pnpm agent-tracker:pack-smoke`. Synthetic conformance
covers privacy allowlists, terminal ordering, continuation, restart correlation,
duplicate callbacks, unknown schema, failure/interruption, child suppression,
truncated streams and fail-open behavior. Live success/failure/interruption/wait,
concurrency, teardown and offline recovery fixtures per runtime/version/OS are
still release gates. The `time-tracker` repository is unchanged: these server paths
use no Qt runtime, and desktop log readers are a separate implementation phase.

Local validation: 54 Node tests and 2 Python tests pass, including both bridges
calling the real Node collector. All npm tarballs install outside the workspace.
Python wheel construction is included in CI but could not be verified locally:
the host Python 3.14 pip fails while detecting the macOS version, before building
the package. The Python callback/module path is tested; wheel installation remains
a packaging qualification item.
