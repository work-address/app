import { Cross1Icon, ExitIcon, HamburgerMenuIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { MobileMenuNav, mobileMenuRowStyles } from '../styled'

import { DesktopMenu } from './desktop-menu'
import { HeaderUserLink } from './header-user-link'
import { MobileMenu, itemVariants } from './mobile-menu'

import { $authenticated, $user, logout } from '@/entities/profile'
import { showPremiumBanner } from '@/features/dashboard'
import { routes } from '@/routes'
import { Logo, useBreakpoint, Button, navigateFx, Tooltip } from '@/shared'

/**
 * The mobile header is one row of equals: the logo, the profile card and the
 * burger are all this tall, and the burger is this wide too.
 */
const MOBILE_ROW_HEIGHT = 48

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
  const showBanner = useUnit(showPremiumBanner)

  /**
   * The banner lives on the dashboard while the badge is in the header, so
   * revealing it from another screen would expand something out of sight -
   * hence the navigation alongside it.
   */
  const revealPremiumBanner = () => {
    showBanner()
    void navigateFx({ to: routes.dashboard.build() })
  }

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
              <HeaderUserLink
                user={user}
                userAlt={t('header.userAlt')}
                onNoPremiumClick={revealPremiumBanner}
              />
              <Tooltip content={t('header.exitHint')}>
                <ExitButton
                  aria-label={t('header.exitHint')}
                  onClick={() => logoutEvent()}
                >
                  <ExitIcon width={18} height={18} aria-hidden="true" />
                </ExitButton>
              </Tooltip>
            </>
          ) : (
            <NavLink to={routes.signIn.build()} viewTransition>
              <Button size="l">{t('signIn.title')}</Button>
            </NavLink>
          )}
        </Right>
        <MobileRight>
          {authenticated && (
            <HeaderUserLink
              user={user}
              userAlt={t('header.userAlt')}
              stretch
              onNoPremiumClick={revealPremiumBanner}
            />
          )}
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
              <Cross1Icon width={18} height={18} aria-hidden="true" />
            ) : (
              <HamburgerMenuIcon width={18} height={18} aria-hidden="true" />
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
                {!authenticated && (
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
                      <ExitIcon width={18} height={18} aria-hidden="true" />
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
  gap: 12px;
  padding: 12px 28px;

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: 12px 16px;
  }
`

const LogoLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;

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
  /* stretch, not center: the burger takes its height from this row rather
     than carrying a size of its own that drifts from the profile card's. */
  align-items: stretch;
  /* Keeps the burger against the right edge when it is alone in this row -
     signed out there is no profile card to push it there. */
  justify-content: flex-end;
  gap: 8px;
  height: ${MOBILE_ROW_HEIGHT}px;

  /* The profile card sits here now, so this row is the one that both claims
     the space left over by the logo and gives way when it runs short. */
  flex: 1;
  min-width: 0;

  ${(p) => p.theme.breakpoints.down('md')} {
    display: flex;
  }
`

const BurgerButton = styled.button`
  /* Square, and as tall as the row - the height comes from the stretch above. */
  width: ${MOBILE_ROW_HEIGHT}px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  /*
   * The same surface, radius and timing as the profile card beside it and the
   * exit button on desktop, so the header reads as one set of controls. It
   * previously sat in an outline box on ad-hoc --c-rgba-* values, half the
   * height of everything around it.
   */
  border: 0;
  border-radius: 8px;
  background: var(--ds-neutral-2);
  color: var(--ds-neutral-11);
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--ds-neutral-alpha-3);
    color: var(--ds-neutral-12);
  }

  &:active {
    background: var(--ds-neutral-alpha-6);
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
  display: flex;
  align-items: center;
  justify-content: center;
  /*
   * Same surface, radius and timing as the profile card beside it - the two
   * read as one pair of controls. It previously carried a border and drew from
   * ad-hoc --c-rgba-* values unrelated to the rest of the header.
   */
  border: 0;
  border-radius: 8px;
  background: var(--ds-neutral-2);
  color: var(--ds-neutral-11);
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--ds-neutral-alpha-3);
    color: var(--ds-neutral-12);
  }

  &:active {
    background: var(--ds-neutral-alpha-6);
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
