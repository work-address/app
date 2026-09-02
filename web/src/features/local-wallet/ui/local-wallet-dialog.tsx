import { Flex } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  $localWallet,
  createLocalWalletFx,
  importLocalWalletFx,
  isLocalWalletError,
  removeLocalWalletFx,
  signInWithLocalWalletFx,
  unlockLocalWalletFx,
} from '../model'

import {
  Field,
  FieldError,
  LocalWalletPasswordFields,
  type PasswordFormValues,
} from './local-wallet-fields'

import {
  AdaptiveDialog,
  Button,
  DIALOG_WIDTH_STANDARD,
  formatWalletAddress,
  showToast,
  Text,
  TextArea,
  useConfirm,
} from '@/shared'

type Step = 'choose' | 'create' | 'import' | 'unlock'

type ImportFormValues = PasswordFormValues & { privateKey: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The sign-in path for someone with no wallet app.
 *
 * Opens on "unlock" when this browser already holds a wallet, and on the
 * create/import choice when it does not. Every path ends the same way: the
 * unlocked key signs the login nonce and the dialog closes on success.
 */
export const LocalWalletDialog = ({ open, onOpenChange }: Props) => {
  const { t } = useTranslation()
  const { confirm } = useConfirm()

  const { wallet, creating, importing, unlocking, signingIn, remove } = useUnit(
    {
      wallet: $localWallet,
      creating: createLocalWalletFx.pending,
      importing: importLocalWalletFx.pending,
      unlocking: unlockLocalWalletFx.pending,
      signingIn: signInWithLocalWalletFx.pending,
      remove: removeLocalWalletFx,
    },
  )

  const [step, setStep] = useState<Step>(wallet ? 'unlock' : 'choose')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const busy = creating || importing || unlocking || signingIn

  // Each opening starts from the state of the browser, not from wherever the
  // last attempt left off.
  useEffect(() => {
    if (open) {
      setStep(wallet ? 'unlock' : 'choose')
      setSubmitError(null)
    }
  }, [open, wallet])

  const describeError = (error: unknown) => {
    if (isLocalWalletError(error)) {
      if (error.code === 'wrong-password') {
        return t('localWallet.errors.wrongPassword')
      }

      if (error.code === 'invalid-key') {
        return t('localWallet.errors.invalidKey')
      }
    }

    return t('localWallet.errors.generic')
  }

  const finish = async (
    run: () => Promise<Parameters<typeof signInWithLocalWalletFx>[0]>,
    successMessage?: string,
  ) => {
    setSubmitError(null)

    try {
      const unlocked = await run()
      await signInWithLocalWalletFx(unlocked)

      if (successMessage) {
        showToast('info', { message: successMessage, position: 'top-center' })
      }

      onOpenChange(false)
    } catch (error) {
      setSubmitError(describeError(error))
    }
  }

  const handleForget = () => {
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
        setStep('choose')
      })
      .catch(() => {})
  }

  const title = t(
    step === 'create'
      ? 'localWallet.create.title'
      : step === 'import'
        ? 'localWallet.import.title'
        : step === 'unlock'
          ? 'localWallet.unlock.title'
          : 'localWallet.dialog.title',
  )

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          onOpenChange(next)
        }
      }}
      title={title}
      desktopWidth={DIALOG_WIDTH_STANDARD}
      desktopShowClose
    >
      {step === 'choose' && (
        <Flex direction="column" gap="4">
          <Text size="3" color="gray">
            {t('localWallet.choose.intro')}
          </Text>
          <Flex direction="column" gap="2">
            <Button size="l" stretch onClick={() => setStep('create')}>
              {t('localWallet.choose.create')}
            </Button>
            <Button
              size="l"
              stretch
              variant="outline"
              color="neutral"
              onClick={() => setStep('import')}
            >
              {t('localWallet.choose.import')}
            </Button>
          </Flex>
        </Flex>
      )}
      {step === 'create' && (
        <CreateForm
          busy={busy}
          submitError={submitError}
          onBack={() => setStep('choose')}
          onSubmit={(values) =>
            finish(
              async () =>
                (await createLocalWalletFx({ password: values.password }))
                  .wallet,
              t('localWallet.created'),
            )
          }
        />
      )}
      {step === 'import' && (
        <ImportForm
          busy={busy}
          submitError={submitError}
          replacing={wallet?.address}
          onBack={() => setStep(wallet ? 'unlock' : 'choose')}
          onSubmit={(values) =>
            finish(
              async () =>
                (
                  await importLocalWalletFx({
                    privateKey: values.privateKey,
                    password: values.password,
                  })
                ).wallet,
            )
          }
        />
      )}
      {step === 'unlock' && wallet && (
        <UnlockForm
          address={wallet.address}
          busy={busy}
          submitError={submitError}
          onImport={() => setStep('import')}
          onForget={handleForget}
          onSubmit={(values) =>
            finish(() => unlockLocalWalletFx({ password: values.password }))
          }
        />
      )}
    </AdaptiveDialog>
  )
}

type FormProps<T> = {
  busy: boolean
  submitError: string | null
  onSubmit: (values: T) => void
}

const CreateForm = ({
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
    <Form
      onSubmit={(event) => {
        // Dialogs render in a portal, but React still bubbles the submit to
        // any form the trigger lives in - the profile form, on that page.
        event.stopPropagation()
        void handleSubmit(onSubmit)(event)
      }}
    >
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
          {t(
            busy ? 'localWallet.actions.working' : 'localWallet.actions.create',
          )}
        </Button>
      </Actions>
    </Form>
  )
}

const ImportForm = ({
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
    <Form
      onSubmit={(event) => {
        // Dialogs render in a portal, but React still bubbles the submit to
        // any form the trigger lives in - the profile form, on that page.
        event.stopPropagation()
        void handleSubmit(onSubmit)(event)
      }}
    >
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
          {t(
            busy ? 'localWallet.actions.working' : 'localWallet.actions.import',
          )}
        </Button>
      </Actions>
    </Form>
  )
}

const UnlockForm = ({
  address,
  busy,
  submitError,
  onImport,
  onForget,
  onSubmit,
}: FormProps<PasswordFormValues> & {
  address: string
  onImport: () => void
  onForget: () => void
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
    <Form
      onSubmit={(event) => {
        // Dialogs render in a portal, but React still bubbles the submit to
        // any form the trigger lives in - the profile form, on that page.
        event.stopPropagation()
        void handleSubmit(onSubmit)(event)
      }}
    >
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
      {submitError && <FieldError>{submitError}</FieldError>}
      <Button type="submit" size="l" stretch loading={busy}>
        {t('localWallet.unlock.submit')}
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

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);

  ${(p) => p.theme.breakpoints.down('md')} {
    & > * {
      flex: 1;
    }
  }
`

const Notice = styled.div`
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--amber-a3);
  color: var(--amber-11);
  font-size: var(--font-size-2);
  line-height: 1.45;
`

const Address = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-2);
  background: var(--ds-neutral-2);
  overflow-wrap: anywhere;
`

const Links = styled.div`
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
`

const LinkButton = styled.button`
  padding: 0;
  font-size: var(--font-size-2);
  color: var(--ds-accent-11);
  text-decoration: underline;
  text-underline-offset: 2px;

  &[data-danger] {
    color: var(--error-11);
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
    border-radius: 2px;
  }
`
