import { Grid } from '@radix-ui/themes'
import styled from 'styled-components'

import { Description } from './description.tsx'
import { ProfileInfo } from './profile-info.tsx'
import { QrCode } from './qr-code.tsx'

export const ClientProfile = () => (
  <Wrapper>
    <Grid
      areas={{
        initial: `
        'qrcode profile'
        'description description'
      `,
      }}
      columns={{
        initial: '246px 668px',
      }}
      rows={{
        initial: 'auto auto',
      }}
      gap={{
        initial: '20px',
      }}
      justify={'center'}
    >
      <QrCode gridArea={'qrcode'} />

      <ProfileInfo gridArea={'profile'} />

      <Description gridArea={'description'} />
    </Grid>
  </Wrapper>
)

const Wrapper = styled.div`
  padding: 24px;
`
