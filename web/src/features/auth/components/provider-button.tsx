import styled from 'styled-components'

type SignButtonProps = {
  iconUrl: string
  iconAlt: string
  children: string
  onClick?: () => void
}

export const ProviderButton = ({
  children,
  iconAlt,
  iconUrl,
  onClick,
}: SignButtonProps) => {
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
  background: #fff;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 12px;
  color: var(--accent-11);

  &:hover {
    background: rgba(0, 0, 51, 0.02);
  }

  ${({ theme }) => theme.breakpoints.up('md')} {
    padding: 0 14px;
    height: 76px;
    border: 1px solid rgba(0, 0, 51, 0.12);
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
  font-size: 18px;
  line-height: 24px;
  font-family: Inter, sans-serif;
  color: var(--accent-11);
  letter-spacing: 0px;

  ${({ theme }) => theme.breakpoints.up('md')} {
    color: rgba(0, 7, 20, 0.82);
    letter-spacing: 0.54px;
  }
`
