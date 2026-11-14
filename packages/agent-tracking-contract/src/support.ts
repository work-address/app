/*
 * How far each agent is supported, per place it runs. The dashboard, the
 * collector and the public website (address.work/agents) all read this list,
 * so a label changes in one place. The website keeps a copy generated from it
 * (`schema/agent-support.json`).
 *
 * An agent is `available` in a place only when all four hold (app SPEC.md,
 * "Agent support"):
 * 1. what it installs is published (npm, PyPI);
 * 2. a live check on a named release of the agent passed: success, failure,
 *    interruption and two runs at once reached the API as runs, and the
 *    collected events are kept as fixtures that CI replays;
 * 3. the dashboard shows that agent's own install and setup steps;
 * 4. an API test uses its product id.
 * Otherwise it is `experimental`; `none` means it is not recorded there.
 * Known limits are stated, and do not block `available`.
 */

/** Dependency-free on purpose: the dashboard imports this from source. */
export type AgentSupportStatus = 'available' | 'experimental' | 'none'

/** A gap the agent's pages state; each consumer words it. */
export type AgentLimit =
  /** Time spent waiting on a person or a tool is billed as running. */
  | 'no-waits'
  /** A successful end is provisional: another hook may continue the turn. */
  | 'stop-provisional'
  /** Only top-level turns are recorded; subagents are not. */
  | 'root-turns-only'
  /** Only the agent release named in `versions` is known to work. */
  | 'pinned-version'

export type AgentServerSupport = {
  status: AgentSupportStatus
  /** Agent releases the live check passed on, oldest first; empty until one passed. */
  versions: string[]
  /** The collector sends the prompt that starts a run. */
  prompts: boolean
  limits: AgentLimit[]
  /** Shell lines that install what the server needs, in order. */
  install: string[]
  /** Section of packages/agent-tracker/SERVER-RUNTIMES.md, or the plugin README. */
  guide: string
}

export type AgentSupport = {
  /** The id collectors report as `source.product`. */
  product: string
  /** Brand name, never translated. */
  name: string
  computer: {
    status: AgentSupportStatus
    /** Oldest release the desktop app reads. */
    since?: string
  }
  servers: AgentServerSupport
}

const COLLECTOR = 'npm install -g @work-address/agent-tracker'
const BRIDGES = '"$(npm root -g)/@work-address/agent-tracker/bridges'
const RUNTIMES = 'packages/agent-tracker/SERVER-RUNTIMES.md'

export const AGENT_SUPPORT_CHECKED_ON = '2026-11-14'

/** In the order the website and the dashboard list them. */
export const AGENT_SUPPORT: AgentSupport[] = [
  {
    product: 'claude-code',
    name: 'Claude Code',
    computer: { status: 'available', since: '2.1.286' },
    servers: {
      status: 'experimental',
      versions: [],
      prompts: true,
      limits: ['stop-provisional'],
      install: [COLLECTOR],
      guide: `${RUNTIMES}#claude-code-and-codex`,
    },
  },
  {
    product: 'codex',
    name: 'Codex',
    computer: { status: 'available', since: '0.162.0' },
    servers: {
      status: 'experimental',
      versions: [],
      prompts: true,
      limits: ['stop-provisional'],
      install: [COLLECTOR],
      guide: `${RUNTIMES}#claude-code-and-codex`,
    },
  },
  {
    product: 'openclaw',
    name: 'OpenClaw',
    computer: { status: 'none' },
    servers: {
      status: 'experimental',
      versions: ['2026.10.4'],
      prompts: false,
      limits: ['no-waits', 'pinned-version'],
      install: [`${COLLECTOR} @work-address/agent-tracker-openclaw`],
      guide:
        'packages/agent-tracker-openclaw/README.md#connect-to-work-address',
    },
  },
  {
    product: 'hermes',
    name: 'Hermes Agent',
    computer: { status: 'none' },
    servers: {
      status: 'experimental',
      versions: [],
      prompts: false,
      limits: ['no-waits', 'root-turns-only'],
      // From the collector's own copy until work-address-hermes is on PyPI.
      install: [COLLECTOR, `pip install ${BRIDGES}/hermes"`],
      guide: `${RUNTIMES}#hermes-agent`,
    },
  },
  {
    product: 'kimi-code',
    name: 'Kimi Code',
    computer: { status: 'none' },
    servers: {
      status: 'experimental',
      versions: [],
      prompts: true,
      limits: ['no-waits', 'stop-provisional'],
      install: [
        COLLECTOR,
        `cat ${BRIDGES}/hooks/kimi-code.toml" >> ~/.kimi-code/config.toml`,
      ],
      guide: `${RUNTIMES}#kimi-code`,
    },
  },
]

export const findAgentSupport = (product: string): AgentSupport | undefined =>
  AGENT_SUPPORT.find((agent) => agent.product === product)

/** A server adapter that passed its live check runs without the experimental switch. */
export const serverAdapterQualified = (product: string): boolean =>
  findAgentSupport(product)?.servers.status === 'available'
