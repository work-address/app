import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Button } from '@/shared'

type Props = {
  className?: string
  /** A presentation is hosted here, so there is something to take down. */
  hosted: boolean
  /** The profile has at least one field worth committing. */
  publishable: boolean
  /** The permanence notice has been read. */
  acknowledged: boolean
  removing: boolean
  onPublish: () => void
  onWithdraw: () => void
  onRemove: () => void
  onExport: () => void
}

/**
 * The four things a holder can do, and the two of them that go to the chain.
 * Withdrawing and republishing are gated on the acknowledgement as publishing
 * is: both are transactions the chain keeps forever.
 */
export const IdentityCardActions = ({
  className,
  hosted,
  publishable,
  acknowledged,
  removing,
  onPublish,
  onWithdraw,
  onRemove,
  onExport,
}: Props) => {
  const { t } = useTranslation()

  return (
    <Root className={className}>
      <Button disabled={!acknowledged || !publishable} onClick={onPublish}>
        {t(hosted ? 'identity.actions.republish' : 'identity.actions.publish')}
      </Button>
      {hosted && (
        <>
          <Button
            variant="outline"
            color="danger"
            disabled={!acknowledged}
            onClick={onWithdraw}
          >
            {t('identity.actions.withdraw')}
          </Button>
          <Button
            variant="outline"
            color="neutral"
            loading={removing}
            disabled={removing}
            onClick={onRemove}
          >
            {t('identity.actions.remove')}
          </Button>
          <Button variant="ghost" color="neutral" onClick={onExport}>
            {t('identity.actions.export')}
          </Button>
        </>
      )}
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  /* auto-fill over a min() rather than a column flow: four buttons in one row
     is what makes this card wider than a 375px screen, and the min() inside
     minmax keeps a single column from being wider than the card itself. */
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
  gap: var(--space-3);
`
