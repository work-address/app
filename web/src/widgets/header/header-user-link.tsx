import { QRCodeSVG } from 'qrcode.react'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { premiumState } from '@/features/dashboard'
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
    /** False on a self-hosted instance: no plan, so no badge either way. */
    billing?: boolean | null
  } | null
  userAlt: string
  stretch?: boolean
}

export const HeaderUserLink = ({
  user,
  userAlt,
  stretch,
  onNoPremiumClick,
}: Props) => {
  const displayName = user?.name || user?.title || ''
  const state = premiumState(user)
  const badge =
    state === 'premium' ? (
      <PremiumBadge />
    ) : state === 'free' ? (
      <NoPremiumBadge onClick={onNoPremiumClick} />
    ) : null

  /**
   * A stretched link rather than an anchor wrapping the card, and a plain
   * shell rather than a Button: the "No premium" badge is a button, and
   * nesting it in either one is invalid HTML with broken keyboard navigation.
   * The link covers the card as a sibling instead, and the badge sits above
   * it.
   */
  return (
    <Root data-stretch={stretch || undefined}>
      <ProfileCard data-stretch={stretch || undefined}>
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
          <UserText>
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
  display: inline-flex;
  /* Free to give way when the row around it runs out of room - in the mobile
     header it shares that row with the logo and the burger. */
  min-width: 0;
  border-radius: 8px;
  background: var(--ds-neutral-2);
  transition: background 0.15s ease;

  &[data-stretch] {
    width: 100%;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 32px;
  padding: 0 6px 0 1px;
  gap: 8px;
  border: 1px solid transparent;
  font-size: 14px;
  line-height: 1;
  white-space: nowrap;
  color: var(--ds-neutral-11);

  &[data-stretch] {
    width: 100%;
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
  background: var(--gray-100);
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

const UserText = styled.div`
  display: grid;
  /* gap: 4px; */
  justify-items: start;

  /* A grid item in a flex row defaults to min-width: auto, so a long display
     name cannot shrink and pushes the whole header wider. */
  min-width: 0;
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

  /* Display names are free text. Without this a long one grows the header
     button indefinitely, since nothing upstream constrains its width. */
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
