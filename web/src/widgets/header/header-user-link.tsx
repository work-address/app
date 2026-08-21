import { QRCodeSVG } from 'qrcode.react'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { routes } from '@/routes'
import { Button, PremiumBadge, formatWalletAddress } from '@/shared'

type Props = {
  user: {
    name?: string | null
    title?: string | null
    friendlyWalletAddress?: string | null
    premium?: boolean | null
  } | null
  userAlt: string
  stretch?: boolean
}

export const HeaderUserLink = ({ user, userAlt, stretch }: Props) => (
  <Root
    to={routes.profile.build({
      walletAddress: user?.friendlyWalletAddress ?? '',
    })}
    data-stretch={stretch || undefined}
  >
    <ProfileButton variant="ghost" color="neutral" stretch={stretch}>
      <UserBox>
        <UserAvatar role="img" aria-label={userAlt}>
          <QRCodeSVG
            value={user?.friendlyWalletAddress || ''}
            size={28}
            level="M"
            fgColor="var(--ds-accent-11)"
            bgColor="transparent"
            marginSize={0}
          />
        </UserAvatar>
        <UserText>
          <UserName>{user?.name || user?.title || ''}</UserName>
          <UserSubRow>
            <UserSub>
              {formatWalletAddress(user?.friendlyWalletAddress || '')}
            </UserSub>
            {user?.premium && <PremiumBadge />}
          </UserSubRow>
        </UserText>
      </UserBox>
    </ProfileButton>
  </Root>
)

const Root = styled(NavLink)`
  &[data-stretch] {
    width: 100%;
  }
`

const ProfileButton = styled(Button)`
  padding-inline-start: 1px;
`

const UserBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
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
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: start;
`

const UserName = styled.span`
  font-size: var(--font-size-2);
  line-height: 16px;
  font-weight: 500;
  color: var(--ds-neutral-12);
`

const UserSubRow = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`

const UserSub = styled.span`
  font-size: var(--font-size-1);
  line-height: 14px;
  font-weight: 400;
  color: var(--muted);
`
