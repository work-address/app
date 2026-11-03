import type { PasswordFormValues } from '../local-wallet-fields'

export type Step =
  | 'choose'
  | 'create'
  | 'backup'
  | 'import'
  | 'unlock'
  | 'reveal'

export type ImportFormValues = PasswordFormValues & { privateKey: string }

export type UnlockIntent = 'signIn' | 'reveal'

export type FormProps<T> = {
  submitLabel: string
  busy: boolean
  submitError: string | null
  autoFocus?: boolean
  onSubmit: (values: T) => void
}
