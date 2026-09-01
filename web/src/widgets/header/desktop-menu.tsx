import { ArrowTopRightIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { match } from 'ts-pattern'

import { NavLink, IconLink } from '../styled'

import { $authenticated, $user } from '@/entities/profile'
import {
  AUTH_REQUIRED_ROUTES,
  defaultMappedRoutes,
  routes,
  type MappingRoute,
} from '@/routes'

type Props = {
  mappedRoutes?: MappingRoute[]
}

const ICON_SIZE = 16

export const DesktopMenu = ({ mappedRoutes = defaultMappedRoutes }: Props) => {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { user, authenticated } = useUnit({
    user: $user,
    authenticated: $authenticated,
  })

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
          icon: Icon,
          desktopOrder,
          target,
          desktopRender,
        }) => {
          const hasDesktopOrder = typeof desktopOrder === 'number'
          const renderText = translateKeyDesktop ? t(translateKeyDesktop) : text

          if (!authenticated && AUTH_REQUIRED_ROUTES.has(schema)) {
            return null
          }

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

          const isExternal = target === '_blank'

          switch (desktopRender) {
            default:
            case 'text': {
              return (
                <NavLink
                  key={key}
                  to={url}
                  data-active={
                    (schema === '/'
                      ? schema === pathname
                      : pathname.includes(url)) || undefined
                  }
                  target={target}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  viewTransition
                >
                  {Icon && <Icon width={ICON_SIZE} height={ICON_SIZE} />}
                  {renderText}
                  {/* Says "this leaves the app" before the click does. */}
                  {isExternal && (
                    <ArrowTopRightIcon
                      width={12}
                      height={12}
                      aria-hidden="true"
                      data-external
                    />
                  )}
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
                  aria-label={renderText}
                  target={target}
                  viewTransition
                >
                  {Icon && <Icon width={ICON_SIZE} height={ICON_SIZE} />}
                </IconLink>
              )
            }
          }
        },
      )}
    </>
  )
}
