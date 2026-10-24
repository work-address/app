export interface WorkerAgent {
  id: string
  name: string
  slug: string
  product: string
  isDefault: boolean
  bindings: string[]
  createdAt: string
  removedAt: string | null
}

export interface AgentAttachment {
  agentId: string
  workerId: string
  rateHourCents: number
  rateChanges: {
    at: string
    fromCents: number
    toCents: number
    changedBy: string
  }[]
  attachedAt: string
  detachedAt: string | null
}

export const AGENT_PRODUCTS = [
  'claude-code',
  'codex',
  'cursor',
  'gemini-cli',
  'copilot',
  'windsurf',
  'cline',
  'minimax',
  'devin-local',
  'claude-cowork',
  'kimi-code',
  'kimi-cli',
  'openclaw',
  'hermes',
  'opencode',
] as const

/** The name a product's default agent gets when it is created for a worker. */
export const AGENT_PRODUCT_NAMES: Record<
  (typeof AGENT_PRODUCTS)[number],
  string
> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  'gemini-cli': 'Gemini CLI',
  copilot: 'Copilot',
  windsurf: 'Windsurf',
  cline: 'Cline',
  minimax: 'MiniMax',
  'devin-local': 'Devin Local',
  'claude-cowork': 'Claude Cowork',
  'kimi-code': 'Kimi Code',
  'kimi-cli': 'Kimi CLI',
  openclaw: 'OpenClaw',
  hermes: 'Hermes',
  opencode: 'OpenCode',
}

export interface AgentSegment {
  fromAt: string
  toAt: string
  state: 'running' | 'human_wait' | 'unknown' | 'untracked'
  evidence: string
}
