import { describe, expect, it } from 'vitest'

import { returnPathFrom, returnState } from './return-path'

describe('returnPathFrom', () => {
  it('goes back to the whole place the visitor asked for', () => {
    const state = returnState({
      pathname: '/time',
      search: '?project=1',
      hash: '#today',
    })

    expect(returnPathFrom(state)).toBe('/time?project=1#today')
  })

  it('has nothing to go back to without a state', () => {
    expect(returnPathFrom(null)).toBeNull()
    expect(returnPathFrom({})).toBeNull()
    expect(returnPathFrom({ from: 42 })).toBeNull()
  })

  it('never leaves the app', () => {
    expect(returnPathFrom({ from: 'https://example.com' })).toBeNull()
    expect(returnPathFrom({ from: '//example.com' })).toBeNull()
    expect(returnPathFrom({ from: String.raw`/\example.com` })).toBeNull()
  })
})
