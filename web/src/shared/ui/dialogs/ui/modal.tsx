import { Cross1Icon } from '@radix-ui/react-icons'
import { Dialog, Flex, Separator } from '@radix-ui/themes'
import styled from 'styled-components'

import type { CommonDialogProps, ModalProps } from '../model'

export const Modal = ({
  children,
  trigger,
  open,
  onOpenChange,
  footer,
  title,
  headerActions,
  width,
  padding,
  showClose = false,
  showTitleSeparator = true,
  description,
}: CommonDialogProps & ModalProps) => {
  const hasHeaderActions = Boolean(headerActions) || showClose

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger>{trigger}</Dialog.Trigger>}
      <SContent $width={width} $padding={padding}>
        {(title || hasHeaderActions) && (
          <>
            <SHeader>
              {title && <STitle>{title}</STitle>}
              {hasHeaderActions && (
                <SHeaderActions>
                  {headerActions}
                  {showClose && (
                    <SClose>
                      <Cross1Icon />
                    </SClose>
                  )}
                </SHeaderActions>
              )}
            </SHeader>
            {title && showTitleSeparator && <Separator size={'4'} mt={'4'} />}
          </>
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

const SHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
`

const STitle = styled(Dialog.Title)`
  font-size: var(--font-size-6);
  font-weight: var(--font-weight-medium);
  flex: 1;
  min-width: 0;
`

const SHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
`

const SContent = styled(Dialog.Content)<{ $width?: string; $padding?: string }>`
  padding: var(--space-5);
  ${(p) => p.$padding && `padding: ${p.$padding};`}

  ${(p) => p.theme.breakpoints.up('md')} {
    padding: 40px;
  }

  ${(p) =>
    p.$width &&
    `
      width: ${p.$width};
      max-width: ${p.$width};
    `}
`

const SClose = styled(Dialog.Close).attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`
