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

export interface AgentSegment {
  fromAt: string
  toAt: string
  state: 'running' | 'human_wait' | 'unknown' | 'untracked'
  evidence: string
}
