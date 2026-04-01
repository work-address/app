import { toast } from 'sonner'
import { createGlobalStyle } from 'styled-components'

import type { ReactNode } from 'react'
import type { ToasterProps } from 'sonner'

import ErrorIcon from '@/assets/info-icon.svg'

type ErrorToastProps = {
  title: ReactNode
  message: ReactNode
  position?: ToasterProps['position']
  duration?: number
}

export const showErrorToast = ({
  message,
  title,
  position,
  duration,
}: ErrorToastProps) => {
  toast.error(
    <div>
      <p className={'toast-title'}>{title}</p>
      <p className={'toast-message'}>{message}</p>
    </div>,
    {
      duration,
      className: 'error-toast',
      position,
      icon: <img src={ErrorIcon} alt={'Error'} />,
    },
  )
}

// TODO: перенести часть стилей в общий вариант
export const ErrorToastStyle = createGlobalStyle`
  .error-toast {
    &[data-sonner-toast][data-styled=true] {
      padding: 16px;
      justify-items: start;
      align-items: start;
      background: rgba(255, 247, 247, 1);
      border: 1px solid var(--error-alpha-6);
      font-size: 16px;
      box-shadow: 0 2px 3px -2px var(--neutral-alpha-3) 
      0px 3px 12px -4px rgba(0, 0, 0, 0.1)
      0px 4px 16px -8px rgba(0, 0, 0, 0.1);
        
      [data-icon] {
        padding-top: 6px;
        margin-right: 12px;
      }
    }
      
    .toast-title, .toast-message {
      color: var(--error-11);
    }
    
    .toast-title {
      margin-bottom: 4px;
      font-weight: 500;
    }
      
    .toast-message {
      font-weight: 400;
    }
  }
`
