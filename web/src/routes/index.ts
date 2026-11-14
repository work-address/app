import {
  ClockIcon,
  DashboardIcon,
  FileTextIcon,
  MagicWandIcon,
  MixerHorizontalIcon,
  PersonIcon,
  QuestionMarkCircledIcon,
} from '@radix-ui/react-icons'

import type { Route, IdRouteParams, NoChildRoutes, MappingRoute } from './types'

import { PeopleIcon } from '@/shared/icons'

type MainRoutes = Route<'/', 'dashboard'> &
  Route<'/time', 'time'> &
  Route<'/team', 'team'> &
  Route<'/agents', 'agents'> &
  Route<'/sign-in', 'signIn'> &
  Route<'/profile/:id', 'profile', ProfileRoutes, IdRouteParams> &
  Route<'https://address.work/docs', 'docs'> &
  Route<'/connect', 'connect', NoChildRoutes, { nonce?: string }> &
  Route<'/download', 'download'> &
  Route<'/invoice/:id', 'invoice', NoChildRoutes, IdRouteParams> &
  Route<'/invoice', 'invoices'> &
  Route<'/settings', 'settings'> &
  Route<
    'https://facebook.com/:userId',
    'facebook',
    NoChildRoutes,
    { userId: string }
  > &
  Route<'https://t.me/:userId', 'telegram', NoChildRoutes, { userId: string }> &
  Route<
    'https://linkedin.com/in/:userId',
    'linkedin',
    NoChildRoutes,
    { userId: string }
  > &
  Route<
    'https://twitter.com/:userId',
    'twitter',
    NoChildRoutes,
    { userId: string }
  > &
  Route<
    'https://instagram.com/:userId',
    'instagram',
    NoChildRoutes,
    { userId: string }
  > &
  Route<
    'https://youtube.com/:userId',
    'youtube',
    NoChildRoutes,
    { userId: string }
  >

type ProfileRoutes = Route<
  '/profile/:id/edit',
  'edit',
  NoChildRoutes,
  IdRouteParams
>

export const routes: MainRoutes = {
  dashboard: {
    schema: '/',
    build: () => '/',

    desktopOrder: 0,
    mobileOrder: 0,

    showInMenu: true,
    translateKeyDesktop: 'header.nav.dashboard',
    translateKeyMobile: 'header.nav.dashboard',
    icon: DashboardIcon,
  },

  time: {
    schema: '/time',
    build: () => '/time',

    desktopOrder: 1,
    mobileOrder: 1,

    showInMenu: true,
    translateKeyDesktop: 'header.nav.time',
    translateKeyMobile: 'header.nav.time',
    icon: ClockIcon,
  },

  team: {
    schema: '/team',
    build: () => '/team',

    desktopOrder: 1.5,
    mobileOrder: 1.5,

    showInMenu: true,
    translateKeyDesktop: 'header.nav.team',
    translateKeyMobile: 'header.nav.team',
    icon: PeopleIcon,
  },

  agents: {
    schema: '/agents',
    build: () => '/agents',

    desktopOrder: 1.7,
    mobileOrder: 1.7,

    showInMenu: true,
    translateKeyDesktop: 'header.nav.agents',
    translateKeyMobile: 'header.nav.agents',
    icon: MagicWandIcon,
  },

  profile: {
    schema: '/profile/:id',
    build: ({ id }) => `/profile/${id}`,

    desktopOrder: 3,
    mobileOrder: 3,

    icon: PersonIcon,
    showInMenu: true,
    translateKeyDesktop: 'header.nav.profile',
    translateKeyMobile: 'header.nav.profile',
    children: {
      edit: {
        schema: '/profile/:id/edit',
        build: ({ id }) => `/profile/${id}/edit`,
      },
    },
  },

  // Singular, matching `/invoice/:id` and the API it reads from: `/invoice`
  // is every invoice, `/invoice/:id` is one of them. `/invoices` still
  // resolves here - see the redirect in app.tsx.
  invoices: {
    schema: '/invoice',
    build: () => '/invoice',

    desktopOrder: 2,
    mobileOrder: 2,

    showInMenu: true,
    translateKeyDesktop: 'header.nav.invoices',
    translateKeyMobile: 'header.nav.invoices',
    icon: FileTextIcon,
  },

  // The profile editor under its own name: the same form as
  // `/profile/:id/edit`, reached without knowing one's id.
  settings: {
    schema: '/settings',
    build: () => '/settings',

    desktopOrder: 3.5,
    mobileOrder: 3.5,

    showInMenu: true,
    translateKeyDesktop: 'header.nav.settings',
    translateKeyMobile: 'header.nav.settings',
    icon: MixerHorizontalIcon,
  },

  docs: {
    schema: 'https://address.work/docs',
    build: () => 'https://address.work/docs',
    target: '_blank',

    translateKeyDesktop: 'header.nav.helpCenter',
    translateKeyMobile: 'header.nav.helpCenter',

    desktopOrder: 4,
    mobileOrder: 4,

    icon: QuestionMarkCircledIcon,
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
  routes.time.schema,
  routes.team.schema,
  routes.agents.schema,
  routes.profile.schema,
  routes.invoices.schema,
  routes.settings.schema,
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

export { returnPathFrom, returnState } from './return-path'

export { type MappingRoute } from './types'
