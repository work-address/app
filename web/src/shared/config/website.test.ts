import { describe, expect, it } from 'vitest'

import { parseWebsiteOrigins } from './website'

describe('parseWebsiteOrigins', () => {
  it('defaults to the production website in a build', () => {
    expect(parseWebsiteOrigins(undefined, false)).toEqual([
      'https://address.work',
    ])
    expect(parseWebsiteOrigins('', false)).toEqual(['https://address.work'])
  })

  it('adds the local website in development', () => {
    expect(parseWebsiteOrigins(undefined, true)).toEqual([
      'https://address.work',
      'http://localhost:3000',
    ])
  })

  it('reads a configured list down to its origins', () => {
    expect(
      parseWebsiteOrigins(
        ' https://work.example/en/ , http://site.test:8080',
        false,
      ),
    ).toEqual(['https://work.example', 'http://site.test:8080'])
  })

  it('drops entries that are not URLs', () => {
    expect(
      parseWebsiteOrigins('address.work,https://ok.example', false),
    ).toEqual(['https://ok.example'])
  })
})
