# Codex 0.169.0

Live check of 2026-11-14 on darwin/arm64, Node v22.16.0. The model was emulated by scripts/mock-model.mjs; the agent and its Work Address integration ran for real.

- success: ok (provisional) — run.completed wanted; saw run.observed
- failure: ok (pass) — run.failed
- interruption: ok (pass) — run.cancelled
- concurrency: ok (pass) — 2 runs ended: run.observed, run.observed
