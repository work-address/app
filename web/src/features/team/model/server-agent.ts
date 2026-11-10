import type {
  AgentCredential,
  OwnAgent,
  ServerCredentialRow,
  ServerCredentialState,
} from './types'

/**
 * Runtimes whose collector adapter records run boundaries, in the order
 * offered. OpenCode's reports session status only, which bills nothing, so it
 * is not offered a rate here.
 */
export const SERVER_PRODUCTS = [
  'openclaw',
  'hermes',
  'claude-code',
  'codex',
  'kimi-code',
] as const

export type ServerProduct = (typeof SERVER_PRODUCTS)[number]

/** Brand names, so they are not translated. */
export const SERVER_PRODUCT_NAMES: Record<ServerProduct, string> = {
  openclaw: 'OpenClaw',
  hermes: 'Hermes',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  'kimi-code': 'Kimi Code',
}

/** Runtimes whose collector sends the prompt that starts a run. */
export const sendsPrompts = (product: ServerProduct): boolean =>
  product === 'claude-code' || product === 'codex'

/** Runtimes the desktop app also reads on a laptop. */
const DESKTOP_PRODUCTS = new Set<ServerProduct>([
  'claude-code',
  'codex',
  'kimi-code',
])

/**
 * Whether a new server agent would also be given the desktop app's runs. The
 * API makes a product's first agent its default whatever is asked, and the
 * default takes every run no machine is bound for.
 */
export const takesDesktopRuns = (
  product: ServerProduct,
  agents: Pick<OwnAgent, 'product' | 'removedAt'>[],
): boolean =>
  DESKTOP_PRODUCTS.has(product) &&
  !agents.some((agent) => agent.product === product && !agent.removedAt)

// `dev` is the repository's default branch.
const REPOSITORY = 'https://github.com/work-address/app/blob/dev/packages'

/** Where the collector's install steps for a runtime are written down. */
export const setupGuideUrl = (product: ServerProduct): string =>
  product === 'openclaw'
    ? `${REPOSITORY}/agent-tracker-openclaw/README.md`
    : `${REPOSITORY}/agent-tracker/SERVER-RUNTIMES.md`

/** What the API takes as a name: 1 to 60 characters, no markup, no control codes. */
export const isAgentName = (name: string): boolean =>
  name.length > 0 &&
  name.length <= 60 &&
  !/[<>]/.test(name) &&
  [...name].every((char) => char.charCodeAt(0) > 31)

const MAX_SLUG = 60

/**
 * A handle the API accepts (`[a-z0-9][a-z0-9-]{0,59}`) that none of the
 * reader's agents holds, removed ones included: the API keeps theirs taken.
 * A name with no Latin letters or digits falls back to the product.
 */
export const agentSlug = (
  name: string,
  product: string,
  taken: string[],
): string => {
  const plain = (value: string) =>
    value
      .normalize('NFKD')
      .toLowerCase()
      .replaceAll(/[^\da-z]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')

  const base = plain(name) || plain(product) || 'agent'
  const used = new Set(taken)

  for (let n = 1; ; n++) {
    const suffix = n === 1 ? '' : `-${n}`
    const slug =
      base.slice(0, MAX_SLUG - suffix.length).replace(/-+$/, '') + suffix

    if (!used.has(slug)) {
      return slug
    }
  }
}

/**
 * The address the collector uploads to. A relative or missing API address
 * means the API is served from the page's own origin.
 */
export const eventsEndpoint = (
  apiUrl: string | undefined,
  origin: string,
): string => {
  const base = new URL(apiUrl || '/', origin)

  return `${base.origin}${base.pathname.replace(/\/+$/, '')}/api/agent-tracking/events`
}

/** The collector reads the credential from stdin, so it is never in this line. */
export const setupCommand = (setup: {
  endpoint: string
  projectId: string
  instanceId: string
}): string =>
  `agent-tracker setup ${setup.endpoint} ${setup.projectId} ${setup.instanceId}`

const EXPIRING_MS = 14 * 86_400_000

/**
 * The servers' credentials that still matter. Desktop apps renew their own and
 * are not listed; a revoked one is gone for good.
 */
export const serverCredentialRows = (
  credentials: AgentCredential[],
  now: number,
): ServerCredentialRow[] =>
  credentials
    .filter(
      (credential) => credential.mode === 'fixed' && !credential.revokedAt,
    )
    .map((credential) => {
      const left = Date.parse(credential.expiresAt) - now
      const state: ServerCredentialState =
        left <= 0 ? 'expired' : left <= EXPIRING_MS ? 'expiring' : 'active'

      return {
        id: credential.id,
        label: credential.label,
        prefix: credential.prefix,
        expiresAt: credential.expiresAt,
        lastUsedAt: credential.lastUsedAt,
        state,
      }
    })
