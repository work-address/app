import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { IconImg } from '../styled'

import { routes } from '@/routes'
import { Button, PersonIcon, formatWalletAddress } from '@/shared'

type Props = {
  user: {
    name?: string | null
    title?: string | null
    friendlyWalletAddress?: string | null
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
    <Button variant="ghost" color="neutral" stretch={stretch}>
      <UserBox>
        <UserAvatar>
          <IconImg src={PersonIcon} alt={userAlt} />
        </UserAvatar>
        <UserText>
          <UserName>{user?.name || user?.title || ''}</UserName>
          <UserSub>
            {formatWalletAddress(user?.friendlyWalletAddress || '')}
          </UserSub>
        </UserText>
      </UserBox>
    </Button>
  </Root>
)

const Root = styled(NavLink)`
  &[data-stretch] {
    width: 100%;
  }
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
  font-size: 14px;
  line-height: 16px;
  font-weight: 500;
  color: var(--ds-neutral-12);
`

const UserSub = styled.span`
  font-size: 12px;
  line-height: 14px;
  font-weight: 400;
  color: var(--muted);
`
