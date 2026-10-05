import { useUnit } from 'effector-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { $authenticated } from '@/entities/profile'
import { routes } from '@/routes'
import { Button, PageHelmet, StateNotice, Wrapper } from '@/shared'

/**
 * Any path the router does not know. It renders inside the app shell, so the
 * navigation is still there, and it offers the one obvious way on - the
 * dashboard for someone signed in, sign-in for everyone else - instead of
 * bouncing silently to `/` and leaving the visitor to wonder where their
 * link went.
 */
export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const authenticated = useUnit($authenticated)

  return (
    <Wrapper width="document">
      <PageHelmet title={t('notFound.documentTitle')} noindex />
      <StateNotice
        size="page"
        title={t('notFound.title')}
        description={t('notFound.description')}
        actions={
          <Button
            size="l"
            onClick={() =>
              navigate(
                authenticated
                  ? routes.dashboard.build()
                  : routes.signIn.build(),
              )
            }
          >
            {t(
              authenticated
                ? 'notFound.action.dashboard'
                : 'notFound.action.signIn',
            )}
          </Button>
        }
      />
    </Wrapper>
  )
}
