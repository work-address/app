import { Helmet, type HelmetProps } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { formatPageTitle } from '../lib/app-document-title'

type PageHelmetProps = Omit<
  HelmetProps,
  'title' | 'defaultTitle' | 'titleTemplate' | 'htmlAttributes'
> & {
  title: string
  /** What a visitor can do here, in a sentence. */
  description?: string
  /**
   * Keeps the page out of search: anything behind sign-in, a person's own
   * records and every form. Public pages get a canonical link instead.
   */
  noindex?: boolean
  /** Open Graph type: `profile` for a person, `website` otherwise. */
  ogType?: 'website' | 'profile'
}

export function PageHelmet({
  title,
  description,
  noindex = false,
  ogType = 'website',
  ...props
}: PageHelmetProps) {
  const { i18n } = useTranslation()
  const { pathname } = useLocation()
  const fullTitle = formatPageTitle(title)
  const canonical = `${window.location.origin}${pathname}`

  return (
    // The document language follows the UI language on every page, so
    // pages no longer pass it one by one.
    <Helmet
      {...props}
      htmlAttributes={{ lang: i18n.language }}
      title={fullTitle}
    >
      {description ? <meta name="description" content={description} /> : null}
      <meta
        name="robots"
        content={noindex ? 'noindex, nofollow' : 'index, follow'}
      />
      {noindex ? null : <link rel="canonical" href={canonical} />}
      <meta property="og:title" content={fullTitle} />
      {description ? (
        <meta property="og:description" content={description} />
      ) : null}
      <meta property="og:type" content={ogType} />
      {noindex ? null : <meta property="og:url" content={canonical} />}
    </Helmet>
  )
}
