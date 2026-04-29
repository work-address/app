import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { match } from 'ts-pattern'

import { NavLink, IconLink, IconImg } from '../styled.ts'

import { $user } from '@/entities/profile'
import { defaultMappedRoutes, routes, type MappingRoute } from '@/routes'

type DesktopMenuProps = {
  mappedRoutes?: MappingRoute[]
}

export const DesktopMenu = ({
  mappedRoutes = defaultMappedRoutes,
}: DesktopMenuProps) => {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const user = useUnit($user)

  const sorted = useMemo(() => {
    const copy = [...mappedRoutes]
    copy.sort((a, b) => (a.desktopOrder || 0) - (b.desktopOrder || 0))
    return copy
  }, [mappedRoutes])

  return (
    <>
      {sorted.map(
        ({
          schema,
          key,
          translateKeyDesktop,
          text,
          children,
          desktopIcon,
          desktopOrder,
          target,
          desktopRender,
        }) => {
          const hasDesktopOrder = typeof desktopOrder === 'number'
          const renderText = translateKeyDesktop ? t(translateKeyDesktop) : text

          const url = match(schema)
            .with(routes.profile.schema, () =>
              routes.profile.build({
                walletAddress: user?.friendlyWalletAddress || '',
              }),
            )
            .with(routes.profile.children.edit.schema, () =>
              routes.profile.children.edit.build({
                walletAddress: user?.friendlyWalletAddress || '',
              }),
            )
            .otherwise(() => schema)

          if (!hasDesktopOrder) {
            return null
          }

          switch (desktopRender) {
            default:
            case 'text':
            case 'textWithIcon': {
              return (
                <NavLink
                  key={key}
                  to={url}
                  $active={
                    schema === '/'
                      ? schema === pathname
                      : pathname.includes(url)
                  }
                  target={target}
                >
                  {desktopRender === 'textWithIcon' && (
                    <IconImg src={desktopIcon} alt={renderText} />
                  )}

                  {renderText}

                  {children.length > 0 && (
                    <DesktopMenu mappedRoutes={children} />
                  )}
                </NavLink>
              )
            }

            case 'icon': {
              return (
                <IconLink
                  key={key}
                  to={schema}
                  aria-label={t('header.aria.github')}
                  target={target}
                >
                  <IconImg src={desktopIcon} alt={t('header.aria.github')} />
                </IconLink>
              )
            }
          }
        },
      )}
    </>
  )
}
