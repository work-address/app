import { Cross1Icon } from '@radix-ui/react-icons'
import { Dialog, Flex, Separator } from '@radix-ui/themes'
import styled from 'styled-components'

import type { CommonDialogProps, ModalProps } from './types.ts'

export const Modal = ({
  children,
  trigger,
  open,
  onOpenChange,
  footer,
  title,
  width,
  padding,
  showClose = false,
  showTitleSeparator = true,
  description,
}: CommonDialogProps & ModalProps) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger>{trigger}</Dialog.Trigger>}
      <SContent $width={width} $padding={padding}>
        {showClose && (
          <SClose>
            <Cross1Icon />
          </SClose>
        )}
        {title && (
          <STitle>
            {title}
            {showTitleSeparator && <Separator size={'4'} mt={'4'} />}
          </STitle>
        )}
        {children}
        {description && <Dialog.Description>{description}</Dialog.Description>}
        {footer && (
          <footer>
            <Flex direction={'column'} mt={'4'}>
              <div>{footer}</div>
            </Flex>
          </footer>
        )}
      </SContent>
    </Dialog.Root>
  )
}

const STitle = styled(Dialog.Title)`
  font-size: var(--font-size-6);
  font-weight: var(--font-weight-medium);
`

const SContent = styled(Dialog.Content)<{ $width?: string; $padding?: string }>`
  padding: var(--space-5);
  ${(p) => p.$padding && `padding: ${p.$padding};`}

  ${(p) => p.theme.breakpoints.up('md')} {
    padding: 40px;
  }

  ${(p) => p.$width && `width: ${p.$width};`}
`

const SClose = styled(Dialog.Close).attrs({ type: 'button' })`
  position: absolute;
  right: var(--space-5);
  top: var(--space-5);
  cursor: pointer;
`
