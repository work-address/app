import { Badge } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { agentRunMode, type AgentRun } from '../model/agent-runs'

import {
  agentRunStatus,
  AgentMark,
  agentSendsNoPrompt,
  PRODUCT_NAMES,
  STATUS_COLORS,
  summarizeAgentRun,
  SURFACE_NAMES,
  useAgentMinutes,
} from '@/features/time'

export type AgentRunNames = {
  projects: Map<string, string>
  people: Map<string, string>
}

type Props = {
  runs: AgentRun[]
  names: AgentRunNames
  /** The reader: their own runs do not name them. */
  userId?: string
  onOpen: (run: AgentRun) => void
}

/** The run's agent as people know it: the worker's name, else its product. */
export const agentRunName = (run: AgentRun) =>
  run.agentName || PRODUCT_NAMES[run.product] || run.product

/**
 * One row a run, newest first: when, which agent and where, the prompt it
 * started with, its minutes by state, and how it ended. A row opens the run.
 */
export const AgentRunList = ({ runs, names, userId, onOpen }: Props) => {
  const { t, i18n } = useTranslation()
  const formatMinutes = useAgentMinutes()

  const day = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const clock = new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return (
    <List role="list">
      {runs.map((run) => {
        const { minutesByState } = summarizeAgentRun(run)
        const status = agentRunStatus(run.status)
        const mode = agentRunMode(run)
        const product = PRODUCT_NAMES[run.product] ?? run.product
        const surface = run.surface
          ? (SURFACE_NAMES[run.surface] ?? run.surface)
          : null
        const person =
          run.userId === userId ? undefined : names.people.get(run.userId)
        const waiting = minutesByState.human_wait
        const unknown = minutesByState.unknown

        return (
          <Row key={run.runKey} role="listitem">
            <Open
              type="button"
              aria-label={t('agents.list.open', {
                agent: agentRunName(run),
                when: `${day.format(new Date(run.fromAt))} ${clock.format(new Date(run.fromAt))}`,
              })}
              onClick={() => onOpen(run)}
            />
            <When>
              <Strong>{day.format(new Date(run.fromAt))}</Strong>
              <Meta>
                {clock.format(new Date(run.fromAt))}–
                {clock.format(new Date(run.toAt))}
              </Meta>
            </When>
            <Agent>
              <Strong>{agentRunName(run)}</Strong>
              <ProductLine>
                <AgentMark product={run.product} size={14} />
                {product}
                {surface ? ` · ${surface}` : null}
              </ProductLine>
              <Badge
                color={mode === 'fixed' ? 'violet' : 'gray'}
                variant="soft"
                size="1"
              >
                {t(`agents.mode.${mode}`)}
              </Badge>
            </Agent>
            <Where>
              <Text>{names.projects.get(run.projectId) ?? '—'}</Text>
              {person ? <Meta>{person}</Meta> : null}
            </Where>
            <PromptCell>
              {run.prompt ? (
                <Prompt title={run.prompt}>{run.prompt}</Prompt>
              ) : (
                <Meta>
                  {run.promptPendingReview
                    ? t('time.list.agents.held')
                    : agentSendsNoPrompt(run.product, mode)
                      ? t('agents.list.noPromptFromAgent')
                      : t('agents.list.noPrompt')}
                </Meta>
              )}
            </PromptCell>
            <Minutes>
              <Strong>
                {t('time.list.agents.running', {
                  duration: formatMinutes(minutesByState.running),
                })}
              </Strong>
              {waiting > 0 || unknown > 0 ? (
                <Meta>
                  {[
                    waiting > 0 &&
                      `${t('dashboard.worklogsTable.agents.state.human_wait')} ${formatMinutes(waiting)}`,
                    unknown > 0 &&
                      `${t('dashboard.worklogsTable.agents.state.unknown')} ${formatMinutes(unknown)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Meta>
              ) : null}
            </Minutes>
            <State>
              <Badge
                color={status ? STATUS_COLORS[status] : 'amber'}
                variant="soft"
                size="1"
              >
                {t(
                  `dashboard.worklogsTable.agents.status.${status ?? 'unknown'}`,
                )}
              </Badge>
              {run.isPaid ? (
                <Badge color="green" variant="soft" size="1">
                  {t('dashboard.worklogsTable.paymentStatus.paid')}
                </Badge>
              ) : run.invoiceId ? (
                <Badge color="gray" variant="soft" size="1">
                  {t('dashboard.worklogsTable.agents.invoiced')}
                </Badge>
              ) : null}
            </State>
          </Row>
        )
      })}
    </List>
  )
}

const List = styled.div`
  display: grid;
`

/* A desktop row is one line of columns; a phone's is a card of stacked
   facts, the prompt last and widest. */
const Row = styled.div`
  position: relative;
  display: grid;
  grid-template-columns:
    minmax(96px, 0.8fr) minmax(140px, 1.1fr) minmax(120px, 1fr)
    minmax(0, 2fr) minmax(120px, 1fr) 104px;
  align-items: center;
  gap: var(--ui-space-4);
  padding: var(--ui-space-3) var(--ui-space-2);
  border-top: 1px solid var(--ui-line);

  &:hover {
    background: var(--ui-inset);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'agent state'
      'when when'
      'where where'
      'minutes minutes'
      'prompt prompt';
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) 0;
  }
`

// The whole row opens the run; the facts are text under it.
const Open = styled.button`
  position: absolute;
  inset: 0;
  z-index: 1;
  border: 0;
  background: transparent;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--ui-blue);
    outline-offset: -2px;
  }
`

const Cell = styled.div`
  display: grid;
  justify-items: start;
  gap: 2px;
  min-width: 0;
`

const When = styled(Cell)`
  ${(p) => p.theme.breakpoints.down('md')} {
    grid-area: when;
    display: flex;
    gap: var(--ui-space-2);
  }
`

const Agent = styled(Cell)`
  ${(p) => p.theme.breakpoints.down('md')} {
    grid-area: agent;
  }
`

const Where = styled(Cell)`
  ${(p) => p.theme.breakpoints.down('md')} {
    grid-area: where;
    display: flex;
    gap: var(--ui-space-2);
  }
`

const PromptCell = styled(Cell)`
  justify-items: stretch;

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-area: prompt;
  }
`

const Minutes = styled(Cell)`
  ${(p) => p.theme.breakpoints.down('md')} {
    grid-area: minutes;
  }
`

const State = styled(Cell)`
  justify-items: end;

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-area: state;
    align-self: start;
  }
`

const Strong = styled.span`
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
  white-space: nowrap;
`

const Text = styled.span`
  min-width: 0;
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;
`

const Meta = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
`

const Prompt = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);

  ${(p) => p.theme.breakpoints.down('md')} {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    white-space: normal;
    overflow-wrap: anywhere;
  }
`

const ProductLine = styled(Meta)`
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
`
