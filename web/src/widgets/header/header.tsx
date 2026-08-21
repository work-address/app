import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { IconImg, MobileMenuNav, mobileMenuRowStyles } from '../styled'

import { DesktopMenu } from './desktop-menu'
import { HeaderUserLink } from './header-user-link'
import { MobileMenu, itemVariants } from './mobile-menu'

import { $authenticated, $user, logout } from '@/entities/profile'
import { routes } from '@/routes'
import {
  CrossIcon,
  ExitIcon,
  HamburgerMenuIcon,
  Logo,
  useBreakpoint,
  Button,
} from '@/shared'

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

export const Header = () => {
  const { t } = useTranslation()
  const logoutEvent = useUnit(logout)
  const { user, authenticated } = useUnit({
    user: $user,
    authenticated: $authenticated,
  })
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
    <Root ref={rootRef}>
      <HeaderInner>
        <LogoLink
          to={authenticated ? routes.dashboard.build() : routes.signIn.build()}
          viewTransition
        >
          <LogoImg src={Logo} alt={t('header.logoAlt')} />
          <Beta>beta</Beta>
        </LogoLink>
        {isDesktop && (
          <Nav>
            <DesktopMenu />
          </Nav>
        )}
        <Right>
          {authenticated ? (
            <>
              <HeaderUserLink user={user} userAlt={t('header.userAlt')} />
              <ExitButton
                aria-label={t('header.exit')}
                onClick={() => logoutEvent()}
              >
                <IconImg src={ExitIcon} alt={t('header.exit')} />
              </ExitButton>
            </>
          ) : (
            <NavLink to={routes.signIn.build()} viewTransition>
              <Button size="l">{t('signIn.title')}</Button>
            </NavLink>
          )}
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
                src={CrossIcon}
                alt={t('header.closeMenu')}
                aria-hidden="true"
              />
            ) : (
              <BurgerToggleImg
                src={HamburgerMenuIcon}
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
            <Panel
              id="mobile-menu"
              role="dialog"
              aria-label={t('header.mobileNavAria')}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
            >
              <MobileMenuInner>
                {authenticated ? (
                  <>
                    <MobileMenuTop>
                      <HeaderUserLink
                        user={user}
                        userAlt={t('header.userAlt')}
                        stretch
                      />
                    </MobileMenuTop>
                    <Divider />
                  </>
                ) : (
                  <>
                    <MobileMenuTop>
                      <NavLink
                        to={routes.signIn.build()}
                        style={{ width: '100%' }}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Button stretch>{t('signIn.title')}</Button>
                      </NavLink>
                    </MobileMenuTop>
                    <Divider />
                  </>
                )}
                <MobileMenuNav
                  variants={menuVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <MobileMenu setOpen={setMobileMenuOpen} />
                  {authenticated && (
                    <MobileMenuButton
                      type="button"
                      aria-label={t('header.exit')}
                      onClick={() => {
                        setMobileMenuOpen(false)
                        logoutEvent()
                      }}
                      variants={itemVariants}
                    >
                      <IconImg src={ExitIcon} alt={t('header.exit')} />
                      <span>{t('header.exit')}</span>
                    </MobileMenuButton>
                  )}
                </MobileMenuNav>
              </MobileMenuInner>
            </Panel>
          ) : null}
        </AnimatePresence>
      )}
    </Root>
  )
}

const Root = styled.header`
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

  position: relative;
`

const LogoImg = styled.img`
  width: 52px;
  height: 52px;
  display: block;
  object-fit: cover;

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 48px;
    height: 48px;
  }
`

const Nav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;

  ${(p) => p.theme.breakpoints.down('lg')} {
    gap: 15px;
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    display: none;
  }
`

const Right = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;

  ${(p) => p.theme.breakpoints.down('md')} {
    display: none;
  }
`

const MobileRight = styled.div`
  display: none;
  align-items: center;

  ${(p) => p.theme.breakpoints.down('md')} {
    display: flex;
  }
`

const BurgerButton = styled.button`
  width: 45px;
  height: 45px;
  display: grid;
  place-items: center;
  border: 1px solid var(--c-rgba-0-8-48-0_27);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: var(--c-rgba-28-32-36-0_06);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 32px;
    height: 32px;
    border-radius: 4px;
  }
`

const BurgerToggleImg = styled.img`
  width: 18px;
  height: 18px;
  display: block;

  ${(p) => p.theme.breakpoints.down('md')} {
    width: 16px;
    height: 16px;
  }
`

const Panel = styled(motion.div)`
  width: 100%;
  overflow: hidden;

  ${(p) => p.theme.breakpoints.up('md')} {
    display: none;
  }
`

const MobileMenuInner = styled.div`
  padding: 12px 16px 14px;
  /* background: var(--white); */
`

const MobileMenuTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
`

const Divider = styled.div`
  height: 1px;
  background: var(--c-rgba-0-8-48-0_12);
  margin: 12px 0;
`

const MobileMenuButton = styled(motion.button)`
  ${mobileMenuRowStyles}
  border: none;
  cursor: pointer;
  text-align: left;
`

const ExitButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--c-rgba-0-8-48-0_27);

  &:hover {
    background: var(--c-rgba-28-32-36-0_06);
  }
`

const Beta = styled.span`
  color: var(--white);
  background: var(--c-253854);

  position: absolute;
  right: 9px;
  bottom: 5px;
  font-weight: 500;

  border-radius: 3px;
  pointer-events: none;
  user-select: none;
  transform: translate(20%, 20%);
  opacity: 0.9;
  font-size: 9px;
  padding: 0px 3px;
`
