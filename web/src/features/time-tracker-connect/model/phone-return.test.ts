import { describe, expect, it, vi } from 'vitest'

import {
  isPhoneClient,
  PHONE_APP_RETURN_URL,
  returnToPhoneApp,
} from './phone-return'

describe('isPhoneClient', () => {
  it('takes the exact value the phone app sends', () => {
    expect(isPhoneClient('phone')).toBe(true)
  })

  it.each([
    ['nothing', null],
    ['an empty value', ''],
    ['another case', 'Phone'],
    ['surrounding space', ' phone '],
    ['the desktop', 'desktop'],
    ['a link to the app', 'work.address.timetracker://connected'],
    ['a link elsewhere', 'https://evil.example/'],
  ])('refuses %s', (_label, raw) => {
    expect(isPhoneClient(raw)).toBe(false)
  })
})

describe('returnToPhoneApp', () => {
  it("goes to the app's fixed address, which carries no secret", () => {
    const win = { location: { assign: vi.fn() } }

    returnToPhoneApp(win)

    expect(win.location.assign).toHaveBeenCalledExactlyOnceWith(
      'work.address.timetracker://connected',
    )
    expect(PHONE_APP_RETURN_URL).toBe('work.address.timetracker://connected')
  })
})
