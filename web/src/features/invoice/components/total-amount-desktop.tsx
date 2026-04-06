import { Flex, Grid, Separator } from '@radix-ui/themes'

import { infoFields } from './constants.ts'
import { QrCodeImage } from './styled'

import { Text, Button } from '@/features/shared'

export const TotalAmountDesktop = () => {
  return (
    <Grid gap={'5'} justify={'between'} columns={'auto 1fr auto'}>
      <Flex direction={'column'} gap={'3'} align={'center'}>
        <QrCodeImage src={'/img/photo/qr-code-example.svg'} />

        <Text color={'gray'} align={'center'}>
          Scan QR code <br /> and pay in USDT
        </Text>
      </Flex>

      <Flex gap={'3'} direction={'column'} justify={'between'}>
        <Flex align={'end'} gap={'3'}>
          <Text size={'6'} weight={'medium'}>
            Project 1
          </Text>

          <Text>for</Text>

          <Text themeVariant={'primary'} weight={'medium'} size={'4'}>
            80.5 USDT
          </Text>
        </Flex>

        <Text color={'gray'}>
          6a5b9c7e2f3d4e5f6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9
        </Text>

        <Separator size={'4'} />

        <Text size={'4'} weight={'medium'}>
          Summary
        </Text>

        <Grid columns={'1fr 1fr'} gap={'5'} flow={'column'} rows={'3'}>
          {Object.entries(infoFields).map(([key, field]) => (
            <Grid key={key} gap={'2'} columns={'120px 204px'}>
              <Text size={'3'} color={'gray'}>
                {key}
              </Text>
              <Text size={'3'} weight={'medium'}>
                {field.value}
              </Text>
            </Grid>
          ))}
        </Grid>
      </Flex>

      <Flex gap={'3'}>
        <Button themeVariant={'secondary'}>Share</Button>
        <Button themeVariant={'primary'}>Save PDF</Button>
      </Flex>
    </Grid>
  )
}
