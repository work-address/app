import type {
  Route,
  IdRouteBuild,
  NoChildRoutes,
  MappingRoute,
} from './types.ts'

/* eslint-disable */
type MainRoutes =
  & Route<'/', 'dashboard'>
  & Route<'/sign-in', 'signIn'>
  & Route<'/profile', 'profile', ProfileRoutes>
  & Route<'/help', 'helpCenter'>
  & Route<'/time-tracker', 'timeTracker'>
  & Route<'/download', 'download'>
  & Route<'https://github.com', 'github'>

type ProfileRoutes =
  & Route<'/profile/freelancer/:id', 'freelancer', NoChildRoutes,  IdRouteBuild>
  & Route<'/profile/edit', 'edit', NoChildRoutes>

/* eslint-enable */

/* Схема сайта. Роут выводится в меню если прописан order.
  Поле text в приоритете вывода, если не хочется
  добавлять translateKey и искать словарь */
export const routes: MainRoutes = {
  dashboard: {
    schema: '/',

    desktopOrder: 0,
    mobileOrder: 1,

    showInMenu: true,
    translateKeyDesktop: 'header.nav.dashboard',
    translateKeyMobile: 'header.nav.dashboard',
    mobileIcon: '/img/icons/dashboard.svg',
  },

  profile: {
    schema: '/profile',

    desktopOrder: 1,
    mobileOrder: 0,

    mobileIcon: '/img/icons/person.svg',
    showInMenu: true,
    translateKeyDesktop: 'header.nav.profile',
    translateKeyMobile: 'header.nav.profile',
    children: {
      freelancer: {
        schema: '/profile/freelancer/:id',
        build: ({ id }) => `/profile/freelancer/${id}`,
        disabled: true,
      },

      edit: {
        schema: '/profile/edit',
      },
    },
  },

  helpCenter: {
    schema: '/help',

    translateKeyDesktop: 'header.nav.helpCenter',
    translateKeyMobile: 'header.nav.helpCenter',

    desktopOrder: 2,
    mobileOrder: 2,

    mobileIcon: '/img/icons/question-mark-circled.svg',
  },

  timeTracker: {
    schema: '/time-tracker',

    mobileOrder: 3,

    translateKeyMobile: 'heaver.nav.timeTracker',
    mobileIcon: '/img/icons/time-tracker.svg',
  },

  download: {
    schema: '/download',

    desktopOrder: 3,

    translateKeyDesktop: 'header.nav.download',
    desktopIcon: '/img/icons/external-link.svg',
    mobileIcon: '/img/icons/external-link.svg',
    target: '_blank',

    desktopRender: 'textWithIcon',
  },

  github: {
    schema: 'https://github.com',

    desktopOrder: 4,
    mobileOrder: 4,

    desktopIcon: '/img/photo/github-logo.svg',
    mobileIcon: '/img/photo/github-logo.svg',
    translateKeyDesktop: 'header.aria.github',
    translateKeyMobile: 'header.aria.github',
    target: '_blank',

    desktopRender: 'icon',
  },

  signIn: {
    schema: '/sign-in',
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
