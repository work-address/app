import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { LOCAL_WALLET_MIN_PASSWORD_LENGTH } from '../model'

import type { FieldErrors, FieldPath, UseFormRegister } from 'react-hook-form'

import { Input, Text } from '@/shared'

export type PasswordFormValues = {
  password: string
  confirmPassword: string
}

type Props<T extends PasswordFormValues> = {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  disabled: boolean
  getPassword: () => string
  /** A new password is confirmed; unlocking an existing one is not. */
  confirm?: boolean
  autoFocus?: boolean
}

/**
 * The password pair every wallet form shares, with the two rules that matter:
 * long enough, and typed the same twice.
 */
export const LocalWalletPasswordFields = <T extends PasswordFormValues>({
  register,
  errors,
  disabled,
  getPassword,
  confirm = true,
  autoFocus,
}: Props<T>) => {
  const { t } = useTranslation()
  const passwordName = 'password' as FieldPath<T>
  const confirmName = 'confirmPassword' as FieldPath<T>
  const passwordError = errors.password?.message as string | undefined
  const confirmError = errors.confirmPassword?.message as string | undefined

  return (
    <>
      <Field>
        <Input
          label={t('localWallet.fields.password')}
          id="local-wallet-password"
          type="password"
          autoComplete={confirm ? 'new-password' : 'current-password'}
          autoFocus={autoFocus}
          placeholder={
            confirm
              ? t('localWallet.fields.passwordPlaceholder', {
                  count: LOCAL_WALLET_MIN_PASSWORD_LENGTH,
                })
              : undefined
          }
          columns="1fr"
          size="3"
          disabled={disabled}
          state={passwordError ? 'error' : undefined}
          {...register(passwordName, {
            required: t('localWallet.errors.passwordShort', {
              count: LOCAL_WALLET_MIN_PASSWORD_LENGTH,
            }),
            ...(confirm
              ? {
                  minLength: {
                    value: LOCAL_WALLET_MIN_PASSWORD_LENGTH,
                    message: t('localWallet.errors.passwordShort', {
                      count: LOCAL_WALLET_MIN_PASSWORD_LENGTH,
                    }),
                  },
                }
              : {}),
          })}
        />
        {passwordError && <FieldError>{passwordError}</FieldError>}
      </Field>
      {confirm && (
        <Field>
          <Input
            label={t('localWallet.fields.confirmPassword')}
            id="local-wallet-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder={t('localWallet.fields.confirmPasswordPlaceholder')}
            columns="1fr"
            size="3"
            disabled={disabled}
            state={confirmError ? 'error' : undefined}
            {...register(confirmName, {
              validate: (value) =>
                value === getPassword() ||
                t('localWallet.errors.passwordMismatch'),
            })}
          />
          {confirmError && <FieldError>{confirmError}</FieldError>}
        </Field>
      )}
    </>
  )
}

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
`

export const FieldError = ({ children }: { children: string }) => (
  <Text size="1" color="red" role="alert">
    {children}
  </Text>
)
