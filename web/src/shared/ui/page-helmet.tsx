import { Helmet, type HelmetProps } from 'react-helmet-async'

import { formatPageTitle } from '@/shared/lib/app-document-title'

type PageHelmetProps = Omit<
  HelmetProps,
  'title' | 'defaultTitle' | 'titleTemplate'
> & {
  title: string
}

export function PageHelmet({ title, ...props }: PageHelmetProps) {
  return <Helmet {...props} title={formatPageTitle(title)} />
}
