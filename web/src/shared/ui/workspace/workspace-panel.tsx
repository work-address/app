import { Skeleton } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { LoadFailure, StateNotice } from '../state-screens/state-notice'

import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: ReactNode
  /** Beside the title: a count, a link, or related actions. */
  aside?: ReactNode
  /** Filters or search kept visible while the content loads, fails or is empty. */
  toolbar?: ReactNode
  loading?: boolean
  failed?: boolean
  onRetry?: () => void
  /** Shown instead of the content when set. */
  empty?: { title: string; description?: string }
  /** Cap the desktop panel and scroll its body; phones always use natural height. */
  bounded?: boolean
  children: ReactNode
  className?: string
}

/** A white workspace surface with consistent loading, failure and empty states. */
export const WorkspacePanel = ({
  title,
  description,
  aside,
  toolbar,
  loading,
  failed,
  onRetry,
  empty,
  bounded = false,
  children,
  className,
}: Props) => {
  const { t } = useTranslation()

  return (
    <Root className={className} data-bounded={bounded || undefined}>
      <Header>
        <Heading>
          <Title>{title}</Title>
          {description ? <Description>{description}</Description> : null}
        </Heading>
        {aside}
      </Header>
      <Body data-has-toolbar={Boolean(toolbar) || undefined}>
        {toolbar ? <Toolbar>{toolbar}</Toolbar> : null}
        <Content>
          {failed ? (
            onRetry ? (
              <LoadFailure title={title} onRetry={onRetry} />
            ) : (
              <StateNotice
                tone="error"
                title={title}
                description={t('common.loadFailure.description')}
              />
            )
          ) : loading ? (
            <Skeleton loading>
              <Placeholder />
            </Skeleton>
          ) : empty ? (
            <Empty>
              <StateNotice
                title={empty.title}
                description={empty.description}
              />
            </Empty>
          ) : (
            children
          )}
        </Content>
      </Body>
    </Root>
  )
}

const Root = styled.section`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  height: 100%;
  border: var(--ui-border-width) solid var(--ui-edge);
  border-radius: var(--ui-radius);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow);

  &[data-bounded] {
    max-height: var(--ui-panel-max-height);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    --ui-card-inset: var(--ui-card-inset-mobile);

    height: auto;

    &[data-bounded] {
      max-height: none;
    }
  }
`

const Header = styled.div`
  /* Arbitrary tool widths need content-based wrapping; fixed grid tracks
     either squeeze the title or wrap every header before it needs to. */
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--ui-space-2) var(--ui-space-3);
  min-height: var(--ui-panel-header-min-height);
  padding: var(--ui-card-inset) var(--ui-card-inset) 0;
`

const Heading = styled.div`
  display: grid;
  gap: var(--ui-space-1);
  min-width: 0;
  flex: 1;
`

const Title = styled.h2`
  margin: 0;
  color: var(--ui-ink);
  font-size: var(--ui-heading-size);
  line-height: var(--ui-heading-line-height);
  font-weight: var(--ui-heading-weight);
  letter-spacing: var(--ui-heading-tracking);
`

const Description = styled.div`
  color: var(--ui-muted);
  font-size: var(--ui-meta-size);
  line-height: var(--ui-body-line-height);
`

const Body = styled.div`
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: var(--ui-card-content-gap) var(--ui-card-inset) var(--ui-card-inset);
  border-radius: 0 0 var(--ui-radius) var(--ui-radius);
  scrollbar-width: thin;
  scrollbar-color: var(--ui-line) transparent;

  &[data-has-toolbar] {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--ui-card-content-gap);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    padding-top: var(--ui-card-content-gap-mobile);

    &[data-has-toolbar] {
      gap: var(--ui-card-content-gap-mobile);
    }
  }
`

const Toolbar = styled.div`
  min-width: 0;
`

const Content = styled.div`
  display: contents;

  ${Body}[data-has-toolbar] & {
    display: block;
    min-width: 0;
    min-height: 0;
  }
`

const Empty = styled.div`
  display: grid;
  align-content: center;
  height: 100%;
`

const Placeholder = styled.div`
  height: var(--ui-placeholder-height);
  border-radius: var(--ui-row-radius);
`
