import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

type SearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function SearchIcon() {
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

export default function Search({ value, onChange, placeholder }: SearchProps) {
  const { t } = useTranslation()
  const ph = placeholder ?? t('ui.search.placeholderProjects')

  return (
    <Wrap>
      <Icon>
        <SearchIcon />
      </Icon>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
      />
      {value ? (
        <Clear
          onClick={() => onChange('')}
          aria-label={t('ui.search.clear')}
          type="button"
        >
          ✕
        </Clear>
      ) : null}
    </Wrap>
  )
}

const Wrap = styled.div`
  width: 300px;
  height: 40px;
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

  @media (max-width: 768px) {
    width: 100%;
    height: 32px;
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

  @media (max-width: 768px) {
    width: 14px;
    height: 14px;

    & > svg {
      width: 14px;
      height: 14px;
    }
  }
`

const Input = styled.input`
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--ds-primary);
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
