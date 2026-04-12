import { Flex, Grid, IconButton, Separator, Text } from '@radix-ui/themes'
import { Controller, type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { RichEditor } from './rich-editor'

import { type CardProps } from '@/features/shared'
import {
  Button,
  Card,
  Input,
  TextArea,
  useLeaveConfirm,
  routes,
  useConfirm,
  showErrorToast,
  useBreakpoints,
} from '@/features/shared'

type FormState = {
  address: string
  username: string
  company: string
  skills: string
  price: string
  bio: string
  facebook: string
  linkedin: string
  telegram: string
}

const inputLabelWidth = '106px'

export const EditProfile = () => {
  const { t } = useTranslation()

  const { isDesktop } = useBreakpoints()
  const { confirm } = useConfirm()

  const {
    register,
    control,
    formState: { isDirty },
    handleSubmit,
    reset,
  } = useForm<FormState>({
    values: {
      address:
        '0x65a9c7e213d4e56f7a82c9b0e1b2c9a3f5b7a8f9b0c1d2e3f4a5b6c7d8e9f0a1',
      username: '',
      company: '',
      skills: '',
      price: '',
      bio: '',
      facebook: '',
      linkedin: '',
      telegram: '',
    },
  })

  const onSubmit: SubmitHandler<FormState> = () => {
    showErrorToast({
      message:
        'Something went wrong. Please check your connection and try again.',
      position: 'top-center',
    })
  }

  const onReset = () => {
    confirm().then(() => reset())
  }

  useLeaveConfirm({ when: isDirty })

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
                  <Link to={routes.profile.schema}>
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
                    disabled={!isDirty}
                  >
                    {t('profile.actions.cancel')}
                  </Button>

                  <Button
                    themeVariant={'primary'}
                    disabled={!isDirty}
                    type={'submit'}
                  >
                    {t('profile.actions.save')}
                  </Button>
                </Flex>
              )}
            </Flex>

            {isDesktop && <Separator size={'4'} mb={'5'} />}

            <Flex direction={'column'} gap={{ initial: '4', md: '5' }}>
              <Input
                label={t('profile.form.address')}
                labelWidth={inputLabelWidth}
                disabled
                id={'address'}
                {...register('address')}
              />

              <Input
                label={t('profile.form.username')}
                placeholder={t('profile.form.usernamePlaceholder')}
                labelWidth={inputLabelWidth}
                id={'username'}
                {...register('username')}
              />

              <Input
                label={t('profile.form.company')}
                placeholder={t('profile.form.companyPlaceholder')}
                labelWidth={inputLabelWidth}
                id={'company'}
                {...register('company')}
              />

              <Input
                label={t('profile.form.skills')}
                placeholder={t('profile.form.skillsPlaceholder')}
                labelWidth={inputLabelWidth}
                id={'skills'}
                {...register('skills')}
              />

              <Separator size={'4'} />

              <Input
                label={t('profile.form.price')}
                placeholder="0"
                labelWidth={inputLabelWidth}
                type={'number'}
                id={'price'}
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
                    render={({ field }) => (
                      <RichEditor
                        value={field.value}
                        onChange={field.onChange}
                        id={'bio'}
                      />
                    )}
                    name={'bio'}
                  />
                </Flex>
              ) : (
                <TextArea label={t('profile.form.bio')} {...register('bio')} />
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
                labelWidth={inputLabelWidth}
                {...register('facebook')}
              />

              <Input
                label={t('profile.links.linkedin')}
                placeholder={'linkedin.com/'}
                labelWidth={inputLabelWidth}
                {...register('linkedin')}
              />

              <Input
                label={t('profile.links.telegram')}
                placeholder={'t.me/'}
                labelWidth={inputLabelWidth}
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
