import { GridIcon, ListBulletIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { $timeView, timeViewChanged, type TimeView } from '../../model'
import { ToolbarSegment, ToolbarShell } from '../common'

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
          {t(option.labelKey)}
        </Option>
      ))}
    </Root>
  )
}

const Root = styled(ToolbarShell).attrs({ role: 'group' })``

const Option = styled(ToolbarSegment)``
