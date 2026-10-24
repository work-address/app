import { Skeleton } from '@radix-ui/themes'
import styled from 'styled-components'

import type { ReactNode } from 'react'

import { Card, LoadFailure, SectionTitle, StateNotice } from '@/shared'

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
 * One dashboard widget: a title over a card, and the same loading, failure
 * and empty states in each - so a failed chart never takes its neighbours
 * down with it.
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
      <SectionTitle>{title}</SectionTitle>
      {aside}
    </Head>
    {failed && onRetry ? (
      <LoadFailure title={title} onRetry={onRetry} />
    ) : loading ? (
      <Body>
        <Skeleton loading>
          <Placeholder />
        </Skeleton>
      </Body>
    ) : empty ? (
      <StateNotice title={empty.title} description={empty.description} />
    ) : (
      <Body>{children}</Body>
    )}
  </Root>
)

const Root = styled.section`
  display: grid;
  align-content: start;
  gap: var(--space-3);
  min-width: 0;
`

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 32px;
`

const Body = styled(Card)`
  min-width: 0;
  padding: var(--space-4);
`

const Placeholder = styled.div`
  height: 220px;
  border-radius: var(--radius-3);
`
