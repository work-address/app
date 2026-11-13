import { DesktopIcon, ListBulletIcon, MobileIcon } from '@radix-ui/react-icons'
import { Skeleton } from '@radix-ui/themes'
import { format } from 'date-fns'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import {
  $dashboardDesktopSession,
  dashboardDesktopSessionRequested,
} from '../../model/dashboard-filters'
import { DashboardWidget } from '../dashboard-widget'

import { recentTimeQuery } from '@/entities/time'
import { routes } from '@/routes'
import { Button, formatDurationFromMinutes, WorkspaceStatus } from '@/shared'

const DAY_FORMAT = 'yyyy-MM-dd'

/**
 * The reader's latest stretch of tracked time in the period, from the desktop
 * app or the phone, and which of the two: how long it ran, when it ended, and
 * what it was for. Always their own time, never a teammate's, and a way into
 * that day on the Time page.
 */
export const DashboardDesktopSession = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { session, loaded, pending, failed, retry } = useUnit({
    session: $dashboardDesktopSession,
    loaded: recentTimeQuery.$succeeded,
    pending: recentTimeQuery.$pending,
    failed: recentTimeQuery.$failed,
    retry: dashboardDesktopSessionRequested,
  })

  const ended = useMemo(() => {
    if (!session) {
      return null
    }

    const time = new Intl.DateTimeFormat(i18n.language, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(session.toAt)
    const date = new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
    }).format(session.toAt)

    return t('dashboard.session.ended', { time, date })
  }, [session, i18n.language, t])

  const loading = !loaded && (pending || !failed)
  const phone = session?.source === 'mobile'
  const title = t(
    phone ? 'dashboard.session.titleMobile' : 'dashboard.session.title',
  )

  // The session's day on the Time page, narrowed to its project.
  const openSession = () => {
    if (!session) {
      return
    }

    const search = new URLSearchParams({
      from: format(session.fromAt, DAY_FORMAT),
      to: format(session.toAt, DAY_FORMAT),
    })

    if (session.projectId) {
      search.set('projects', session.projectId)
    }

    navigate(`${routes.time.build()}?${search.toString()}`)
  }

  return (
    <DashboardWidget
      title={title}
      aside={
        <Icon aria-hidden="true">
          {phone ? <MobileIcon /> : <DesktopIcon />}
        </Icon>
      }
      failed={failed}
      onRetry={() => retry()}
      empty={
        loaded && !session
          ? {
              title: t('dashboard.session.empty.title'),
              description: t('dashboard.session.empty.description'),
            }
          : undefined
      }
    >
      <Root>
        <Hero>
          {loading ? (
            <>
              <Skeleton width="128px" height="26px" />
              <Skeleton width="160px" height="44px" />
              <Skeleton width="180px" height="20px" />
            </>
          ) : session ? (
            <>
              <WorkspaceStatus tone="positive">
                {t('dashboard.session.saved')}
              </WorkspaceStatus>
              <Duration>
                {formatDurationFromMinutes(session.minutes, t)}
              </Duration>
              <Ended>{ended}</Ended>
            </>
          ) : null}
        </Hero>
        <Details>
          <Row>
            <dt>{t('dashboard.session.project')}</dt>
            <dd>
              {loading ? (
                <Skeleton width="120px" height="16px" />
              ) : (
                <span>
                  {session && session.projectCount > 1
                    ? t('dashboard.session.projectsMore', {
                        title: session.projectTitle,
                        count: session.projectCount - 1,
                      })
                    : (session?.projectTitle ?? '—')}
                </span>
              )}
            </dd>
          </Row>
          <Row>
            <dt>{t('dashboard.session.task')}</dt>
            <dd>
              {loading ? (
                <Skeleton width="160px" height="16px" />
              ) : (
                <span data-muted={!session?.note || undefined}>
                  {session?.note ?? t('dashboard.session.noNote')}
                </span>
              )}
            </dd>
          </Row>
        </Details>
        <Button
          variant="outline"
          color="neutral"
          stretch
          iconLeft={<ListBulletIcon />}
          disabled={!session}
          onClick={openSession}
        >
          {t('dashboard.session.view')}
        </Button>
      </Root>
    </DashboardWidget>
  )
}

const Root = styled.div`
  display: grid;
  align-content: start;
  gap: var(--ui-space-5);
`

const Icon = styled.span`
  display: grid;
  place-items: center;
  color: var(--ui-muted);
`

/* The session's headline: a pale inset holding its status, length and end. */
const Hero = styled.div`
  display: grid;
  justify-items: center;
  align-content: center;
  gap: var(--ui-space-3);
  min-height: 184px;
  padding: var(--ui-space-6) var(--ui-space-4);
  border: var(--ui-border-width) solid var(--ui-edge);
  border-radius: var(--ui-control-radius);
  background: linear-gradient(180deg, var(--ui-inset), var(--ui-surface));
  text-align: center;
`

const Duration = styled.p`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-metric-size);
  line-height: var(--ui-metric-line-height);
  font-weight: var(--ui-metric-weight);
  letter-spacing: var(--ui-metric-tracking);
  font-variant-numeric: tabular-nums;

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--ui-metric-min-size);
  }
`

const Ended = styled.p`
  margin: 0;
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
`

const Details = styled.dl`
  display: grid;
  gap: var(--ui-space-3);
  margin: 0;
`

const Row = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--ui-space-4);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);

  & > dt {
    color: var(--ui-muted);
  }

  & > dd {
    margin: 0;
    justify-self: end;
    min-width: 0;
    color: var(--ui-ink);
    text-align: end;
    overflow-wrap: anywhere;
  }

  & [data-muted] {
    color: var(--ui-muted);
  }
`
