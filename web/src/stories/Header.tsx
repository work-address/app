import type { HeaderProps as Work AddressHeaderProps } from '@/widgets'

import { Header as Work AddressHeader } from '@/widgets'
import '../i18n/i18n'
import '@/app/app.css'

export interface HeaderProps extends Work AddressHeaderProps {}

export const Header = (props: HeaderProps) => <Work AddressHeader {...props} />
