import { motion, useReducedMotion } from 'motion/react'
import styled from 'styled-components'

import type { ReactNode } from 'react'

import { SectionTitle } from '@/shared'

type Props = {
  children?: ReactNode
  /** A white workspace panel; off for the head, which sits on the canvas. */
  surface?: boolean
  className?: string
}

/** Stagger for the sections of the profile. */
export const PROFILE_VIEW_REVEAL_LIST = {
  shown: { transition: { staggerChildren: 0.06 } },
}

const REVEAL = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.24 } },
}

const REVEAL_STILL = { hidden: { opacity: 1 }, shown: { opacity: 1 } }

/**
 * One part of the profile, on its own white panel, so a part with nothing to
 * say costs nothing by rendering nothing.
 */
export const ProfileViewSection = ({
  children,
  surface = true,
  className,
}: Props) => {
  const reducedMotion = useReducedMotion()

  return (
    <Root
      className={className}
      data-surface={surface || undefined}
      variants={reducedMotion ? REVEAL_STILL : REVEAL}
    >
      {children}
    </Root>
  )
}

/** A panel's title, with a quiet icon saying what kind of panel it is. */
export const ProfileViewSectionHead = ({
  title,
  icon,
}: {
  title: ReactNode
  icon: ReactNode
}) => (
  <Head>
    <SectionTitle>{title}</SectionTitle>
    {icon}
  </Head>
)

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ui-space-3);
  color: var(--ui-muted);

  svg {
    flex-shrink: 0;
    width: var(--ui-icon-size);
    height: var(--ui-icon-size);
  }
`

const Root = styled(motion.div)`
  display: grid;
  gap: var(--ui-space-4);
  min-width: 0;

  &[data-surface] {
    padding: var(--ui-card-inset);
    border: var(--ui-border-width) solid var(--ui-edge);
    border-radius: var(--ui-radius);
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
  }

  ${(p) => p.theme.breakpoints.down('md')} {
    &[data-surface] {
      padding: var(--ui-card-inset-mobile);
    }
  }
`
