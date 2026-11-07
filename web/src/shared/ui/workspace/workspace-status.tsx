import { CheckIcon, ClockIcon, CrossCircledIcon } from '@radix-ui/react-icons'
import styled, { css } from 'styled-components'

import type { ReactNode } from 'react'

/** What a status means, not its colour: each tone has one look app-wide. */
export type WorkspaceStatusTone =
  | 'positive'
  | 'attention'
  | 'critical'
  | 'neutral'

type Props = {
  tone: WorkspaceStatusTone
  children: ReactNode
  /** Replaces the tone's own icon; `null` shows the label alone. */
  icon?: ReactNode
  className?: string
}

const ICON_SIZE = 14

const TONE_ICONS: Record<WorkspaceStatusTone, ReactNode> = {
  positive: <CheckIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />,
  attention: <ClockIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />,
  critical: (
    <CrossCircledIcon width={ICON_SIZE} height={ICON_SIZE} aria-hidden />
  ),
  neutral: null,
}

/** The status pill: a real state with its icon, never decoration. */
export const WorkspaceStatus = ({ tone, children, icon, className }: Props) => (
  <Root className={className} data-tone={tone}>
    {icon === undefined ? TONE_ICONS[tone] : icon}
    {children}
  </Root>
)

/** The pill's look, for a control that is a status and a button at once. */
export const workspaceStatusStyles = css`
  --status-color: var(--ui-muted);
  --status-background: var(--ui-inset);

  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: start;
  gap: var(--ui-space-1);
  min-height: var(--ui-space-6);
  padding-inline: var(--ui-space-3);
  border-radius: var(--ui-pill-radius);
  background: var(--status-background);
  color: var(--status-color);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-meta-line-height);
  font-weight: var(--ui-weight-medium);
  white-space: nowrap;

  &[data-tone='positive'] {
    --status-color: var(--green-11);
    --status-background: var(--green-a3);
  }

  &[data-tone='attention'] {
    --status-color: var(--amber-11);
    --status-background: var(--amber-a3);
  }

  &[data-tone='critical'] {
    --status-color: var(--red-11);
    --status-background: var(--red-a3);
  }
`

const Root = styled.span`
  ${workspaceStatusStyles}
`
