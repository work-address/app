import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Grid, Separator } from '@radix-ui/themes'
import styled from 'styled-components'

import { InvoiceCard } from './styled'

import { Text } from '@/features/shared'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
})
const numberFormatter = new Intl.NumberFormat('ru-RU')

const infoFields = {
  'Issue date': {
    value: dateFormatter.format(new Date()),
  },
  'Time total': { value: '4 hr 10 min', desc: 'Time total description' },
  'Time active': { value: '2 hr 10 min', desc: 'Time active description' },
  Keyboard: {
    value: numberFormatter.format(4983),
    desc: 'Keyboard description',
  },
  Mouse: { value: numberFormatter.format(1834), desc: 'Mouse description' },
  'Mouse Distance': {
    value: numberFormatter.format(2_385_910),
    desc: 'Mouse distance description',
  },
}

export const TotalAmount = () => {
  return (
    <InvoiceCard shadow={false}>
      <Flex gap={'3'} direction={'column'}>
        <TotalAmountFlex
          justify={'center'}
          align={'center'}
          direction={'column'}
        >
          <Text size={'4'} color={'gray'}>
            Total Amount
          </Text>
          <Text size={'8'} weight={'medium'} themeVariant={'primary'}>
            80.5 USD
          </Text>
        </TotalAmountFlex>

        <Separator size={'4'} />

        <MetricsGrid
          columns={{ initial: '137px 1fr' }}
          gap={{ initial: '4' }}
          align={'end'}
        >
          {Object.entries(infoFields).map(([key, field]) => (
            <>
              <Flex align={'center'} gap={'1'}>
                <Text size={'3'} color={'gray'}>
                  {key}
                </Text>

                {'desc' in field && <StyledQuestionMarkCircledIcon />}
              </Flex>

              <Text weight={'medium'}>{field.value}</Text>
            </>
          ))}
        </MetricsGrid>

        <Separator size={'4'} />

        <Flex justify={'center'}>
          <QrCodeImage src={'/img/photo/qr-code-example.svg'} />
        </Flex>

        <Text color={'gray'} weight={'regular'} align={'center'}>
          Scan QR code and pay in USDT
        </Text>
      </Flex>
    </InvoiceCard>
  )
}

const TotalAmountFlex = styled(Flex)`
  padding: var(--space-4);
`

const MetricsGrid = styled(Grid)`
  padding: var(--space-2) 0;
`

const QrCodeImage = styled.img`
  width: 194px;
`

const StyledQuestionMarkCircledIcon = styled(QuestionMarkCircledIcon)`
  height: 16px;
  width: 16px;
`
