/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

import 'styled-components'
import type { theme } from '@/features/shared'

type CustomTheme = typeof theme

declare module 'styled-components' {
  export interface DefaultTheme extends CustomTheme {}
}

declare module '*.svg?react' {
  import type React from 'react'
  const SVG: React.VFC<React.SVGProps<SVGSVGElement>>
  export default SVG
}
