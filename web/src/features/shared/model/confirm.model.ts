import { createStore, createEvent, sample, createEffect } from 'effector'

export type ConfirmProps = {
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

type Resolvers = {
  resolve: (props: ConfirmProps) => void | Promise<void>
  reject: (props: ConfirmProps) => void | Promise<void>
}

type ConfirmEntry = {
  id: string
  props: ConfirmProps
} & Resolvers

export const DEFAULT_PROPS: ConfirmProps = {
  title: 'Are you sure?',
  description: 'This action cannot be undone.',
  cancelLabel: 'Cancel',
  confirmLabel: 'Ok',
}

const addConfirm = createEvent<ConfirmEntry>()

const removeConfirm = createEvent<string>()

const handleConfirmOrCancel = createEffect(
  async ({
    type,
    entry,
  }: {
    type: 'confirm' | 'cancel'
    entry: ConfirmEntry | null
  }): Promise<void> => {
    switch (type) {
      case 'confirm': {
        {
          entry?.resolve && (await entry.resolve(entry.props))
          entry?.props.onConfirm && (await entry.props.onConfirm())
        }
        break
      }

      case 'cancel': {
        {
          entry?.reject && (await entry.reject(entry.props))
          entry?.props.onCancel && (await entry.props.onCancel())
        }
        break
      }
    }
  },
)

const confirmed = createEvent<string>()
const cancelled = createEvent<string>()

const $confirmStack = createStore<ConfirmEntry[]>([])

$confirmStack
  .on(addConfirm, (state, payload) => [...state, payload])
  .on(removeConfirm, (state, payload) =>
    state.filter(({ id }) => id !== payload),
  )

sample({
  clock: confirmed,
  source: $confirmStack,
  fn: (stack, id): ConfirmEntry | null =>
    stack.find((confirmEntry) => confirmEntry.id === id) ?? null,
  target: handleConfirmOrCancel.prepend((entry: ConfirmEntry | null) => ({
    type: 'confirm',
    entry,
  })),
})

sample({
  clock: cancelled,
  source: $confirmStack,
  fn: (stack, id): ConfirmEntry | null =>
    stack.find((confirmEntry) => confirmEntry.id === id) ?? null,
  target: handleConfirmOrCancel.prepend((entry: ConfirmEntry | null) => ({
    type: 'cancel',
    entry,
  })),
})

sample({
  clock: handleConfirmOrCancel.done,
  fn: ({ params }) => params.entry?.id ?? '',
  filter: Boolean,
  target: removeConfirm,
})

export { $confirmStack, addConfirm, confirmed, cancelled }
