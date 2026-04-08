import { Dialog, Flex } from '@radix-ui/themes'

import type { CommonDialogProps } from './types.ts'

export const Modal = ({
  children,
  trigger,
  open,
  onOpenChange,
  description,
}: CommonDialogProps) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger>{trigger}</Dialog.Trigger>}

      <Dialog.Content>
        {children}

        {description && (
          <Dialog.Description>
            <Flex direction={'column'} mt={'3'}>
              <div>{description}</div>
            </Flex>
          </Dialog.Description>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
