import { useMemo, useState } from 'react'
import styled from 'styled-components'
import { useTranslation } from 'react-i18next'
import Button from '../components/ui/button'

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
  price: '0',
  bio: '',
  facebook: '',
  linkedin: '',
  telegram: '',
}

export default function Profile() {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(initialState)
  const [baseline, setBaseline] = useState<FormState>(initialState)

  const dirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(baseline)
  }, [baseline, form])

  const reset = () => setForm(baseline)
  const save = () => setBaseline(form)

  return (
    <Wrap>
      <Top>
        <Left>
          <BackBtn
            type="button"
            aria-label={t('profile.aria.back')}
            onClick={() => history.back()}
          >
            ←
          </BackBtn>
          <TopTitle>{t('profile.title')}</TopTitle>
        </Left>

        <TopRight>
          <Button variant="secondary" onClick={reset} disabled={!dirty}>
            {t('profile.actions.cancel')}
          </Button>
          <Button onClick={save} disabled={!dirty}>
            {t('profile.actions.save')}
          </Button>
        </TopRight>
      </Top>

      <Card>
        <Grid>
          <Field>
            <Label>{t('profile.form.address')}</Label>
            <Input
              value={form.address}
              onChange={(e) =>
                setForm((p) => ({ ...p, address: e.target.value }))
              }
            />
          </Field>
          <Field>
            <Label>{t('profile.form.username')}</Label>
            <Input
              value={form.username}
              onChange={(e) =>
                setForm((p) => ({ ...p, username: e.target.value }))
              }
              placeholder={t('profile.form.usernamePlaceholder')}
            />
          </Field>
          <Field>
            <Label>{t('profile.form.company')}</Label>
            <Input
              value={form.company}
              onChange={(e) =>
                setForm((p) => ({ ...p, company: e.target.value }))
              }
              placeholder={t('profile.form.companyPlaceholder')}
            />
          </Field>
          <Field>
            <Label>{t('profile.form.skills')}</Label>
            <Input
              value={form.skills}
              onChange={(e) =>
                setForm((p) => ({ ...p, skills: e.target.value }))
              }
              placeholder={t('profile.form.skillsPlaceholder')}
            />
          </Field>
          <Field>
            <Label>{t('profile.form.price')}</Label>
            <PriceWrap>
              <Input
                value={form.price}
                onChange={(e) =>
                  setForm((p) => ({ ...p, price: e.target.value }))
                }
                placeholder="0"
              />
              <Suffix>$</Suffix>
            </PriceWrap>
          </Field>
          <Field $span>
            <Label>{t('profile.form.bio')}</Label>
            <Toolbar>
              <ToolBtn type="button" aria-label={t('profile.aria.bold')}>
                B
              </ToolBtn>
              <ToolBtn type="button" aria-label={t('profile.aria.italic')}>
                I
              </ToolBtn>
              <ToolBtn type="button" aria-label={t('profile.aria.underline')}>
                U
              </ToolBtn>
              <ToolBtn type="button" aria-label={t('profile.aria.list')}>
                •
              </ToolBtn>
              <ToolBtn type="button" aria-label={t('profile.aria.link')}>
                ⛓
              </ToolBtn>
            </Toolbar>
            <TextArea
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              placeholder={t('profile.form.bioPlaceholder')}
            />
          </Field>
        </Grid>
      </Card>

      <Card>
        <CardTitle>{t('profile.links.title')}</CardTitle>
        <LinksGrid>
          <Field>
            <Label>{t('profile.links.facebook')}</Label>
            <Input
              value={form.facebook}
              onChange={(e) =>
                setForm((p) => ({ ...p, facebook: e.target.value }))
              }
              placeholder="facebook.com/"
            />
          </Field>
          <Field>
            <Label>{t('profile.links.linkedin')}</Label>
            <Input
              value={form.linkedin}
              onChange={(e) =>
                setForm((p) => ({ ...p, linkedin: e.target.value }))
              }
              placeholder="linkedin.com/"
            />
          </Field>
          <Field>
            <Label>{t('profile.links.telegram')}</Label>
            <Input
              value={form.telegram}
              onChange={(e) =>
                setForm((p) => ({ ...p, telegram: e.target.value }))
              }
              placeholder="t.me/"
            />
          </Field>
        </LinksGrid>
      </Card>
    </Wrap>
  )
}

const Wrap = styled.div`
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 26px 28px 40px;
`

const Top = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`

const Left = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`

const BackBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  background: #fff;
  color: rgba(0, 7, 20, 0.82);
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(0, 0, 51, 0.04);
  }
`

const TopTitle = styled.h1`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
  margin: 0;
`

const TopRight = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`

const Card = styled.section`
  width: 100%;
  border: 1px solid rgba(0, 0, 45, 0.09);
  border-radius: 12px;
  background: #fff;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 1px 4px 0 rgba(0, 0, 45, 0.09),
    0 2px 1px -1px rgba(0, 0, 0, 0.05),
    0 1px 3px 0 rgba(0, 0, 0, 0.05);
  padding: 16px;

  & + & {
    margin-top: 12px;
  }
`

const CardTitle = styled.div`
  font-weight: 500;
  font-size: 14px;
  line-height: 150%;
  color: #1c2024;
  margin-bottom: 12px;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`

const LinksGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
`

const Field = styled.div<{ $span?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  ${(p) => (p.$span ? 'grid-column: 1 / -1;' : '')}
`

const Label = styled.div`
  font-size: 12px;
  line-height: 143%;
  color: rgba(0, 7, 20, 0.62);
`

const Input = styled.input`
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  background: #fff;
  font-size: 12px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.82);
  outline: none;

  &::placeholder {
    color: rgba(0, 7, 20, 0.45);
  }
`

const PriceWrap = styled.div`
  position: relative;
`

const Suffix = styled.div`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(0, 7, 20, 0.62);
  font-size: 12px;
  pointer-events: none;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  border-radius: 8px 8px 0 0;
  background: #fff;
`

const ToolBtn = styled.button`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 0;
  background: transparent;
  color: rgba(0, 7, 20, 0.62);

  &:hover {
    background: rgba(0, 0, 51, 0.06);
  }
`

const TextArea = styled.textarea`
  min-height: 110px;
  padding: 10px;
  border-radius: 0 0 8px 8px;
  border: 1px solid rgba(0, 0, 51, 0.12);
  border-top: 0;
  background: #fff;
  font-size: 12px;
  line-height: 150%;
  color: rgba(0, 7, 20, 0.82);
  outline: none;
  resize: vertical;
  font-family: inherit;

  &::placeholder {
    color: rgba(0, 7, 20, 0.45);
  }
`