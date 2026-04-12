import * as Dialog from '@radix-ui/react-dialog'
import { Flex, Text, Button, Dialog as ThemeDialog } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import styled from 'styled-components'

import { useBreakpoints } from '../../hooks'
import { $confirmStack, confirmed, cancelled } from '../../model/confirm.model'

export const Confirm = () => {
  const stack = useUnit($confirmStack)
  const cancelledEvent = useUnit(cancelled)
  const confirmedEvent = useUnit(confirmed)

  const { isDesktop } = useBreakpoints()

  return (
    <>
      {stack.map((entry) => (
        <Dialog.Root
          key={entry.id}
          open={entry.visible}
          onOpenChange={(v) => !v && cancelledEvent(entry.id)}
          i18nIsDynamicList
        >
          <Dialog.Portal container={document.body}>
            <Dialog.Overlay />

            <SContent>
              <Flex direction="column" gap={{ initial: '1', sm: '2' }}>
                <Dialog.Title style={{ marginBottom: 0 }}>
                  <Text
                    align={{ initial: 'center', md: 'left' }}
                    size="5"
                    weight={{ initial: 'medium', md: 'bold' }}
                    as="p"
                  >
                    {entry.props.title}
                  </Text>
                </Dialog.Title>

                {entry.props.description && (
                  <Dialog.Description>
                    <Text
                      size={isDesktop ? '2' : '3'}
                      as="p"
                      align={{ initial: 'center', sm: 'left' }}
                    >
                      {entry.props.description}
                    </Text>
                  </Dialog.Description>
                )}

                <Flex
                  justify={{ initial: 'between', sm: 'end' }}
                  gap={{ initial: '3', sm: '3' }}
                  direction={{ initial: 'column-reverse', sm: 'row' }}
                  mt={{ initial: '4', md: '3' }}
                >
                  <Button
                    variant="soft"
                    color="gray"
                    onClick={() => cancelledEvent(entry.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {entry.props.cancelLabel}
                  </Button>

                  <Button
                    variant="solid"
                    color="red"
                    onClick={() => confirmedEvent(entry.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {entry.props.confirmLabel}
                  </Button>
                </Flex>
              </Flex>
            </SContent>
          </Dialog.Portal>
        </Dialog.Root>
      ))}
    </>
  )
}

const SContent = styled(ThemeDialog.Content)`
  position: fixed;
  top: 50%;
  left: 50%;
  translate: -50% -50%;

  background: var(--color-panel-solid);
  border-radius: var(--radius-4);
  padding: var(--space-5);
  width: clamp(320px, 90vw, 400px);
  box-shadow: var(--shadow-4);

  &:focus {
    outline: none;
  }
`
