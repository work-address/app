import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/shared'

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
    <Flex gap="2" align="center">
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
    </Flex>
  )
}
