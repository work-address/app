import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'

import { Button, Text } from '@/shared'

type Props = {
  onCreate: () => void
  onImport: () => void
}

/** The first screen for a browser with no wallet yet: make one, or bring one. */
export const ChooseStep = ({ onCreate, onImport }: Props) => {
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="4">
      <Text size="3" color="gray">
        {t('localWallet.choose.intro')}
      </Text>
      <Flex direction="column" gap="2">
        <Button size="l" stretch onClick={onCreate}>
          {t('localWallet.choose.create')}
        </Button>
        <Button
          size="l"
          stretch
          variant="outline"
          color="neutral"
          onClick={onImport}
        >
          {t('localWallet.choose.import')}
        </Button>
      </Flex>
    </Flex>
  )
}
