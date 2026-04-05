import { Flex, Grid, IconButton, Separator, Text } from '@radix-ui/themes'
import { Controller, type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMediaQuery } from 'styled-breakpoints/use-media-query'
import styled, { useTheme } from 'styled-components'

import { RichEditor } from './rich-editor'

import type { CardProps } from '@/features/shared'

import { Button, Card, Input, TextArea } from '@/features/shared'

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

export const FreelancerProfile = () => {
  const { t } = useTranslation()

  const { breakpoints } = useTheme()
  const isUpMd = useMediaQuery(breakpoints.up('md'))

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

  const onSubmit: SubmitHandler<FormState> = (data) => {
    alert(
      Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n'),
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Wrapper>
        <Grid
          rows={{ initial: 'auto auto' }}
          gap={isUpMd ? 'var(--space-5)' : 'var(--space-1)'}
        >
          <FreelancerViewCard>
            <Flex
              gap={'var(--space-4)'}
              mb={'4'}
              align={'center'}
              justify={'between'}
            >
              <Flex gap={'var(--space-4)'} align={'center'}>
                {isUpMd && (
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
                )}

                <Text size={isUpMd ? '6' : '4'} weight={'medium'}>
                  {t('profile.title')}
                </Text>
              </Flex>

              {isUpMd && (
                <Flex gap={'var(--space-4)'}>
                  <Button
                    themeVariant="secondary"
                    onClick={() => reset()}
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

            {isUpMd && <Separator size={'4'} mb={'5'} />}

            <Flex direction={'column'} gap={'var(--space-5)'}>
              <Input
                label={t('profile.form.address')}
                labelWidth={inputLabelWidth}
                disabled
                {...register('address')}
              />

              <Input
                label={t('profile.form.username')}
                placeholder={t('profile.form.usernamePlaceholder')}
                labelWidth={inputLabelWidth}
                {...register('username')}
              />

              <Input
                label={t('profile.form.company')}
                placeholder={t('profile.form.companyPlaceholder')}
                labelWidth={inputLabelWidth}
                {...register('company')}
              />

              <Input
                label={t('profile.form.skills')}
                placeholder={t('profile.form.skillsPlaceholder')}
                labelWidth={inputLabelWidth}
                {...register('skills')}
              />

              <Separator size={'4'} />

              <Input
                label={t('profile.form.price')}
                placeholder="0"
                labelWidth={inputLabelWidth}
                type={'number'}
                addonLeft={
                  <Text size={'2'} color={'gray'}>
                    $
                  </Text>
                }
                {...register('price')}
              />

              <Separator size={'4'} />

              {isUpMd ? (
                <Flex direction={'column'} gap={'var(--space-3)'}>
                  <Text size={'2'} weight={'medium'}>
                    {t('profile.form.bio')}
                  </Text>

                  <Controller
                    control={control}
                    render={({ field }) => (
                      <RichEditor
                        value={field.value}
                        onChange={field.onChange}
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

          <FreelancerViewCard style={{ paddingTop: isUpMd ? undefined : 0 }}>
            <Text
              size={isUpMd ? '6' : '4'}
              weight={'medium'}
              mb={isUpMd ? '5' : '3'}
            >
              {t('profile.links.title')}
            </Text>

            <Grid gap={'var(--space-5)'}>
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

              {!isUpMd && (
                <Grid columns={'1fr 1fr'} gap={'var(--space-4)'}>
                  <Button
                    themeVariant="secondary"
                    onClick={() => reset()}
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
                </Grid>
              )}
            </Grid>
          </FreelancerViewCard>
        </Grid>
      </Wrapper>
    </form>
  )
}

const Wrapper = styled.div`
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
