/**
 * The value the phone app puts in the pairing address, as `client=phone`, to
 * say it started the pairing: `/connect?nonce=…&client=phone`.
 */
export const PHONE_CLIENT = 'phone'

/**
 * Where the connected page sends the phone back to the app. A fixed address,
 * never one read from the page's own: nothing in a link can point this page at
 * another app or site. It carries no secret, since the app still collects its
 * token by polling the pairing.
 */
export const PHONE_APP_RETURN_URL = 'work.address.timetracker://connected'

/** Whether the phone app opened the pairing. Only the exact value counts. */
export const isPhoneClient = (raw: string | null): boolean =>
  raw === PHONE_CLIENT

type ReturnWindow = { location: { assign: (url: string) => void } }

/**
 * One attempt to hand the phone back to the app once it is connected. A
 * browser may ignore a move to an app that no tap asked for, so the page's
 * "Return to the app" link has to stand on its own.
 */
export const returnToPhoneApp = (win: ReturnWindow): void => {
  win.location.assign(PHONE_APP_RETURN_URL)
}
