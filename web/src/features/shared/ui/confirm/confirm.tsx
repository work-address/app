import { Dialog } from '@radix-ui/themes'
import { Flex, Text, Button } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import styled from 'styled-components'

import { $confirmStack, confirmed, cancelled } from '../../model/confirm.model'

export const Confirm = () => {
  const stack = useUnit($confirmStack)

  return (
    <>
      {stack.map((entry) => (
        <Dialog.Root
          key={entry.id}
          open
          onOpenChange={(v) => !v && cancelled(entry.id)}
        >
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <SContent onInteractOutside={(e) => e.preventDefault()}>
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
                    <Dialog.Description
                      align={{ initial: 'center', sm: 'left' }}
                    >
                      <Text size="3" as="p">
                        {entry.props.description}
                      </Text>
                    </Dialog.Description>
                  )}

                  <Flex
                    justify={{ initial: 'between', sm: 'end' }}
                    gap={{ initial: '3', sm: '3' }}
                    direction={{ initial: 'column-reverse', sm: 'row' }}
                    mt="4"
                  >
                    <Button
                      variant="soft"
                      color="gray"
                      onClick={() => cancelled(entry.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {entry.props.cancelLabel}
                    </Button>

                    <Button
                      variant="solid"
                      color="red"
                      onClick={() => confirmed(entry.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {entry.props.confirmLabel}
                    </Button>
                  </Flex>
                </Flex>
              </SContent>
            </motion.div>
          </AnimatePresence>
        </Dialog.Root>
      ))}
    </>
  )
}

const SContent = styled(Dialog.Content)`
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
