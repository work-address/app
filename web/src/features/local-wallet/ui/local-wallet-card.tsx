import { CopyIcon, EyeOpenIcon } from '@radix-ui/react-icons'
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

import { $user } from '@/entities/profile'
import {
  AdaptiveDialog,
  Button,
  Card,
  copyToClipboard,
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

  const handleCopy = () => {
    if (!privateKey) {
      return
    }

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
    <AdaptiveDialog
      open={open}
      onOpenChange={close}
      title={t('localWallet.export.title')}
      desktopWidth={DIALOG_WIDTH_STANDARD}
      desktopShowClose
    >
      <Flex direction="column" gap="4">
        <Warning>{t('localWallet.export.intro')}</Warning>
        {privateKey ? (
          <>
            <KeyBox>{privateKey}</KeyBox>
            <Flex justify="end" gap="3">
              <Button
                color="neutral"
                variant="soft"
                onClick={() => close(false)}
              >
                {t('common.close')}
              </Button>
              <Button iconLeft={<CopyIcon />} onClick={handleCopy}>
                {t('localWallet.export.copy')}
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
            <LocalWalletPasswordFields
              register={register}
              errors={errors}
              disabled={pending}
              getPassword={() => getValues('password')}
              confirm={false}
              autoFocus
            />
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

const Warning = styled.div`
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
