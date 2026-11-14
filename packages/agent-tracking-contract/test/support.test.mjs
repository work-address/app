import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AGENT_SUPPORT,
  AGENT_SUPPORT_CHECKED_ON,
  serverAdapterQualified,
} from '../dist/support.js'

test('every agent is listed once, with an install line and a guide', () => {
  const products = AGENT_SUPPORT.map((agent) => agent.product)
  assert.deepEqual(products, [...new Set(products)])
  for (const agent of AGENT_SUPPORT) {
    assert.ok(agent.servers.install.length > 0, agent.product)
    assert.match(agent.servers.guide, /^packages\/.+\.md#[a-z-]+$/)
  }
})

test('an available server path names the releases it was checked on', () => {
  for (const { product, servers } of AGENT_SUPPORT)
    if (servers.status === 'available')
      assert.ok(servers.versions.length > 0, product)
})

test('only an available server adapter skips the experimental switch', () => {
  for (const { product, servers } of AGENT_SUPPORT)
    assert.equal(
      serverAdapterQualified(product),
      servers.status === 'available',
    )
  assert.equal(serverAdapterQualified('cursor'), false)
})

test('the website copy matches the list', () => {
  const copy = JSON.parse(
    readFileSync(new URL('../schema/agent-support.json', import.meta.url)),
  )
  assert.deepEqual(copy, {
    checkedOn: AGENT_SUPPORT_CHECKED_ON,
    agents: AGENT_SUPPORT,
  })
})
