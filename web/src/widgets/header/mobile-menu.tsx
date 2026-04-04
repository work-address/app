import { motion } from 'motion/react'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { IconImg } from '../styled.ts'

import { defaultMappedRoutes } from '@/features/shared'

type MobileMenuProps = {
  setOpen: (value: boolean) => void
}

export const MobileMenu = ({ setOpen }: MobileMenuProps) => {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const sorted = useMemo(() => {
    const copy = [...defaultMappedRoutes]
    copy.sort((a, b) => (a.mobileOrder || 0) - (b.mobileOrder || 0))
    return copy
  }, [])

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setOpen(false)
    const path = e.currentTarget.getAttribute('href')

    if (path) {
      navigate(path)
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
        }) =>
          !disabled &&
          mobileOrder !== undefined && (
            <MobileMenuItem
              key={key}
              href={schema}
              onClick={onClick}
              $active={
                schema === '/' ? pathname === schema : pathname.includes(schema)
              }
              variants={itemVariants}
            >
              <IconImg
                src={mobileIcon}
                alt={translateKeyMobile ? t(translateKeyMobile) : text || key}
              />
              {translateKeyMobile && <span>{t(translateKeyMobile)}</span>}
            </MobileMenuItem>
          ),
      )}
    </>
  )
}

export const itemVariants = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.14 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.1 } },
}

const MobileMenuItem = styled(motion.a)<{ $active?: boolean }>`
  padding: 10px 10px;
  border-radius: 10px;
  color: var(--ds-primary);
  text-decoration: none;
  font-size: 16px;
  line-height: 22px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: ${(p) =>
    p.$active ? 'rgba(5, 86, 205, 0.0588)' : 'transparent'};

  &:hover {
    background: rgba(28, 32, 36, 0.06);
  }

  img {
    width: 18px;
    height: 18px;
  }
`
