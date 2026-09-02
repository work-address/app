import { Flex } from '@radix-ui/themes'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FieldError } from '../local-wallet-fields'
import { LocalWalletKeyReveal } from '../local-wallet-key-reveal'
import { LocalWalletStatus } from '../local-wallet-status'

import { ConfirmRow } from './styles'

import { Button, Checkbox, Text } from '@/shared'

/**
 * The one moment the new key is shown unprompted. Continuing is gated on an
 * explicit "I saved it": the keystore is in this browser only, so this copy
 * is the only way back into the account from anywhere else.
 */
export const BackupStep = ({
  privateKey,
  busy,
  submitError,
  onContinue,
}: {
  privateKey: string
  busy: boolean
  submitError: string | null
  onContinue: () => void
}) => {
  const { t } = useTranslation()
  const [saved, setSaved] = useState(false)

  return (
    <Flex direction="column" gap="4">
      <Text size="3" color="gray">
        {t('localWallet.backup.intro')}
      </Text>
      <LocalWalletKeyReveal privateKey={privateKey} />
      <ConfirmRow>
        <Checkbox
          id="local-wallet-backup-saved"
          checked={saved}
          disabled={busy}
          onCheckedChange={(checked) => setSaved(checked === true)}
        />
        <Text as="label" htmlFor="local-wallet-backup-saved" size="2">
          {t('localWallet.backup.confirm')}
        </Text>
      </ConfirmRow>
      <LocalWalletStatus />
      {submitError && <FieldError>{submitError}</FieldError>}
      <Button
        size="l"
        stretch
        disabled={!saved}
        loading={busy}
        onClick={onContinue}
      >
        {t('localWallet.backup.continue')}
      </Button>
    </Flex>
  )
}
