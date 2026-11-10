# Work Address OpenClaw adapter

Prototype, **partial coverage**, fixed-project mode. Source stays in the Work Address
monorepo; this directory produces an independently installable npm plugin. No package
has been published yet.

## What works

- Observes trusted `run.started` / `run.completed` diagnostics from OpenClaw **2026.10.4**.
- Maps completion, abort, blocked and error outcomes into the shared event contract.
- Keeps source timestamps and reported durations; never invents an end after a crash.
- Hashes run identities; uses a stable per-run session namespace instead of exporting
  session keys, addresses, paths or user-supplied labels.
- Queues allowlisted events in SQLite before uploading. Uploads one bounded batch
  every 30 seconds while the gateway service is running, with retries and backoff.
- Ignores inner harness/model/tool streams, so they cannot duplicate the outer run.
- Subscribes through the SDK's metadata-only `onInternalDiagnosticEvent`, with a
  two-event filter and a `metadata.trusted` check. The public `onDiagnosticEvent`
  excludes trusted core events in this version and is unsuitable for this collector.

The adapter never controls an agent, requests approval privileges, changes a prompt,
reads a transcript or turns on diagnostics. Diagnostics must already be enabled.
An unsupported version or failed collector leaves agent execution alone and reports
one generic warning per minute. Inspect the queue with `agent-tracker status`.

## Local proof (no OpenClaw installation required)

From the repository root:

```sh
pnpm agent-tracker:test
pnpm agent-tracker:demo
pnpm agent-tracker:pack-smoke
```

The demo sends synthetic fixtures through the adapter, restarts the SQLite queue,
and uploads to an authenticated loopback receiver. It uses a temporary directory,
removes it afterward and never accesses the application's database.

The collector/library tests require Node 22.16+ (`node:sqlite`, experimental on some
releases). Running this plugin in OpenClaw requires the host's Node range:
**>=24.16.0 <25 or >=26.1.0**. Package tests on older Node do not qualify a gateway.

To verify against an installed OpenClaw package:

```sh
pnpm agent-tracker:build
pnpm agent-tracker:verify-sdk /absolute/path/to/node_modules/openclaw
```

For an unpacked 2026.10.4 npm tarball without its native dependencies, append
`--dispatcher-only`. This checks the published types and exercises the actual
metadata dispatcher with synthetic trusted/untrusted events. It does not load a
full gateway or qualify a real model run.

## Try with a development gateway

Use a separate test gateway with the exact version above and a supported Node runtime.
These steps use the loopback development receiver, which bills nothing. To record
into a Work Address project, see [Connect to Work Address](#connect-to-work-address).

1. Build all three packages with `pnpm agent-tracker:build`.
2. Start the loopback development receiver in another terminal, supplying a local
   test credential (at least 16 characters) in `WORK_ADDRESS_MOCK_CREDENTIAL`:

   ```sh
   node packages/agent-tracker/examples/mock-ingest.mjs
   ```

3. Set `WORK_ADDRESS_STATE_DIR` to a new absolute directory. Feed the same development
   credential to the setup command on stdin; do not put a real credential in argv:

   ```sh
   node packages/agent-tracker/dist/cli.js setup \
     http://127.0.0.1:4199/api/agent-tracking/events \
     677cf211-c57d-49ce-aa82-23fd013bed14
   ```

   Enter the test credential and close stdin. Setup writes an owner-only config
   with a generated machine identity. It refuses to overwrite an existing setup.
   On Windows, ensure the directory's ACL allows only the collector account;
   POSIX file modes alone do not configure Windows ACLs.

4. Link the local plugin using OpenClaw's development installation flow:

   ```sh
   openclaw plugins install --link ./packages/agent-tracker-openclaw
   ```

   Set the plugin's configuration in that development gateway:

   ```json
   {
     "plugins": {
       "entries": {
         "work-address-agent-tracker": {
           "enabled": true,
           "config": { "stateDirectory": "/absolute/path/to/the/collector-directory" }
         }
       }
     }
   }
   ```

   Follow the gateway's plugin trust/enablement flow. The plugin needs its host SDK
   resolvable as `openclaw/plugin-sdk/diagnostic-runtime`; the adapter library itself
   does not load or install OpenClaw. Restart the test gateway after configuration.
5. Run a test task, then inspect `node packages/agent-tracker/dist/cli.js status`
   or flush with `node packages/agent-tracker/dist/cli.js sync`.

Disable/remove this plugin through OpenClaw when finished. Stop the gateway service
before inspecting or deleting its collector directory. Uninstallation should preserve
unsent events until you explicitly choose to remove that dedicated directory.

## Connect to Work Address

The API issues collector credentials and ingests, deduplicates and bills these runs.
Every minute is billed as unclassified until this adapter is qualified.

1. Install the collector and this plugin on the gateway host. No package is published
   yet: build with `pnpm agent-tracker:build`, run `pnpm pack` in each of
   `packages/agent-tracking-contract`, `packages/agent-tracker` and this directory,
   and install the three tarballs on the host with `npm install -g`. That puts
   `agent-tracker` on the PATH.
2. On the web Team page, choose **Add a server agent**, pick OpenClaw, the project and
   a rate. The project needs **Record AI agents** on, or its runs are refused. The
   page shows the credential once, and a setup command.
3. Set `WORK_ADDRESS_STATE_DIR` to a new absolute private directory. Copy the
   credential first, then run the command the page shows, as it is:

   ```sh
   agent-tracker setup <events-endpoint> <project-uuid> <source-instance-uuid>
   ```

   The command waits 30 seconds for the credential on stdin: paste it, press Enter,
   then Ctrl+D. Keep the third argument. It is the machine identity the credential
   was issued for, and the API refuses uploads from any other.
4. Enable the plugin with that directory as `stateDirectory`, as in step 4 above, and
   restart the gateway.

A credential lasts 90 days and cannot be renewed, and setup never overwrites an
existing directory. To carry on after it expires, add a new server agent on the Team
page and set the collector up in a new directory.

## Qualification boundary

See `compatibility.json` and the fixture's provenance. Current tests use synthetic
inputs and the pinned SDK dispatcher, not captured real runs. Missing end events
remain incomplete; no replay, human-wait detection, token counts, tool summaries,
subagent lineage or cross-collector deduplication is claimed. Do not run this alongside
another collector for the same work and assume the result is invoice-ready.

Before production: qualify real completion, interruption, crash, concurrent and child
runs on supported hosts and measure enqueue latency. The server must register adapter
capabilities itself; client capability flags are never billing authority.

This prototype is intentionally independent of the Qt desktop collector and existing
human time/invoice behavior. It adds no hooks or services to the user's machine by itself.

Sources used for this adapter:
- https://docs.openclaw.ai/plugins/sdk-runtime/config-and-utilities
- https://docs.openclaw.ai/plugins/sdk-runtime/gateway-and-nodes
- Published `openclaw@2026.10.4` diagnostic and plugin API declarations/dispatcher.
