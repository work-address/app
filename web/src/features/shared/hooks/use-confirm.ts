import { useUnit } from 'effector-react'
import { nanoid } from 'nanoid'
import { useCallback } from 'react'

import { addConfirm, DEFAULT_PROPS } from '../model/confirm.model'

import type { ConfirmProps } from '../model/confirm.model'

export const useConfirm = () => {
  const addConfirmEvent = useUnit(addConfirm)

  const confirm = useCallback(
    (props?: ConfirmProps): Promise<ConfirmProps> =>
      new Promise((resolve, reject) => {
        addConfirmEvent({
          id: nanoid(),
          props: { ...DEFAULT_PROPS, ...props },
          resolve: (props) => resolve(props),
          reject: (props) => reject(props),
        })
      }),
    [addConfirmEvent],
  )

  return { confirm }
}
