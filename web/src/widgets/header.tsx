import { AnimatePresence, motion } from 'motion/react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import styled from 'styled-components'

import { router } from '@/features/shared'

export const Header = () => {
  const { pathname } = useLocation()

  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    const onDown = (e: MouseEvent) => {
      const el = rootRef.current
      if (!el) {
        return
      }
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <HeaderRoot ref={rootRef}>
      <HeaderInner>
        <LogoLink href={router.dashboard.schema}>
          <LogoImg src="/img/photo/logo.svg" alt={t('header.logoAlt')} />
        </LogoLink>

        <Nav>
          <NavLink to={router.dashboard.schema} $active={pathname === '/'}>
            {t('header.nav.dashboard')}
          </NavLink>

          <NavLink
            to={router.profile.schema}
            $active={pathname.includes('/profile')}
          >
            {t('header.nav.profile')}
          </NavLink>

          <NavLink to="#" $active={pathname.includes('download')}>
            {t('header.nav.helpCenter')}
          </NavLink>

          <NavLink to="#" $active={pathname.includes('download')} $download>
            {t('header.nav.download')}
            <IconImg
              src="/img/icons/external-link.svg"
              alt={t('header.aria.github')}
            />
          </NavLink>

          <IconLink to="#" aria-label={t('header.aria.github')}>
            <IconImg
              src="/img/photo/github-logo.svg"
              alt={t('header.aria.github')}
            />
          </IconLink>
        </Nav>

        <Right>
          <UserBox>
            <UserAvatar>
              <IconImg src="/img/icons/person.svg" alt={t('header.userAlt')} />
            </UserAvatar>

            <UserText>
              <UserName>John Doe</UserName>
              <UserSub>EQCF9...NDOM</UserSub>
            </UserText>
          </UserBox>

          <ExitButton aria-label={t('header.exit')}>
            <IconImg src="/img/icons/exit.svg" alt={t('header.exit')} />
          </ExitButton>
        </Right>

        <MobileRight>
          <BurgerButton
            type="button"
            aria-label={open ? t('header.closeMenu') : t('header.openMenu')}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((s) => !s)}
          >
            {open ? (
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

      <AnimatePresence>
        {open ? (
          <MobileMenu
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
                    <UserName>John Doe</UserName>
                    <UserSub>EQCF9...NDOM</UserSub>
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
                <MobileMenuItem
                  href="#"
                  onClick={() => setOpen(false)}
                  $active={pathname.includes(router.profile.schema)}
                  variants={itemVariants}
                >
                  <IconImg
                    src="/img/icons/person.svg"
                    alt={t('header.nav.profile')}
                  />
                  <span>{t('header.nav.profile')}</span>
                </MobileMenuItem>

                <MobileMenuItem
                  href="#"
                  onClick={() => setOpen(false)}
                  $active={pathname === router.dashboard.schema}
                  variants={itemVariants}
                >
                  <IconImg
                    src="/img/icons/dashboard.svg"
                    alt={t('header.nav.dashboard')}
                  />
                  <span>{t('header.nav.dashboard')}</span>
                </MobileMenuItem>

                <MobileMenuItem
                  href="#"
                  onClick={() => setOpen(false)}
                  variants={itemVariants}
                >
                  <IconImg
                    src="/img/icons/question-mark-circled.svg"
                    alt={t('header.nav.helpCenter')}
                  />
                  <span>{t('header.nav.helpCenter')}</span>
                </MobileMenuItem>

                <MobileMenuItem
                  href="#"
                  onClick={() => setOpen(false)}
                  variants={itemVariants}
                >
                  <IconImg
                    src="/img/icons/external-link.svg"
                    alt={t('header.nav.download')}
                  />
                  <span>{t('header.nav.download')}</span>
                </MobileMenuItem>

                <MobileMenuItem
                  href="#"
                  onClick={() => setOpen(false)}
                  variants={itemVariants}
                >
                  <IconImg
                    src="/img/photo/github-logo.svg"
                    alt={t('header.aria.github')}
                  />
                  <span>{t('header.aria.github')}</span>
                </MobileMenuItem>

                <MobileMenuButton
                  type="button"
                  aria-label={t('header.exit')}
                  onClick={() => setOpen(false)}
                  variants={itemVariants}
                >
                  <IconImg src="/img/icons/exit.svg" alt={t('header.exit')} />
                  <span>{t('header.exit')}</span>
                </MobileMenuButton>
              </MobileMenuNav>
            </MobileMenuInner>
          </MobileMenu>
        ) : null}
      </AnimatePresence>
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

const itemVariants = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.14 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.1 } },
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

const LogoLink = styled.a`
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

const NavLink = styled(Link)<{ $active?: boolean; $download?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 400;
  position: relative;

  &:after {
    transition: .25s;
    content: '';
    display: block;
    background: rgba(0,0,0,0.12);
    height: 2px;
    width: 100%;
    position: absolute;
    bottom: -6px;
    opacity: 0;
  }

  color: ${(p) => {
    if (p.$download) {
      return 'var(--download, #003482)'
    }
    return 'var(--ds-primary)'
  }};

  ${(p) =>
    p.$active &&
    `&:after {
      opacity: 1;
    }`}

  opacity: ${(p) => {
    // eslint-disable-next-line
    return p.$download
            ? 1
            : (p.$active
                    ? 1
                    : 0.8)
  }}}

  @media (max-width: 1024px) {
    font-size: 14px;
  }

  &:hover {
    opacity: 1;
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

const MobileMenu = styled(motion.div)`
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

const MobileMenuNav = styled(motion.nav)`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

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

const IconLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(28, 32, 36, 0.06);
  }
`

const IconImg = styled.img`
  width: 18px;
  height: 18px;
  display: block;
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
