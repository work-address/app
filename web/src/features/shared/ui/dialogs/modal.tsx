import { Dialog, Flex, Separator } from '@radix-ui/themes'
import styled from 'styled-components'

import type { CommonDialogProps } from './types.ts'

export const Modal = ({
  children,
  trigger,
  open,
  onOpenChange,
  description,
  title,
  desktopWidth,
  desktopPadding,
}: CommonDialogProps) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger>{trigger}</Dialog.Trigger>}

      <Content $width={desktopWidth} $padding={desktopPadding}>
        {title && (
          <Title>
            {title}

            <Separator size={'4'} mt={'4'} />
          </Title>
        )}

        {children}

        {description && (
          <Dialog.Description>
            <Flex direction={'column'} mt={'4'}>
              <div>{description}</div>
            </Flex>
          </Dialog.Description>
        )}
      </Content>
    </Dialog.Root>
  )
}

const Title = styled(Dialog.Title)`
  font-size: var(--font-size-6);
  font-weight: var(--font-weight-medium);
`

const Content = styled(Dialog.Content)<{ $width?: string; $padding?: string }>`
  padding: 40px;

  ${(p) => p.$padding && `padding: ${p.$padding};`}
`
