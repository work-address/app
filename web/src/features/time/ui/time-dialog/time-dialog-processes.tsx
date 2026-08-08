import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { Time } from '@/entities/time'

import { Text } from '@/shared'

type TimeProcessItem = {
  name?: string
  timeMin?: number
}

type TimeDialogProcessesProps = {
  processes?: Time['processes']
}

export const TimeDialogProcesses = ({
  processes,
}: TimeDialogProcessesProps) => {
  const { t } = useTranslation()

  const processItems = (processes ?? [])
    .map((item) => item as TimeProcessItem)
    .filter((item): item is TimeProcessItem & { name: string } =>
      Boolean(item?.name),
    )

  if (processItems.length === 0) {
    return null
  }

  return (
    <Flex direction="column" gap="2" width="100%">
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.confirmRemoveProcesses.processes')}
      </Text>
      <ProcessesList>
        {processItems.map((item, index) => (
          <Flex
            key={`${item.name}-${index}`}
            justify="between"
            align="center"
            gap="2"
          >
            <Text size="2">{item.name}</Text>
            <Text size="2" color="gray">
              {t('common.duration.minutesOnly', {
                minutes: item.timeMin ?? 0,
              })}
            </Text>
          </Flex>
        ))}
      </ProcessesList>
    </Flex>
  )
}

const ProcessesList = styled.div`
  display: grid;
  gap: var(--space-2);
  max-height: 200px;
  overflow-y: auto;
  width: 100%;
`
