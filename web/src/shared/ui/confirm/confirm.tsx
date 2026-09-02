import { Flex, Text, Dialog } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import styled from 'styled-components'

import { useBreakpoint } from '../../hooks'
import { $confirmStack, confirmed, cancelled } from '../../model/confirm.model'
import { Button } from '../button/ui/button'

export const Confirm = () => {
  const stack = useUnit($confirmStack)
  const cancelledEvent = useUnit(cancelled)
  const confirmedEvent = useUnit(confirmed)

  const isDesktop = useBreakpoint('isDesktop')

  return (
    <>
      {stack.map((entry) => (
        <Dialog.Root
          key={entry.id}
          open={entry.visible}
          onOpenChange={(v) => !v && cancelledEvent(entry.id)}
          i18nIsDynamicList
        >
          <Content>
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
                // Description is itself a <p>, so the text inside is a block
                // span: a <p> in a <p> is invalid HTML React warns about.
                <Dialog.Description>
                  <Text
                    size={isDesktop ? '2' : '3'}
                    as="span"
                    style={{ display: 'block' }}
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
                  color="neutral"
                  variant="soft"
                  onClick={() => cancelledEvent(entry.id)}
                >
                  {entry.props.cancelLabel}
                </Button>
                <Button color="danger" onClick={() => confirmedEvent(entry.id)}>
                  {entry.props.confirmLabel}
                </Button>
              </Flex>
            </Flex>
          </Content>
        </Dialog.Root>
      ))}
    </>
  )
}

const Content = styled(Dialog.Content)`
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
