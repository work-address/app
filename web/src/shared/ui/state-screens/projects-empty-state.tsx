import { PlusIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { FeaturedIcon } from '../../icons'
import { Button } from '../button'

type ProjectsEmptyStateProps = {
  onCreateClick: () => void
}

export const ProjectsEmptyState = ({
  onCreateClick,
}: ProjectsEmptyStateProps) => {
  const { t } = useTranslation()

  return (
    <Root>
      <IconInner>
        <img
          src={FeaturedIcon}
          alt={t('dashboard.page.projectsNotFound.title')}
        />
      </IconInner>
      <Title>{t('dashboard.page.projectsNotFound.title')}</Title>
      <Desc>{t('dashboard.page.projectsNotFound.description')}</Desc>
      <Button iconLeft={<PlusIcon />} onClick={onCreateClick}>
        {t('dashboard.page.createProject')}
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
  color: var(--ds-neutral-12);
  margin-bottom: 6px;
`

const Desc = styled.div`
  max-width: 352px;
  font-size: 14px;
  line-height: 143%;
  color: var(--ds-neutral-11);
  margin-bottom: 24px;
`
