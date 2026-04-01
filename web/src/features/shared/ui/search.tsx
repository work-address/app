import styled from 'styled-components'

type SearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const Wrap = styled.div`
  width: 280px;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(0, 8, 48, 0.12);
  background: #fff;

  &:hover {
    border-color: rgba(0, 8, 48, 0.18);
  }

  &:focus-within {
    border-color: rgba(0, 52, 130, 0.55);
  }
`

const Icon = styled.span`
  width: 18px;
  height: 18px;
  color: rgba(0, 8, 48, 0.45);
  display: inline-flex;
  align-items: center;
  justify-content: center;

  & > svg {
    width: 18px;
    height: 18px;
  }
`

const Input = styled.input`
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--primary);
  background: transparent;

  &::placeholder {
    color: rgba(28, 32, 36, 0.5);
  }
`

const Clear = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: rgba(28, 32, 36, 0.55);
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(28, 32, 36, 0.06);
  }
`

const SearchIcon = () => {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m21 21-4.35-4.35"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export const Search = ({
  value,
  onChange,
  placeholder = 'Search for projects',
}: SearchProps) => {
  return (
    <Wrap>
      <Icon>
        <SearchIcon />
      </Icon>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value ? <Clear onClick={() => onChange('')}>✕</Clear> : null}
    </Wrap>
  )
}
