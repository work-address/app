import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { $chipIdentity, $chipState, identityChipRequested } from '../../model'

import { IdentityChip } from './identity-chip'

type Props = {
  className?: string
  /** The profile being read, not the account reading it. */
  address: string | null | undefined
}

/** The chip, asking the API about the profile the page is showing. */
export const IdentityProfileChip = ({ className, address }: Props) => {
  const { state, view, request } = useUnit({
    state: $chipState,
    view: $chipIdentity,
    request: identityChipRequested,
  })

  useEffect(() => {
    if (address) {
      request(address)
    }
  }, [address, request])

  return (
    <IdentityChip
      className={className}
      state={state}
      version={view?.version ?? null}
    />
  )
}
