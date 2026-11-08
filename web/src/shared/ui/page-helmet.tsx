import { Helmet, type HelmetProps } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

import { formatPageTitle } from '../lib/app-document-title'

type PageHelmetProps = Omit<
  HelmetProps,
  'title' | 'defaultTitle' | 'titleTemplate' | 'htmlAttributes'
> & {
  title: string
  /** What a visitor can do here, in a sentence. */
  description?: string
  /** Open Graph type: `profile` for a person, `website` otherwise. */
  ogType?: 'website' | 'profile'
}

export function PageHelmet({
  title,
  description,
  ogType = 'website',
  ...props
}: PageHelmetProps) {
  const { i18n } = useTranslation()
  const fullTitle = formatPageTitle(title)

  return (
    // The document language follows the UI language on every page, so
    // pages no longer pass it one by one. Nothing here is for search engines:
    // index.html's robots tag covers every route (see public/robots.txt).
    <Helmet
      {...props}
      htmlAttributes={{ lang: i18n.language }}
      title={fullTitle}
    >
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:title" content={fullTitle} />
      {description ? (
        <meta property="og:description" content={description} />
      ) : null}
      <meta property="og:type" content={ogType} />
    </Helmet>
  )
}
