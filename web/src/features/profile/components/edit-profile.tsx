import { Flex, Grid, IconButton, Separator, Text } from '@radix-ui/themes'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'
import { Controller, type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import type { baseApi } from '@/shared'

import { $user, saveProfileMutation } from '@/entities/profile'
import { routes } from '@/routes'
import {
  Button,
  Card,
  Input,
  TagInput,
  TextArea,
  useLeaveConfirm,
  useConfirm,
  showToast,
  useBreakpoint,
  RichEditor,
  Spinner,
} from '@/shared'
import { type CardProps } from '@/shared'

const INPUT_LABEL_WIDTH = '106px'

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

export const EditProfile = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const isDesktop = useBreakpoint('isDesktop')
  const { confirm } = useConfirm()

  const [isFormSubmittedSuccessfully, setIsFormSubmittedSuccessfully] =
    useState(false)

  const user = useUnit($user)

  const { loading, saveProfile, status, resetMutation } = useUnit({
    loading: saveProfileMutation.$pending,
    saveProfile: saveProfileMutation.start,
    status: saveProfileMutation.$status,
    resetMutation: saveProfileMutation.reset,
  })

  const {
    register,
    control,
    formState: { isDirty },
    handleSubmit,
    reset,
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
      skills: values.skills.join(','),
      // TODO: remove this when backend will be ready
      emailOrPhone: user?.emailOrPhone || '',
    })
  }

  const onReset = () => {
    confirm().then(() => reset())
  }

  useLeaveConfirm({ when: isDirty })

  useEffect(() => {
    if (isFormSubmittedSuccessfully) {
      setIsFormSubmittedSuccessfully(false)
      navigate(
        routes.profile.build({
          walletAddress: user?.friendlyWalletAddress || '',
        }),
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
      reset()
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
  }, [status, resetMutation, navigate, reset])

  useEffect(() => {
    if (user) {
      reset({
        userName: user.userName || '',
        company: user.company || '',
        skills: user.skills?.split(',') || [],
        price: user.price || '',
        bio: user.bio || '',
        facebook: user.facebook || '',
        linkedIn: user.linkedIn || '',
        telegram: user.telegram || '',
      })
    }
  }, [user, reset])

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Wrapper>
        <Grid rows={{ initial: 'auto auto' }} gap={{ initial: '1', md: '5' }}>
          <FreelancerViewCard>
            <Flex
              gap={'var(--space-4)'}
              mb={'4'}
              align={'center'}
              justify={'between'}
            >
              <Flex gap={'var(--space-4)'} align={'center'}>
                {isDesktop && (
                  <Link
                    to={
                      user?.friendlyWalletAddress
                        ? routes.profile.build({
                            walletAddress: user.friendlyWalletAddress,
                          })
                        : '#'
                    }
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
                    disabled={!isDirty || loading}
                    type="button"
                  >
                    {t('profile.actions.cancel')}
                  </Button>

                  <Button
                    themeVariant={'primary'}
                    disabled={!isDirty || loading}
                    type={'submit'}
                  >
                    {loading && <Spinner useCase="button" />}
                    {t('profile.actions.save')}
                  </Button>
                </Flex>
              )}
            </Flex>

            {isDesktop && <Separator size={'4'} mb={'5'} />}

            <Flex direction={'column'} gap={{ initial: '4', md: '5' }}>
              <Input
                label={t('profile.form.address')}
                labelWidth={INPUT_LABEL_WIDTH}
                value={user.friendlyWalletAddress || ''}
                disabled
                id={'friendlyWalletAddress'}
              />

              <Input
                label={t('profile.form.username')}
                placeholder={t('profile.form.usernamePlaceholder')}
                labelWidth={INPUT_LABEL_WIDTH}
                id={'username'}
                disabled={loading}
                {...register('userName')}
              />

              <Input
                label={t('profile.form.company')}
                placeholder={t('profile.form.companyPlaceholder')}
                labelWidth={INPUT_LABEL_WIDTH}
                id={'company'}
                disabled={loading}
                {...register('company')}
              />

              <Controller
                control={control}
                name="skills"
                render={({ field }) => (
                  <TagInput
                    label={t('profile.form.skills')}
                    placeholder={t('profile.form.skillsPlaceholder')}
                    labelWidth={INPUT_LABEL_WIDTH}
                    id={'skills'}
                    disabled={loading}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <Separator size={'4'} />

              <Input
                label={t('profile.form.price')}
                placeholder="0"
                labelWidth={INPUT_LABEL_WIDTH}
                id={'price'}
                disabled={loading}
                addonLeft={
                  <Text size={'2'} color={'gray'}>
                    $
                  </Text>
                }
                {...register('price')}
              />

              <Separator size={'4'} />

              {isDesktop ? (
                <Flex direction={'column'} gap={'3'}>
                  <Text
                    size={'2'}
                    weight={'medium'}
                    as={'label'}
                    htmlFor={'bio'}
                  >
                    {t('profile.form.bio')}
                  </Text>

                  <Controller
                    control={control}
                    render={({ field }) => {
                      return (
                        <RichEditor
                          value={field.value}
                          onChange={field.onChange}
                          id={'bio'}
                        />
                      )
                    }}
                    name={'bio'}
                  />
                </Flex>
              ) : (
                <TextArea
                  label={t('profile.form.bio')}
                  id={'bio'}
                  placeholder={t('profile.form.bioPlaceholder')}
                  {...register('bio')}
                />
              )}
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
              <Input
                label={t('profile.links.facebook')}
                placeholder={'facebook.com/'}
                labelWidth={INPUT_LABEL_WIDTH}
                disabled={loading}
                {...register('facebook')}
              />

              <Input
                label={t('profile.links.linkedin')}
                placeholder={'linkedin.com/'}
                labelWidth={INPUT_LABEL_WIDTH}
                disabled={loading}
                {...register('linkedIn')}
              />

              <Input
                label={t('profile.links.telegram')}
                placeholder={'t.me/'}
                labelWidth={INPUT_LABEL_WIDTH}
                disabled={loading}
                {...register('telegram')}
              />

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
