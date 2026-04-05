import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { NavLink, IconLink, IconImg } from '../styled.ts'

import { defaultMappedRoutes, type MappingRoute } from '@/features/shared'

type DesktopMenuProps = {
  mappedRoutes?: MappingRoute[]
}

export const DesktopMenu = ({
  mappedRoutes = defaultMappedRoutes,
}: DesktopMenuProps) => {
  const { pathname } = useLocation()
  const { t } = useTranslation()

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
                  to={schema}
                  $active={
                    schema === '/'
                      ? schema === pathname
                      : pathname.includes(schema)
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
