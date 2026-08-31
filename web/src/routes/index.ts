import type { Route, IdRouteParams, NoChildRoutes, MappingRoute } from './types'

import {
  DashboardIcon,
  PersonIcon,
  QuestionMarkCircledIcon,
  TimeTrackerIcon,
} from '@/shared/icons'

/* eslint-disable */
type MainRoutes =
  & Route<'/', 'dashboard'>
  & Route<'/sign-in', 'signIn'>
  & Route<'/profile/:walletAddress', 'profile', ProfileRoutes, { walletAddress: string }>
  & Route<'https://address.work/docs', 'docs'>
  & Route<'/connect', 'connect', NoChildRoutes, { nonce?: string }>
  & Route<'/time-tracker', 'timeTracker'>
  & Route<'/download', 'download'>
  & Route<'/invoice/:id', 'invoice', NoChildRoutes, IdRouteParams>
  & Route<'/invoice', 'invoices'>
  & Route<'https://facebook.com/:userId', 'facebook', NoChildRoutes, { userId: string }>
  & Route<'https://t.me/:userId', 'telegram', NoChildRoutes, { userId: string }>
  & Route<'https://linkedin.com/in/:userId', 'linkedin', NoChildRoutes, { userId: string }>
  & Route<'https://twitter.com/:userId', 'twitter', NoChildRoutes, { userId: string }>
  & Route<'https://instagram.com/:userId', 'instagram', NoChildRoutes, { userId: string }>
  & Route<'https://youtube.com/:userId', 'youtube', NoChildRoutes, { userId: string }>

type ProfileRoutes =
  & Route<'/profile/:walletAddress/edit', 'edit', NoChildRoutes, { walletAddress: string }>

/* eslint-enable */

/* Схема сайта. Роут выводится в меню если прописан order.
  Поле text в приоритете вывода, если не хочется
  добавлять translateKey и искать словарь */
export const routes: MainRoutes = {
  dashboard: {
    schema: '/',
    build: () => '/',

    desktopOrder: 0,
    mobileOrder: 1,

    showInMenu: true,
    translateKeyDesktop: 'header.nav.dashboard',
    translateKeyMobile: 'header.nav.dashboard',
    mobileIcon: DashboardIcon,
  },

  profile: {
    schema: '/profile/:walletAddress',
    build: ({ walletAddress }) => `/profile/${walletAddress}`,

    desktopOrder: 1,
    mobileOrder: 0,

    mobileIcon: PersonIcon,
    showInMenu: true,
    translateKeyDesktop: 'header.nav.profile',
    translateKeyMobile: 'header.nav.profile',
    children: {
      edit: {
        schema: '/profile/:walletAddress/edit',
        build: ({ walletAddress }) => `/profile/${walletAddress}/edit`,
      },
    },
  },

  // Singular, matching `/invoice/:id` and the API it reads from: `/invoice`
  // is every invoice, `/invoice/:id` is one of them. `/invoices` still
  // resolves here - see the redirect in app.tsx.
  invoices: {
    schema: '/invoice',
    build: () => '/invoice',
  },

  docs: {
    schema: 'https://address.work/docs',
    build: () => 'https://address.work/docs',
    target: '_blank',

    translateKeyDesktop: 'header.nav.helpCenter',
    translateKeyMobile: 'header.nav.helpCenter',

    desktopOrder: 2,
    mobileOrder: 2,

    mobileIcon: QuestionMarkCircledIcon,
  },

  timeTracker: {
    schema: '/time-tracker',
    build: () => '/time-tracker',

    mobileOrder: 3,

    translateKeyMobile: 'header.nav.timeTracker',
    mobileIcon: TimeTrackerIcon,
  },

  download: {
    schema: '/download',
    build: () => '/download',
  },

  facebook: {
    schema: 'https://facebook.com/:userId',
    build: ({ userId }) => `https://facebook.com/${userId}`,
  },

  telegram: {
    schema: 'https://t.me/:userId',
    build: ({ userId }) => `https://t.me/${userId}`,
  },

  linkedin: {
    schema: 'https://linkedin.com/in/:userId',
    build: ({ userId }) => `https://linkedin.com/in/${userId}`,
  },

  twitter: {
    schema: 'https://twitter.com/:userId',
    build: ({ userId }) => `https://twitter.com/${userId}`,
  },

  instagram: {
    schema: 'https://instagram.com/:userId',
    build: ({ userId }) => `https://instagram.com/${userId}`,
  },

  youtube: {
    schema: 'https://youtube.com/:userId',
    build: ({ userId }) => `https://youtube.com/${userId}`,
  },

  signIn: {
    schema: '/sign-in',
    build: () => '/sign-in',
  },

  connect: {
    schema: '/connect',
    build: ({ nonce }: { nonce?: string } = {}) =>
      nonce ? `/connect?nonce=${encodeURIComponent(nonce)}` : '/connect',
  },

  invoice: {
    schema: '/invoice/:id',
    build: ({ id }) => `/invoice/${id}`,
  },
}

/** Routes hidden from the menu for unauthenticated visitors. */
export const AUTH_REQUIRED_ROUTES = new Set<string>([
  routes.dashboard.schema,
  routes.profile.schema,
  routes.timeTracker.schema,
])

// eslint-disable-next-line
export const mapRoutes = (tree: Record<string, any>): MappingRoute[] => {
  const routes = [] as MappingRoute[]

  for (const key in tree) {
    // eslint-disable-next-line
    const item = tree[key] as any

    const route: MappingRoute = {
      ...item,
      key,
      children: 'children' in item ? mapRoutes(item.children) : [],
    }

    if (route.disabled) {
      continue
    }

    routes.push(route)
  }

  return routes
}

export const defaultMappedRoutes = mapRoutes(routes)

export const openDocs = () => {
  window.open(routes.docs.build(), routes.docs.target ?? '_blank')
}

export type { MainRoutes }

export { type MappingRoute } from './types'
