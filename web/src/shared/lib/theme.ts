import { createStyledBreakpointsTheme } from 'styled-breakpoints'

export const theme = createStyledBreakpointsTheme({
  breakpoints: {
    // styled-breakpoints v15 nests the map under `values`.
    values: {
      // `xs` has no consumers of its own — it exists so `sm` isn't the first
      // key, which is required for `breakpoints.down('sm')` to type-check.
      xs: '0px',
      sm: '440px',
      md: '768px',
      lg: '1024px',
      xl: '1200px',
    },
  },
})
