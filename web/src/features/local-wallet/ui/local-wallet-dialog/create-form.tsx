import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  FieldError,
  LocalWalletPasswordFields,
  type PasswordFormValues,
} from '../local-wallet-fields'
import { LocalWalletStatus } from '../local-wallet-status'

import { Actions, Form } from './styles'

import type { FormProps } from './types'

import { Button, Text } from '@/shared'

/** Picks the password the new key is encrypted with. */
export const CreateForm = ({
  busy,
  submitError,
  onBack,
  onSubmit,
}: FormProps<PasswordFormValues> & { onBack: () => void }) => {
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
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Text size="3" color="gray">
        {t('localWallet.create.intro')}
      </Text>
      <LocalWalletPasswordFields
        register={register}
        errors={errors}
        disabled={busy}
        getPassword={() => getValues('password')}
        autoFocus
      />
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
        <Button type="submit" loading={busy}>
          {t('localWallet.actions.create')}
        </Button>
      </Actions>
    </Form>
  )
}
