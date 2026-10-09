import { Flex, Separator, Skeleton, Text } from '@radix-ui/themes'
import { useMemo } from 'react'
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SKILLS_SUGGESTIONS, type $profile } from '../../model'

import {
  ProfileEditField,
  INPUT_LABEL_WIDTH,
  type ProfileEditFormState,
} from './profile-edit-field'
import { SectionHeading } from './profile-edit-styles'

import {
  Card,
  Input,
  TagInput,
  Select,
  RichEditor,
  getCountryOptions,
  BASE_CURRENCY,
  type CardProps,
} from '@/shared'

// Every profile field is optional on the API - `PUT /user` validates only the
// email and phone constraints - so nothing here may be marked required. A form
// requirement the backend does not have just locks the user out of saving.
const TEXT_FIELDS = [
  {
    name: 'name' as const,
    labelKey: 'profile.form.name',
    placeholderKey: 'profile.form.namePlaceholder',
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
  },
]

type Props = {
  user: ReturnType<typeof $profile.getState>
  isDesktop: boolean
  profileLoading: boolean
  profileSaving: boolean
  register: UseFormRegister<ProfileEditFormState>
  control: Control<ProfileEditFormState>
  errors: FieldErrors<ProfileEditFormState>
}

export const ProfileEditDetails = ({
  user,
  isDesktop,
  profileLoading,
  profileSaving,
  register,
  control,
  errors,
}: Props) => {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const countryOptions = useMemo(() => getCountryOptions(language), [language])

  return (
    <Root>
      <SectionHeading>{t('profile.form.detailsTitle')}</SectionHeading>
      <Fields>
        <Cell data-span="full">
          <Skeleton loading={profileLoading}>
            <Input
              label={t('profile.form.address')}
              labelWidth={INPUT_LABEL_WIDTH}
              value={user?.friendlyWalletAddress || ''}
              disabled
              id={'friendlyWalletAddress'}
            />
          </Skeleton>
        </Cell>
        {TEXT_FIELDS.map((field) => (
          <Cell key={field.name}>
            <ProfileEditField
              name={field.name}
              label={t(field.labelKey)}
              placeholder={t(field.placeholderKey)}
              register={register}
              error={Boolean(errors[field.name])}
              loading={profileLoading}
              disabled={profileSaving}
            />
          </Cell>
        ))}
        <Cell>
          <ProfileEditField
            name="email"
            label={t('profile.form.email')}
            placeholder={t('profile.form.emailPlaceholder')}
            register={register}
            rules={{
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t('profile.form.errors.email'),
              },
            }}
            error={Boolean(errors.email)}
            errorMessage={errors.email?.message}
            loading={profileLoading}
            disabled={profileSaving}
            inputMode="email"
          />
        </Cell>
        <Cell>
          <Controller
            control={control}
            name="country"
            render={({ field }) => (
              <Skeleton loading={profileLoading}>
                <Select
                  label={t('profile.form.country')}
                  placeholder={t('profile.form.countryPlaceholder')}
                  options={countryOptions}
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
        </Cell>
        <Cell>
          <ProfileEditField
            name="city"
            label={t('profile.form.city')}
            placeholder={t('profile.form.cityPlaceholder')}
            register={register}
            error={Boolean(errors.city)}
            loading={profileLoading}
            disabled={profileSaving}
          />
        </Cell>
        <Cell data-span="full">
          <Controller
            control={control}
            name="skills"
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
        </Cell>
        <Cell data-span="full">
          <Separator size={'4'} />
        </Cell>
        <Cell>
          <ProfileEditField
            name="rate"
            label={t('profile.form.rate')}
            placeholder="0"
            register={register}
            rules={{
              pattern: {
                value: /^\d*([,.]\d{1,2})?$/,
                message: t('profile.form.errors.rate'),
              },
            }}
            error={Boolean(errors.rate)}
            errorMessage={errors.rate?.message}
            loading={profileLoading}
            disabled={profileSaving}
            inputMode="decimal"
            addonLeft={
              <Text size={'2'} color={'gray'}>
                {BASE_CURRENCY.symbol}
              </Text>
            }
          />
        </Cell>
        <Cell data-span="full">
          <Separator size={'4'} />
        </Cell>
        <Cell data-span="full">
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
        </Cell>
      </Fields>
    </Root>
  )
}

const Root = styled(Card)<CardProps>`
  box-shadow: none;
  display: grid;
  gap: var(--space-5);

  /* See profile-edit-links.tsx: the shadow has to be switched off through
     the same attribute selector Card turns it on with. */
  ${(p) => p.theme.breakpoints.down('md')} {
    border: none;
    /* The page already insets by the phone gutter; a second inset inside
       an invisible card would push the fields in twice. */
    padding: 0 0 var(--space-5);

    &[data-shadow] {
      box-shadow: none;
    }
  }
`

/* One column until there is room for two: name beside title, company beside
   email, country beside city. The long fields - address, skills, bio - span
   both. Halves the height of the form without shrinking any field below a
   comfortable width. */
const Fields = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4) var(--space-6);

  ${(p) => p.theme.breakpoints.up('lg')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-5) var(--space-6);
  }
`

const Cell = styled.div`
  min-width: 0;

  &[data-span='full'] {
    grid-column: 1 / -1;
  }
`
