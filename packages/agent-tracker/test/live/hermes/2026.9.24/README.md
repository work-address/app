# Hermes Agent 2026.9.24

Live check of 2026-11-14 on darwin/arm64, Node v22.16.0. The model was emulated by scripts/mock-model.mjs; the agent and its Work Address integration ran for real.

- success: ok (pass) — run.completed
- failure: ok (pass) — run.failed
- interruption: not ok (fail) — run.cancelled wanted; saw open
- concurrency: ok (pass) — 2 runs ended: run.completed, run.completed

Not passed: a one-shot `hermes -z` stopped with Ctrl+C hard-exits (`os._exit`)
before any hook or exit handler runs, so the interrupted turn stays open. The
interruption fixture is left out so CI replays only what passed; Hermes Agent
stays experimental until an interruption is recorded.
