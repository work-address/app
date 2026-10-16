# Agent data sources

Reference for [agent-time-tracking.md](agent-time-tracking.md): what each AI agent tool exposes about its work, through hooks and through the records it keeps locally. Collected 13–15 October 2026.

**How things were verified.**

- **Seen:** field, record or table names inspected in real local data on a Mac on 15–17 October 2026. Names only; no prompt, code or other content was read.
- **Docs:** stated in the vendor's documentation or source code.
- **Reported:** stated by a third party (for example a competitor's release notes).
- **Unverified:** expected but not yet confirmed; Phase 0 must check it.

Nothing here has been qualified by our own conformance tests yet.

## 1. Coding tools on the worker's machine

Read by the Qt log reader on laptops (timer mode). H = hooks, L = local records.

| Tool | Local records | Hooks | Run timing | Tokens and cost | Model | Interruptions and errors | Waits for a person | Subagents | Richer source | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Claude Code** | JSONL per session, `~/.claude/projects/<project>/<session>.jsonl` | 32 events: prompt submit, Stop, tool, permission, subagent, compaction, file and folder changes | L: timestamp on every record, `stop_reason`. H: prompt submit and Stop arrival only | L: input, output, cache read, cache creation per call. H: none (only `context_tokens` on resumed sessions) | L: per call, plus `requestedModel`, `effort`. H: SessionStart (optional), model-switch events | L: interruption marker in the user record, `system` `api_error`. H: `StopFailure`, `PostToolUseFailure`; Stop does **not** fire on interruption | H: `PermissionRequest`, `PermissionDenied`, live. L: `permissionDecision`, `permissionMode` on records | L: `isSidechain`. H: `SubagentStart` / `Stop`, `agent_id` | **Logs** | L Seen, H Docs |
| **Codex** | JSONL rollout per session, `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | Prompt submit, Stop, Interrupt, session start and end, subagent, tool, permission | L: `task_started` / `task_complete` with `started_at`, `completed_at`, `duration_ms`, `time_to_first_token_ms`; per tool `item_completed` start and end in ms | L: input, cached, cache write, output, reasoning, total; plan and rate limits. H: none | L: `session_meta`, `turn_context` | L: `turn_aborted`. H: `Interrupt` | H: `PermissionRequest`. L: `approval_policy` only | L: inter-agent records. H: subagent events | **Logs** | L Seen, H Docs |
| **Kimi Code** | Per session `~/.kimi-code/sessions/<workDirKey>/<sessionId>/`: `state.json`, `agents/main/wire.jsonl`, one `wire.jsonl` per subagent, `logs/kimi-code.log`; `session_index.jsonl` at the root | `TurnStarted`, Stop, `StopFailure`, `Interrupt`, `PermissionRequest` / `PermissionResult`, subagent events, `SessionHeartbeat`; experimental Server API | L: `turn.prompt` / `turn.ended` with `turnId`, `durationMs`, `wallClockMs`, `llmFirstTokenLatencyMs` | L: `usage.record`, `token_counting.turn_recorded`. H: none | L: `model`, `provider`, `modelAlias`, `thinkingEffort` | L: end `reason`, `turn.steer`, `error`; `lastTurnReason` in `state.json`. H: `Interrupt`, `StopFailure` | **L: `interaction.request` / `interaction.resolved` explicit pairs**, approval results. H: permission events | L: one stream per subagent. H: subagent events | **Logs** | L Seen, H Docs |
| **MiniMax** (Agent desktop app and its local runtime) | SQLite `~/.minimax/v2/sqlite/runtime-state.sqlite` (WAL); also `~/.minimax/v2/sessions/`, `~/.minimax/background-tasks/` | Undocumented; a local `~/.minimax/v2/plugin-hook-cache` suggests plugin hooks exist | L: `turn_ingress` with `accepted_at_ms`, `completed_at_ms`, `status` | L: input, output, reasoning, cache read, cache write **and `cost_usd`** per turn | L: per token-usage row | L: `terminal_outcome`, `error_code` (values unverified) | L: partial (goal wait reason, queue pauses) | L: `parent_session_id`, agent-to-agent messages | **Local DB** | L Seen, H unverified |
| **Cursor IDE** | SQLite `state.vscdb` in Cursor's `User/globalStorage` (3.8 GB here): `composerHeaders` table, `composerData:` and `bubbleId:` records in `cursorDiskKV` | Prompt submit, `stop`, session start and end, tool, subagent, compaction, agent response and thought | L: `createdAt` on every message, `createdAt` / `lastUpdatedAt` per conversation. H: prompt submit and `stop`; `sessionEnd` with `duration_ms` | **None in either.** L: `tokenCount` exists on every message but is empty (3,533 of 3,534 sampled on 3.24.12); `usageData` empty. H: context size only before compaction | L: `modelConfig.modelName`, `modelInfo.modelName`. H: on every event | L: `status` `completed` / `aborted` / `none`, `errorDetails`. H: `stop` status | None | L: `composerHeaders.isSubagent`, `subagentTypeName` (`explore`, `shell`, `generalPurpose`, `bugbot`). H: subagent events | **Logs** for timing; also lines added/removed and files changed | L Seen (3.24.12), H Docs |
| **Gemini CLI** | `~/.gemini/tmp/<project>/` session files | `BeforeAgent`, `AfterAgent`, `AfterModel`, session events | H and L: turn start and end | H: `AfterModel` usage. L: input, output, cached, thoughts | H and L | H: no end event on user abort | — | — | **About even** | H Docs, L folder Seen, fields unverified |
| **GitHub Copilot** (CLI and VS Code) | CLI under `~/.copilot`; VS Code chat sessions in its storage | CLI: prompt submitted, agent stop, session end with `abort`. VS Code: prompt submit, Stop (Preview) | H: turn start and end | Only through OTel | Only through OTel | H: CLI `abort` | — | — | **Hooks** for timing | H Docs, L unverified |
| **Windsurf** | A transcript file written only by its transcript hook | `pre_user_prompt`, asynchronous `post_cascade_response` | H: start, asynchronous end | None | H: `model_name` (may be "Unknown") | None | — | — | **Hooks** | H Docs |
| **Cline** | Task files in VS Code's global storage | Per task: `TaskStart`, `TaskComplete`, `TaskCancel` (settings toggle) | H: per task, not per turn | L: tokens in and out, cost in task records | H: provider and slug | H: `TaskCancel` | — | — | **Logs** for tokens | H Docs, L unverified |
| **OpenCode** | Local store under `~/.local/share/opencode` | Plugin events: `session.status`, `session.idle`, `session.error`, permission, tool | H: status changes | Unverified | Unverified | H: `session.error` | H: permission events | — | Unverified | H Docs, L Reported |
| **Devin Local** | Desktop and CLI history | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | L Reported |

Not supported: **Aider** (no start hook; only a launch wrapper or its `--analytics-log`, which records prompt tokens, completion tokens and cost), **Roo Code** (repository archived), **Cursor CLI in `-p` mode** (skips the prompt and stop hooks).

## 2. Agent runtimes on servers

Read by the npm collector in fixed mode, through plugins, observers or hooks; there is no Qt app on a server.

| Runtime | Integration route | Run boundaries | Tokens | Model | Waits for a person | Subagents and nesting | Project attribution | Limits | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **OpenClaw** | Typed plugin observers and diagnostic subscriptions; OTLP spans | `agent_end`; diagnostics `harness.run.started` / `completed` / `error`; spans `openclaw.run`, `openclaw.harness.run` | Model-call telemetry, not uniform across embedded and external harnesses | From model spans | Universal human-wait boundaries not established | Child hooks name the child differently at spawn and end; runs it launches in Codex or Claude Code are seen twice and billed once, under OpenClaw | Not in default OTLP export (session keys omitted); set at collector setup or `WORK_ADDRESS_PROJECT` | A trigger labelled `user` need not be a human; don't request approval-control privileges to measure time | Docs |
| **Hermes Agent** | Python observer plugin, contract `hermes.observer.v1`, through a pip shim that hands events to the npm collector | `pre_llm_call` to `on_session_end`, which, despite its name, ends each turn, including failure and interruption | API events; fields unverified | API events | `on_human_input_request` / `resolved` with request identity | Subagent events; child stop callbacks can arrive late | Setup or `WORK_ADDRESS_PROJECT` | Turn start comes after context compression; plugins need explicit enablement | Docs |
| **Claude Cowork** | Plugin hooks in its cloud execution environment, uploading over authenticated HTTPS | Plugin hooks (schemas may differ from Claude Code) | Unverified | Unverified | Unverified | Unverified | Sandbox credential | Organisation-level OTel is out of scope; manual timer if hooks don't qualify | Docs |
| **Claude Code, headless** (`claude -p`, CI, cron) | Hooks plus the transcript at Stop; plugin from our marketplace | Hooks | Transcript at Stop | Transcript | Hooks | Hooks | Setup or `WORK_ADDRESS_PROJECT` | In `-p` mode async hooks die at teardown; cloud VMs are reclaimed, so flush at Stop | Docs |
| **Codex, headless** (`codex exec --json`, CI) | Hooks, or the JSONL event stream of a run we launch | `turn.started` / `turn.completed` / `turn.failed` | Transcript at Stop | Transcript | Hooks | Hooks | Setup or `WORK_ADDRESS_PROJECT` | A launched run's stream needs a durable run ID; timeouts kill the hook's process group | Docs |
| **Kimi Code Server API** | Experimental REST and WebSocket API (`/api/v1/ws`) | Turn events | Unverified | Unverified | Approval and question events | Subagent events | Setup | Replay by `{seq, epoch}`, 1,000-event buffer; some reads resume a cold session, so never start work just to track it | Docs |
| **Legacy Kimi CLI** | Wire JSON-RPC transport | `TurnBegin` / `TurnEnd` | Unverified | Unverified | Unverified | Nested subagent events | Setup | Archived codebase; separate adapter | Docs |
| **OpenCode server** | JS/TS plugin | Plugin status events | Unverified | Unverified | Permission events | — | Setup | Payload and replay to qualify | Docs |
| **Custom frameworks** | Our event emitter SDK, or OpenTelemetry GenAI agent spans | Agent spans | Model spans | Model spans | Unverified | Distinguish agent spans from nested model and tool spans; never sum every span | Setup | GenAI conventions are still "Development" | Docs |

**MiniMax's coding CLI** (`mcode`, with an `mcode exec` mode for scripts and CI) is documented, but whether it writes the same local store as the desktop runtime is unverified. MiniMax's `mmx` is a media-generation CLI, not a coding agent. MiniMax models used inside other tools appear as the `model` in that tool's records and need nothing extra.

## Field details

Names only, as seen on 15 October 2026 unless marked otherwise.

### Claude Code

- **Record types:** `user`, `assistant`, `attachment`, `system` (subtypes `stop_hook_summary`, `api_error`, `local_command`), `custom-title`, `last-prompt`, `agent-name`, `mode`, `queue-operation`, `file-history-snapshot`, `file-history-delta`, `cost-state`, `atis-latch`.
- **On user and assistant records:** `timestamp`, `uuid`, `parentUuid`, `sessionId`, `promptId`, `isSidechain`, `cwd`, `gitBranch`, `version`, `entrypoint`, `permissionMode`, `permissionDecision`, `userType`.
- **On assistant records:** `message.model`, `requestedModel`, `effort`, `thinkingDurationMs`, `message.stop_reason` (`tool_use`, `end_turn`, `stop_sequence`), `message.usage` with `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, `cache_creation`, `server_tool_use`, `service_tier`, `speed`, `iterations`.
- **Hook common fields (Docs):** `session_id`, `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, `effort`, `hook_event_name`, `agent_id`, `agent_type`.

### Codex

- **Record types:** `session_meta`, `turn_context`, `event_msg` (`task_started`, `task_complete`, `token_count`, `item_completed`, `turn_aborted`, `thread_settings_applied`, `thread_goal_updated`), `response_item` (`message`, `agent_message`, `reasoning` (encrypted), `function_call` and output, `custom_tool_call` and output, `compaction`), `token_usage_record`, `inter_agent_communication_metadata`, `world_state`, `compacted`.
- **`task_started`:** `turn_id`, `started_at`, `model_context_window`, `collaboration_mode_kind`, `turn_attribution`.
- **`task_complete`:** `turn_id`, `started_at`, `completed_at`, `duration_ms`, `time_to_first_token_ms`.
- **`token_count`:** `info.total_token_usage` and `info.last_token_usage` with `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`; `rate_limits` with `plan_type`, `primary`, `secondary`, `credits`.
- **`session_meta`:** `cwd`, `git`, `model`, `cli_version`, `approval_policy`, `effort`, `context_window`.

### Kimi Code

- **Layout:** `session_index.jsonl` (`sessionId`, `workDir`, `sessionDir`); per session `state.json` (`agents`, `cwd`, `createdAt`, `updatedAt`, `lastTurnReason`, `title`, `version`), `agents/<main | agent-N>/wire.jsonl`, `logs/kimi-code.log`. Older builds used `~/.kimi/sessions/<hash>/<id>/` with `context.jsonl`, `wire.jsonl`, `state.json` (Docs). Moved by `KIMI_CODE_HOME` (older: `KIMI_SHARE_DIR`).
- **Record types:** `turn.prompt`, `turn.ended`, `turn.steer`, `prompt.accepted`, `task.started`, `task.terminated`, `llm.request`, `usage.record`, `token_counting.measured`, `token_counting.turn_recorded`, `interaction.request`, `interaction.resolved`, `permission.set_mode`, `permission.record_approval_result`, `context.append_loop_event`, `goal.create` / `update` / `clear`, `swarm_mode.enter` / `exit`, `plugin.session_start`.
- **Fields:** `turnId`, `promptId`, `durationMs`, `wallClockMs`, `model`, `provider`, `modelAlias`, `usage`, `tokens`, `tokensUsed`, `thinkingEffort`, `llmFirstTokenLatencyMs`, `toolName`, `toolCallId`, `status`, `reason`, `error`, `created_at`.

### Cursor

- **Store:** `state.vscdb`, with tables `ItemTable`, `cursorDiskKV` (key/value; 515k rows here) and `composerHeaders`.
- **`composerHeaders`:** `composerId`, `workspaceId`, `createdAt`, `lastUpdatedAt` (epoch ms), `isArchived`, `isSubagent`, `subagentTypeName`, `checkpointAt`, and a `value` JSON with `filesChangedCount`, `totalLinesAdded`, `totalLinesRemoved`, `contextUsagePercent`, `unifiedMode` (`agent` or `chat`), `workspaceIdentifier`.
- **`composerData:<id>`:** `createdAt`, `lastUpdatedAt`, `status`, `modelConfig.modelName`, `isAgentic`, `subagentComposerIds`, `generatingBubbleIds`, `stopHookLoopCount`, `filesChangedCount`, `usageData` (empty).
- **`bubbleId:<composerId>:<bubbleId>`:** `type` (1 user, 2 assistant), `createdAt`, `modelInfo.modelName`, `tokenCount.inputTokens` / `outputTokens` (empty), `errorDetails`, `isRefunded`, `requestId`, `commits`.
- **Content beside the fields:** the same records hold prompts, responses, code excerpts and file selections. The reader must copy only the fields above out of each row.
- **Key prefixes seen:** `agentKv:blob`, `bubbleId`, `composerData`, `messageRequestContext`, `checkpointId`, `codeBlockDiff`, `composerDraft`.

### MiniMax

- **Tables of interest in `runtime-state.sqlite`:**
  - `local_runtime_sessions`: `status`, `workspace_dir`, `project_id`, `parent_session_id`, `created_at_ms`, `error_code`.
  - `local_runtime_turn_ingress`: `turn_id`, `accepted_at_ms`, `completed_at_ms`, `status`, `source`.
  - `local_runtime_token_usage`: `turn_id`, `model`, `ts`, `input_tokens`, `output_tokens`, `reasoning_tokens`, `cache_read_tokens`, `cache_write_tokens`, `cost_usd`.
  - `local_runtime_session_agent_state`: `terminal_outcome`.
  - `local_runtime_turn_diffs` and `local_runtime_turn_diff_journal`: file changes and file-changing tool calls with `tool_name`, `tool_status` and timestamps.
  - `local_runtime_crons` and `local_runtime_v2_cron_runs`: scheduled runs with `trigger_source`, `status` and timestamps.
  - `local_runtime_thread_goals`: `tokens_used`, `time_used_seconds`, `execution_wait_reason`.
  - `local_runtime_communication_messages`: messages between sessions.
- **Message bodies** sit in `local_runtime_message_rows.data_json`; the reader must not read them.
- **Scheduled runs** start without a human prompt. On a laptop they count only while the timer is on, like any other run.

## Locations by OS

Only the macOS locations were seen; the rest follow each tool's conventions and are unverified.

| Tool | macOS | Linux | Windows |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/projects/` | `~/.claude/projects/` | `%USERPROFILE%\.claude\projects\`, or inside WSL |
| Codex | `~/.codex/sessions/` | `~/.codex/sessions/` | `%USERPROFILE%\.codex\sessions\`, usually inside WSL |
| Kimi Code | `~/.kimi-code/` | `~/.kimi-code/` | `%USERPROFILE%\.kimi-code\` |
| Gemini CLI | `~/.gemini/tmp/` | `~/.gemini/tmp/` | `%USERPROFILE%\.gemini\tmp\` |
| Cursor | `~/Library/Application Support/Cursor/User/globalStorage/` | `~/.config/Cursor/User/globalStorage/` | `%APPDATA%\Cursor\User\globalStorage\` |
| MiniMax | `~/.minimax/` | Unverified | Unverified |
| Cline, Copilot (VS Code) | VS Code's storage under `~/Library/Application Support/Code/` | `~/.config/Code/` | `%APPDATA%\Code\` |

- **Moved stores:** `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and `KIMI_CODE_HOME` move them; a GUI app does not see shell variables, so the Qt app needs a folder setting.
- **WSL:** stores inside WSL are read from Windows through `\\wsl.localhost\<distribution>\home\<user>\`, only while the distribution runs, by polling.
- **Flatpak and Snap** editions keep data under `~/.var/app/` or `~/snap/`.

## Hooks or local records: summary

| Tool | Richer source | What only that source gives |
| --- | --- | --- |
| Claude Code | Logs | Logs: tokens, exact timing, interruptions. Hooks: live permission waits |
| Codex | Logs | Logs: tokens incl. reasoning, `duration_ms`, time to first token, per-tool timing, plan limits |
| Kimi Code | Logs | Logs: tokens, time to first token, explicit wait pairs. Hooks: real-time delivery only |
| MiniMax | Local DB | DB: tokens, cost, scheduled-run origin. Hooks: unknown |
| Gemini CLI | About even | Both have tokens; hooks miss user aborts |
| Cursor | Logs | Logs: timing, outcome, model, subagents, lines changed, history. Neither source has tokens |

Hooks are better only for real-time delivery, live permission waits and session end reasons. Local records also give history from before installation. That is why the agent plan reads local records on laptops and keeps hooks for servers.

## Prior art: Firstlight

[Firstlight](https://firstlight.sh/) (21st Labs) is a macOS menu-bar app with friends and leaderboards.

- **How it collects:** it reads agents' local usage logs on a schedule, with no hooks, no OTel and no proxy.
  - **Tools:** Claude Code, Codex, Cursor and OpenCode are named in its privacy policy; Devin Local, Cowork-run Claude Code and Orca-launched Codex are named in its release notes.
  - **What it reads:** "only the agent logs it counts, not the settings and sign-in files beside them". It re-reads history to backfill.
- **What it counts:** overlapping sessions each add time. An agent counts as running if it did anything in the last five minutes, including while waiting on a build or the user.
- **What it uploads:** agent time and daily token counts by model; the front app per active minute; optionally the front-tab site for chosen sites and browsers. It says it never records window titles, file names, keystrokes or screen content.
- **Where:** Supabase Postgres in the US, sign-in through Clerk.
- **How it compares:**
  - **Same:** both read token counts from local logs, and both store no prompts.
  - **Different:** we count one agent's overlapping runs once per project, and the desktop timer decides the project.

Sources: [privacy policy](https://firstlight.sh/privacy), [release notes](https://github.com/serafimcloud/firstlight-releases/releases).

## Sources

- **Claude Code:** [hooks](https://code.claude.com/docs/en/hooks), [monitoring](https://code.claude.com/docs/en/monitoring-usage).
- **Codex:** [hooks](https://learn.chatgpt.com/docs/hooks), [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [app-server](https://learn.chatgpt.com/docs/app-server).
- **Kimi Code:** [hooks](https://moonshotai.github.io/kimi-code/en/customization/hooks), [data locations](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/data-locations.html), [sessions](https://www.kimi.com/code/docs/en/kimi-code-cli/guides/sessions), [Server API](https://www.kimi.com/en/help/kimi-code/cli-server-api); legacy [Wire](https://moonshotai.github.io/kimi-cli/en/customization/wire-mode.html).
- **MiniMax:** [CLI features](https://agent.minimax.io/docs/cli/features.md), [quick start](https://agent.minimax.io/docs/cli/quick-start.md), [mmx](https://platform.minimax.io/docs/m-plan/minimax-cli).
- **Cursor:** [hooks](https://cursor.com/docs/hooks); [Cursor CLI forum report](https://forum.cursor.com/t/cursor-cli-omits-beforesubmitprompt-afteragentresponse-and-stop-hooks-loses-token-usage-and-emits-inconsistent-generation-id-values/169059).
- **Gemini CLI:** [hooks reference](https://geminicli.com/docs/hooks/reference/), [telemetry](https://geminicli.com/docs/cli/telemetry/).
- **GitHub Copilot:** [CLI hooks](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference), [VS Code hooks](https://code.visualstudio.com/docs/copilot/customization/hooks), [monitoring](https://code.visualstudio.com/docs/agents/guides/monitoring-agents).
- **Windsurf:** [Cascade hooks](https://docs.devin.ai/desktop/cascade/hooks).
- **Cline:** [v3.36 hooks](https://cline.bot/blog/cline-v3-36-hooks).
- **Aider:** [notifications](https://aider.chat/docs/usage/notifications.html).
- **OpenCode:** [plugins](https://opencode.ai/docs/plugins/).
- **OpenClaw:** [hook reference](https://docs.openclaw.ai/plugins/hooks/reference), [spans and events](https://docs.openclaw.ai/gateway/opentelemetry/spans-and-events), [telemetry privacy](https://docs.openclaw.ai/gateway/opentelemetry/privacy-and-trace-context), [prompt and session hooks](https://docs.openclaw.ai/plugins/hooks/prompt-and-session).
- **Hermes Agent:** [observer contract](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/observer-hooks.md), [hooks](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/hooks.md), [plugins](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/plugins.md).
- **Claude Cowork:** [plugins](https://support.claude.com/en/articles/13837440-use-plugins-in-claude), [architecture](https://support.claude.com/en/articles/14479288-claude-cowork-architecture-overview), [OTel](https://support.claude.com/en/articles/14477985-monitor-claude-cowork-activity-with-opentelemetry).
- **OpenTelemetry:** [GenAI agent spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md).
