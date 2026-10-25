/**
 * Demo mode - the app answers itself from in-browser mock handlers instead of
 * the API, so `pnpm dev` needs no backend, database or wallet
 * (docs/demo-mode.md).
 *
 * On by default in development; opt out with `VITE_DEMO=false` (`pnpm
 * dev:live`) to talk to the API at VITE_API_URL. A build is the other way
 * round: off unless `VITE_DEMO=true` (`pnpm build:demo`). A plain `pnpm build`
 * is never in demo mode, and because the guard in `main.tsx` is made of
 * literals Vite inlines, the mock layer is dropped from that bundle entirely.
 */
export const DEMO_MODE: boolean = import.meta.env.DEV
  ? import.meta.env.VITE_DEMO !== 'false'
  : import.meta.env.VITE_DEMO === 'true'
