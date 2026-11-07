import {
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  EnterIcon,
  ExitIcon,
} from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import { match } from 'ts-pattern'

import { $authenticated, $user, signOut } from '@/entities/profile'
import { showPremiumBanner } from '@/features/dashboard'
import {
  AUTH_REQUIRED_ROUTES,
  defaultMappedRoutes,
  routes,
  type MappingRoute,
} from '@/routes'
import {
  Logo,
  LogoWordmark,
  navigateFx,
  NoPremiumBadge,
  Tooltip,
  useBreakpoint,
} from '@/shared'

/** Collapsed: the icon column alone. Expanded: icons with their labels. */
const WIDTH_COLLAPSED = 64
const WIDTH_EXPANDED = 240
/** Phones keep a slimmer rail so the page keeps as much of its width as it can. */
const WIDTH_MOBILE = 56

const ICON_SIZE = 16
const STORAGE_KEY = 'wa.sidebar.collapsed'

const readCollapsed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const writeCollapsed = (value: boolean) => {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Private mode or blocked storage: the choice just won't outlive the tab.
  }
}

export const Sidebar = () => {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const isMobile = useBreakpoint('isMobile')
  const { user, authenticated, signOutEvent, showBanner } = useUnit({
    user: $user,
    authenticated: $authenticated,
    signOutEvent: signOut,
    showBanner: showPremiumBanner,
  })

  /**
   * On desktop the choice sticks and pushes the page aside. On a phone the
   * rail always stays collapsed in the layout and expanding lays the full
   * menu over the page, closing again on the next navigation.
   */
  const [desktopCollapsed, setDesktopCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const collapsed = isMobile ? !mobileOpen : desktopCollapsed

  const toggle = () => {
    if (isMobile) {
      setMobileOpen((open) => !open)
      return
    }

    setDesktopCollapsed((value) => {
      writeCollapsed(!value)
      return !value
    })
  }

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, isMobile])

  useEffect(() => {
    if (!mobileOpen) {
      return
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  /**
   * The badge lives here while the banner is on the dashboard, so revealing
   * it from another screen would expand something out of sight - hence the
   * navigation alongside it.
   */
  const revealPremiumBanner = () => {
    showBanner()
    void navigateFx({ to: routes.dashboard.build() })
  }

  const { mainItems, externalItems } = useMemo(() => {
    const sorted = defaultMappedRoutes
      .filter((route) => typeof route.desktopOrder === 'number')
      .sort((a, b) => (a.desktopOrder || 0) - (b.desktopOrder || 0))

    return {
      mainItems: sorted.filter((route) => route.target !== '_blank'),
      externalItems: sorted.filter((route) => route.target === '_blank'),
    }
  }, [])

  const buildUrl = (schema: string) =>
    match(schema)
      .with(routes.profile.schema, () =>
        routes.profile.build({
          id: user?.id ?? '',
        }),
      )
      .otherwise(() => schema)

  const renderItem = (route: MappingRoute) => {
    if (!authenticated && AUTH_REQUIRED_ROUTES.has(route.schema)) {
      return null
    }

    const { key, schema, icon: Icon, target, translateKeyDesktop, text } = route
    const url = buildUrl(schema)
    const label = translateKeyDesktop ? t(translateKeyDesktop) : text || key
    const isExternal = target === '_blank'
    const active =
      !isExternal && (url === '/' ? pathname === url : pathname.startsWith(url))

    return (
      <Row key={key}>
        <WithTooltip label={label} enabled={collapsed}>
          <Item
            as={Link}
            to={url}
            target={target}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            aria-current={active ? 'page' : undefined}
            aria-label={collapsed ? label : undefined}
            data-active={active || undefined}
            viewTransition={!isExternal}
          >
            {Icon && (
              <Icon width={ICON_SIZE} height={ICON_SIZE} aria-hidden="true" />
            )}
            <Label>{label}</Label>
          </Item>
        </WithTooltip>
        {/* A sibling of the link, not inside it: the badge is a button, and
            nesting one in an anchor is invalid HTML. */}
        {schema === routes.profile.schema &&
          user &&
          !user.premium &&
          !collapsed && (
            <RowBadge>
              <NoPremiumBadge onClick={revealPremiumBanner} />
            </RowBadge>
          )}
      </Row>
    )
  }

  const toggleLabel = collapsed ? t('sidebar.expand') : t('sidebar.collapse')

  return (
    <>
      <Rail
        style={{
          width: isMobile
            ? WIDTH_MOBILE
            : collapsed
              ? WIDTH_COLLAPSED
              : WIDTH_EXPANDED,
        }}
      />
      {isMobile && mobileOpen && (
        <Scrim aria-hidden="true" onClick={() => setMobileOpen(false)} />
      )}
      <Aside
        data-collapsed={collapsed || undefined}
        style={{
          width: collapsed
            ? isMobile
              ? WIDTH_MOBILE
              : WIDTH_COLLAPSED
            : WIDTH_EXPANDED,
        }}
      >
        <Brand
          to={authenticated ? routes.dashboard.build() : routes.signIn.build()}
          viewTransition
        >
          {/* The wordmark does not fit the collapsed rail, so the mark stands
              in for it there. */}
          <BrandImage
            src={collapsed ? Logo : LogoWordmark}
            alt={t('header.logoAlt')}
          />
        </Brand>
        <BrandDivider />
        <Nav aria-label={t('sidebar.navAria')}>
          <List>{mainItems.map(renderItem)}</List>
        </Nav>
        <Footer>
          <List>{externalItems.map(renderItem)}</List>
          {authenticated ? (
            <WithTooltip label={t('header.exitHint')} enabled={collapsed}>
              <Item
                type="button"
                aria-label={t('header.exitHint')}
                onClick={() => signOutEvent()}
              >
                <ExitIcon
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  aria-hidden="true"
                />
                <Label>{t('header.exit')}</Label>
              </Item>
            </WithTooltip>
          ) : (
            <WithTooltip label={t('signIn.title')} enabled={collapsed}>
              <Item
                as={Link}
                to={routes.signIn.build()}
                aria-label={collapsed ? t('signIn.title') : undefined}
                viewTransition
              >
                <EnterIcon
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  aria-hidden="true"
                />
                <Label>{t('signIn.title')}</Label>
              </Item>
            </WithTooltip>
          )}
          <Divider />
          <WithTooltip label={toggleLabel} enabled={collapsed}>
            <Item
              type="button"
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              onClick={toggle}
              data-muted
            >
              {collapsed ? (
                <DoubleArrowRightIcon
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  aria-hidden="true"
                />
              ) : (
                <DoubleArrowLeftIcon
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  aria-hidden="true"
                />
              )}
              <Label>{t('sidebar.collapse')}</Label>
            </Item>
          </WithTooltip>
        </Footer>
      </Aside>
    </>
  )
}

/** Labels are hidden while collapsed, so the tooltip takes over naming the icon. */
const WithTooltip = ({
  label,
  enabled,
  children,
}: {
  label: string
  enabled: boolean
  children: ReactElement
}) =>
  enabled ? (
    <Tooltip content={label} side="right" delayDuration={100}>
      {children}
    </Tooltip>
  ) : (
    children
  )

/** Holds the sidebar's width in the page flow; the sidebar itself is fixed. */
const Rail = styled.div`
  flex-shrink: 0;
  transition: width 0.2s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media print {
    display: none;
  }
`

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 19;
  background: var(--ds-neutral-alpha-6);
`

const Aside = styled.aside`
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: var(--sidebar-gap, 16px);
  padding: var(--sidebar-padding, 16px 12px 12px);
  overflow: hidden;
  background: var(--sidebar-bg);
  border-right: var(--sidebar-edge-width, 0px) solid var(--sidebar-border);
  transition: width 0.2s ease;

  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--sidebar-mobile-padding, 12px 8px);

    &:not([data-collapsed]) {
      padding: var(--sidebar-open-mobile-padding, 12px);
      box-shadow: var(--shadow-4);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media print {
    display: none;
  }
`

const Brand = styled(Link)`
  display: flex;
  align-items: center;
  height: 40px;
  /* Centers the 32px mark in the 40px icon column the items below share. */
  padding-left: 4px;
  flex-shrink: 0;
  border-radius: 8px;

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
  }
`

const BrandImage = styled.img`
  height: 32px;
  width: auto;
  flex-shrink: 0;
  display: block;
`

const Nav = styled.nav`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
`

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: var(--sidebar-item-gap, 2px);
`

const Row = styled.li`
  position: relative;
`

const RowBadge = styled.div`
  position: absolute;
  top: 50%;
  right: 8px;
  display: flex;
  transform: translateY(-50%);
`

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--sidebar-item-gap, 2px);
  flex-shrink: 0;
