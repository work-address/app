import { motion, useReducedMotion } from 'motion/react'
import styled from 'styled-components'

import type { ReactNode } from 'react'

type Props = {
  children?: ReactNode
  className?: string
}

/** Stagger for the sections inside the profile's card. */
export const PROFILE_VIEW_REVEAL_LIST = {
  shown: { transition: { staggerChildren: 0.06 } },
}

const REVEAL = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.24 } },
}

const REVEAL_STILL = { hidden: { opacity: 1 }, shown: { opacity: 1 } }

/**
 * One band of the profile's card. A hairline parts it from the band above, so
 * a band with nothing to say costs nothing by rendering nothing.
 */
export const ProfileViewSection = ({ children, className }: Props) => {
  const reducedMotion = useReducedMotion()

  return (
    <Root
      className={className}
      variants={reducedMotion ? REVEAL_STILL : REVEAL}
    >
      {children}
    </Root>
  )
}

const Root = styled(motion.div)`
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-5);

  & + & {
    border-top: 1px solid var(--ds-neutral-alpha-6);
  }

  /* The card has no chrome on a phone (see profile-view.tsx), so a second
     inset inside it would push the content in twice. */
  ${(p) => p.theme.breakpoints.down('md')} {
    padding: var(--space-4) 0;
  }
`
