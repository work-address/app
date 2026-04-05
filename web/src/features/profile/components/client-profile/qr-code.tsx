import { Flex } from '@radix-ui/themes'
import styled from 'styled-components'

import QrCodeExample from './assets/qr-code-example.png'

import { Button, Card } from '@/features/shared'

type QrCodeProps = {
  gridArea?: string
}

export const QrCode = ({ gridArea }: QrCodeProps) => (
  <StyledCard style={{ gridArea: gridArea }} shadow={false}>
    <Flex
      direction={'column'}
      gap={'3'}
      align={'center'}
      style={{ height: '100%' }}
    >
      <QrCodeImage src={QrCodeExample} alt={'qr-code'} />

      <Button width={'146px'} themeVariant={'primary'} size={'3'}>
        Share QR-code
      </Button>
    </Flex>
  </StyledCard>
)

const QrCodeImage = styled.img`
  width: 180px;
  height: 180px;
`

const StyledCard = styled(Card)`
  padding: 33px;
  height: 100%;
`
