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
  height: 76px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(0, 0, 51, 0.12);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;

  &:hover {
    background: rgba(0, 0, 51, 0.02);
  }
`

export const Icon = styled.img`
  width: 52px;
  height: 52px;
  display: block;
`

export const Text = styled.div`
  font-weight: 500;
  font-size: 18px;
  line-height: 1;
  color: rgba(0, 7, 20, 0.82);
  letter-spacing: 0.54px;
  font-family: Inter, sans-serif;
`
