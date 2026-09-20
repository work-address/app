import { useUnit } from 'effector-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { publishIdentityFx, withdrawIdentityFx } from '../../model'

import {
  AdaptiveDialog,
  Button,
  DIALOG_WIDTH_STANDARD,
  Input,
  Text,
} from '@/shared'

export type IdentityWalletAction = 'publish' | 'withdraw'

type Props = {
  action: IdentityWalletAction | null
  onOpenChange: (open: boolean) => void
}

type FormValues = { password: string }

/**
 * Both chain actions ask the same thing: the password that unlocks the key in
 * this browser. The key is decrypted, used to sign one transaction and
 * dropped; neither it nor the password ever reaches the API.
 *
 * Nothing here reports success or failure itself - the outcome belongs to the
 * card, which shows exactly one state for it however the action ended.
 */
export const IdentityCardWalletDialog = ({ action, onOpenChange }: Props) => {
  const { t } = useTranslation()

  const { publish, withdraw, publishing, withdrawing } = useUnit({
    publish: publishIdentityFx,
    withdraw: withdrawIdentityFx,
    publishing: publishIdentityFx.pending,
    withdrawing: withdrawIdentityFx.pending,
  })
  const pending = publishing || withdrawing

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { password: '' } })

  const close = (open: boolean) => {
    if (!open) {
      reset()
    }

    onOpenChange(open)
  }

  const onSubmit = async ({ password }: FormValues) => {
    const run = action === 'withdraw' ? withdraw : publish

    try {
      await run({ password })
    } catch {
      // The failure is already an outcome on the card; a thrown effect here
      // would only become an unhandled rejection.
    }

    close(false)
  }

  return (
    <AdaptiveDialog
      open={action !== null}
      onOpenChange={close}
      title={t(
        action === 'withdraw'
          ? 'identity.withdraw.title'
          : 'identity.actions.publish',
      )}
      desktopWidth={DIALOG_WIDTH_STANDARD}
      desktopShowClose
    >
      <Form
        onSubmit={(event) => {
          // The card sits inside the profile form on this page, and a dialog
          // in a portal still bubbles its submit up to it.
          event.stopPropagation()
          void handleSubmit(onSubmit)(event)
        }}
      >
        <Text size="2" color="gray">
          {t(
            action === 'withdraw'
              ? 'identity.withdraw.description'
              : 'identity.permanence.body',
          )}
        </Text>
        <Input
          label={t('localWallet.fields.password')}
          id="identity-wallet-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          columns="1fr"
          size="3"
          disabled={pending}
          state={errors.password ? 'error' : undefined}
          {...register('password', { required: true })}
        />
        <Actions>
          <Button
            color="neutral"
            variant="soft"
            disabled={pending}
            onClick={() => close(false)}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={pending} disabled={pending}>
            {t(
              action === 'withdraw'
                ? 'identity.withdraw.confirm'
                : 'identity.actions.publish',
            )}
          </Button>
        </Actions>
      </Form>
    </AdaptiveDialog>
  )
}

const Form = styled.form`
  display: grid;
  gap: var(--space-4);
`

const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  justify-content: end;
  gap: var(--space-3);
`
