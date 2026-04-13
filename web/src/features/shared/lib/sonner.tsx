import i18n from 'i18next'
import { toast } from 'sonner'
import styled, { createGlobalStyle } from 'styled-components'

import type { ReactNode } from 'react'
import type { ToasterProps } from 'sonner'

import { InfoIcon } from '@/features/shared'

type ToastProps = {
  title?: ReactNode
  message: ReactNode
  position?: ToasterProps['position']
  duration?: number
  closeButton?: boolean
  icon?: () => ReactNode
}

const showToast = (
  type: 'error' | 'warning' | 'info' | 'success',
  { message, title, position, duration, closeButton, icon: Icon }: ToastProps,
) => {
  toast[type](
    <ToastWrapper>
      {title && <p className="toast-title">{title}</p>}
      <p className="toast-message">{message}</p>
    </ToastWrapper>,
    {
      duration,
      className: `${type}-toast sonner-toast`,
      position,
      icon: Icon ? <Icon /> : <InfoIcon />,
      closeButton,
    },
  )
}

export const showErrorToast = (props: ToastProps) => showToast('error', props)

export const showWarningToast = (props: ToastProps) =>
  showToast('warning', props)

export const showInfoToast = (props: ToastProps) => showToast('info', props)

const ToastWrapper = styled.div``

const baseToastStyle = (bg: string, border: string, color: string) => `
  &[data-sonner-toast][data-styled=true] {
    background: ${bg};
    border: 1px solid ${border};

    [data-icon] {
      color: ${color};
    }

    .toast-title {
      color: ${color};
    }

    .toast-message {
      color: ${color};
    }
  }
`

export const ToastStyle = createGlobalStyle`
  .sonner-toast {
    &[data-sonner-toast][data-styled=true] {
      padding: 16px;
      justify-items: start;
      align-items: start;
      font-size: 16px;
      /*
      Тень из макета работает некорректно.
      box-shadow: 0 2px 3px -2px var(--ds-neutral-alpha-3)
      0px 3px 12px -4px var(--overlays-black-alpha-2)
      0px 4px 16px -8px var(--overlays-black-alpha-2);
      */

      [data-close-button] {
        position: absolute;
        top: 40%;
        left: initial;
        bottom: 50%;
        right: var(--space-2);
        transform: translateY(-50%);
        background: transparent;
        font-size: var(--font-size-4);

        svg {
          width: 18px;
          height: 18px;
        }
      }
    }

    [data-icon] {
      padding-top: 6px;
      margin-right: 12px;
    }

    .toast-title {
      margin-bottom: 4px;
      font-weight: 500;
    }

    .toast-message {
      font-weight: 400;
    }
  }

  .error-toast {
    ${baseToastStyle(
      'rgba(255, 247, 247, 1)',
      'var(--error-alpha-6)',
      'var(--error-11)',
    )}
  }

  .warning-toast {
    ${baseToastStyle(
      'rgba(255, 252, 242, 1)',
      'var(--warning-alpha-6)',
      'var(--warning-11)',
    )}
  }

  .info-toast {
    ${baseToastStyle('var(--ds-accent-3)', 'var(--ds-accent-alpha-6)', '#000')}
  }
`
