import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  FieldError,
  LocalWalletPasswordFields,
  type PasswordFormValues,
} from '../local-wallet-fields'
import { LocalWalletStatus } from '../local-wallet-status'

import { Address, Form, LinkButton, Links } from './styles'

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
  onImport,
  onForget,
  onSubmit,
}: {
  address: string
  busy: boolean
  submitError: string | null
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
        autoFocus
      />
      <LocalWalletStatus />
      {submitError && <FieldError>{submitError}</FieldError>}
      <Button type="submit" size="l" stretch loading={busy}>
        {t('localWallet.unlock.submit')}
      </Button>
      {/* The same password also opens the key for a backup, without signing in. */}
      <Button
        type="button"
        size="l"
        stretch
        variant="outline"
        color="neutral"
        disabled={busy}
        onClick={handleSubmit((values) => onSubmit(values, 'reveal'))}
      >
        {t('localWallet.unlock.reveal')}
      </Button>
      <Links>
        <LinkButton type="button" disabled={busy} onClick={onImport}>
          {t('localWallet.unlock.useAnother')}
        </LinkButton>
        <LinkButton
          type="button"
          data-danger
          disabled={busy}
          onClick={onForget}
        >
          {t('localWallet.unlock.forget')}
        </LinkButton>
      </Links>
    </Form>
  )
}
