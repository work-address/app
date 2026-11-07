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
  background: var(--ui-blue);
  color: var(--ui-surface);
  font-size: var(--ui-meta-size);
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: var(--ui-blue);
  }

  &:focus-visible {
    outline: 2px solid var(--ui-blue);
    outline-offset: 2px;
  }
`
