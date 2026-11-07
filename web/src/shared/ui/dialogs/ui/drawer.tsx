import { Separator, Theme } from '@radix-ui/themes'
import styled from 'styled-components'
import * as Vaul from 'vaul'

import type { CommonDialogProps } from '../model'

export const Drawer = ({
  trigger,
  children,
  open,
  title,
  headerActions,
  footer,
  onOpenChange,
  mobileHeight,
  description,
}: CommonDialogProps) => {
  return (
    <Vaul.Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground
      repositionInputs={false}
    >
      {trigger && (
        <Vaul.Drawer.Trigger asChild>
          <Theme asChild>{trigger}</Theme>
        </Vaul.Drawer.Trigger>
      )}
      <Vaul.Drawer.Portal>
        <DrawerOverlay />
        <DrawerContent $maxHeight={mobileHeight}>
          <DrawerHandleWrapper>
            <DrawerHandle />
          </DrawerHandleWrapper>
          <DrawerInner>
            {(title || headerActions) && (
              <DrawerTitleRow>
                {title && (
                  <Vaul.Drawer.Title>
                    <Theme>
                      <DrawerTitle>{title}</DrawerTitle>
                    </Theme>
                  </Vaul.Drawer.Title>
                )}
                {headerActions && <Theme>{headerActions}</Theme>}
              </DrawerTitleRow>
            )}
            <DrawerBody>
              <Theme>{children}</Theme>
            </DrawerBody>
            {description && (
              <DrawerDescription>{description}</DrawerDescription>
            )}
            {footer && (
              <footer>
                <Theme>
                  <FooterWrapper>
                    <Separator size={'4'} mt={'22px'} mb={'2'} color={'gray'} />
                    {footer}
                  </FooterWrapper>
                </Theme>
              </footer>
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
  background: var(--color-overlay);
`

const DrawerContent = styled(Vaul.Drawer.Content)<{ $maxHeight?: string }>`
  position: fixed;

  left: 0;
  right: 0;
  bottom: 0;

  display: flex;
  flex-direction: column;

  border: 1px solid var(--ui-line);
  border-bottom: 0;
  border-top-left-radius: var(--ui-radius);
  border-top-right-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);

  ${(p) => `
    max-height: ${p.$maxHeight || '95dvh'};
  `}
`

const DrawerHandleWrapper = styled.div`
  padding: 8px 0 0;
`

const DrawerHandle = styled.div`
  margin: 0 auto;
  height: 6px;
  width: 100px;
  border-radius: var(--ui-pill-radius);
  background: var(--ui-line);
`

const DrawerInner = styled.div`
  /* The sheet sits on the bottom edge, so its last row has to clear the home
     indicator on phones without a hardware button. */
  padding: var(--ui-space-2) var(--ui-card-inset-mobile)
    calc(var(--ui-card-inset-mobile) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`

const DrawerTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);

  & > :first-child {
    flex: 1;
    min-width: 0;
  }
`

const DrawerTitle = styled.span`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-heading-size);
  line-height: var(--ui-heading-line-height);
  font-weight: var(--ui-heading-weight);
  letter-spacing: var(--ui-heading-tracking);
  width: 100%;
`

const DrawerDescription = styled(Vaul.Drawer.Description)`
  color: var(--ui-muted);
`

const FooterWrapper = styled.div``

const DrawerBody = styled.div`
  padding: 12px 1px 1px;
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`
