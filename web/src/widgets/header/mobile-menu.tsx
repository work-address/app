import { useUnit } from 'effector-react'
import { motion } from 'motion/react'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { match } from 'ts-pattern'

import { IconImg, mobileMenuRowStyles } from '../styled'

import { $authenticated, $user } from '@/entities/profile'
import { AUTH_REQUIRED_ROUTES, defaultMappedRoutes, routes } from '@/routes'

export const itemVariants = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.14 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.1 } },
}

type Props = {
  setOpen: (value: boolean) => void
}

export const MobileMenu = ({ setOpen }: Props) => {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, authenticated } = useUnit({
    user: $user,
    authenticated: $authenticated,
  })

  const sorted = useMemo(() => {
    const copy = [...defaultMappedRoutes]
    copy.sort((a, b) => (a.mobileOrder || 0) - (b.mobileOrder || 0))
    return copy
  }, [])

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setOpen(false)
    const path = e.currentTarget.getAttribute('href')
    const target = e.currentTarget.getAttribute('target')

    if (path) {
      if (target === '_blank') {
        window.open(path)
      } else {
        navigate(path, { viewTransition: true })
      }
    }
  }

  return (
    <>
      {sorted.map(
        ({
          schema,
          mobileIcon,
          translateKeyMobile,
          key,
          text,
          disabled,
          mobileOrder,
          target,
        }) => {
          if (disabled || mobileOrder === undefined) {
            return null
          }

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

          return (
            <MobileMenuItem
              key={key}
              href={url}
              onClick={onClick}
              data-active={
                (url === '/' ? pathname === url : pathname.includes(url)) ||
                undefined
              }
              variants={itemVariants}
              target={target}
            >
              <IconImg
                src={mobileIcon}
                alt={translateKeyMobile ? t(translateKeyMobile) : text || key}
              />
              {translateKeyMobile && <span>{t(translateKeyMobile)}</span>}
            </MobileMenuItem>
          )
        },
      )}
    </>
  )
}

const MobileMenuItem = styled(motion.a)`
  ${mobileMenuRowStyles}
  text-decoration: none;

  &[data-active] {
    background: var(--c-rgba-5-86-205-0_0588);
  }
`
