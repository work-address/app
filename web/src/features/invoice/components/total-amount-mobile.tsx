import { QuestionMarkCircledIcon } from '@radix-ui/react-icons'
import { Flex, Separator, Grid } from '@radix-ui/themes'
import { Fragment } from 'react'
import styled from 'styled-components'

import { infoFields } from './constants'
import { QrCodeImage } from './styled'

import { Text } from '@/features/shared'

export const TotalAmountMobile = () => {
  return (
    <Flex gap={'3'} direction={'column'}>
      <Flex justify={'center'} align={'center'} direction={'column'} p={'4'}>
        <Text size={'4'} color={'gray'}>
          Total Amount
        </Text>
        <Text size={'8'} weight={'medium'} themeVariant={'primary'}>
          80.5 USD
        </Text>
      </Flex>

      <Separator size={'4'} />

      <Grid
        columns={{ initial: '137px 1fr' }}
        gap={{ initial: '4' }}
        align={'end'}
        py={'2'}
      >
        {Object.entries(infoFields).map(([key, field]) => (
          <Fragment key={key}>
            <Flex align={'center'} gap={'1'}>
              <Text size={'3'} color={'gray'}>
                {key}
              </Text>

              {'desc' in field && <StyledQuestionMarkCircledIcon />}
            </Flex>

            <Text weight={'medium'}>{field.value}</Text>
          </Fragment>
        ))}
      </Grid>

      <Separator size={'4'} />

      <Flex justify={'center'}>
        <QrCodeImage src={'/img/photo/qr-code-example.svg'} />
      </Flex>

      <Text color={'gray'} weight={'regular'} align={'center'}>
        Scan QR code and pay in USDT
      </Text>
    </Flex>
  )
}

const StyledQuestionMarkCircledIcon = styled(QuestionMarkCircledIcon)`
  height: 16px;
  width: 16px;
`
