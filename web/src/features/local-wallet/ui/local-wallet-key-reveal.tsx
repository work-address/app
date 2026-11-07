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
  padding: var(--ui-space-2) var(--ui-space-3);
  border-radius: var(--ui-row-radius);
  background: var(--amber-a3);
  color: var(--amber-11);
  font-size: var(--ui-meta-size);
  line-height: 1.45;
`

const KeyBox = styled.code`
  display: block;
  padding: var(--ui-space-3);
  border: 1px solid var(--ui-line);
  border-radius: var(--ui-row-radius);
  background: var(--ui-inset);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--ui-meta-size);
  line-height: 1.5;
  overflow-wrap: anywhere;
  user-select: all;
`
