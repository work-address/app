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
import { Controller, type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { match } from 'ts-pattern'

import { $profile, $profileLoading } from '../model'

import type { baseApi } from '@/shared'

import { saveProfileMutation } from '@/entities/profile'
import { routes } from '@/routes'
import {
  Button,
  Card,
  Input,
  TagInput,
  useLeaveConfirm,
  useConfirm,
  showToast,
  useBreakpoint,
  RichEditor,
  Spinner,
} from '@/shared'
import { type CardProps } from '@/shared'

const INPUT_LABEL_WIDTH = '106px'

const SKILLS_SUGGESTIONS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'UI/UX Design',
  'Figma',
  'Graphic Design',
  'Java',
  'Go',
  'Copywriting',
  'Content Writing',
  'SEO',
  'Vue.js',
  'Angular',
  'Social Media Marketing',
  'Email Marketing',
  'Rust',
  'C++',
  'C#',
  'PHP',
  'Ruby',
  'Swift',
  'Kotlin',
  'Video Editing',
  'Motion Graphics',
  'After Effects',
  'Premiere Pro',
  'Next.js',
  'Express.js',
  'NestJS',
  'Django',
  'FastAPI',
  'Spring Boot',
  'Illustration',
  'Brand Identity',
  'Logo Design',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'GraphQL',
  'REST API',
  'Docker',
  'Kubernetes',
  'AWS',
  'Google Cloud',
  'Azure',
  'GitHub',
  'CI/CD',
  'Unit Testing',
  'WebSockets',
  'Solidity',
  'Web3',
  'Smart Contracts',
  'Project Management',
  'Scrum',
  'Agile',
  'Technical Writing',
  'Data Analysis',
  'Machine Learning',
  'Data Visualization',
  'Excel',
  'Power BI',
  'Tableau',
  'Photoshop',
  'Illustrator',
  'Sketch',
  'WordPress',
  'Shopify',
  'Webflow',
  'Mobile Development',
  'iOS',
  'Android',
  'Flutter',
  'React Native',
  'Game Development',
  'Unity',
  'Unreal Engine',
  '3D Modeling',
  'Blender',
  'Voice Over',
  'Transcription',
  'Translation',
  'Legal Writing',
  'Business Analysis',
  'Financial Modeling',
  'Accounting',
  'Blockchain',
  'NFT',
  'Cybersecurity',
  'Penetration Testing',
  'DevOps',
  'Linux',
  'Networking',
]

type FormState = Pick<
  baseApi.User,
  | 'userName'
  | 'company'
  | 'price'
  | 'bio'
  | 'facebook'
  | 'linkedIn'
  | 'telegram'
> & { skills: string[] }

