import { QRCodeSVG } from 'qrcode.react'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { routes } from '@/routes'
import {
  Button,
  NoPremiumBadge,
  PremiumBadge,
  formatWalletAddress,
} from '@/shared'

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
  stretch?: boolean
}

export const HeaderUserLink = ({
  user,
  userAlt,
  stretch,
  onNoPremiumClick,
}: Props) => (
  /**
   * A stretched link rather than an anchor wrapping the card: the "No premium"
   * badge is a button, and a button inside an anchor is invalid HTML with
   * broken keyboard navigation. The link covers the card through a pseudo
   * element instead, and the badge sits above it.
   */
  <Root data-stretch={stretch || undefined}>
    <ProfileButton
      data-profile-card
      variant="ghost"
      color="neutral"
      stretch={stretch}
    >
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
            {user?.premium ? (
              <PremiumBadge />
            ) : (
              <NoPremiumBadge onClick={onNoPremiumClick} />
            )}
          </UserSubRow>
          <UserNameRow>
            <UserName>{user?.name || user?.title || ''}</UserName>
          </UserNameRow>
        </UserText>
      </UserBox>
    </ProfileButton>
    <StretchedLink
      to={routes.profile.build({
        walletAddress: user?.friendlyWalletAddress ?? '',
      })}
      aria-label={userAlt}
    />
  </Root>
)

const Root = styled.div`
  position: relative;
  display: inline-flex;
  border-radius: 8px;
  background: var(--ds-neutral-2);
  transition: background 0.15s ease;

  &[data-stretch] {
    width: 100%;
  }

  /*
   * The surface lives here rather than on the button, for two reasons.
   *
   * The stretched link covers the button as a sibling, so the pointer never
   * lands on the button and its own :hover cannot fire.
   *
   * And Button sets its background from a data-color plus data-variant
   * selector, specificity (0,3,0), which outranks anything a styled(Button)
   * wrapper declares at (0,1,0) - an override there is silently ignored.
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

const ProfileButton = styled(Button)`
  padding-inline-start: 1px;
  /* Stays transparent: Root paints the surface, so the two cannot disagree. */
  border-color: transparent;
  padding-inline-end: 6px;
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
