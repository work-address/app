import { AGENT_SUPPORT } from '@work-address/agent-tracking-contract/support'
import { describe, expect, it } from 'vitest'

import {
  agentSlug,
  eventsEndpoint,
  installCommand,
  isAgentName,
  sendsPrompts,
  SERVER_PRODUCT_NAMES,
  SERVER_PRODUCTS,
  serverStatus,
  serverCredentialRows,
  setupCommand,
  setupGuideUrl,
} from './server-agent'

import type { AgentCredential } from './types'

const SLUG = /^[\da-z][\da-z-]{0,59}$/

describe('agentSlug', () => {
  it('makes a handle from the name', () => {
    expect(agentSlug('OpenClaw (build server)', 'openclaw', [])).toBe(
      'openclaw-build-server',
    )
  })

  it('numbers a handle that is taken', () => {
    expect(agentSlug('Codex', 'codex', ['codex', 'codex-2'])).toBe('codex-3')
  })

  it('falls back to the product when the name has nothing to keep', () => {
    expect(agentSlug('сервер', 'hermes', [])).toBe('hermes')
  })

  it('stays within what the API accepts', () => {
    const long = 'a'.repeat(80)
    const slug = agentSlug(long, 'codex', [long.slice(0, 60)])

    expect(slug).toMatch(SLUG)
    expect(slug.endsWith('-2')).toBe(true)
  })
})

describe('isAgentName', () => {
  it('takes what the API takes', () => {
    expect(isAgentName('OpenClaw (server)')).toBe(true)
    expect(isAgentName('')).toBe(false)
    expect(isAgentName('a'.repeat(61))).toBe(false)
    expect(isAgentName('<b>')).toBe(false)
    expect(isAgentName('tab\there')).toBe(false)
  })
})

describe('SERVER_PRODUCTS', () => {
  it('leaves out OpenCode, whose adapter records nothing billable', () => {
    expect(SERVER_PRODUCTS).not.toContain('opencode')
  })

  it('offers every agent the support list records on servers, in its order', () => {
    expect(SERVER_PRODUCTS).toEqual(
      AGENT_SUPPORT.filter((agent) => agent.servers.status !== 'none').map(
        (agent) => agent.product,
      ),
    )
  })

  it('names Hermes as its makers do', () => {
    expect(SERVER_PRODUCT_NAMES.hermes).toBe('Hermes Agent')
  })
})

describe('serverStatus', () => {
  it('says experimental until an agent passed its live check', () => {
    expect(SERVER_PRODUCTS.map(serverStatus)).toEqual(
      SERVER_PRODUCTS.map(() => 'experimental'),
    )
  })
})

describe('installCommand', () => {
  it('installs the collector, and the plugin an agent needs', () => {
    for (const product of SERVER_PRODUCTS) {
      expect(installCommand(product)).toContain('@work-address/agent-tracker')
    }
    expect(installCommand('openclaw')).toContain('agent-tracker-openclaw')
    expect(installCommand('hermes')).toContain('pip install')
    expect(installCommand('kimi-code')).toContain('~/.kimi-code/config.toml')
  })
})

describe('sendsPrompts', () => {
  it('is true only of the runtimes whose hooks carry the prompt', () => {
    expect(SERVER_PRODUCTS.filter(sendsPrompts)).toEqual([
      'claude-code',
      'codex',
      'kimi-code',
    ])
  })
})

describe('eventsEndpoint', () => {
  it('uses the API address', () => {
    expect(eventsEndpoint('https://api.address.work/', 'https://x.test')).toBe(
      'https://api.address.work/api/agent-tracking/events',
    )
  })

  it('uses the page origin when the API address is relative or missing', () => {
    expect(eventsEndpoint(undefined, 'https://address.work')).toBe(
      'https://address.work/api/agent-tracking/events',
    )
    expect(eventsEndpoint('/', 'https://address.work')).toBe(
      'https://address.work/api/agent-tracking/events',
    )
  })
})

describe('setupCommand', () => {
  it('names the endpoint, project and machine, and never the credential', () => {
    expect(
      setupCommand({
        endpoint: 'https://a/e',
        projectId: 'p',
        instanceId: 'i',
      }),
    ).toBe('agent-tracker setup https://a/e p i')
  })
})

describe('setupGuideUrl', () => {
  it('sends each agent to its own section on the default branch', () => {
    expect(setupGuideUrl('openclaw')).toContain('agent-tracker-openclaw')
    expect(setupGuideUrl('codex')).toContain('SERVER-RUNTIMES.md#')
    expect(setupGuideUrl('hermes')).toContain('#hermes-agent')
    expect(setupGuideUrl('kimi-code')).toContain('/blob/main/')
  })
})

describe('serverCredentialRows', () => {
  const now = Date.parse('2026-11-10T00:00:00Z')
  const credential = (
    overrides: Partial<AgentCredential> = {},
  ): AgentCredential => ({
    id: 'c1',
    instanceId: 'i1',
    label: 'Build server',
    mode: 'fixed',
    prefix: 'wa_agent_abc',
    createdAt: '2026-11-01T00:00:00Z',
    expiresAt: '2027-01-30T00:00:00Z',
    revokedAt: null,
    lastUsedAt: null,
    ...overrides,
  })

  it('lists server credentials only, and not revoked ones', () => {
    const rows = serverCredentialRows(
      [
        credential(),
        credential({ id: 'c2', mode: 'timer' }),
        credential({ id: 'c3', revokedAt: '2026-11-02T00:00:00Z' }),
      ],
      now,
    )

    expect(rows.map((row) => row.id)).toEqual(['c1'])
    expect(rows[0].state).toBe('active')
  })

  it('says when a credential is about to expire or has', () => {
    const state = (expiresAt: string) =>
      serverCredentialRows([credential({ expiresAt })], now)[0].state

    expect(state('2026-11-20T00:00:00Z')).toBe('expiring')
    expect(state('2026-11-09T00:00:00Z')).toBe('expired')
  })
})
