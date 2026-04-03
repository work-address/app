import { Flex, Grid, IconButton, Separator, Text } from '@radix-ui/themes'
import { useMemo, useState } from 'react'
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

const initialState: FormState = {
  address: '0x65a9c7e213d4e56f7a82c9b0e1b2c9a3f5b7a8f9b0c1d2e3f4a5b6c7d8e9f0a1',
  username: '',
  company: '',
  skills: '',
  price: '',
  bio: '',
  facebook: '',
  linkedin: '',
  telegram: '',
}

const inputLabelWidth = '106px'

export const Desktop = () => {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(initialState)
  const [baseline, setBaseline] = useState<FormState>(initialState)

  const dirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(baseline)
  }, [baseline, form])

  const reset = () => setForm(baseline)

  const save = () => setBaseline(form)

  return (
    <Wrapper>
      <Grid rows={{ initial: 'auto auto' }} gap={'var(--space-5)'}>
        <FreelancerViewCard>
          <Flex direction={'column'} gap={'var(--space-5)'}>
            <Flex justify={'between'}>
              <Flex gap={'var(--space-3)'} align={'center'}>
                <IconButton radius={'full'}>←</IconButton>
                <Text size={'5'}>{t('profile.title')}</Text>
              </Flex>

              <Flex align={'center'} gap={'var(--space-4)'}>
                <Button variant="secondary" onClick={reset} disabled={!dirty}>
                  {t('profile.actions.cancel')}
                </Button>

                <Button onClick={save} disabled={!dirty}>
                  {t('profile.actions.save')}
                </Button>
              </Flex>
            </Flex>

            <Separator size={'4'} />

            <Input
              label={t('profile.form.address')}
              onChange={(e) =>
                setForm((p) => ({ ...p, address: e.target.value }))
              }
              value={form.address}
              labelWidth={inputLabelWidth}
              disabled
            />

            <Input
              label={t('profile.form.username')}
              value={form.username}
              onChange={(e) =>
                setForm((p) => ({ ...p, username: e.target.value }))
              }
              placeholder={t('profile.form.usernamePlaceholder')}
              labelWidth={inputLabelWidth}
            />

            <Input
              label={t('profile.form.company')}
              value={form.company}
              placeholder={t('profile.form.companyPlaceholder')}
              onChange={(e) =>
                setForm((p) => ({ ...p, company: e.target.value }))
              }
              labelWidth={inputLabelWidth}
            />

            <Input
              label={t('profile.form.skills')}
              value={form.skills}
              onChange={(e) =>
                setForm((p) => ({ ...p, skills: e.target.value }))
              }
              placeholder={t('profile.form.skillsPlaceholder')}
              labelWidth={inputLabelWidth}
            />

            <Separator size={'4'} />

            <Input
              label={t('profile.form.price')}
              value={form.price}
              onChange={(e) =>
                setForm((p) => ({ ...p, price: e.target.value }))
              }
              placeholder="0"
              labelWidth={inputLabelWidth}
              type={'number'}
              addonLeft={
                <Text size={'2'} color={'gray'}>
                  $
                </Text>
              }
            />

            <Separator size={'4'} />

            <Flex direction={'column'} gap={'var(--space-3)'}>
              <Text size={'2'} weight={'medium'}>
                Bio
              </Text>

              <RichEditor />
            </Flex>
          </Flex>
        </FreelancerViewCard>

        <FreelancerViewCard>
          <Grid gap={'var(--space-5)'}>
            <Text size={'5'}> {t('profile.links.title')} </Text>

            <Input
              label={t('profile.links.facebook')}
              value={form.facebook}
              onChange={(e) =>
                setForm((p) => ({ ...p, facebook: e.target.value }))
              }
              placeholder={'facebook.com/'}
              labelWidth={inputLabelWidth}
            />

            <Input
              label={t('profile.links.linkedin')}
              onChange={(e) =>
                setForm((p) => ({ ...p, linkedin: e.target.value }))
              }
              value={form.linkedin}
              placeholder={'linkedin.com/'}
              labelWidth={inputLabelWidth}
            />

            <Input
              label={t('profile.links.telegram')}
              onChange={(e) =>
                setForm((p) => ({ ...p, telegram: e.target.value }))
              }
              value={form.telegram}
              placeholder={'t.me/'}
              labelWidth={inputLabelWidth}
            />
          </Grid>
        </FreelancerViewCard>
      </Grid>
    </Wrapper>
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
