import { Theme } from '@radix-ui/themes'
import styled from 'styled-components'
import * as Vaul from 'vaul'

import type { CommonDialogProps } from './types'

export const Drawer = ({
  trigger,
  children,
  open,
  title,
  description,
  onOpenChange,
}: CommonDialogProps) => {
  return (
    <Vaul.Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground
    >
      {trigger && (
        <Theme>
          <Vaul.Drawer.Trigger asChild>{trigger}</Vaul.Drawer.Trigger>
        </Theme>
      )}

      <Vaul.Drawer.Portal>
        <Theme>
          <DrawerOverlay />

          <DrawerContent>
            <DrawerHandle />

            <DrawerInner>
              {title && <DrawerTitle>{title}</DrawerTitle>}

              <DrawerBody>{children}</DrawerBody>

              {description && (
                <DrawerDescription>{description}</DrawerDescription>
              )}
            </DrawerInner>
          </DrawerContent>
        </Theme>
      </Vaul.Drawer.Portal>
    </Vaul.Drawer.Root>
  )
}

const DrawerOverlay = styled(Vaul.Drawer.Overlay)`
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.5);
`

const DrawerContent = styled(Vaul.Drawer.Content)`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ds-neutral-alpha-6);
  border-bottom: 0;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  background: var(--white);
  box-shadow: var(--shadow-4);
`

const DrawerHandle = styled.div`
  margin: 16px auto 0;
  height: 8px;
  width: 100px;
  border-radius: 999px;
  background: var(--gray-100);
`

const DrawerInner = styled.div`
  padding: 16px;
`

const DrawerTitle = styled(Vaul.Drawer.Title)`
  margin: 0;
`

const DrawerDescription = styled(Vaul.Drawer.Description)`
  margin-top: 24px;
  color: var(--ds-neutral-11);
`

const DrawerBody = styled.div`
  margin-top: 12px;
`
