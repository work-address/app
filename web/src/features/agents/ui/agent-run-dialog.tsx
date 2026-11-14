import { Badge } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { agentRunMode, type AgentRun } from '../model/agent-runs'
import { agentSessionRunsQuery } from '../model/agents.model'

import { agentRunName, type AgentRunNames } from './agent-run-list'

import { $removedPromptRunKeys } from '@/entities/time'
import {
  AgentMark,
  AgentPromptRemoveButton,
  agentRunStatus,
  agentSendsNoPrompt,
  AgentSupportBadge,
  AgentRunTimeline,
  canRemoveAgentPrompt,
  Dot,
  PRODUCT_NAMES,
  STATE_COLORS,
  STATUS_COLORS,
  summarizeAgentRun,
  SURFACE_NAMES,
  useAgentMinutes,
} from '@/features/time'
import { routes } from '@/routes'
import { AdaptiveDialog, formatCurrency } from '@/shared'

type Props = {
  run: AgentRun | null
  names: AgentRunNames
  userId?: string
  onOpenRun: (runKey: string) => void
  onClose: () => void
}

/**
 * Everything collected about one run: its prompt, its timeline segment by
 * segment with what each was judged on, the agent and its rate, where it ran
 * and what reported it, and the other runs of its session. The raw events
 * stay out: they are for debugging, not for reading.
 */
export const AgentRunDialog = ({
  run,
  names,
  userId,
  onOpenRun,
  onClose,
}: Props) => {
  const { t, i18n } = useTranslation()
  const formatMinutes = useAgentMinutes()
  const { removed, sessionRuns, askSession } = useUnit({
    removed: $removedPromptRunKeys,
    sessionRuns: agentSessionRunsQuery.$data,
    askSession: agentSessionRunsQuery.start,
  })

  const sessionId = run?.sourceSessionId
  useEffect(() => {
    if (sessionId) {
      askSession(sessionId)
    }
  }, [askSession, sessionId])

  const when = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' })
  // A segment can be seconds long: its times keep their seconds.
  const clock = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'medium' })

  if (!run) {
    return null
  }

  const summary = summarizeAgentRun(run)
  const status = agentRunStatus(run.status)
  const mode = agentRunMode(run)
  const product = PRODUCT_NAMES[run.product] ?? run.product
  const surface = run.surface
    ? (SURFACE_NAMES[run.surface] ?? run.surface)
    : null
  const prompt = removed.has(run.runKey) ? null : run.prompt
  // The same session id may come from another person's source: only theirs on this project.
  const neighbours = (sessionRuns ?? []).filter(
    (other) =>
      other.sourceSessionId === sessionId &&
      other.userId === run.userId &&
      other.projectId === run.projectId &&
      other.runKey !== run.runKey,
  )
  const rate = run.agentRateHourCents
  const measurement = run.measurement

  const facts: [string, React.ReactNode][] = [
    [t('agents.detail.project'), names.projects.get(run.projectId) ?? '—'],
    ...(run.userId === userId
      ? []
      : [
          [t('agents.detail.person'), names.people.get(run.userId) ?? '—'] as [
            string,
            React.ReactNode,
          ],
        ]),
    [
      t('agents.detail.when'),
      `${when.format(new Date(run.fromAt))} – ${time.format(new Date(run.toAt))}`,
    ],
    [
      t('agents.detail.rate'),
      rate == null
        ? '—'
        : rate === 0
          ? t('team.rate.notBilled')
          : t('team.rate.value', { rate: formatCurrency(rate / 100) }),
    ],
    [
      t('agents.detail.invoice'),
      run.invoiceId ? (
        <Link to={routes.invoice.build({ id: run.invoiceId })}>
          {run.isPaid
            ? t('dashboard.worklogsTable.paymentStatus.paid')
            : t('dashboard.worklogsTable.agents.invoiced')}
        </Link>
      ) : (
        t('agents.detail.notInvoiced')
      ),
    ],
  ]

  const ids: [string, string | undefined][] = [
    [t('agents.detail.session'), run.sourceSessionId],
    [t('agents.detail.run'), run.sourceRunId],
    [t('agents.detail.sourceAgent'), run.sourceAgentId],
    [t('agents.detail.machine'), run.sourceInstanceId],
    [t('agents.detail.runKey'), run.runKey],
    [
      t('agents.detail.versions'),
      measurement
        ? [
            measurement.adapterVersion &&
              `${t('agents.detail.adapter')} ${measurement.adapterVersion}`,
            measurement.runtimeVersion &&
              `${t('agents.detail.runtime')} ${measurement.runtimeVersion}`,
            measurement.schemaVersion != null &&
              `${t('agents.detail.schema')} ${measurement.schemaVersion}`,
          ]
            .filter(Boolean)
            .join(' · ')
        : undefined,
    ],
    [
      t('agents.detail.measurement'),
      [
        t(`agents.mode.${mode}`),
        measurement?.liveness ? t('agents.detail.liveness') : null,
        measurement?.provisional ? t('agents.detail.provisional') : null,
        run.manual ? t('agents.detail.manual') : null,
      ]
        .filter(Boolean)
        .join(' · '),
    ],
  ]

  return (
    <AdaptiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={agentRunName(run)}
      desktopWidth="min(760px, calc(100vw - 48px))"
    >
      <Body>
        <Heading>
          <ProductLine>
            <AgentMark product={run.product} />
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
          <Badge
            color={status ? STATUS_COLORS[status] : 'amber'}
            variant="soft"
            size="1"
          >
            {t(`dashboard.worklogsTable.agents.status.${status ?? 'unknown'}`)}
          </Badge>
          <AgentSupportBadge product={run.product} place={mode} />
        </Heading>
        <Facts>
          {facts.map(([label, value]) => (
            <Fact key={label}>
              <Label>{label}</Label>
              <Value>{value}</Value>
            </Fact>
          ))}
        </Facts>
        <Section>
          <Title>{t('dashboard.worklogsTable.agents.prompt')}</Title>
          {prompt ? (
            <PromptRow>
              <PromptText>{prompt}</PromptText>
              {canRemoveAgentPrompt(run, userId) && (
                <AgentPromptRemoveButton runKey={run.runKey} />
              )}
            </PromptRow>
          ) : (
            <Meta>
              {run.promptPendingReview
                ? t('dashboard.prompts.held')
                : agentSendsNoPrompt(run.product, mode)
                  ? t('agents.list.noPromptFromAgent')
                  : t('agents.list.noPrompt')}
            </Meta>
          )}
        </Section>
        <Section>
          <Title>
            {t('agents.detail.timeline', {
              duration: formatMinutes(summary.minutes),
            })}
          </Title>
          <AgentRunTimeline summary={summary} />
          <Segments>
            {(run.segments ?? []).map((segment, index) => (
              <Segment key={index}>
                <Dot style={{ background: STATE_COLORS[segment.state] }} />
                <span>
                  {t(`dashboard.worklogsTable.agents.state.${segment.state}`)}
                </span>
                <Meta>
                  {clock.format(new Date(segment.fromAt))}–
                  {clock.format(new Date(segment.toAt))} ·{' '}
                  {formatMinutes(
                    (Date.parse(segment.toAt) - Date.parse(segment.fromAt)) /
                      60_000,
                  )}
                </Meta>
                {segment.evidence ? (
                  <Evidence title={t('agents.detail.evidence')}>
                    {segment.evidence}
                  </Evidence>
                ) : null}
              </Segment>
            ))}
          </Segments>
        </Section>
        <Section>
          <Title>{t('agents.detail.source')}</Title>
          <Ids>
            {ids
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <Fact key={label}>
                  <Label>{label}</Label>
                  <Code>{value}</Code>
                </Fact>
              ))}
          </Ids>
        </Section>
        {neighbours.length > 0 && (
          <Section>
            <Title>{t('agents.detail.sessionRuns')}</Title>
            <Neighbours>
              {neighbours.map((other) => (
                <Neighbour
                  key={other.runKey}
                  type="button"
                  onClick={() => onOpenRun(other.runKey)}
                >
                  <Meta>{when.format(new Date(other.fromAt))}</Meta>
                  <NeighbourPrompt>
                    {other.prompt ||
                      (other.promptPendingReview
                        ? t('time.list.agents.held')
                        : agentRunName(other))}
                  </NeighbourPrompt>
                </Neighbour>
              ))}
            </Neighbours>
          </Section>
        )}
      </Body>
    </AdaptiveDialog>
  )
}

