import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { Button, routes } from '@/features/shared'

export const ProjectsNotFound = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Root>
      <IconInner>
        <img
          src="/img/icons/featured-icon.svg"
          alt={t('dashboard.page.projectsNotFound.title')}
        />
      </IconInner>

      <Title>{t('dashboard.page.projectsNotFound.title')}</Title>

      <Desc>{t('dashboard.page.projectsNotFound.description')}</Desc>

      <Button
        onClick={() => navigate(routes.helpCenter.schema)}
        variant={'outline'}
        color={'gray'}
        size={'2'}
        style={{
          color: 'black',
        }}
      >
        {t('dashboard.page.empty.action')}
      </Button>
    </Root>
  )
}

const Root = styled.section`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  text-align: center;
`

const IconInner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;

  img {
    width: 60px;
    height: 60px;
    display: block;
  }
`

const Title = styled.div`
  font-weight: 500;
  font-size: 16px;
  line-height: 150%;
  color: #1c2024;
  margin-bottom: 6px;
`

const Desc = styled.div`
  max-width: 352px;
  font-size: 14px;
  line-height: 143%;
  color: #60646c;
  margin-bottom: 24px;
`
