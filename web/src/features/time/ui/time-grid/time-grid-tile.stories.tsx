import i18n from 'i18next'
import styled from 'styled-components'

import { createTimeStub } from '../../__fixtures__/time-stub'
import { TimeContext } from '../time-context'

import { TimeGridTile } from './time-grid-tile'

import type { TimeContextProps } from '../time-context'
import type { Meta, StoryObj } from '@storybook/react-vite'

/** The tile reads its formatters from the section shell, which stories lack. */
const formatters = {
  dateFormatter: new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }),
  timeFormatter: new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }),
  dayFormatter: new Intl.DateTimeFormat('en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }),
  numberFormatter: new Intl.NumberFormat('en', { maximumFractionDigits: 0 }),
}

const meta = {
  title: 'features/time/TimeGridTile',
  component: TimeGridTile,
  decorators: [
    (Story) => (
      <TimeContext.Provider
        value={{ ...formatters, t: i18n.t.bind(i18n) as TimeContextProps['t'] }}
      >
        <Frame>
          <Story />
        </Frame>
      </TimeContext.Provider>
    ),
  ],
  args: {
    entry: createTimeStub(),
    selected: false,
    onOpen: () => {},
    onSelectedChange: () => {},
  },
} satisfies Meta<typeof TimeGridTile>

export default meta

type Story = StoryObj<typeof meta>

/** data-tone="high": six of ten minutes active or better. */
export const ToneHigh: Story = {
  args: { entry: createTimeStub({ minutesActive: 9 }) },
}

/** data-tone="medium": three to five minutes of a ten-minute slot. */
export const ToneMedium: Story = {
  args: { entry: createTimeStub({ minutesActive: 4 }) },
}

/** data-tone="low": two minutes or fewer. */
export const ToneLow: Story = {
  args: { entry: createTimeStub({ minutesActive: 1 }) },
}

/** data-selected: the checkbox stays visible and the tile keeps an accent ring. */
export const Selected: Story = {
  args: { selected: true },
}

/** data-empty: the project never captured a screenshot for this slot. */
export const WithoutScreenshot: Story = {
  args: { entry: createTimeStub({ screenshot: undefined }) },
}

export const Paid: Story = {
  args: { entry: createTimeStub({ isPaid: true }) },
}

export const WithoutNote: Story = {
  args: { entry: createTimeStub({ note: '' }) },
}

const Frame = styled.div`
  display: grid;
  width: 240px;
`
