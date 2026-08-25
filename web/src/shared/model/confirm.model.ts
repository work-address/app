import { createStore, createEvent, sample, createEffect } from 'effector'
import { nanoid } from 'nanoid'

export const DEFAULT_PROPS: ConfirmProps = {
  title: 'Are you sure?',
  description: 'This action cannot be undone.',
  cancelLabel: 'Cancel',
  confirmLabel: 'Ok',
}
const REMOVE_DELAY = 2000

const addConfirm = createEvent<ConfirmEntry>()

const toggleVisible = createEvent<{ id: string; visible: boolean }>()

const handleConfirmOrCancel = createEffect(
  async (params: {
    type: 'confirm' | 'cancel'
    entry: ConfirmEntry | null
  }): Promise<void> => {
    switch (params.type) {
      case 'confirm': {
        {
          params.entry?.props.onConfirm &&
            (await params.entry.props.onConfirm())

          params.entry?.resolve &&
            (await params.entry.resolve(params.entry.props))
        }
        break
      }

      case 'cancel': {
        {
          params.entry?.props.onCancel && (await params.entry.props.onCancel())

          params.entry?.reject &&
            (await params.entry.reject(params.entry.props))
        }
        break
      }
    }
  },
)

const removeConfirm = createEffect(
  (_: string) => new Promise((resolve) => setTimeout(resolve, REMOVE_DELAY)),
)

const confirmed = createEvent<string>()
const cancelled = createEvent<string>()

const $confirmStack = createStore<(ConfirmEntry & { visible?: boolean })[]>([])

$confirmStack
  .on(addConfirm, (state, payload) => [...state, { ...payload, visible: true }])
  .on(removeConfirm.done, (state, payload) =>
    state.filter(({ id }) => id !== payload.params),
  )
  .on(toggleVisible, (state, payload) =>
    state.map((confirmEntry) => {
      if (payload.id === confirmEntry.id) {
        return {
          ...confirmEntry,
          visible: payload.visible,
        }
      }

      return confirmEntry
    }),
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
  target: toggleVisible.prepend((id: string) => ({
    id,
    visible: false,
  })),
})

sample({
  clock: toggleVisible,
  target: removeConfirm.prepend(
    (params: { id: string; visible: boolean }) => params.id,
  ),
})

/**
 * Effector-native entry point to the confirm dialog: resolves when the user
 * confirms and rejects when they cancel, so a model can gate an action on
 * `confirmFx.done` instead of threading an onConfirm callback through a
 * component. useConfirm is a thin React wrapper over this.
 */
const confirmFx = createEffect(
  (props?: ConfirmProps): Promise<ConfirmProps> =>
    new Promise((resolve, reject) => {
      addConfirm({
        id: nanoid(),
        props: { ...DEFAULT_PROPS, ...props },
        resolve,
        reject,
      })
    }),
)

export { $confirmStack, addConfirm, confirmed, cancelled, confirmFx }

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
