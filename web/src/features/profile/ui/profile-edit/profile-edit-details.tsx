import { Flex, IconButton, Separator, Skeleton, Text } from '@radix-ui/themes'
import {
  Controller,
  type RegisterOptions,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { SKILLS_SUGGESTIONS, type $profile } from '../../model'

import { ProfileEditActions } from './profile-edit-actions'
import {
  ProfileEditField,
  INPUT_LABEL_WIDTH,
  type ProfileEditFormState,
} from './profile-edit-field'

import { routes } from '@/routes'
import {
  Card,
  Input,
  TagInput,
  Select,
  RichEditor,
  COUNTRY_OPTIONS,
  BASE_CURRENCY,
  Tooltip,
  type CardProps,
} from '@/shared'

const TEXT_FIELDS = [
  {
    name: 'name' as const,
    labelKey: 'profile.form.name',
    placeholderKey: 'profile.form.namePlaceholder',
    rules: {
      required: true,
    } satisfies RegisterOptions<ProfileEditFormState, 'name'>,
  },
  {
    name: 'title' as const,
    labelKey: 'profile.form.title',
    placeholderKey: 'profile.form.titlePlaceholder',
  },
  {
    name: 'company' as const,
    labelKey: 'profile.form.company',
    placeholderKey: 'profile.form.companyPlaceholder',
    rules: {
      required: true,
    } satisfies RegisterOptions<ProfileEditFormState, 'company'>,
  },
]

type Props = {
  user: ReturnType<typeof $profile.getState>
  isDesktop: boolean
  profileLoading: boolean
  isDirty: boolean
  profileSaving: boolean
  onReset: () => void
  register: UseFormRegister<ProfileEditFormState>
  control: Control<ProfileEditFormState>
  errors: FieldErrors<ProfileEditFormState>
}

export const ProfileEditDetails = ({
  user,
  isDesktop,
  profileLoading,
  isDirty,
  profileSaving,
  onReset,
  register,
  control,
  errors,
}: Props) => {
  const { t } = useTranslation()

  return (
    <Root>
      <Flex gap={'4'} mb={'4'} align={'center'} justify={'between'}>
        <Flex gap={'4'} align={'center'}>
          {isDesktop && (
            <Link
              to={
                user?.friendlyWalletAddress
                  ? routes.profile.build({
                      walletAddress: user.friendlyWalletAddress,
                    })
                  : '#'
              }
              viewTransition
            >
              <Tooltip content={t('profile.aria.back')}>
                <IconButton
                  radius={'full'}
                  variant={'ghost'}
                  style={{
                    width: 40,
                    height: 40,
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                  color={'gray'}
                  type={'button'}
                  aria-label={t('profile.aria.back')}
                >
                  ←
                </IconButton>
              </Tooltip>
            </Link>
          )}
          <Text size={isDesktop ? '6' : '4'} weight={'medium'}>
            {t('profile.title')}
          </Text>
        </Flex>
        {isDesktop && (
          <Flex gap={'4'}>
            <ProfileEditActions
              isDirty={isDirty}
              profileSaving={profileSaving}
              onReset={onReset}
            />
          </Flex>
        )}
      </Flex>
      {isDesktop && <Separator size={'4'} mb={'5'} />}
      <Flex direction={'column'} gap={{ initial: '4', md: '5' }}>
        <Skeleton loading={profileLoading}>
          <Input
            label={t('profile.form.address')}
            labelWidth={INPUT_LABEL_WIDTH}
            value={user?.friendlyWalletAddress || ''}
            disabled
            id={'friendlyWalletAddress'}
          />
        </Skeleton>
        {TEXT_FIELDS.map((field) => (
          <ProfileEditField
            key={field.name}
            name={field.name}
            label={t(field.labelKey)}
            placeholder={t(field.placeholderKey)}
            register={register}
            rules={field.rules}
            error={Boolean(errors[field.name])}
            loading={profileLoading}
            disabled={profileSaving}
          />
        ))}
        <ProfileEditField
          name="email"
          label={t('profile.form.email')}
          placeholder={t('profile.form.emailPlaceholder')}
          register={register}
          rules={{
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          }}
          error={Boolean(errors.email)}
          loading={profileLoading}
          disabled={profileSaving}
          inputMode="email"
        />
        <Controller
          control={control}
          name="country"
          render={({ field }) => (
            <Skeleton loading={profileLoading}>
              <Select
                label={t('profile.form.country')}
                placeholder={t('profile.form.countryPlaceholder')}
                options={COUNTRY_OPTIONS}
                value={field.value || ''}
                menuMaxHeight={240}
                onChange={(value) => {
                  if (!Array.isArray(value)) {
                    field.onChange(value)
                  }
                }}
                inputProps={{
                  labelWidth: INPUT_LABEL_WIDTH,
                  columns: {
                    initial: '1',
                    md: `${INPUT_LABEL_WIDTH} 1fr`,
                  },
                  disabled: profileSaving,
                  id: 'country',
                }}
              />
            </Skeleton>
          )}
        />
        <ProfileEditField
          name="city"
          label={t('profile.form.city')}
          placeholder={t('profile.form.cityPlaceholder')}
          register={register}
          error={Boolean(errors.city)}
          loading={profileLoading}
          disabled={profileSaving}
        />
        <Controller
          control={control}
          name="skills"
          rules={{ required: true }}
          render={({ field }) => (
            <TagInput
              label={t('profile.form.skills')}
              placeholder={t('profile.form.skillsPlaceholder')}
              labelWidth={INPUT_LABEL_WIDTH}
              id={'skills'}
              disabled={profileSaving}
              showSkeleton={profileLoading}
              state={errors.skills ? 'error' : undefined}
              suggestions={SKILLS_SUGGESTIONS}
              {...field}
            />
          )}
        />
        <Separator size={'4'} />
        <ProfileEditField
          name="rate"
          label={t('profile.form.rate')}
          placeholder="0"
          register={register}
          rules={{
            pattern: /^\d*([,.]\d{1,2})?$/,
            required: true,
          }}
          error={Boolean(errors.rate)}
          loading={profileLoading}
          disabled={profileSaving}
          inputMode="decimal"
          addonLeft={
            <Text size={'2'} color={'gray'}>
              {BASE_CURRENCY.symbol}
            </Text>
          }
        />
        <Separator size={'4'} />
        <Controller
          control={control}
          render={({ field }) => {
            return (
              <Skeleton loading={profileLoading}>
                <Flex direction={'column'} gap="1">
                  <Text size={'2'} weight={'medium'} mb={'2'}>
                    {t('profile.form.bio')}
                  </Text>
                  <RichEditor
                    value={field.value}
                    onChange={field.onChange}
                    id={'bio'}
                    showEditPanel={isDesktop}
                    disabled={profileSaving}
                  />
                </Flex>
              </Skeleton>
            )
          }}
          name={'bio'}
        />
      </Flex>
    </Root>
  )
}

const Root = styled(Card)<CardProps>`
  box-shadow: none;

  ${(p) => p.theme.breakpoints.down('md')} {
    border: none;
  }
`
