import { EyeOpenIcon } from '@radix-ui/react-icons'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { $localWallet } from '../model'

import { LocalWalletExportDialog } from './local-wallet-export-dialog'

import { Button, normalizeAddress, type ButtonProps } from '@/shared'

type Props = {
  /**
   * The account the button sits beside. The key is only offered where it
   * belongs: on the profile of the wallet this browser holds, not on someone
   * else's page and not on an account signed in through a wallet app.
   */
  address?: string | null
} & Pick<ButtonProps, 'size' | 'stretch' | 'variant' | 'color'>

/** "Reveal private key": opens the password-gated key dialog. */
export const LocalWalletRevealButton = ({
  address,
  size = 'l',
  stretch,
  variant = 'outline',
  color = 'neutral',
}: Props) => {
  const { t } = useTranslation()
  const wallet = useUnit($localWallet)
  const [open, setOpen] = useState(false)

  if (
    !wallet ||
    !address ||
    normalizeAddress(address) !== normalizeAddress(wallet.address)
  ) {
    return null
  }

  return (
    <>
      <Button
        size={size}
        stretch={stretch}
        variant={variant}
        color={color}
        iconLeft={<EyeOpenIcon />}
        onClick={() => setOpen(true)}
      >
        {t('localWallet.reveal.button')}
      </Button>
      <LocalWalletExportDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
