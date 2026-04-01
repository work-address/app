import 'styled-components'
import type { theme } from '@/features/shared'

type CustomTheme = typeof theme

declare module 'styled-components' {
  export interface DefaultTheme extends CustomTheme {}
}
