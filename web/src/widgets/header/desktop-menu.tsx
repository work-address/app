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
        }) => {
          return typeof desktopOrder === 'number' ? (
            text || !desktopIcon ? (
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
                {translateKeyDesktop ? t(translateKeyDesktop) : text}
                {children.length > 0 && <DesktopMenu mappedRoutes={children} />}
              </NavLink>
            ) : (
              <IconLink
                to={schema}
                aria-label={t('header.aria.github')}
                target={target}
              >
                <IconImg src={desktopIcon} alt={t('header.aria.github')} />
              </IconLink>
            )
          ) : null
        },
      )}
    </>
  )
}
