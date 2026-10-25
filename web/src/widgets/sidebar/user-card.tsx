import { QRCodeSVG } from 'qrcode.react'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { routes } from '@/routes'
import { NoPremiumBadge, PremiumBadge, formatWalletAddress } from '@/shared'

type Props = {
  /** Brings the dismissed premium banner back. */
  onNoPremiumClick?: () => void
  user: {
    name?: string | null
    title?: string | null
    friendlyWalletAddress?: string | null
    premium?: boolean | null
  } | null
  userAlt: string
  /** The collapsed sidebar: the QR avatar alone, as wide as a nav icon row. */
  compact?: boolean
}

export const UserCard = ({
  user,
  userAlt,
  compact,
  onNoPremiumClick,
}: Props) => {
  const displayName = user?.name || user?.title || ''
  const badge = user?.premium ? (
    <PremiumBadge />
  ) : (
    <NoPremiumBadge onClick={onNoPremiumClick} />
  )

  /**
   * A stretched link rather than an anchor wrapping the card, and a plain
   * shell rather than a Button: the "No premium" badge is a button, and
   * nesting it in either one is invalid HTML with broken keyboard navigation.
   * The link covers the card as a sibling instead, and the badge sits above
   * it.
   */
  return (
    <Root data-compact={compact || undefined}>
      <ProfileCard>
        <UserBox>
          <UserAvatar role="img" aria-label={userAlt}>
            <QRCodeSVG
              value={user?.friendlyWalletAddress || ''}
              size={32}
              level="M"
              fgColor="var(--ds-accent-11)"
              bgColor="transparent"
              marginSize={0}
            />
          </UserAvatar>
          <UserText hidden={compact}>
            <UserSubRow>
              <UserSub>
                {formatWalletAddress(user?.friendlyWalletAddress || '')}
              </UserSub>
              {/* With no name below it the second row would sit empty, so the
                badge drops into it rather than crowding the address. */}
              {displayName ? badge : null}
            </UserSubRow>
            <UserNameRow>
              {displayName ? <UserName>{displayName}</UserName> : badge}
            </UserNameRow>
          </UserText>
        </UserBox>
      </ProfileCard>
      <StretchedLink
        to={routes.profile.build({
          walletAddress: user?.friendlyWalletAddress ?? '',
        })}
        aria-label={userAlt}
      />
    </Root>
  )
}

const Root = styled.div`
  position: relative;
  display: flex;
  width: 100%;
  /* Free to give way when the sidebar narrows - the name ellipsizes. */
  min-width: 0;
  border-radius: 8px;
  transition: background 0.15s ease;

  &[data-compact] {
    width: 40px;
  }

  /*
   * The surface lives here rather than on the card: the stretched link covers
   * the card as a sibling, so the pointer never lands on the card and a
   * :hover there cannot fire.
   */
  &:hover {
    background: var(--ds-neutral-alpha-3);
  }

  &:active {
    background: var(--ds-neutral-alpha-6);
  }
`

/**
 * Covers the card so the whole thing remains clickable, while leaving anything
 * with its own z-index - the badge - reachable on top of it.
 */
const StretchedLink = styled(NavLink)`
  position: absolute;
  inset: 0;
  border-radius: 8px;

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
  }
`

/**
 * The card was a ghost Button purely for its metrics - nothing ever pressed
 * it, and a <button> here wrapped the badge's own button. Those metrics are
 * inlined instead, including the transparent border, which held 1px of the
 * card's height and width.
 */
const ProfileCard = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 4px 8px 4px 0;
  font-size: 14px;
  line-height: 1;
  white-space: nowrap;
  color: var(--ds-neutral-11);

  [data-compact] > & {
    padding: 0;
  }
`

const UserBox = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
`

const UserAvatar = styled.div`
  width: 40px;
  height: 40px;
  /* Fixed, not merely sized: the QR inside is 32px, so letting the box shrink
     under a long display name squeezes it down to the code itself and the
     inset around it disappears. The name ellipsizes instead. */
  flex-shrink: 0;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

const UserText = styled.div`
  display: grid;
  /* gap: 4px; */
  justify-items: start;

  /* A grid item in a flex row defaults to min-width: auto, so a long display
     name cannot shrink and pushes the sidebar wider. */
  min-width: 0;

  &[hidden] {
    display: none;
  }
`

const UserNameRow = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
`

const UserName = styled.span`
  font-size: var(--font-size-2);
  line-height: 16px;
  font-weight: 500;
  color: var(--ds-neutral-12);

  /* Display names are free text; the sidebar's width is fixed, so a long
     one ellipsizes rather than spilling out of it. */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const UserSubRow = styled.span`
  /* Flex, not grid: a single-column grid puts the premium star on its own row
     under the address instead of beside it. */
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
`

const UserSub = styled.span`
  font-size: var(--font-size-1);
  line-height: 14px;
  font-weight: 400;
  /* color: var(--muted); */
`
