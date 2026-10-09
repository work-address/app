import { Skeleton } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Wrapper } from '../../wrapper'

import type { RouteSkeletonVariant } from '../model'

type Props = {
  variant?: RouteSkeletonVariant
  className?: string
}

/** A stable page shape while its route module loads, retaining the app shell. */
export const RouteSkeleton = ({ variant = 'document', className }: Props) => {
  const { t } = useTranslation()

  return (
    <Root
      data-variant={variant}
      className={className}
      role="status"
      aria-live="polite"
    >
      <Wrapper width={variant === 'document' ? 'document' : 'full'}>
        <span className="sr-only">{t('ui.routeSkeleton.loading')}</span>
        <Content aria-hidden="true">
          <Header>
            <Skeleton width="min(260px, 70%)" height="35px" />
            <Skeleton width="min(440px, 90%)" height="20px" />
          </Header>
          {variant === 'list' && (
            <Summary>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} height="86px" />
              ))}
            </Summary>
          )}
          <Panel>
            <Skeleton width="min(220px, 60%)" height="28px" />
            <Rows>
              {Array.from(
                { length: variant === 'auth' ? 4 : 6 },
                (_, index) => (
                  <Skeleton
                    key={index}
                    height={variant === 'auth' ? '44px' : '36px'}
                  />
                ),
              )}
            </Rows>
          </Panel>
        </Content>
      </Wrapper>
    </Root>
  )
}

const Root = styled.div`
  width: 100%;
  min-height: 60vh;

  &[data-variant='auth'] {
    min-height: 70vh;
    width: min(720px, calc(100vw - 2 * var(--space-4)));
    margin-inline: auto;
  }
`

const Content = styled.div`
  display: grid;
  gap: var(--space-5);
`

const Header = styled.div`
  display: grid;
  gap: var(--space-2);
`

const Summary = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);

  ${(p) => p.theme.breakpoints.down('md')} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

const Panel = styled.div`
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--gray-a6);
  border-radius: var(--radius-3);
`

const Rows = styled.div`
  display: grid;
  gap: var(--space-3);
`
