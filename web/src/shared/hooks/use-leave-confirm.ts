import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

import { useConfirm } from './use-confirm'

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
  const blockedRef = useRef(false)

  useEffect(() => {
    if (blocker.state !== 'blocked' || blockedRef.current) {
      return
    }

    void confirm({
      title,
      description,
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
      onConfirm: () => {
        blocker.proceed()
        blockedRef.current = false
      },
      onCancel: () => {
        blocker.reset()
        blockedRef.current = false
      },
    })

    blockedRef.current = true
  }, [blocker, confirm, description, title])
}
