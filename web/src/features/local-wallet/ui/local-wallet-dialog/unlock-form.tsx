import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  FieldError,
  LocalWalletPasswordFields,
  type PasswordFormValues,
} from '../local-wallet-fields'
import { LocalWalletStatus } from '../local-wallet-status'

import { Address, Form, LinkButton, Links, MoreLinks } from './styles'

import type { UnlockIntent } from './types'

import { Button, Text } from '@/shared'

/**
 * The returning visitor's screen: the stored address and the password that
 * opens it - to sign in, or to see the key again for a backup.
 */
export const UnlockForm = ({
  address,
  busy,
  submitError,
  autoFocus,
  onImport,
  onForget,
  onSubmit,
  submitLabel,
}: {
  submitLabel: string
  address: string
  busy: boolean
  submitError: string | null
  autoFocus?: boolean
  onImport: () => void
  onForget: () => void
  onSubmit: (values: PasswordFormValues, intent: UnlockIntent) => void
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    defaultValues: { password: '', confirmPassword: '' },
  })

  return (
    <Form onSubmit={handleSubmit((values) => onSubmit(values, 'signIn'))}>
      <Text size="3" color="gray">
        {t('localWallet.unlock.intro')}
      </Text>
      <Address>
        <Text size="1" color="gray">
          {t('localWallet.card.address')}
        </Text>
        <Text size="2" weight="medium" $themeVariant="primary">
          {address}
        </Text>
      </Address>
      <LocalWalletPasswordFields
        register={register}
        errors={errors}
        disabled={busy}
        getPassword={() => getValues('password')}
        confirm={false}
        autoFocus={autoFocus}
      />
      <LocalWalletStatus />
      {submitError && <FieldError>{submitError}</FieldError>}
      <Button type="submit" size="l" stretch loading={busy}>
        {submitLabel}
      </Button>
      <Links>
        {/* There is no password reset: the backup key is the only way back. */}
        <LinkButton type="button" disabled={busy} onClick={onImport}>
          {t('localWallet.unlock.useAnother')}
        </LinkButton>
        <MoreLinks>
          {/* The same password also opens the key for a backup, without
              signing in. */}
          <LinkButton
            type="button"
            disabled={busy}
            onClick={handleSubmit((values) => onSubmit(values, 'reveal'))}
          >
            {t('localWallet.unlock.reveal')}
          </LinkButton>
          <LinkButton
            type="button"
            data-danger
            disabled={busy}
            onClick={onForget}
          >
            {t('localWallet.unlock.forget')}
          </LinkButton>
        </MoreLinks>
      </Links>
    </Form>
  )
}
