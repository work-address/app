import styled from 'styled-components'

type Props = {
  iconUrl: string
  iconAlt: string
  children: string
  onClick?: () => void
}

export const AuthProviderButton = ({
  children,
  iconAlt,
  iconUrl,
  onClick,
}: Props) => {
  return (
    <Button onClick={onClick} type={'button'}>
      <Icon src={iconUrl} alt={iconAlt} />
      <Text>{children}</Text>
    </Button>
  )
}

export const Button = styled.button`
  width: 100%;
  border-radius: 8px;
  background: var(--white);
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 12px;
  color: var(--ds-accent-11);

  &:hover {
    background: var(--c-rgba-0-0-51-0_02);
  }

  ${({ theme }) => theme.breakpoints.up('md')} {
    padding: 0 14px;
    height: 76px;
    border: 1px solid var(--c-rgba-0-0-51-0_12);
  }
`

export const Icon = styled.img`
  height: 32px;
  width: 32px;
  display: block;

  ${({ theme }) => theme.breakpoints.up('md')} {
    width: 52px;
    height: 52px;
  }
`

export const Text = styled.div`
  font-weight: 500;
  font-size: var(--font-size-4);
  line-height: 24px;
  font-family: Inter, sans-serif;
  color: var(--ds-accent-11);
  letter-spacing: -0.45px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    color: var(--c-rgba-0-7-20-0_82);
    letter-spacing: 0.54px;
  }
`