`

const Divider = styled.div`
  height: 1px;
  margin: 8px 4px;
  background: var(--sidebar-border);
`

/** A direct child of the sidebar, whose own gap already spaces it vertically. */
const BrandDivider = styled(Divider)`
  flex-shrink: 0;
  margin-block: 0;
`

const Label = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  transition: opacity 0.15s ease;

  [data-collapsed] & {
    opacity: 0;
  }
`

const Item = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: var(--sidebar-item-height, 36px);
  /* (40px column - 16px icon) / 2: the icon stays put while the width animates. */
  padding: 0 12px;
  border-radius: var(--sidebar-item-radius, 8px);
  font-size: var(--sidebar-item-font-size, var(--font-size-2));
  line-height: 20px;
  font-weight: 400;
  color: var(--sidebar-item-color, var(--ds-neutral-11));
  background: var(--sidebar-item-bg, transparent);
  white-space: nowrap;
  transition:
    background 0.15s ease,
    color 0.15s ease;

  & > svg {
    flex-shrink: 0;
  }

  &:hover {
    background: var(--sidebar-item-hover, var(--ds-neutral-alpha-3));
    color: var(--sidebar-item-hover-color, var(--ds-neutral-12));
  }

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: -2px;
  }

  /* The dashboard raises its selection; other pages keep the original tint. */
  &[data-active] {
    background: var(--sidebar-item-active-bg, var(--c-rgba-5-86-205-0_0588));
    color: var(--sidebar-item-active-color, var(--ds-accent-11));
    box-shadow: var(--sidebar-item-active-shadow, none);
    font-weight: var(--sidebar-item-active-weight, 400);
  }

  &[data-active] > svg {
    color: var(--sidebar-item-active-color, var(--ds-accent-11));
  }

  &[data-muted] {
    color: var(--sidebar-item-muted-color, var(--muted));
  }

  &[data-muted]:hover {
    color: var(--sidebar-item-hover-color, var(--ds-neutral-12));
  }
`
