import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

import { useConfirm } from './use-confirm.ts'

interface Options {
  when: boolean
  title?: string
  description?: string
}

export const useLeaveConfirm = ({
  when,
  title = 'Leave this page?',
  description = "It seems you didn't save the changes you've made.",
}: Options) => {
  const blocker = useBlocker(when)
  const { confirm } = useConfirm()

  useEffect(() => {
    if (blocker.state !== 'blocked') {
      return
    }

    void confirm({
      title,
      description,
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
      onConfirm: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
    })
  }, [
    blocker.state,
    blocker.proceed,
    blocker.reset,
    confirm,
    description,
    title,
  ])
}
