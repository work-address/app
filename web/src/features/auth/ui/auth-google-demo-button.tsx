import styled from 'styled-components'

type Props = {
  onCredential: (credential: string) => void
}

/**
 * Stands where Google's button goes in demo mode, the size it would be. English
 * only, like the demo panel, and it says what it is.
 */
export const AuthGoogleDemoButton = ({ onCredential }: Props) => (
  <Root type="button" onClick={() => onCredential('demo-credential')}>
    Continue with Google (demo)
  </Root>
)

const Root = styled.button`
  width: 100%;
  max-width: 400px;
  height: 40px;
  border-radius: 4px;
  background: var(--ds-accent-9);
  color: var(--white);
  font-size: var(--font-size-2);
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: var(--ds-accent-11);
  }

  &:focus-visible {
    outline: 2px solid var(--ds-accent-9);
    outline-offset: 2px;
  }
`
