import type {
  Route,
  IdRouteParams,
  NoChildRoutes,
  MappingRoute,
} from './types.ts'

/* eslint-disable */
type MainRoutes =
  & Route<'/', 'dashboard'>
  & Route<'/sign-in', 'signIn'>
  & Route<'/profile/:walletAddress', 'profile', ProfileRoutes, { walletAddress: string }>
  & Route<'/help', 'helpCenter'>
  & Route<'/time-tracker', 'timeTracker'>
  & Route<'/download', 'download'>
  & Route<'https://github.com', 'github'>
  & Route<'https://facebook.com/:userId', 'facebook', NoChildRoutes, { userId: string }>
  & Route<'https://t.me/:userId', 'telegram', NoChildRoutes, { userId: string }>
  & Route<'https://linkedin.com/in/:userId', 'linkedin', NoChildRoutes, { userId: string }>
  & Route<'/invoice/:id', 'invoice', NoChildRoutes, IdRouteParams>

type ProfileRoutes =
  & Route<'/profile/edit', 'edit', NoChildRoutes>

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
    mobileIcon: '/img/icons/dashboard.svg',
  },

  profile: {
    schema: '/profile/:walletAddress',
    build: ({ walletAddress }) => `/profile/${walletAddress}`,

    desktopOrder: 1,
    mobileOrder: 0,

    mobileIcon: '/img/icons/person.svg',
    showInMenu: true,
    translateKeyDesktop: 'header.nav.profile',
    translateKeyMobile: 'header.nav.profile',
    children: {
      edit: {
        schema: '/profile/edit',
        build: () => '/profile/edit',
      },
    },
  },

  helpCenter: {
    schema: '/help',
    build: () => '/help',

    translateKeyDesktop: 'header.nav.helpCenter',
    translateKeyMobile: 'header.nav.helpCenter',

    desktopOrder: 2,
    mobileOrder: 2,

    mobileIcon: '/img/icons/question-mark-circled.svg',
  },

  timeTracker: {
    schema: '/time-tracker',
    build: () => '/time-tracker',

    mobileOrder: 3,

    translateKeyMobile: 'header.nav.timeTracker',
    mobileIcon: '/img/icons/time-tracker.svg',
  },

  download: {
    schema: '/download',
    build: () => '/download',

    desktopOrder: 3,

    translateKeyDesktop: 'header.nav.download',
    desktopIcon: '/img/icons/external-link.svg',
    mobileIcon: '/img/icons/external-link.svg',
    target: '_blank',

    desktopRender: 'textWithIcon',
  },

  github: {
    schema: 'https://github.com',
    build: () => 'https://github.com',

    desktopOrder: 4,
    mobileOrder: 4,

    desktopIcon: '/img/photo/github-logo.svg',
    mobileIcon: '/img/photo/github-logo.svg',
    translateKeyDesktop: 'header.aria.github',
    translateKeyMobile: 'header.aria.github',
    target: '_blank',

    desktopRender: 'icon',
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

  signIn: {
    schema: '/sign-in',
    build: () => '/sign-in',
  },

  invoice: {
    schema: '/invoice/:id',
    build: ({ id }) => `/invoice/${id}`,
  },
}

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

export type { MainRoutes }

export { type MappingRoute } from './types.ts'
