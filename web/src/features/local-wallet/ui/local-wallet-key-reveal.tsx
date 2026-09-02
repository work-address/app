import { CopyIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Button, copyToClipboard, showToast } from '@/shared'

type Props = {
  privateKey: string
}

/**
 * The private key, plainly, with a copy button. Shown only after the user
 * asked for it - at creation, from the unlock dialog, or from the profile -
 * and never stored anywhere by the app beyond the encrypted keystore.
 */
export const LocalWalletKeyReveal = ({ privateKey }: Props) => {
  const { t } = useTranslation()

  const handleCopy = () => {
    copyToClipboard(privateKey)
      .then(() =>
        showToast('info', {
          message: t('localWallet.export.copied'),
          position: 'top-center',
        }),
      )
      .catch(() => {})
  }

  return (
    <Flex direction="column" gap="3">
      <Warning>{t('localWallet.export.intro')}</Warning>
      <KeyBox>{privateKey}</KeyBox>
      <Flex justify="end">
        <Button
          variant="outline"
          color="neutral"
          iconLeft={<CopyIcon />}
          onClick={handleCopy}
        >
          {t('localWallet.export.copy')}
        </Button>
      </Flex>
    </Flex>
  )
}

export const Warning = styled.div`
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--amber-a3);
  color: var(--amber-11);
  font-size: var(--font-size-2);
  line-height: 1.45;
`

const KeyBox = styled.code`
  display: block;
  padding: var(--space-3);
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-2);
  line-height: 1.5;
  overflow-wrap: anywhere;
  user-select: all;
`
