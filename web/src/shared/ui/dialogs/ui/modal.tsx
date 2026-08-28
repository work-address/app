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
  const hasSeparator = Boolean(title) && showTitleSeparator

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger>{trigger}</Dialog.Trigger>}
      <Root $width={width} $padding={padding}>
        {(title || hasHeaderActions) && (
          <>
            <Header $spaceBelow={!hasSeparator}>
              {title && <Title>{title}</Title>}
              {hasHeaderActions && (
                <Actions>
                  {headerActions}
                  {showClose && (
                    <Close>
                      <Cross1Icon />
                    </Close>
                  )}
                </Actions>
              )}
            </Header>
            {hasSeparator && <Separator size={'4'} mt={'4'} mb={'4'} />}
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
      </Root>
    </Dialog.Root>
  )
}

const Root = styled(Dialog.Content)<{ $width?: string; $padding?: string }>`
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

const Header = styled.div<{ $spaceBelow: boolean }>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);

  /* Without a separator the header has to space itself off the content. */
  ${(p) => p.$spaceBelow && `margin-bottom: var(--space-3);`}
`

// Radix's Dialog.Title defaults to mb="3", which stacked on top of the
// separator's own margin. The header's bottom spacing is owned by the
// separator (or by Header when there is none) instead.
const Title = styled(Dialog.Title).attrs({ mb: '0' as const })`
  font-size: var(--font-size-6);
  font-weight: var(--font-weight-medium);
  flex: 1;
  min-width: 0;
`

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
`

const Close = styled(Dialog.Close).attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`
