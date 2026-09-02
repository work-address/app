import { EyeOpenIcon } from '@radix-ui/react-icons'
import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $localWallet,
  exportLocalWalletFx,
  isLocalWalletError,
  removeLocalWalletFx,
} from '../model'

import {
  FieldError,
  LocalWalletPasswordFields,
  type PasswordFormValues,
} from './local-wallet-fields'
import { LocalWalletKeyReveal } from './local-wallet-key-reveal'
import { LocalWalletStatus } from './local-wallet-status'

import { $user } from '@/entities/profile'
import {
  AdaptiveDialog,
  Button,
  Card,
  DIALOG_WIDTH_STANDARD,
  normalizeAddress,
  showToast,
  Text,
  useConfirm,
  type CardProps,
} from '@/shared'

/**
 * The wallet this browser holds, on the profile page: where it is, what it
 * is, and the two things a person may need to do with it - back the key up,
 * or get rid of it.
 */
export const LocalWalletCard = () => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()
  const [exportOpen, setExportOpen] = useState(false)

  const { wallet, user, remove } = useUnit({
    wallet: $localWallet,
    user: $user,
    remove: removeLocalWalletFx,
  })

  if (!wallet) {
    return null
  }

  const isCurrentAccount =
    Boolean(user?.address) &&
    normalizeAddress(user?.address ?? '') === normalizeAddress(wallet.address)

  const handleRemove = () => {
    confirm({
      title: t('localWallet.remove.title'),
      description: t('localWallet.remove.description'),
      confirmLabel: t('localWallet.remove.confirm'),
      cancelLabel: t('common.cancel'),
    })
      .then(() => {
        remove()
        showToast('info', {
          message: t('localWallet.removed'),
          position: 'top-center',
        })
      })
      .catch(() => {})
  }

  return (
    <Root shadow={false}>
      <Flex direction="column" gap="3">
        <Text size="6" weight="medium">
          {t('localWallet.card.title')}
        </Text>
        <Text size="2" color="gray">
          {t('localWallet.card.description')}
        </Text>
        <AddressBox>
          <Text size="1" color="gray">
            {t('localWallet.card.address')}
          </Text>
          <Text size="2" weight="medium" $themeVariant="primary">
            {wallet.address}
          </Text>
          {!isCurrentAccount && (
            <Text size="1" color="amber">
              {t('localWallet.card.mismatch')}
            </Text>
          )}
        </AddressBox>
        <Actions>
          <Button
            variant="outline"
            color="neutral"
            iconLeft={<EyeOpenIcon />}
            onClick={() => setExportOpen(true)}
          >
            {t('localWallet.card.export')}
          </Button>
          <Button variant="outline" color="danger" onClick={handleRemove}>
            {t('localWallet.card.remove')}
          </Button>
        </Actions>
      </Flex>
      <LocalWalletExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </Root>
  )
}

/**
 * Reveals the private key behind the password. The key is shown, never
 * written anywhere by the app; copying is the user's own step.
 */
const LocalWalletExportDialog = ({
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

const Root = styled(Card)<CardProps>`
  box-shadow: none;

  ${(p) => p.theme.breakpoints.down('md')} {
    border: none;
  }
`

const AddressBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
  overflow-wrap: anywhere;
`

const Actions = styled.div`
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`
