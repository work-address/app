// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { sanitizeRichText } from './rich-text'

describe('sanitizeRichText', () => {
  it('keeps what the editor writes', () => {
    const html = [
      '<p>Plain <strong>bold</strong> <em>italic</em> <u>under</u> <s>gone</s></p>',
      '<h2>Heading</h2>',
      '<blockquote><p>Quote</p></blockquote>',
      '<ul><li><p>One</p></li></ul>',
      '<ol start="3"><li><p>Three</p></li></ol>',
      '<pre><code>const a = 1</code></pre>',
      '<p style="text-align: center">Centered</p>',
    ].join('')

    expect(sanitizeRichText(html)).toBe(html)
  })

  it('keeps a safe link and hardens it', () => {
    const link = new DOMParser()
      .parseFromString(
        sanitizeRichText('<a href="https://example.com" target="_self">x</a>'),
        'text/html',
      )
      .querySelector('a')

    expect(link?.getAttribute('href')).toBe('https://example.com')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer nofollow')
  })

  it('keeps alignment but no other style', () => {
    expect(
      sanitizeRichText('<p style="position: fixed; inset: 0">Hi</p>'),
    ).toBe('<p>Hi</p>')
    expect(sanitizeRichText('<h2 style="text-align: center">Hi</h2>')).toBe(
      '<h2>Hi</h2>',
    )
    expect(sanitizeRichText('<p style="text-align: url(x)">Hi</p>')).toBe(
      '<p>Hi</p>',
    )
  })

  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(1)">',
    '<svg onload="alert(1)"></svg>',
    '<svg><script>alert(1)</script></svg>',
    '<iframe src="https://example.com"></iframe>',
    '<object data="https://example.com"></object>',
    '<embed src="https://example.com">',
    '<form action="https://example.com"><button>go</button></form>',
    '<style>body{display:none}</style>',
    '<p onclick="alert(1)">x</p>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href=" javascript:alert(1)">x</a>',
    '<a href="java&#10;script:alert(1)">x</a>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<a href="//example.com">x</a>',
    '<math><mi><style><img src=x onerror=alert(1)></style></mi></math>',
  ])('drops the route to running code in %s', (attack) => {
    expect(sanitizeRichText(attack)).not.toMatch(
      /<script|<img|<svg|<iframe|<object|<embed|<form|<style|<math|on\w+=|javascript:|data:|href="\/\//i,
    )
  })
})
