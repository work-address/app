import {
  Flex,
  Grid,
  IconButton,
  Separator,
  Skeleton,
  Text,
} from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import React, { useEffect, useState } from 'react'
import {
  Controller,
  type RegisterOptions,
  type SubmitHandler,
  useForm,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { $profile, $profileLoading } from '../../model'
import {
  containsHost,
  normalizeLink,
  SKILLS_SUGGESTIONS,
  SOCIAL_DOMAIN_BY_FIELD,
  SOCIAL_LINKS,
  type SocialLinkField,
} from '../../model/profile-field'

import { ProfileEditActions } from './profile-edit-actions'
import {
  ProfileEditField,
  INPUT_LABEL_WIDTH,
  type ProfileEditFormState,
} from './profile-edit-field'

import { saveProfileMutation } from '@/entities/profile'
import { routes } from '@/routes'
import {
  Card,
  Input,
  TagInput,
  Select,
  useLeaveConfirm,
  useConfirm,
  showToast,
  useBreakpoint,
  RichEditor,
  COUNTRY_OPTIONS,
} from '@/shared'
import { type CardProps } from '@/shared'

const EMPTY_FORM_VALUES: ProfileEditFormState = {
  name: '',
  title: '',
  company: '',
  skills: [],
  rate: '',
  bio: '',
  facebook: '',
  linkedIn: '',
  telegram: '',
  twitter: '',
  instagram: '',
  youtube: '',
  city: '',
  country: '',
}

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

export const ProfileEdit = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const isDesktop = useBreakpoint('isDesktop')
  const { confirm } = useConfirm()

  const [isFormSubmittedSuccessfully, setIsFormSubmittedSuccessfully] =
    useState(false)

  const user = useUnit($profile)

  const { profileSaving, profileLoading, saveProfile, status, resetMutation } =
    useUnit({
      profileSaving: saveProfileMutation.$pending,
      profileLoading: $profileLoading,
      saveProfile: saveProfileMutation.start,
      status: saveProfileMutation.$status,
      resetMutation: saveProfileMutation.reset,
    })

  const {
    register,
    control,
    formState: { isDirty, errors },
    handleSubmit,
    reset: resetForm,
    setValue,
  } = useForm<ProfileEditFormState>({
    values: EMPTY_FORM_VALUES,
  })

  const onSubmit: SubmitHandler<ProfileEditFormState> = async (values) => {
    saveProfile({
      ...values,
      skills: values.skills.join(',') || '',
      // TODO: remove this when backend will be ready
      emailOrPhone: user?.emailOrPhone || '',
    })
  }

  const onReset = () => {
    confirm().then(() => resetForm())
  }

  const handleSocialPaste = (
    type: SocialLinkField,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const domain = SOCIAL_DOMAIN_BY_FIELD[type]

    const isXDomain = type === 'twitter' && containsHost(text, 'x.com')
    const randomLinkPasted = text.includes('http')
    const allowedDomain = containsHost(text, domain) || isXDomain
    const notAllowedTextPasted = !allowedDomain

    if (notAllowedTextPasted && randomLinkPasted) {
      showToast('error', {
        message: 'Invalid link',
        position: isDesktop ? 'top-center' : 'bottom-center',
      })

      return
    }

    const prefix = isXDomain ? 'x.com' : domain
    const normalized = normalizeLink(prefix, text)
    setValue(type, normalized, { shouldDirty: true, shouldValidate: true })
  }

  useLeaveConfirm({ when: isDirty })

  useEffect(() => {
    if (isFormSubmittedSuccessfully) {
      setIsFormSubmittedSuccessfully(false)

      navigate(
        routes.profile.build({
          walletAddress: user?.friendlyWalletAddress || '',
        }),
        { viewTransition: true },
      )
    }
  }, [isFormSubmittedSuccessfully, navigate, user?.friendlyWalletAddress])

  useEffect(() => {
    if (status === 'done') {
      showToast('info', {
        message: t('profile.form.edit.success'),
        position: 'top-center',
        closeButton: true,
      })

      setIsFormSubmittedSuccessfully(true)
      resetForm()
      resetMutation()
    } else if (status === 'fail') {
      showToast('error', {
        message: t('profile.form.edit.error'),
        position: 'top-center',
        closeButton: true,
      })

      resetMutation()
    }
  }, [status, resetMutation, navigate, resetForm, t])

  useEffect(() => {
    if (user) {
      resetForm({
        name: user.name ?? user.title ?? '',
        title: user.name ? (user.title ?? '') : '',
        company: user.company || '',
        skills: user.skills ? user.skills?.split(',') : [],
        rate: user.rate || '',
        bio: user.bio || '',
        facebook: user.facebook || '',
        linkedIn: user.linkedIn || '',
        telegram: user.telegram || '',
        twitter: user.twitter || '',
        instagram: user.instagram || '',
        youtube: user.youtube || '',
        city: user.city || '',
        country: user.country || '',
      })
    }
  }, [user, resetForm])

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Wrapper>
        <Grid rows={{ initial: 'auto auto' }} gap={{ initial: '1', md: '5' }}>
          <FreelancerViewCard>
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
                    >
                      ←
                    </IconButton>
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
                    $
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
          </FreelancerViewCard>
          <FreelancerViewCard style={{ paddingTop: isDesktop ? undefined : 0 }}>
            <Text
              size={isDesktop ? '6' : '4'}
              weight={'medium'}
              mb={{ initial: '3', md: '5' }}
            >
              {t('profile.links.title')}
            </Text>
            <Grid gap={{ initial: '4', md: '5' }}>
              {SOCIAL_LINKS.map(({ name, labelKey, domain }) => (
                <Skeleton key={name} loading={profileLoading}>
                  <StyledLinkInput
                    label={t(labelKey)}
                    addonLeft={`${domain}/`}
                    labelWidth={INPUT_LABEL_WIDTH}
                    disabled={profileSaving}
                    onPaste={(e) => handleSocialPaste(name, e)}
                    state={errors[name] ? 'error' : undefined}
                    {...register(name)}
                  />
                </Skeleton>
              ))}
              {!isDesktop && (
                <BottomSheet columns={'1fr 1fr'} gap={'var(--space-4)'}>
                  <ProfileEditActions
                    isDirty={isDirty}
                    profileSaving={profileSaving}
                    onReset={onReset}
                    stretch
                  />
                </BottomSheet>
              )}
            </Grid>
          </FreelancerViewCard>
        </Grid>
      </Wrapper>
    </form>
  )
}

const Wrapper = styled.div`
  padding-bottom: 50px;

  ${(p) => p.theme.breakpoints.up('md')} {
    max-width: 710px;
    margin: 0 auto;
    padding: 26px 28px 40px;
  }
`

const FreelancerViewCard = styled(Card)<CardProps>`
  box-shadow: none;

  ${(p) => p.theme.breakpoints.down('md')} {
    border: none;
  }
`

const BottomSheet = styled(Grid)`
  position: fixed;
  padding: var(--space-2) var(--space-5) 14px;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  border-top: 1px solid var(--ds-neutral-alpha-6);
`

const StyledLinkInput = styled(Input)`
  [data-side='left'] {
    padding-right: 0;
  }
`
