# Work Address agent collector

Shared library and `agent-tracker` CLI for experimental server runtime adapters.
See [server coverage, setup and qualification limits](SERVER-RUNTIMES.md). Requires Node
22.16+ and built-in `node:sqlite`. No native addon installation is needed.

## Commands

- `agent-tracker setup <events-endpoint> <project-uuid> [source-instance-uuid]` reads the credential from
  stdin and creates a new config in `WORK_ADDRESS_STATE_DIR` (default
  `~/.work-address/agent-tracker`). Setup never overwrites an existing identity.
- `agent-tracker adapters` prints the complete server support matrix.
- `agent-tracker hook <product>` reads native hook JSON; experimental opt-in required.
  Session boundaries and stops start a detached `sync`; in CI and cloud sandboxes
  `Stop` flushes first. `WORK_ADDRESS_HOOK_UPLOAD=0` turns this off (see
  SERVER-RUNTIMES.md).
- `agent-tracker stream codex` reads one live exec JSONL stream.
- `agent-tracker emit` accepts a strict normalized event on stdin.
- `agent-tracker status` prints queued, rejected and lost event counts, never secrets.
- `agent-tracker sync` attempts up to 20 batches of due events, then exits. Backoff
  survives restarts. Exit 0 means no retained events remain; exit 1 reports a
  command/transport failure; exit 2 means the drain is incomplete (backoff, active
  upload lease, batch limit, or rejected events). Preserve the state directory
  until remaining events are handled. Loss counts must also be monitored.

A queue is bound to its endpoint, project, instance and credential. Use a separate
state directory per identity; this prototype does not implement credential rotation.
Do not edit a config to redirect existing queued data to another server or account.
When using the app API, supply the same source-instance UUID used to issue the
credential; omitting it generates an identity suitable for the mock receiver.

`WORK_ADDRESS_PROJECT` selects a project for an agent process, and
`WORK_ADDRESS_AGENT` selects that worker's agent handle. Hooks, Codex streams and
the OpenClaw plugin honor these values. Each project/handle combination has a
separate durable queue beneath the configured state directory; the base config
and its existing queue are unchanged. Run `status` and `sync` with the same values
to inspect or drain that scope. Attribution is pinned when a run first emits an
event. The API validates membership, the owner switch and attachment again.
Local policy/attachment preflight and automatic hook installation remain pending.

HTTPS is required except for explicit loopback HTTP; redirects are rejected.

The library exports `EventQueue`, `sync`, `setup`, `readConfig` and config utilities.
Each upload sends `{ events }`, with at most 50 events (16 KiB each). Only explicit
`accepted`/`duplicate` acknowledgements delete rows. Missing acknowledgements are
retried with the same event IDs. Rejected rows are held for inspection, not retried
indefinitely. The upload lease is transactional and expires after 30 seconds; requests
have a 10-second timeout. Delivery is at least once; the receiver must deduplicate.

HTTP 4xx responses other than 408 and 429 hold the batch as rejected with the
diagnostic code `HTTP_PERMANENT_FAILURE`; response bodies are discarded. Network
failures, 408, 429 and 5xx responses retry with exponential backoff and jitter.
Valid `Retry-After` delays (seconds or HTTP dates) pause uploads for the entire
queue, including newly captured events, and survive restarts. Queue identity uses
normalized configuration, so JSON key order and equivalent endpoint spelling do
not change its scope.

The queue caps stored payload bytes at 100 MiB and expires rows after seven days
when enqueueing or preparing a batch. Drops increment a persistent loss count.
SQLite indexes/page overhead is additional to the payload cap. This lifecycle/observation
prototype has no enrichment events competing for queue space. Local data is stored
in plaintext under restricted permissions; Windows ACL setup and OS keychain-backed
credential storage remain qualification/release work.

`examples/mock-ingest.mjs` is a development-only receiver: it binds loopback and
validates/authenticates/deduplicates, but does not authorize real users or calculate
billing. It stores only event IDs and payload hashes. With its default in-memory DB,
deduplication lasts only until receiver restart; set `WORK_ADDRESS_MOCK_DB` to a test
SQLite path if you need persistence. Never use it as a production endpoint.

See the sibling OpenClaw package README for the runnable demo and installation steps.
