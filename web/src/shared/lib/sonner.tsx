import { Theme } from '@radix-ui/themes'
import { toast } from 'sonner'
import styled, { createGlobalStyle } from 'styled-components'

import { InfoIcon } from '../assets'

import type { ReactNode } from 'react'
import type { ToasterProps } from 'sonner'

type ToastProps = {
  title?: ReactNode
  message: ReactNode
  position?: ToasterProps['position']
  duration?: number
  closeButton?: boolean
  icon?: () => ReactNode
  nowrap?: boolean
}

export const showToast = (
  type: 'error' | 'warning' | 'info' | 'success',
  {
    message,
    title,
    position,
    duration,
    closeButton,
    icon: Icon,
    nowrap,
  }: ToastProps,
) => {
  toast[type](
    <ToastWrapper>
      {title && <p className="toast-title">{title}</p>}
      <p className="toast-message">{message}</p>
    </ToastWrapper>,
    {
      duration,
      className: `${type}-toast sonner-toast ${nowrap ? 'nowrap' : ''}`,
      position,
      icon: Icon ? <Icon /> : <InfoIcon />,
      closeButton,
    },
  )
}

export const SonnerRadixTheme = styled(Theme)`
  position: initial;
  height: initial;
  width: initial;
  min-height: initial;
  background: initial;
`

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
      font-size: var(--font-size-3);
      /*
      box-shadow: 0 2px 3px -2px var(--ds-neutral-alpha-3)
                  0px 3px 12px -4px var(--overlays-black-alpha-2)
                  0px 4px 16px -8px var(--overlays-black-alpha-2);
      */

      /* sonner positions its close button via its own inline/global styles;
         createGlobalStyle can't use the && specificity-doubling trick since
         it isn't scoped to a single generated class, so !important is the
         only way to override the library's own positioning here. */
      [data-close-button] {
        position: absolute;
        top: var(--space-4) !important;
        left: initial !important;
        bottom: 50% !important;
        right: var(--space-2) !important;
        transform: translateY(-50%);
        background: transparent;
        font-size: var(--font-size-4);
        border: none;

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
      'var(--c-fff7f7)',
      'var(--error-alpha-6)',
      'var(--error-11)',
    )}
  }

  .warning-toast {
    ${baseToastStyle(
      'var(--c-fffcf2)',
      'var(--warning-alpha-6)',
      'var(--warning-11)',
    )}
  }

  .info-toast {
    ${baseToastStyle(
      'var(--ds-accent-3)',
      'var(--ds-accent-alpha-6)',
      'var(--c-000000)',
    )}
  }
`
