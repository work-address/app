import { CheckIcon, ClockIcon, DashboardIcon } from '@radix-ui/react-icons'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { formatCurrency, formatDurationFromMinutes } from '@/shared'

type Props = {
  className?: string
}

/** The example day's figures: a sample, never anyone's own workspace. */
const EXAMPLE = {
  trackedMinutes: 7 * 60 + 30,
  earned: 600,
  taskMinutes: 2 * 60 + 15,
}

/**
 * The sign-in screen's welcome: what the workspace is for, and an example of
 * a day in it. The example is labelled as one - a visitor has no workspace
 * yet, so nothing here may read as their own data. A phone keeps only the
 * heading, so the sign-in options come first.
 */
export const AuthWelcomeStory = ({ className }: Props) => {
  const { t, i18n } = useTranslation()
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date()),
    [i18n.language],
  )

  return (
    <Root className={className}>
      <Eyebrow>{t('signIn.story.eyebrow')}</Eyebrow>
      <Title>
        <span>{t('signIn.story.titleLine1')}</span>{' '}
        <span>{t('signIn.story.titleLine2')}</span>
      </Title>
      <Lead>{t('signIn.story.lead')}</Lead>
      <Example aria-label={t('signIn.story.example.label')}>
        <ExampleHead>
          <ExampleIcon aria-hidden="true">
            <DashboardIcon />
          </ExampleIcon>
          <div>
            <ExampleTitle>{t('signIn.story.example.title')}</ExampleTitle>
            <ExampleDate>{today}</ExampleDate>
          </div>
          <ExampleTag>{t('signIn.story.example.tag')}</ExampleTag>
        </ExampleHead>
        <Figures>
          <Figure>
            <dt>{t('signIn.story.example.tracked')}</dt>
            <dd>{formatDurationFromMinutes(EXAMPLE.trackedMinutes, t)}</dd>
          </Figure>
          <Figure>
            <dt>{t('signIn.story.example.earned')}</dt>
            <dd>{formatCurrency(EXAMPLE.earned)}</dd>
          </Figure>
        </Figures>
        <Task>
          <TaskIcon aria-hidden="true">
            <CheckIcon />
          </TaskIcon>
          <div>
            <TaskTitle>{t('signIn.story.example.task')}</TaskTitle>
            <TaskProject>{t('signIn.story.example.project')}</TaskProject>
          </div>
          <TaskTime>
            {formatDurationFromMinutes(EXAMPLE.taskMinutes, t)}
          </TaskTime>
        </Task>
      </Example>
      <Note>
        <ClockIcon aria-hidden="true" />
        {t('signIn.story.note')}
      </Note>
    </Root>
  )
}

const Root = styled.section`
  display: grid;
  justify-items: start;
  align-content: center;
  gap: var(--ui-space-4);
  min-width: 0;

  /* A phone keeps the heading alone, centred above the sign-in card. */
  ${(p) => p.theme.breakpoints.down('lg')} {
    justify-items: center;
    gap: var(--ui-space-2);
    text-align: center;
  }
`

const Eyebrow = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
  font-weight: var(--ui-eyebrow-weight);
  letter-spacing: var(--ui-eyebrow-tracking);
  text-transform: uppercase;
`

/* Two lines on a desktop, one on a phone. */
const Title = styled.h2`
  margin: 0;
  display: grid;
  color: var(--ui-ink);
  font-size: calc(var(--ui-title-size) * 1.3);
  line-height: 1.08;
  font-weight: var(--ui-title-weight);
  letter-spacing: var(--ui-title-tracking);
  text-wrap: balance;

  ${(p) => p.theme.breakpoints.down('lg')} {
    display: block;
    font-size: var(--ui-metric-min-size);
    line-height: var(--ui-heading-line-height);
  }
`

const Lead = styled.p`
  margin: 0;
  max-inline-size: 34ch;
  color: var(--ui-muted);
  font-size: var(--ui-description-size);
  line-height: var(--ui-description-line-height);

  ${(p) => p.theme.breakpoints.down('lg')} {
    display: none;
  }
`

const Example = styled.article`
  display: grid;
  gap: var(--ui-space-4);
  width: min(100%, 380px);
  margin-top: var(--ui-space-4);
  padding: var(--ui-space-5);
  border: var(--ui-border-width) solid var(--ui-edge);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);

  ${(p) => p.theme.breakpoints.down('lg')} {
    display: none;
  }
`

const ExampleHead = styled.header`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--ui-space-3);
`

const ExampleIcon = styled.span`
  display: grid;
  place-items: center;
  width: var(--ui-icon-size);
  height: var(--ui-icon-size);
  border-radius: var(--ui-icon-radius);
  background: var(--ui-glow);
  color: var(--ui-blue);
`

const ExampleTitle = styled.p`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
`

const ExampleDate = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

/* Says outright that the figures are a sample. */
const ExampleTag = styled.span`
  padding: 0 var(--ui-space-2);
  border-radius: var(--ui-pill-radius);
  background: var(--ui-inset);
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-space-5);
`

const Figures = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-bottom: var(--ui-space-4);
  border-bottom: var(--ui-border-width) solid var(--ui-line);
`

const Figure = styled.div`
  display: grid;
  gap: var(--ui-space-1);

  & + & {
    padding-inline-start: var(--ui-space-4);
    border-inline-start: var(--ui-border-width) solid var(--ui-line);
  }

  & dt {
    color: var(--ui-muted);
    font-size: var(--ui-meta-size);
    line-height: var(--ui-meta-line-height);
  }

  & dd {
    margin: 0;
    color: var(--ui-ink);
    font-size: var(--ui-metric-min-size);
    line-height: var(--ui-metric-line-height);
    font-weight: var(--ui-metric-weight);
    letter-spacing: var(--ui-metric-tracking);
    font-variant-numeric: tabular-nums;
  }
`

const Task = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--ui-space-3);
`

const TaskIcon = styled(ExampleIcon)``

const TaskTitle = styled.p`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-semibold);
`

const TaskProject = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-small-size);
  line-height: var(--ui-small-line-height);
`

const TaskTime = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  font-variant-numeric: tabular-nums;
`

const Note = styled.p`
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-2);
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);

  ${(p) => p.theme.breakpoints.down('lg')} {
    display: none;
  }
`
