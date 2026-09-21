import { Flex, Skeleton } from '@radix-ui/themes'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Text } from '@/shared'

/**
 * The invoice's reference as a QR code, with the reference printed beneath
 * it.
 *
 * It carries the invoice id and nothing else, and says so. It used to be
 * captioned "scan and pay", but a wallet that scans an id has no payee, no
 * amount and no chain to pay on: the caption promised a payment the code
 * could not start. A payment code (EIP-681) needs a payout address the
 * invoice can vouch for, which does not exist yet, so until then the code is
 * what it honestly is - a reference, the same one the printed id spells out.
 */
export const InvoiceReferenceCode = ({
  invoiceId,
  loading,
}: {
  invoiceId?: string | null
  loading: boolean
}) => {
  const { t } = useTranslation()

  return (
    <Root direction={'column'} align={'center'} gap={'2'}>
      {loading ? (
        <Skeleton width="194px" height="194px" />
      ) : (
        <QRCodeSVG
          value={invoiceId || ''}
          size={194}
          bgColor="transparent"
          fgColor="var(--ds-accent-9)"
          marginSize={1}
          title={t('invoice.reference.label')}
        />
      )}
      <Text weight={'medium'} align={'center'}>
        {t('invoice.reference.label')}
      </Text>
      {loading ? (
        <Skeleton width="194px" height="16px" />
      ) : (
        <Reference size={'1'} color={'gray'} align={'center'}>
          {invoiceId}
        </Reference>
      )}
      <Hint size={'1'} color={'gray'} align={'center'}>
        {t('invoice.reference.hint')}
      </Hint>
    </Root>
  )
}

/* Paper is narrower than a desktop screen: in print the code shrinks, so
   the facts printed beside it keep their width. */
const Root = styled(Flex)`
  @media print {
    svg {
      width: 120px;
      height: 120px;
    }
  }
`

/* An id has no break opportunities of its own; without this a long one
   pushes the page wider than the phone - or the paper. */
const Reference = styled(Text)`
  max-width: 194px;
  overflow-wrap: anywhere;
  font-family: var(--code-font-family, monospace);

  @media print {
    max-width: 120px;
  }
`

const Hint = styled(Text)`
  max-width: 194px;

  @media print {
    max-width: 120px;
  }
`
