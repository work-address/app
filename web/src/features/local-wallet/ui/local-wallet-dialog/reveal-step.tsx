import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { FieldError } from '../local-wallet-fields'
import { LocalWalletKeyReveal } from '../local-wallet-key-reveal'
import { LocalWalletStatus } from '../local-wallet-status'

import { Actions } from './styles'

import { Button } from '@/shared'

type Props = {
  privateKey: string
  busy: boolean
  submitError: string | null
  onBack: () => void
  onSignIn: () => void
}

/** The key, shown again on request from the unlock screen. */
export const RevealStep = ({
  privateKey,
  busy,
  submitError,
  onBack,
  onSignIn,
}: Props) => {
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="4">
      <LocalWalletKeyReveal privateKey={privateKey} />
      <LocalWalletStatus />
      {submitError && <FieldError>{submitError}</FieldError>}
      <Actions>
        <Button
          type="button"
          color="neutral"
          variant="soft"
          disabled={busy}
          onClick={onBack}
        >
          {t('localWallet.actions.back')}
        </Button>
        <Button loading={busy} onClick={onSignIn}>
          {t('localWallet.unlock.submitShort')}
        </Button>
      </Actions>
    </Flex>
  )
}
