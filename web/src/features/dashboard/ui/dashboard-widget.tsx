import { Skeleton } from '@radix-ui/themes'
import styled from 'styled-components'

import type { ReactNode } from 'react'

import { LoadFailure, SectionTitle, StateNotice } from '@/shared'

type Props = {
  title: string
  /** Beside the title: a count, a link. */
  aside?: ReactNode
  loading?: boolean
  failed?: boolean
  onRetry?: () => void
  /** Shown instead of the content when set. */
  empty?: { title: string; description?: string }
  children: ReactNode
  className?: string
}

/**
 * One dashboard tile: a bordered card with its title inside, and the same
 * loading, failure and empty states in each - so a failed chart never takes
 * its neighbours down with it. Every tile wears the same chrome as the stat
 * tiles above them, so the page reads as one grid.
 */
export const DashboardWidget = ({
  title,
  aside,
  loading,
  failed,
  onRetry,
  empty,
  children,
  className,
}: Props) => (
  <Root className={className}>
    <Head>
      <Title>{title}</Title>
      {aside}
    </Head>
    <Body>
      {failed && onRetry ? (
        <LoadFailure title={title} onRetry={onRetry} />
      ) : loading ? (
        <Skeleton loading>
          <Placeholder />
        </Skeleton>
      ) : empty ? (
        <Empty>
          <StateNotice title={empty.title} description={empty.description} />
        </Empty>
      ) : (
        children
      )}
    </Body>
  </Root>
)

/** No tile grows past this; what does not fit scrolls inside its body. */
const MAX_HEIGHT = 500

/* The tile takes whatever height the row gives it, so two side by side end
   on the same line whatever each holds - up to the ceiling. */
const Root = styled.section`
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  height: 100%;
  max-height: ${MAX_HEIGHT}px;
  border: 1px solid var(--ds-neutral-alpha-6);
  border-radius: var(--radius-3);
  background: var(--color-panel-solid);
`

/* Wraps, so a tile's tools drop under its title when the tile runs narrow. */
const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  min-height: 32px;
  padding: var(--space-4) var(--space-4) 0;
`

/* A step down from the page's section size: inside a card the title is a
   label, not a heading between blocks. */
const Title = styled(SectionTitle)`
  font-size: var(--font-size-4);
  font-weight: 600;
`

const Body = styled.div`
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: var(--space-4);
`

/* A tile takes its row's height whatever it holds; an empty notice sits in
   the middle of that rather than leaving the bottom two thirds blank. */
const Empty = styled.div`
  display: grid;
  align-content: center;
  height: 100%;
`

const Placeholder = styled.div`
  height: 220px;
  border-radius: var(--radius-3);
`
