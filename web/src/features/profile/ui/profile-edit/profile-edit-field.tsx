import { Skeleton } from '@radix-ui/themes'
import React from 'react'
import {
  type FieldPath,
  type RegisterOptions,
  type UseFormRegister,
} from 'react-hook-form'

import { Input, type baseApi } from '@/shared'

export const INPUT_LABEL_WIDTH = '106px'

export type ProfileEditFormState = Pick<
  baseApi.User,
  | 'name'
  | 'email'
  | 'title'
  | 'company'
  | 'rate'
  | 'bio'
  | 'facebook'
  | 'linkedIn'
  | 'telegram'
  | 'twitter'
  | 'instagram'
  | 'youtube'
  | 'city'
  | 'country'
> & { skills: string[] }

type ProfileEditFieldProps<T extends FieldPath<ProfileEditFormState>> = {
  label: string
  placeholder?: string
  name: T
  register: UseFormRegister<ProfileEditFormState>
  rules?: RegisterOptions<ProfileEditFormState, T>
  error?: boolean
  loading: boolean
  disabled: boolean
  addonLeft?: React.ReactNode
  inputMode?: React.ComponentProps<typeof Input>['inputMode']
}

export const ProfileEditField = <T extends FieldPath<ProfileEditFormState>>({
  label,
  placeholder,
  name,
  register,
  rules,
  error,
  loading,
  disabled,
  addonLeft,
  inputMode,
}: ProfileEditFieldProps<T>) => (
  <Skeleton loading={loading}>
    <Input
      label={label}
      placeholder={placeholder}
      labelWidth={INPUT_LABEL_WIDTH}
      id={name}
      disabled={disabled}
      state={error ? 'error' : undefined}
      addonLeft={addonLeft}
      inputMode={inputMode}
      {...register(name, rules)}
    />
  </Skeleton>
)
