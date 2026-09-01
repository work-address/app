import { Theme } from '@radix-ui/themes'
import { HelmetProvider } from 'react-helmet-async'
import { ThemeProvider } from 'styled-components'

import { theme } from '../src/shared/lib/theme'

import type { Preview } from '@storybook/react-vite'

import '../src/app/app.css'
import '@radix-ui/themes/styles.css'
import '../src/shared/i18n/i18n'

const preview: Preview = {
  decorators: [
    // Mirrors main.tsx: Radix owns the colour and spacing scales the design
    // tokens build on, styled-components' theme owns the breakpoint helper.
    (Story) => (
      <Theme>
        <ThemeProvider theme={theme}>
          <HelmetProvider>
            <Story />
          </HelmetProvider>
        </ThemeProvider>
      </Theme>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
}

export default preview
