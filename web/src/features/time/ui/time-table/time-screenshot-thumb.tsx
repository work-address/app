import { ImageIcon } from '@radix-ui/react-icons'
import { useContext } from 'react'
import styled from 'styled-components'

import { TimeContext } from '../time-context'

import { toImageDataUrl } from '@/shared'

type Props = {
  screenshot?: string | null
  alt: string
  className?: string
}

/**
 * A row-sized screenshot preview, or a frame of the same size saying there
 * is none, so the rows keep one rhythm whether an entry has one or not.
 */
export const TimeScreenshotThumb = ({ screenshot, alt, className }: Props) => {
  const { t } = useContext(TimeContext)
  const src = toImageDataUrl(screenshot)

  return (
    <Root className={className} data-empty={!src || undefined}>
      {src ? (
        <Media src={src} alt={alt} loading="lazy" />
      ) : (
        <Placeholder
          role="img"
          aria-label={t('dashboard.worklogsTable.screenshotNoData')}
          title={t('dashboard.worklogsTable.screenshotNoData')}
        >
          <ImageIcon aria-hidden />
        </Placeholder>
      )}
    </Root>
  )
}

const Root = styled.span`
  display: grid;
  width: var(--ui-space-9);
  aspect-ratio: 16 / 10;
  border-radius: var(--ui-row-radius);
  background: var(--ui-inset);
  overflow: hidden;
`

const Media = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
`

const Placeholder = styled.span`
  display: grid;
  place-items: center;
  color: var(--ui-muted);
`