const normalizeLink = (prefix: string, value: string) =>
  value
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(new RegExp(`^${prefix}`), '')
    .replace(/\/$/, '')
    .replace(/^\//, '')

export const EditProfile = () => {
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
  } = useForm<FormState>({
    values: {
      userName: '',
      company: '',
      skills: [],
      price: '',
      bio: '',
      facebook: '',
      linkedIn: '',
      telegram: '',
    },
  })

  const onSubmit: SubmitHandler<FormState> = async (values) => {
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
    type: 'facebook' | 'linkedIn' | 'telegram',
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')

    const domain = match(type)
      .with('facebook', () => 'facebook.com')
      .with('linkedIn', () => 'linkedin.com')
      .with('telegram', () => 't.me')
      .exhaustive()

    const randomLinkPasted = text.includes('http')
    const notAllowedTextPasted = !text.includes(domain)

    if (notAllowedTextPasted && randomLinkPasted) {
      showToast('error', {
        message: 'Invalid link',
        position: isDesktop ? 'top-center' : 'bottom-center',
      })

      return
    }

    const normalized = normalizeLink(domain, text)
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
        message: 'Profile updated',
        position: 'top-center',
        closeButton: true,
      })

      setIsFormSubmittedSuccessfully(true)
      resetForm()
      resetMutation()
    } else if (status === 'fail') {
      showToast('error', {
        message:
          'Something went wrong. Please check your connection and try again.',
        position: 'top-center',
        closeButton: true,
      })

      resetMutation()
    }
  }, [status, resetMutation, navigate, resetForm])

  useEffect(() => {
    if (user) {
      resetForm({
        userName: user.userName || '',
        company: user.company || '',
        skills: user.skills ? user.skills?.split(',') : [],
        price: user.price || '',
        bio: user.bio || '',
        facebook: user.facebook || '',
        linkedIn: user.linkedIn || '',
        telegram: user.telegram || '',
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
                  <Button
                    themeVariant="secondary"
                    onClick={onReset}
                    disabled={!isDirty || profileSaving}
                    type="button"
                  >
                    {t('profile.actions.cancel')}
                  </Button>

                  <Button
                    themeVariant={'primary'}
                    disabled={!isDirty || profileSaving}
                    type={'submit'}
                  >
                    {profileSaving && <Spinner useCase="button" />}
                    {t('profile.actions.save')}
                  </Button>
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

              <Skeleton loading={profileLoading}>
                <Input
                  label={t('profile.form.username')}
                  placeholder={t('profile.form.usernamePlaceholder')}
                  labelWidth={INPUT_LABEL_WIDTH}
                  id={'username'}
                  disabled={profileSaving}
                  state={errors.userName ? 'error' : undefined}
                  {...register('userName', {
                    required: true,
                  })}
                />
              </Skeleton>

              <Skeleton loading={profileLoading}>
                <Input
                  label={t('profile.form.company')}
                  placeholder={t('profile.form.companyPlaceholder')}
                  labelWidth={INPUT_LABEL_WIDTH}
                  id={'company'}
                  disabled={profileSaving}
                  state={errors.company ? 'error' : undefined}
                  {...register('company', {
                    required: true,
                  })}
                />
              </Skeleton>

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

              <Skeleton loading={profileLoading}>
                <Input
                  addonLeft={
                    <Text size={'2'} color={'gray'}>
                      $
                    </Text>
                  }
                  label={t('profile.form.price')}
                  placeholder="0"
                  labelWidth={INPUT_LABEL_WIDTH}
                  id={'price'}
                  disabled={profileSaving}
                  state={errors.price ? 'error' : undefined}
                  inputMode="decimal"
                  {...register('price', {
                    pattern: /^\d*([,.]\d{1,2})?$/,
                    required: true,
                  })}
                />
              </Skeleton>

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
              <Skeleton loading={profileLoading}>
                <StyledLinkInput
                  label={t('profile.links.facebook')}
                  addonLeft={'facebook.com/'}
                  labelWidth={INPUT_LABEL_WIDTH}
                  onPaste={(e) => handleSocialPaste('facebook', e)}
                  disabled={profileSaving}
                  state={errors.facebook ? 'error' : undefined}
                  {...register('facebook')}
                />
              </Skeleton>

              <Skeleton loading={profileLoading}>
                <StyledLinkInput
                  label={t('profile.links.linkedin')}
                  addonLeft={'linkedin.com/'}
                  labelWidth={INPUT_LABEL_WIDTH}
                  disabled={profileSaving}
                  onPaste={(e) => handleSocialPaste('linkedIn', e)}
                  state={errors.linkedIn ? 'error' : undefined}
                  {...register('linkedIn')}
                />
              </Skeleton>

              <Skeleton loading={profileLoading}>
                <StyledLinkInput
                  label={t('profile.links.telegram')}
                  addonLeft={'t.me/'}
                  labelWidth={INPUT_LABEL_WIDTH}
                  disabled={profileSaving}
                  onPaste={(e) => handleSocialPaste('telegram', e)}
                  state={errors.telegram ? 'error' : undefined}
                  {...register('telegram')}
                />
              </Skeleton>

              {!isDesktop && (
                <BottomSheet columns={'1fr 1fr'} gap={'var(--space-4)'}>
                  <Button
                    themeVariant="secondary"
                    onClick={onReset}
                    disabled={!isDirty}
                    stretch
                  >
                    {t('profile.actions.cancel')}
                  </Button>

                  <Button
                    themeVariant={'primary'}
                    disabled={!isDirty}
                    type={'submit'}
                    stretch
                  >
                    {t('profile.actions.save')}
                  </Button>
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
