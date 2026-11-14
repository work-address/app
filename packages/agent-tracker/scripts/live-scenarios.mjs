/*
 * What each live-check scenario must show in the events that reached the API.
 * The live check judges a fresh recording with it, and CI judges the fixtures
 * kept from past checks (test/live-replay.test.mjs).
 */

export const SCENARIOS = ['success', 'failure', 'interruption', 'concurrency']

const TERMINALS = new Set([
  'run.completed',
  'run.failed',
  'run.cancelled',
  'run.observed',
])

/** The run's last ending, by source order; observations count as provisional ends. */
function endings(events) {
  const runs = new Map()
  for (const event of [...events].sort(
    (a, b) =>
      a.source.epoch.localeCompare(b.source.epoch) ||
      a.source.sequence - b.source.sequence,
  )) {
    // A run is its session's: the API keys runs by session and run id too.
    const key = JSON.stringify([event.sessionId, event.runId])
    const run = runs.get(key) ?? { started: false, end: null }
    if (event.eventType === 'run.started') run.started = true
    else if (TERMINALS.has(event.eventType)) run.end = event.eventType
    runs.set(key, run)
  }
  return [...runs.values()].filter((run) => run.started)
}

/**
 * `pass` when the scenario's ending is there; `provisional` when the agent
 * only gives an observation where a definite end was wanted; `fail` otherwise.
 * `ok` allows a provisional end only for an agent whose support entry states
 * the `stop-provisional` limit. `reason` says what was seen.
 */
export function judge(scenario, events, limits = []) {
  const result = verdict(scenario, events)
  return {
    ...result,
    ok:
      result.verdict === 'pass' ||
      (result.verdict === 'provisional' && limits.includes('stop-provisional')),
  }
}

function verdict(scenario, events) {
  const runs = endings(events)
  const ended = runs.filter((run) => run.end)
  const seen = runs.map((run) => run.end ?? 'open').join(', ') || 'no run'
  const want = {
    success: 'run.completed',
    failure: 'run.failed',
    interruption: 'run.cancelled',
  }[scenario]
  if (scenario === 'concurrency') {
    return ended.length >= 2
      ? { verdict: 'pass', reason: `${ended.length} runs ended: ${seen}` }
      : { verdict: 'fail', reason: `two ended runs wanted; saw ${seen}` }
  }
  if (!want) throw new Error(`Unknown scenario ${scenario}`)
  if (ended.some((run) => run.end === want))
    return { verdict: 'pass', reason: seen }
  if (ended.some((run) => run.end === 'run.observed'))
    return { verdict: 'provisional', reason: `${want} wanted; saw ${seen}` }
  return { verdict: 'fail', reason: `${want} wanted; saw ${seen}` }
}
