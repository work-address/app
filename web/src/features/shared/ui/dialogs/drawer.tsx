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
        <Vaul.Drawer.Trigger asChild>
          <Theme> {trigger} </Theme>
        </Vaul.Drawer.Trigger>
      )}

      <Vaul.Drawer.Portal>
        <DrawerOverlay />

        <DrawerContent>
          <DrawerHandle />

          <DrawerInner>
            {title && (
              <Vaul.Drawer.Title>
                <Theme>
                  <DrawerTitle>{title}</DrawerTitle>
                </Theme>
              </Vaul.Drawer.Title>
            )}

            <DrawerBody>
              <Theme>{children}</Theme>
            </DrawerBody>

            {description && (
              <DrawerDescription>
                <Theme>{description}</Theme>
              </DrawerDescription>
            )}
          </DrawerInner>
        </DrawerContent>
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
  margin: 20px auto 0 auto;
  height: 8px;
  width: 100px;
  border-radius: 999px;
  background: var(--gray-100);
`

const DrawerInner = styled.div`
  padding: 8px 16px 16px;
`

const DrawerTitle = styled.span`
  margin: 0;
  font-weight: 500;
  font-size: 18px;
  width: 100%;
`

const DrawerDescription = styled(Vaul.Drawer.Description)`
  margin-top: 24px;
  color: var(--ds-neutral-11);
`

const DrawerBody = styled.div`
  margin-top: 12px;
`
