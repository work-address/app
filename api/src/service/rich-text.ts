import sanitizeHtml from 'sanitize-html'

/**
 * What the profile's rich text editor can produce, and nothing else. Keep it in
 * step with `web/src/shared/lib/rich-text.ts`, which applies the same list again
 * in the browser just before the HTML reaches the page.
 */
const RICH_TEXT_POLICY: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    ol: ['start'],
    p: ['style'],
  },
  allowedStyles: {
    p: { 'text-align': [/^(left|right|center|justify)$/] },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  // Script bodies and the like go whole rather than leaving their text behind.
  nonTextTags: ['script', 'style', 'textarea', 'noscript', 'iframe', 'object'],
  transformTags: {
    // Someone else's link never gets a handle on this page or its ranking.
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    }),
  },
}

/** User-written HTML, reduced to what is safe to put on someone else's page. */
export const sanitizeRichText = (html: string): string =>
  sanitizeHtml(html, RICH_TEXT_POLICY)
