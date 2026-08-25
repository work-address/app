import { createEffect } from 'effector'

import { showToast } from '../lib/sonner'

import { translate } from './translate'

import type { ToasterProps } from 'sonner'

export type ToastRequest = {
  type: 'error' | 'warning' | 'info' | 'success'
  /** i18n key - resolved here so models stay free of React context. */
  messageKey: string
  values?: Record<string, unknown>
  position?: ToasterProps['position']
  closeButton?: boolean
}

/**
 * Lets a model declare a toast as the target of a sample, rather than having a
 * component watch a mutation's status in useEffect and fire the toast as a
 * side effect of rendering. i18next is a singleton, so translation does not
 * need the React tree.
 */
export const showToastFx = createEffect((request: ToastRequest) => {
  const {
    type,
    messageKey,
    values,
    position = 'top-center',
    closeButton,
  } = request

  showToast(type, {
    message: translate(messageKey, values),
    position,
    closeButton,
  })
})
