import { useState, type ComponentProps } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import styled from 'styled-components'

import i18n from '../i18n/i18n'

import { DatePickerInput } from './date-picker-input'

import type { Meta, StoryObj } from '@storybook/react-vite'

const INITIAL_DATE = new Date(2026, 5, 15)
const dateValue = (value: Date | null | undefined) =>
  value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : 'none'

const ControlledDate = (props: ComponentProps<typeof DatePickerInput>) => {
  const [value, setValue] = useState(props.value)

  return (
    <>
      <DatePickerInput
        {...props}
        value={value}
        onChange={(next) => {
          setValue(next)
          props.onChange?.(next)
        }}
      />
      <output aria-label="Selected date">{dateValue(value)}</output>
      <button type="button">Next control</button>
    </>
  )
}

const meta = {
  title: 'shared/DatePickerInput',
  component: DatePickerInput,
  args: { label: 'Invoice date', value: INITIAL_DATE, onChange: fn() },
  render: (args) => <ControlledDate {...args} />,
  decorators: [
    (Story) => (
      <Root>
        <Story />
      </Root>
    ),
  ],
} satisfies Meta<typeof DatePickerInput>

export default meta
type Story = StoryObj<typeof meta>

export const DraftCancelAndConfirm: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('button', { name: 'Invoice date' })

    trigger.focus()
    await userEvent.keyboard('{Enter}')
    const grid = await body.findByRole('grid')
    const day = within(grid)
      .getAllByRole('button')
      .find((button) => button.textContent?.trim() === '16')
    if (!day) {
      throw new Error('June 16 must be available in the date fixture')
    }
    await userEvent.click(day)
    await expect(
      canvas.getByRole('status', { name: 'Selected date' }),
    ).toHaveTextContent('2026-06-15')
    await expect(args.onChange).not.toHaveBeenCalled()
    await userEvent.click(
      body.getByRole('button', { name: i18n.t('ui.datePicker.cancel') }),
    )
    await waitFor(() => expect(grid).not.toBeInTheDocument())
    await expect(
      canvas.getByRole('status', { name: 'Selected date' }),
    ).toHaveTextContent('2026-06-15')
    await waitFor(() => expect(trigger).toHaveFocus())

    await userEvent.keyboard(' ')
    const nextGrid = await body.findByRole('grid')
    const nextDay = within(nextGrid)
      .getAllByRole('button')
      .find((button) => button.textContent?.trim() === '16')
    if (!nextDay) {
      throw new Error('June 16 must be available after reopening')
    }
    await userEvent.click(nextDay)
    await userEvent.click(
      body.getByRole('button', { name: i18n.t('ui.datePicker.confirm') }),
    )
    await waitFor(() =>
      expect(
        canvas.getByRole('status', { name: 'Selected date' }),
      ).toHaveTextContent('2026-06-16'),
    )
    await expect(args.onChange).toHaveBeenCalledWith(new Date(2026, 5, 16))
  },
}

export const ClearAndReopen: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      canvas.getByRole('button', { name: i18n.t('ui.datePicker.clear') }),
    )
    await expect(args.onChange).toHaveBeenCalledWith(null)
    await expect(
      canvas.getByRole('status', { name: 'Selected date' }),
    ).toHaveTextContent('none')
    await userEvent.click(canvas.getByRole('button', { name: 'Invoice date' }))
    await body.findByRole('grid')
    await expect(
      body.queryAllByRole('gridcell', { selected: true }),
    ).toHaveLength(0)
    await userEvent.click(
      body.getByRole('button', { name: i18n.t('ui.datePicker.confirm') }),
    )
    await expect(
      canvas.getByRole('status', { name: 'Selected date' }),
    ).toHaveTextContent('none')
    await expect(args.onChange).toHaveBeenLastCalledWith(null)
  },
}

export const Disabled: Story = {
  args: { inputProps: { disabled: true } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Invoice date' })
    await expect(trigger).toBeDisabled()
    await expect(
      canvas.getByRole('button', { name: i18n.t('ui.datePicker.clear') }),
    ).toBeDisabled()
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

export const ReadOnly: Story = {
  ...Disabled,
  args: { inputProps: { readOnly: true } },
}

export const RequiredDate: Story = { args: { allowClear: false } }
export const Empty: Story = { args: { value: null } }

const Root = styled.div`
  display: grid;
  gap: var(--space-4);
  width: min(100%, 360px);
  padding: var(--space-4);
`
