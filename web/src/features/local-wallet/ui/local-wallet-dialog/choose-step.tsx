import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Prompt, TextAction } from './styles'

import { Button } from '@/shared'

type Props = {
  onCreate: () => void
  onImport: () => void
}

/**
 * The first screen for a browser with no wallet yet: make one, or bring one.
 * Whatever holds it introduces the wallet, since a dialog and the sign-in page
 * do that in their own words.
 */
export const ChooseStep = ({ onCreate, onImport }: Props) => {
  const { t } = useTranslation()

  return (
    <Root>
      <Button
        size="l"
        stretch
        variant="outline"
        color="neutral"
        onClick={onCreate}
      >
        {t('localWallet.choose.create')}
      </Button>
      <Prompt>
        {t('localWallet.choose.importPrompt')}{' '}
        <TextAction type="button" onClick={onImport}>
          {t('localWallet.choose.import')}
        </TextAction>
      </Prompt>
    </Root>
  )
}

const Root = styled.div`
  display: grid;
  gap: var(--ui-space-3);
`
