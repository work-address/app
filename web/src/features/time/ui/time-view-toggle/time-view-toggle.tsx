import { GridIcon, ListBulletIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $timeView, timeViewChanged, type TimeView } from '../../model'

const ICON_SIZE = 14

const OPTIONS: { view: TimeView; labelKey: string }[] = [
  { view: 'list', labelKey: 'dashboard.worklogsView.list' },
  { view: 'grid', labelKey: 'dashboard.worklogsView.grid' },
]

export const TimeViewToggle = ({ className }: { className?: string }) => {
  const { t } = useTranslation()

  const { view, changeView } = useUnit({
    view: $timeView,
    changeView: timeViewChanged,
  })

  return (
    <Root className={className} aria-label={t('dashboard.worklogsView.label')}>
      {OPTIONS.map((option) => (
        <Option
          key={option.view}
          type="button"
          // Native state for a toggle, so nothing has to mirror it in data-*.
          aria-pressed={view === option.view}
          onClick={() => changeView(option.view)}
        >
          {option.view === 'list' ? (
            <ListBulletIcon width={ICON_SIZE} height={ICON_SIZE} />
          ) : (
            <GridIcon width={ICON_SIZE} height={ICON_SIZE} />
          )}
          <Label>{t(option.labelKey)}</Label>
        </Option>
      ))}
    </Root>
  )
}

const Root = styled.div.attrs({ role: 'group' })`
  display: grid;
  grid-auto-flow: column;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-3);
  background: var(--ds-neutral-2);
`

const Option = styled.button`
  display: grid;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-2);
  font-size: var(--font-size-1);
  color: var(--ds-neutral-11);
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    color: var(--ds-neutral-12);
  }

  &[aria-pressed='true'] {
    background: var(--white);
    color: var(--ds-neutral-12);
    box-shadow: 0 0 0 1px var(--ds-neutral-alpha-6);
  }
`

const Label = styled.span`
  line-height: 1;
`
