import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { exportLocalWalletFx, isLocalWalletError } from '../model'

import {
  FieldError,
  LocalWalletPasswordFields,
  type PasswordFormValues,
} from './local-wallet-fields'
import { LocalWalletKeyReveal } from './local-wallet-key-reveal'
import { LocalWalletStatus } from './local-wallet-status'

import { AdaptiveDialog, Button, DIALOG_WIDTH_STANDARD, Text } from '@/shared'

/**
 * Reveals the private key behind the password. The key is shown, never
 * written anywhere by the app; copying is the user's own step.
 */
export const LocalWalletExportDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const { t } = useTranslation()
  const [privateKey, setPrivateKey] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { exportKey, pending } = useUnit({
    exportKey: exportLocalWalletFx,
    pending: exportLocalWalletFx.pending,
  })

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    defaultValues: { password: '', confirmPassword: '' },
  })

  const close = (next: boolean) => {
    if (!next) {
      // The key must not linger in state once the dialog is gone.
      setPrivateKey(null)
      setSubmitError(null)
      reset()
    }

    onOpenChange(next)
  }

  const onSubmit = async (values: PasswordFormValues) => {
    setSubmitError(null)

    try {
      setPrivateKey(await exportKey({ password: values.password }))
    } catch (error) {
      setSubmitError(
        isLocalWalletError(error) && error.code === 'wrong-password'
          ? t('localWallet.errors.wrongPassword')
          : t('localWallet.errors.generic'),
      )
    }
  }

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={close}
      title={t('localWallet.export.title')}
      desktopWidth={DIALOG_WIDTH_STANDARD}
      desktopShowClose
    >
      <Flex direction="column" gap="4">
        {privateKey ? (
          <>
            <LocalWalletKeyReveal privateKey={privateKey} />
            <Flex justify="end">
              <Button
                color="neutral"
                variant="soft"
                onClick={() => close(false)}
              >
                {t('common.close')}
              </Button>
            </Flex>
          </>
        ) : (
          <Form
            onSubmit={(event) => {
              // Dialogs render in a portal, but React still bubbles the submit to
              // any form the trigger lives in - the profile form, on that page.
              event.stopPropagation()
              void handleSubmit(onSubmit)(event)
            }}
          >
            <Text size="2" color="gray">
              {t('localWallet.export.passwordIntro')}
            </Text>
            <LocalWalletPasswordFields
              register={register}
              errors={errors}
              disabled={pending}
              getPassword={() => getValues('password')}
              confirm={false}
              autoFocus
            />
            <LocalWalletStatus />
            {submitError && <FieldError>{submitError}</FieldError>}
            <Flex justify="end" gap="3">
              <Button
                type="button"
                color="neutral"
                variant="soft"
                disabled={pending}
                onClick={() => close(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={pending}>
                {t('localWallet.export.reveal')}
              </Button>
            </Flex>
          </Form>
        )}
      </Flex>
    </AdaptiveDialog>
  )
}

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`
