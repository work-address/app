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
}

const showToast = (
  type: 'error' | 'warning' | 'info',
  { message, title, position, duration }: ToastProps,
) => {
  toast[type](
    <ToastWrapper>
      {title && <p className="toast-title">{title}</p>}
      <p className="toast-message">{message}</p>
    </ToastWrapper>,
    {
      duration,
      className: `${type}-toast`,
      position,
      icon: <img src={InfoIcon} alt={type} />,
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
    padding: 16px;
    justify-items: start;
    align-items: start;
    background: ${bg};
    border: 1px solid ${border};
    font-size: 16px;
    box-shadow:
      0 2px 3px -2px var(--ds-neutral-alpha-3),
      0px 3px 12px -4px rgba(0, 0, 0, 0.1),
      0px 4px 16px -8px rgba(0, 0, 0, 0.1);

    [data-icon] {
      padding-top: 6px;
      margin-right: 12px;
    }

    .toast-title {
      margin-bottom: 4px;
      font-weight: 500;
      color: ${color};
    }

    .toast-message {
      font-weight: 400;
      color: ${color};
    }
  }
`

export const ToastStyle = createGlobalStyle`
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
    ${baseToastStyle(
      'rgba(245, 248, 255, 1)',
      'var(--info-alpha-6)',
      'var(--info-11)',
    )}
  }
`
