import { Flex, Grid, IconButton, Separator, Text } from '@radix-ui/themes'
import { Controller, type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { RichEditor } from '../rich-editor.tsx'

import { Button, Card, Input } from '@/features/shared'

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

export const Desktop = () => {
  const { t } = useTranslation()

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
        <Grid rows={{ initial: 'auto auto' }} gap={'var(--space-5)'}>
          <FreelancerViewCard>
            <Flex direction={'column'} gap={'var(--space-5)'}>
              <Flex justify={'between'}>
                <Flex gap={'var(--space-4)'} align={'center'}>
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
                  >
                    ←
                  </IconButton>
                  <Text size={'6'} weight={'medium'}>
                    {t('profile.title')}
                  </Text>
                </Flex>

                <Flex align={'center'} gap={'var(--space-4)'}>
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
              </Flex>

              <Separator size={'4'} />

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

              <Flex direction={'column'} gap={'var(--space-3)'}>
                <Text size={'2'} weight={'medium'}>
                  Bio
                </Text>

                <Controller
                  control={control}
                  render={({ field }) => (
                    <RichEditor value={field.value} onChange={field.onChange} />
                  )}
                  name={'bio'}
                />
              </Flex>
            </Flex>
          </FreelancerViewCard>

          <FreelancerViewCard>
            <Grid gap={'var(--space-5)'}>
              <Text size={'6'} weight={'medium'}>
                {t('profile.links.title')}
              </Text>

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
            </Grid>
          </FreelancerViewCard>
        </Grid>
      </Wrapper>
    </form>
  )
}

const Wrapper = styled.div`
  max-width: 710px;
  margin: 0 auto;
  padding: 26px 28px 40px;
`

const FreelancerViewCard = styled(Card)`
  box-shadow: none;
`
