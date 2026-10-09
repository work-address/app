import { createEvent, createStore } from 'effector'

export const timeSelectionChanged = createEvent<Record<string, boolean>>()
export const timeSelectionCleared = createEvent()
// The common bulk model accepts user selection changes only while idle.
export const timeSelectionChangeAccepted =
  createEvent<Record<string, boolean>>()

export const $timeSelection = createStore<Record<string, boolean>>({})
  .on(timeSelectionChangeAccepted, (_, selection) => selection)
  .reset(timeSelectionCleared)

export const $selectedTimeIds = $timeSelection.map((selection) =>
  Object.keys(selection).filter((id) => selection[id]),
)
export const $selectedTimeCount = $selectedTimeIds.map((ids) => ids.length)
