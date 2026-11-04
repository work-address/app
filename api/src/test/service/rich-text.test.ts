import { expect } from 'chai'
import { suite, test } from '@testdeck/mocha'

import { sanitizeRichText } from '@/service/rich-text'

@suite()
export class RichTextTest {
  @test()
  keepsWhatTheEditorWrites() {
    const html = [
      '<p>Plain <strong>bold</strong> <em>italic</em> <u>under</u> <s>gone</s></p>',
      '<h2>Heading</h2>',
      '<blockquote><p>Quote</p></blockquote>',
      '<ul><li><p>One</p></li></ul>',
      '<ol start="3"><li><p>Three</p></li></ol>',
      '<pre><code>const a = 1</code></pre>',
      '<p>Line<br />break</p>',
      '<hr />',
    ].join('')

    expect(sanitizeRichText(html)).to.equal(html)
  }

  @test()
  keepsAlignmentButNoOtherStyle() {
    expect(
      sanitizeRichText(
        '<p style="text-align: center; position: fixed; inset: 0">Hi</p>',
      ),
    ).to.equal('<p style="text-align:center">Hi</p>')
    expect(sanitizeRichText('<p style="text-align: url(x)">Hi</p>')).to.equal(
      '<p>Hi</p>',
    )
  }

  @test()
  keepsSafeLinksAndHardensThem() {
    expect(
      sanitizeRichText('<a href="https://example.com" target="_self">x</a>'),
    ).to.equal(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">x</a>',
    )
  }

  @test()
  dropsEveryRouteToRunningCode() {
    const attacks = [
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
    ]

    for (const attack of attacks) {
      expect(sanitizeRichText(attack), attack).to.not.match(
        /<script|<img|<svg|<iframe|<object|<embed|<form|<style|<math|on\w+=|javascript:|data:|href="\/\//i,
      )
    }
  }

  @test()
  isStableWhenAppliedAgain() {
    const once = sanitizeRichText(
      '<p style="text-align: right">A &amp; B <a href="https://example.com">x</a></p>',
    )

    expect(sanitizeRichText(once)).to.equal(once)
  }
}
