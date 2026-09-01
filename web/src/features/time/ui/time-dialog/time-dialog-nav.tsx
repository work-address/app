import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { IconButton, Tooltip } from '@/shared'

type TimeDialogNavProps = {
  hasPrev: boolean
  hasNext: boolean
  disabled?: boolean
  onPrev?: () => void
  onNext?: () => void
}

export const TimeDialogNav = ({
  hasPrev,
  hasNext,
  disabled = false,
  onPrev,
  onNext,
}: TimeDialogNavProps) => {
  const { t } = useTranslation()

  return (
    <Flex gap="3" align="center">
      <Tooltip content={t('dashboard.worklogsTable.dialog.nav.prev')}>
        <TooltipTarget>
          <IconButton
            type="button"
            variant="ghost"
            color="gray"
            radius="full"
            disabled={disabled || !hasPrev || !onPrev}
            onClick={onPrev}
            aria-label={t('dashboard.worklogsTable.dialog.nav.prev')}
          >
            <ChevronLeftIcon width={20} height={20} />
          </IconButton>
        </TooltipTarget>
      </Tooltip>
      <Tooltip content={t('dashboard.worklogsTable.dialog.nav.next')}>
        <TooltipTarget>
          <IconButton
            type="button"
            variant="ghost"
            color="gray"
            radius="full"
            disabled={disabled || !hasNext || !onNext}
            onClick={onNext}
            aria-label={t('dashboard.worklogsTable.dialog.nav.next')}
          >
            <ChevronRightIcon width={20} height={20} />
          </IconButton>
        </TooltipTarget>
      </Tooltip>
    </Flex>
  )
}

// A disabled button swallows no pointer events, so the tooltip needs a wrapper
// to hover. It has to be inline-flex: an inline wrapper would build a text line
// box around the button and sit it a couple of pixels off the axis the close
// button lines up on.
const TooltipTarget = styled.span`
  display: inline-flex;
`
