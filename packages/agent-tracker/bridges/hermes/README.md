# work-address-hermes

A [Hermes Agent](https://github.com/NousResearch/hermes-agent) plugin that
records how long each agent turn runs, for time tracking and invoicing in
[Work Address](https://address.work).

It is an observer only: it registers `pre_llm_call` and `on_session_end`, never
returns context or directives, and hands only session and turn identity, the
schema version and three outcome flags to the Work Address collector
(`npm install -g @work-address/agent-tracker`). No prompt or response text
leaves the process.

## Install

```sh
npm install -g @work-address/agent-tracker
pip install work-address-hermes
```

Install it in the same Python environment as Hermes, add `work-address` to
`plugins.enabled` in Hermes configuration, and set the collector up with the
command the Work Address dashboard gives when you add a server agent.

Hermes Agent support is experimental until its live check passes: set
`WORK_ADDRESS_EXPERIMENTAL_ADAPTERS=1` in Hermes's environment. See
[SERVER-RUNTIMES.md](https://github.com/work-address/app/blob/main/packages/agent-tracker/SERVER-RUNTIMES.md#hermes-agent).
