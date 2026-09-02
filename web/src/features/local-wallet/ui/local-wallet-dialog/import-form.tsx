import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  Field,
  FieldError,
  LocalWalletPasswordFields,
} from '../local-wallet-fields'
import { LocalWalletStatus } from '../local-wallet-status'

import { Actions, Form, Notice } from './styles'

import type { FormProps, ImportFormValues } from './types'

import { Button, formatWalletAddress, Text, TextArea } from '@/shared'

/** Brings an existing Ethereum key into this browser, behind a new password. */
export const ImportForm = ({
  busy,
  submitError,
  replacing,
  onBack,
  onSubmit,
}: FormProps<ImportFormValues> & {
  replacing?: string
  onBack: () => void
}) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ImportFormValues>({
    defaultValues: { privateKey: '', password: '', confirmPassword: '' },
  })

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Text size="3" color="gray">
        {t('localWallet.import.intro')}
      </Text>
      {replacing && (
        <Notice>
          {t('localWallet.import.replaceWarning', {
            address: formatWalletAddress(replacing),
          })}
        </Notice>
      )}
      <Field>
        <TextArea
          label={t('localWallet.fields.privateKey')}
          id="local-wallet-private-key"
          placeholder={t('localWallet.fields.privateKeyPlaceholder')}
          rows={2}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          state={errors.privateKey ? 'error' : undefined}
          {...register('privateKey', {
            required: t('localWallet.errors.invalidKey'),
          })}
        />
        {errors.privateKey?.message && (
          <FieldError>{errors.privateKey.message}</FieldError>
        )}
      </Field>
      <LocalWalletPasswordFields
        register={register}
        errors={errors}
        disabled={busy}
        getPassword={() => getValues('password')}
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
          {t('localWallet.actions.import')}
        </Button>
      </Actions>
    </Form>
  )
}
