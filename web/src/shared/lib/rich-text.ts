import DOMPurify from 'dompurify'

const ALIGNMENT = /^text-align:\s*(left|right|center|justify);?$/i
const LINK_SCHEME = /^(?:https?:|mailto:|tel:)/i

/**
 * What the profile's rich text editor can produce, and nothing else. Keep it in
 * step with `api/src/service/rich-text.ts`, which applies the same list when a
 * bio is saved and read.
 */
const POLICY = {
  ALLOWED_TAGS: [
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
  ALLOWED_ATTR: ['href', 'target', 'rel', 'start', 'style'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOWED_URI_REGEXP: LINK_SCHEME,
  // DOMPurify holds other attributes to the URI pattern too, unless told not to:
  // a list's `start="3"` is not a URL and would otherwise be stripped.
  ADD_URI_SAFE_ATTR: ['start'],
}

// DOMPurify treats `style` as all or nothing, and an overlay built from
// `position: fixed` is no safer for having no script in it. Only a paragraph's
// alignment survives, and a link never gets a handle on this page.
//
// Outside a browser DOMPurify has no DOM and no hooks; this module only gets
// imported there, through the shared barrel, and never asked to sanitize.
if (DOMPurify.isSupported) {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const style = node.getAttribute('style')?.trim()

    if (
      style !== undefined &&
      (node.tagName !== 'P' || !ALIGNMENT.test(style))
    ) {
      node.removeAttribute('style')
    }

    if (node.tagName !== 'OL') {
      node.removeAttribute('start')
    }

    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow')
    } else {
      node.removeAttribute('href')
      node.removeAttribute('target')
      node.removeAttribute('rel')
    }
  })
}

/** User-written HTML, reduced to what is safe to put in the page. */
export const sanitizeRichText = (html: string): string =>
  DOMPurify.sanitize(html, POLICY)