const Body = styled.div`
  display: grid;
  gap: var(--ui-space-5);
  min-width: 0;
`

const Heading = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-2);
`

const Facts = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--ui-space-3) var(--ui-space-5);
  margin: 0;
`

const Ids = styled(Facts)`
  grid-template-columns: minmax(0, 1fr);
  gap: var(--ui-space-2);
`

const Fact = styled.div`
  display: grid;
  gap: 2px;
  min-width: 0;
`

const Label = styled.dt`
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
`

const Value = styled.dd`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  overflow-wrap: anywhere;
`

const Code = styled.dd`
  margin: 0;
  color: var(--ui-text);
  font-family: var(--code-font-family, ui-monospace, monospace);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
  overflow-wrap: anywhere;
`

const Section = styled.section`
  display: grid;
  gap: var(--ui-space-2);
  min-width: 0;
`

const Title = styled.h3`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
`

const Meta = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-variant-numeric: tabular-nums;
`

const PromptRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--ui-space-2);
`

// The prompt as typed: its lines kept, and scrolled when it is long.
const PromptText = styled.p`
  max-height: 240px;
  margin: 0;
  padding: var(--ui-space-3);
  overflow-y: auto;
  border-radius: var(--ui-filter-radius);
  background: var(--ui-inset);
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

const Segments = styled.ol`
  display: grid;
  gap: var(--ui-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
`

const Segment = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ui-space-1) var(--ui-space-2);
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

const Evidence = styled.code`
  padding: 0 var(--ui-space-1);
  border-radius: 4px;
  background: var(--ui-inset);
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
`

const Neighbours = styled.div`
  display: grid;
  gap: var(--ui-space-1);
`

const Neighbour = styled.button`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--ui-space-3);
  padding: var(--ui-space-2);
  border: 0;
  border-radius: var(--ui-filter-radius);
  background: transparent;
  text-align: start;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: var(--ui-inset);
  }
`

const NeighbourPrompt = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-text);
  font-size: var(--ui-meta-size);
`

const ProductLine = styled(Meta)`
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-1);
`
