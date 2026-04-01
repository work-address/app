import styled from 'styled-components'

type HeaderProps = {
  active?: 'dashboard' | 'profile' | 'help' | 'download'
}

export default function Header({ active = 'dashboard' }: HeaderProps) {
  return (
    <HeaderRoot>
      <HeaderInner>
        <LogoLink href="/">
          <LogoImg src="/img/photo/logo.svg" alt="Logo" />
        </LogoLink>

        <Nav>
          <NavLink href="#" $active={active === 'dashboard'}>
            Dashboard
          </NavLink>
          <NavLink href="#" $active={active === 'profile'}>
            Profile
          </NavLink>
          <NavLink href="#" $active={active === 'help'}>
            Help Center
          </NavLink>
          <NavLink href="#" $active={active === 'download'} $download>
            Download
            <IconImg src="/img/icons/external-link.svg" alt="Github" />
          </NavLink>
          <IconLink href="#" aria-label="Github">
            <IconImg src="/img/photo/github-logo.svg" alt="Github" />
          </IconLink>
        </Nav>

        <Right>
          <UserBox>
            <UserAvatar>
              <IconImg src="/img/icons/person.svg" alt="User" />
            </UserAvatar>
            <UserText>
              <UserName>John Doe</UserName>
              <UserSub>EQCF9...NDOM</UserSub>
            </UserText>
          </UserBox>

          <ExitButton aria-label="Exit">
            <IconImg src="/img/icons/exit.svg" alt="Exit" />
          </ExitButton>
        </Right>
      </HeaderInner>
    </HeaderRoot>
  )
}

const HeaderRoot = styled.header`
  width: 100%;
  background: var(--bg);
`

const HeaderInner = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 28px;
`

const LogoLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`

const LogoImg = styled.img`
  width: 52px;
  height: 52px;
  display: block;
  object-fit: cover;
`

const Nav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
`

const NavLink = styled.a<{ $active?: boolean; $download?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 400;
  color: ${(p) => {
    if (p.$download) {
      return 'var(--download, #003482)'
    }
    return 'var(--primary)'
  }};
  opacity: ${(p) => (p.$download ? 1 : p.$active ? 1 : 0.8)};

  &:hover {
    opacity: 1;
  }
`

const Right = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 44px;
`

const IconLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(28, 32, 36, 0.06);
  }
`

const IconImg = styled.img`
  width: 18px;
  height: 18px;
  display: block;
`

const UserBox = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
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
`

const UserName = styled.span`
  font-size: 14px;
  line-height: 16px;
  font-weight: 500;
  color: var(--primary);
`

const UserSub = styled.span`
  font-size: 12px;
  line-height: 14px;
  font-weight: 400;
  color: var(--muted);
`

const ExitButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 8, 48, 0.27);

  &:hover {
    background: rgba(28, 32, 36, 0.06);
  }
`
