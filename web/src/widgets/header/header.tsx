import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styled from 'styled-components'

import { IconImg, MobileMenuNav } from '../styled.ts'

import { DesktopMenu } from './desktop-menu.tsx'
import { MobileMenu, itemVariants } from './mobile-menu.tsx'

import { $user, logout } from '@/entities/profile'
import { routes } from '@/routes'
import { formatWalletAddress, useBreakpoint } from '@/shared'

export const Header = () => {
  const { t } = useTranslation()
  const logoutEvent = useUnit(logout)
  const user = useUnit($user)
  const isDesktop = useBreakpoint('isDesktop')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!mobileMenuOpen) {
      return
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    const onDown = (e: MouseEvent) => {
      const el = rootRef.current

      if (!el) {
        return
      }

      if (e.target instanceof Node && !el.contains(e.target)) {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onDown)
    }
  }, [mobileMenuOpen])

  return (
    <HeaderRoot ref={rootRef}>
      <HeaderInner>
        <LogoLink to={routes.dashboard.build()}>
          <LogoImg src="/img/photo/logo.svg" alt={t('header.logoAlt')} />
        </LogoLink>

        {isDesktop && (
          <Nav>
            <DesktopMenu />
          </Nav>
        )}

        <Right>
          <UserBox>
            <UserAvatar>
              <IconImg src="/img/icons/person.svg" alt={t('header.userAlt')} />
            </UserAvatar>

            <UserText>
              <UserName>{user?.userName || ''}</UserName>
              <UserSub>
                {formatWalletAddress(user?.friendlyWalletAddress || '')}
              </UserSub>
            </UserText>
          </UserBox>

          <ExitButton
            aria-label={t('header.exit')}
            onClick={() => logoutEvent()}
          >
            <IconImg src="/img/icons/exit.svg" alt={t('header.exit')} />
          </ExitButton>
        </Right>

        <MobileRight>
          <BurgerButton
            type="button"
            aria-label={
              mobileMenuOpen ? t('header.closeMenu') : t('header.openMenu')
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileMenuOpen((s) => !s)}
          >
            {mobileMenuOpen ? (
              <BurgerToggleImg
                src="/img/icons/cross-1.svg"
                alt={t('header.closeMenu')}
                aria-hidden="true"
              />
            ) : (
              <BurgerToggleImg
                src="/img/icons/hamburger-menu.svg"
                alt={t('header.openMenu')}
                aria-hidden="true"
              />
            )}
          </BurgerButton>
        </MobileRight>
      </HeaderInner>

      {!isDesktop && (
        <AnimatePresence>
          {mobileMenuOpen ? (
            <MobileMenuStyled
              id="mobile-menu"
              role="dialog"
              aria-label={t('header.mobileNavAria')}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
            >
              <MobileMenuInner>
                <MobileMenuTop>
                  <UserBox>
                    <UserAvatar>
                      <IconImg
                        src="/img/icons/person.svg"
                        alt={t('header.userAlt')}
                      />
                    </UserAvatar>

                    <UserText>
                      <UserName>{user?.userName || ''}</UserName>
                      <UserSub>
                        {formatWalletAddress(user?.friendlyWalletAddress || '')}
                      </UserSub>
                    </UserText>
                  </UserBox>
                </MobileMenuTop>

                <Divider />

                <MobileMenuNav
                  variants={menuVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <MobileMenu setOpen={setMobileMenuOpen} />

                  <MobileMenuButton
                    type="button"
                    aria-label={t('header.exit')}
                    onClick={() => {
                      setMobileMenuOpen(false)
                      logoutEvent()
                    }}
                    variants={itemVariants}
                  >
                    <IconImg src="/img/icons/exit.svg" alt={t('header.exit')} />
                    <span>{t('header.exit')}</span>
                  </MobileMenuButton>
                </MobileMenuNav>
              </MobileMenuInner>
            </MobileMenuStyled>
          ) : null}
        </AnimatePresence>
      )}
    </HeaderRoot>
  )
}

const menuVariants = {
  initial: { opacity: 1 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.04 },
  },
  exit: {
    opacity: 1,
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
}

const HeaderRoot = styled.header`
  width: 100%;
  background: var(--ds-secondary);
`

const HeaderInner = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 28px;
`

const LogoLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`

const LogoImg = styled.img`
  width: 52px;
  height: 52px;
  display: block;
  object-fit: cover;

  @media (max-width: 768px) {
    width: 48px;
    height: 48px;
  }
`

const Nav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;

  @media (max-width: 1024px) {
    gap: 15px;
  }

  @media (max-width: 770px) {
    display: none;
  }
`

const Right = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 44px;

  @media (max-width: 770px) {
    display: none;
  }
`

const MobileRight = styled.div`
  display: none;
  align-items: center;

  @media (max-width: 770px) {
    display: flex;
  }
`

const BurgerButton = styled.button`
  width: 45px;
  height: 45px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(0, 8, 48, 0.27);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: rgba(28, 32, 36, 0.06);
  }

  @media (max-width: 768px) {
    width: 32px;
    height: 32px;
    border-radius: 4px;
  }
`

const BurgerToggleImg = styled.img`
  width: 18px;
  height: 18px;
  display: block;

  @media (max-width: 768px) {
    width: 16px;
    height: 16px;
  }
`

const MobileMenuStyled = styled(motion.div)`
  width: 100%;
  overflow: hidden;

  @media (min-width: 771px) {
    display: none;
  }
`

const MobileMenuInner = styled.div`
  padding: 12px 16px 14px;
  /* background: #fff; */
`

const MobileMenuTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
`

const Divider = styled.div`
  height: 1px;
  background: rgba(0, 8, 48, 0.12);
  margin: 12px 0;
`

const MobileMenuButton = styled(motion.button)`
  padding: 10px 10px;
  border-radius: 10px;
  color: var(--ds-primary);
  font-size: 16px;
  line-height: 22px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: rgba(28, 32, 36, 0.06);
  }

  img {
    width: 18px;
    height: 18px;
  }
`

const UserBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const UserAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: var(--gray-100);
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

const UserText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const UserName = styled.span`
  font-size: 14px;
  line-height: 16px;
  font-weight: 500;
  color: var(--ds-primary);
`

const UserSub = styled.span`
  font-size: 12px;
  line-height: 14px;
  font-weight: 400;
  color: var(--muted);
`

const ExitButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 8, 48, 0.27);

  &:hover {
    background: rgba(28, 32, 36, 0.06);
  }
`
