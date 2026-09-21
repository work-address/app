import { Flex } from '@radix-ui/themes'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Text } from '@/shared'

/**
 * What the invoice is billing for, in the words the parties agreed.
 *
 * An hourly invoice answers that with its line table - the entries, their
 * spans and their notes - so it carries no description and this renders
 * nothing. A fixed-price invoice has no lines at all, so without this the
 * page and the PDF would show a sum with nothing behind it.
 *
 * Prose, so it wraps rather than truncates: this goes to paper, where a
 * clipped description is a clipped record.
 */
export const InvoiceDescription = ({
  description,
}: {
  description?: string | null
}) => {
  const { t } = useTranslation()

  if (!description) {
    return null
  }

  return (
    <Flex direction={'column'} gap={'1'}>
      <Text size={'3'} color={'gray'}>
        {t('invoice.billingFor')}
      </Text>
      <Description size={'3'}>{description}</Description>
    </Flex>
  )
}

const Description = styled(Text)`
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`
