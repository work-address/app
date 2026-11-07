import { HoverCard } from '@radix-ui/themes'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { getProjectStatusTranslationKey } from '../../model'

import type { ProjectWithStats } from '@/entities/projects'
import type { ReactNode } from 'react'

import {
  formatCompactDurationFromMinutes,
  formatCurrency,
  formatDurationFromMinutes,
  useBreakpoint,
  workspaceDesign,
} from '@/shared'

type Props = {
  project: ProjectWithStats
  showDetail: boolean
  onOpen: (project: ProjectWithStats) => void
  projectPopup?: (project: ProjectWithStats) => ReactNode
}

export const ProjectsOverviewRow = ({
  project,
  showDetail,
  onOpen,
  projectPopup,
}: Props) => {
  const { t, i18n } = useTranslation()
  const isMobile = useBreakpoint('isMobile')
  const [popupOpen, setPopupOpen] = useState(false)
  const viewer = project.role === 'viewer'
  const statusKey = getProjectStatusTranslationKey(project.state)
  const status = statusKey
    ? t(statusKey)
    : project.state.toLowerCase() === 'inactive'
      ? t('dashboard.page.tabs.inactive')
      : project.state
  const rate =
    !viewer && project.rateHour !== undefined
      ? t('invoices.item.perHour', { rate: formatCurrency(project.rateHour) })
      : undefined
  const active =
    project.minutesActive === undefined
      ? '—'
      : `${Math.round(project.minutes > 0 ? (project.minutesActive / project.minutes) * 100 : 0)}%`
  const identity = (
    <Identity
      type="button"
      onClick={() => {
        setPopupOpen(false)
        onOpen(project)
      }}
    >
      <Body>
        <Name>{project.title}</Name>
        <Description>
          {status}
          {rate && <Rate>{rate}</Rate>}
        </Description>
      </Body>
    </Identity>
  )

  return (
    <Root
      role="row"
      data-detail={showDetail || undefined}
      data-viewer={viewer || undefined}
    >
      <Cell>
        {projectPopup && !isMobile ? (
          <HoverCard.Root
            open={popupOpen}
            onOpenChange={setPopupOpen}
            openDelay={workspaceDesign.popup.openDelay}
            closeDelay={workspaceDesign.popup.closeDelay}
          >
            <HoverCard.Trigger>{identity}</HoverCard.Trigger>
            <HoverCard.Content
              size="1"
              side="right"
              align="center"
              collisionPadding={workspaceDesign.popup.collisionPadding}
              width="min(var(--ui-popup-max-width), calc(100vw - var(--ui-popup-viewport-gutter)))"
              maxWidth="min(var(--ui-popup-max-width), calc(100vw - var(--ui-popup-viewport-gutter)))"
            >
              {projectPopup(project)}
            </HoverCard.Content>
          </HoverCard.Root>
        ) : (
          identity
        )}
      </Cell>
      <Cell>
        <Caption>{t('dashboard.projectsTable.head.tracked')}</Caption>
        <Metric aria-label={formatDurationFromMinutes(project.minutes, t)}>
          {formatCompactDurationFromMinutes(project.minutes, i18n.language)}
        </Metric>
      </Cell>
      {showDetail && (
        <>
          <Cell data-unavailable={viewer || undefined}>
            {!viewer && (
              <>
                <Caption>{t('dashboard.summary.active.label')}</Caption>
                <Metric>{active}</Metric>
              </>
            )}
          </Cell>
          <Cell data-unavailable={viewer || undefined}>
            {!viewer && (
              <>
                <Caption>{t('dashboard.summary.earned.label')}</Caption>
                <Metric>
                  {project.earnedCents === undefined
                    ? '—'
                    : formatCurrency(project.earnedCents / 100)}
                </Metric>
              </>
            )}
          </Cell>
        </>
      )}
    </Root>
  )
}

const Root = styled.tr`
  ${(p) => p.theme.breakpoints.down('md')} {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--ui-space-3) var(--ui-space-2);
    padding: var(--ui-space-4) 0;
    border-top: var(--ui-border-width) solid var(--ui-line);
    border-radius: var(--ui-row-radius);

    &:hover,
    &:focus-within {
      background: var(--ui-inset);
    }

    &:not([data-detail]),
    &[data-viewer] {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`

const Cell = styled.td.attrs({ role: 'cell' })`
  padding: var(--ui-space-4) var(--ui-space-3);
  border-top: var(--ui-border-width) solid var(--ui-line);
  vertical-align: middle;
  transition: background var(--ui-transition);

  &:first-child {
    border-radius: var(--ui-row-radius) 0 0 var(--ui-row-radius);
  }

  &:last-child {
    border-radius: 0 var(--ui-row-radius) var(--ui-row-radius) 0;
    text-align: right;
  }

  ${Root}:hover &,
  ${Root}:focus-within & {
    background: var(--ui-inset);
  }

  @container projects-table (max-width: ${workspaceDesign.container
    .compact}px) {
    padding: var(--ui-space-3) var(--ui-space-2);
  }

  @container projects-table (max-width: ${workspaceDesign.container.narrow}px) {
    padding-block: var(--ui-space-2);

    &:first-child {
      padding-left: 0;
    }

    &:last-child {
      padding-right: 0;
    }
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    min-width: 0;
    padding: 0;
    border-top: 0;
    border-radius: 0;

    &:first-child {
      grid-column: 1 / -1;
      border-radius: 0;
    }

    &:last-child {
      text-align: left;
    }

    &[data-unavailable] {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Identity = styled.button`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  width: 100%;
  padding: var(--ui-space-1) 0;
  border-radius: var(--ui-row-radius);
  text-align: left;
  color: var(--ui-ink);

  ${(p) => p.theme.breakpoints.up('md')} {
    @container projects-table (max-width: ${workspaceDesign.container
      .narrow}px) {
      padding-block: 0;
    }
  }

  &:focus-visible {
    outline: var(--ui-focus-width) solid var(--ui-blue);
    outline-offset: var(--ui-focus-offset-loose);
  }
`

const Body = styled.span`
  display: grid;
  gap: var(--ui-space-1);
  min-width: 0;
`

const Name = styled.span`
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-weight: var(--ui-weight-semibold);
  overflow-wrap: anywhere;
`

const Description = styled.span`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  overflow-wrap: anywhere;
`

const Rate = styled.span`
  white-space: nowrap;

  &::before {
    content: ' · ';
    white-space: pre;
  }
`

const Metric = styled.span`
  color: var(--ui-text);
  font-size: var(--ui-body-size);
  line-height: var(--ui-body-line-height);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;

  ${(p) => p.theme.breakpoints.up('md')} {
    white-space: nowrap;
  }

  @container projects-table (max-width: ${workspaceDesign.container.narrow}px) {
    font-size: var(--ui-meta-size);
    line-height: var(--ui-meta-line-height);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    font-size: var(--ui-meta-size);
    line-height: var(--ui-meta-line-height);
  }
`

const Caption = styled.span`
  display: none;

  ${(p) => p.theme.breakpoints.down('md')} {
    display: block;
    margin-bottom: var(--ui-space-1);
    color: var(--ui-muted);
    font-size: var(--ui-meta-size);
    line-height: var(--ui-meta-line-height);
  }
`
