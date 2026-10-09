import { useState, type ComponentProps } from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import styled from 'styled-components'

import { BreakpointsWatcher } from './breakpoints-watcher'
import { Select } from './select'

import type { Meta, StoryObj } from '@storybook/react-vite'

const OPTIONS = [
  { value: '', label: 'All projects' },
  { value: 'design', label: 'Design' },
  { value: 'development', label: 'Development' },
]

const ControlledSelect = (props: ComponentProps<typeof Select>) => {
  const [value, setValue] = useState(props.value)

  return (
    <>
      <Select
        {...props}
        value={value}
        onChange={(next) => {
          setValue(next)
          props.onChange(next)
        }}
      />
      <output aria-label="Selected value">{JSON.stringify(value)}</output>
      <button type="button">Next control</button>
    </>
  )
}

const meta = {
  title: 'shared/Select',
  component: Select,
  args: {
    label: 'Project',
    options: OPTIONS,
    value: 'design',
    onChange: fn(),
  },
  render: (args) => <ControlledSelect {...args} />,
  decorators: [
    (Story) => (
      <Root>
        <BreakpointsWatcher />
        <Story />
      </Root>
    ),
  ],
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const KeyboardAndEmptyValue: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('button', { name: 'Project' })

    trigger.focus()
    await userEvent.tab()
    await expect(
      canvas.getByRole('button', { name: 'Next control' }),
    ).toHaveFocus()
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    const list = await body.findByRole('listbox', { name: 'Project' })
    await userEvent.keyboard('{Home}{Enter}')
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent('""'),
    )
    await expect(args.onChange).toHaveBeenCalledWith('')
    await expect(trigger).toHaveTextContent('All projects')
    await waitFor(() => expect(list).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())

    await userEvent.keyboard('{ArrowDown}')
    await body.findByRole('listbox', { name: 'Project' })
    await userEvent.keyboard('{Home}{Enter}')
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-expanded', 'false'),
    )
    await expect(canvas.getByRole('status')).toHaveTextContent('""')

    await userEvent.keyboard(' ')
    await body.findByRole('listbox', { name: 'Project' })
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  },
}

export const Multiple: Story = {
  args: { multi: true, value: ['design'], title: 'Choose projects' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: 'Project' }))
    const list = await body.findByRole('listbox', { name: 'Choose projects' })
    await userEvent.click(
      within(list).getByRole('option', { name: 'Development' }),
    )
    await expect(args.onChange).toHaveBeenCalledWith(['design', 'development'])
    await expect(
      within(list).getByRole('option', { name: 'Design' }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(
      within(list).getByRole('option', { name: 'Development' }),
    ).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(within(list).getByRole('option', { name: 'Design' }))
    await expect(args.onChange).toHaveBeenCalledWith(['development'])
    await userEvent.keyboard('{Escape}')
    await waitFor(() =>
      expect(canvas.getByRole('status')).toHaveTextContent('["development"]'),
    )
  },
}

export const Disabled: Story = {
  args: { inputProps: { disabled: true } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: 'Project' })
    await expect(trigger).toBeDisabled()
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(args.onChange).not.toHaveBeenCalled()
  },
}

export const ReadOnly: Story = {
  ...Disabled,
  args: { inputProps: { readOnly: true } },
}

export const LongList: Story = {
  args: {
    value: '',
    placeholder: 'Choose a project',
    menuMaxHeight: 240,
    options: Array.from({ length: 40 }, (_, index) => ({
      value: `project-${index + 1}`,
      label: `Project ${index + 1}: a long name that should fit the control`,
    })),
  },
}

const Root = styled.div`
  display: grid;
  gap: var(--space-4);
  width: min(100%, 360px);
  padding: var(--space-4);
`
