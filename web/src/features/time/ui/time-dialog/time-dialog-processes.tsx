import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { Time } from '@/entities/time'

import { formatDurationFromMinutes, Text, Tooltip } from '@/shared'

type TimeProcessItem = {
  name?: string
  timeMin?: number
}

type TimeDialogProcessesProps = {
  processes?: Time['processes']
}

// Keeps a one-minute process from rendering as an invisible sliver.
const MIN_BAR_PERCENT = 4

// The faintest a bar may get, so the shortest process still reads as a bar.
const MIN_FILL_OPACITY = 0.45

const toMinutes = (value?: number) => {
  const rounded = Math.round(Number(value))

  return Number.isFinite(rounded) ? Math.max(0, rounded) : 0
}

// Longer processes sit at full strength, shorter ones fade back.
const getFillOpacity = (ratio: number) =>
  Number((MIN_FILL_OPACITY + ratio * (1 - MIN_FILL_OPACITY)).toFixed(2))

export const TimeDialogProcesses = ({
  processes,
}: TimeDialogProcessesProps) => {
  const { t } = useTranslation()

  const processItems = (processes ?? [])
    .map((item) => item as TimeProcessItem)
    .filter((item): item is TimeProcessItem & { name: string } =>
      Boolean(item?.name),
    )
    .map((item) => ({ name: item.name, minutes: toMinutes(item.timeMin) }))
    .sort((a, b) => a.minutes - b.minutes)

  if (processItems.length === 0) {
    return null
  }

  // Bars are read against the busiest process, so the longest one fills its track.
  const minutesList = processItems.map((item) => item.minutes)
  const longest = Math.max(...minutesList)
  const shortest = Math.min(...minutesList)
  const scaleMax = Math.max(longest, 1)

  return (
    <Flex direction="column" gap="2" width="100%">
      <Text size="2" weight="medium">
        {t('dashboard.worklogsTable.confirmRemoveProcesses.processes')}
      </Text>
      {longest > 0 && (
        <Scale>
          {shortest !== longest && (
            <ScaleLabel>{formatDurationFromMinutes(shortest, t)}</ScaleLabel>
          )}
          <ScaleLabel>{formatDurationFromMinutes(longest, t)}</ScaleLabel>
        </Scale>
      )}
      <ProcessesList>
        {processItems.map((item, index) => {
          const duration = formatDurationFromMinutes(item.minutes, t)
          const ratio = item.minutes / scaleMax
          const percent = item.minutes
            ? Math.max(MIN_BAR_PERCENT, ratio * 100)
            : 0

          return (
            <Tooltip key={`${item.name}-${index}`} content={duration}>
              <Row aria-label={`${item.name}: ${duration}`} role="img">
                <Fill
                  style={{
                    width: `${percent}%`,
                    opacity: getFillOpacity(ratio),
                  }}
                />
                <Name title={item.name}>{item.name}</Name>
              </Row>
            </Tooltip>
          )
        })}
      </ProcessesList>
    </Flex>
  )
}

const ProcessesList = styled.div`
  display: grid;
  gap: 3px;
  max-height: 200px;
  overflow-y: auto;
  width: 100%;
`

// The track spans the full width and the fill sits behind the name, so a row
// costs one line instead of a label/bar pair.
const Row = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  height: 22px;
  border-radius: 4px;
  background: var(--c-rgba-0-0-51-0_04);
  overflow: hidden;
`

// A tint rather than a solid, so the process name stays readable on top of it.
const Fill = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: var(--c-rgba-0-52-130-0_28);
`

const Name = styled.span`
  position: relative;
  overflow: hidden;
  padding: 0 var(--space-2);
  color: var(--ds-neutral-12);
  font-size: var(--font-size-1);
  line-height: 1;
  white-space: nowrap;
  text-overflow: ellipsis;
`

const Scale = styled.div`
  display: flex;
  justify-content: space-between;

  & > *:only-child {
    margin-left: auto;
  }
`

const ScaleLabel = styled.span`
  color: var(--ds-neutral-11);
  font-size: var(--font-size-0);
  line-height: 1;
`
