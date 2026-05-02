export const copyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
  }

  return new Promise((resolve, reject) => {
    const textArea = document.createElement('textarea')

    textArea.value = text

    textArea.style.cssText = 'position:fixed;left:50%;top:50%;opacity:0;'

    document.body.appendChild(textArea)

    textArea.focus()
    textArea.select()

    document.execCommand('copy')
      ? resolve()
      : reject(new Error('execCommand failed'))

    document.body.removeChild(textArea)
  })
}
