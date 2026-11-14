import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEvent } from '@work-address/agent-tracking-contract'
import {
  AGENT_SUPPORT,
  findAgentSupport,
} from '@work-address/agent-tracking-contract/support'
import { judge } from '../scripts/live-scenarios.mjs'

const LIVE = new URL('./live/', import.meta.url)

/** Every fixture kept from a live check: test/live/<product>/<release>/<scenario>.json. */
function fixtures() {
  if (!existsSync(LIVE)) return []
  return readdirSync(LIVE, { recursive: true })
    .filter((path) => String(path).endsWith('.json'))
    .map((path) => JSON.parse(readFileSync(new URL(String(path), LIVE))))
}

for (const fixture of fixtures())
  test(`${fixture.product} ${fixture.release} ${fixture.scenario} still passes`, () => {
    const events = fixture.events.map(parseEvent)
    const support = findAgentSupport(fixture.product)
    assert.ok(support, fixture.product)
    const result = judge(fixture.scenario, events, support.servers.limits)
    assert.ok(result.ok, result.reason)
  })

test('an agent available on servers has a passing live check for each release', () => {
  const kept = fixtures()
  for (const agent of AGENT_SUPPORT)
    if (agent.servers.status === 'available')
      for (const release of agent.servers.versions)
        for (const scenario of [
          'success',
          'failure',
          'interruption',
          'concurrency',
        ])
          assert.ok(
            kept.some(
              (f) =>
                f.product === agent.product &&
                f.release === release &&
                f.scenario === scenario,
            ),
            `${agent.product} ${release} has no ${scenario} fixture (${join('test/live', agent.product, release)})`,
          )
})

test('the judge tells the scenarios apart', () => {
  const run = (runId, ...types) =>
    types.map((eventType, sequence) => ({
      runId,
      eventType,
      source: { epoch: runId, sequence },
    }))
  assert.equal(
    judge('success', run('a', 'run.started', 'run.completed')).ok,
    true,
  )
  assert.equal(
    judge('failure', run('a', 'run.started', 'run.completed')).ok,
    false,
  )
  assert.equal(
    judge('interruption', run('a', 'run.started', 'run.observed')).ok,
    false,
  )
  assert.equal(
    judge('interruption', run('a', 'run.started', 'run.observed'), [
      'stop-provisional',
    ]).ok,
    true,
  )
  assert.equal(
    judge('concurrency', [
      ...run('a', 'run.started', 'run.completed'),
      ...run('b', 'run.started', 'run.completed'),
    ]).ok,
    true,
  )
  assert.equal(judge('concurrency', run('a', 'run.started')).ok, false)
})
