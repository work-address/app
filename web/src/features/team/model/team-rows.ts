import type { OwnAgent, OwnAgentRow, Team } from './types'

/** The most `AgentRateDto` accepts: $1,000,000 an hour, in cents. */
const MAX_RATE_CENTS = 100_000_000

/**
 * An agent's rate as typed, in whole cents, or null when it is not a price.
 * Worked on the digits rather than the float, so `19.99` cannot become 1998.
 */
export const parseRateCents = (value: string): number | null => {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) {
    return null
  }

  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))

  return cents <= MAX_RATE_CENTS ? cents : null
}

/**
 * Whether every project the reader works on is their own. Text that speaks of
 * "the owner" as someone else would then be talking about them.
 */
export const ownsEveryProject = (team: Team | null): boolean =>
  team !== null &&
  team.projects.length > 0 &&
  team.projects.every((project) => project.role === 'owner')

/** "My Codex" needs its product beside it; "Claude Code" already says it. */
export const namesItsProduct = (name: string, product: string): boolean => {
  const bare = (value: string) =>
    value.toLowerCase().replaceAll(/[^\da-z]/g, '')

  return bare(name) === bare(product)
}

export const centsToRateInput = (cents: number): string =>
  cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)

/**
 * The reader's agents with where each is attached. The rates come from the
 * team, whose people carry the reader's own attachments whatever their role.
 * An agent attached nowhere still gets a row: it has no project to appear under.
 */
export const ownAgentRows = (
  agents: OwnAgent[],
  team: Team | null,
  userId: string | undefined,
): OwnAgentRow[] =>
  agents
    .filter((agent) => !agent.removedAt)
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      product: agent.product,
      attachments: (team?.projects ?? []).flatMap((project) =>
        project.people
          .filter((person) => userId && person.userId === userId)
          .flatMap((person) => person.agents)
          .filter((attached) => attached.id === agent.id)
          .map((attached) => ({
            projectId: project.id,
            projectTitle: project.title,
            projectState: project.state,
            trackAgents: project.trackAgents,
            rateHourCents: attached.rateHourCents,
          })),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
