/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

import 'styled-components'
import type { theme } from '@/shared'

type CustomTheme = typeof theme

declare module 'styled-components' {
  export interface DefaultTheme extends CustomTheme {}
}

declare module '*.svg?react' {
  import type React from 'react'
  const SVG: React.VFC<React.SVGProps<SVGSVGElement>>
  export default SVG
}

interface ImportMetaEnv {
  readonly VITE_GIT_COMMIT_SUFFIX: string
  readonly VITE_WEBSITE_ORIGINS?: string
  readonly VITE_MAP_TILE_URL?: string
  readonly VITE_MAP_TILE_ATTRIBUTION?: string
}
